import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasTranslation, langFromPathname, localePath } from "@/lib/ttc/i18n";
import { legal, primaryNav, services } from "@/lib/ttc/site";
import { isNonContributorRole } from "@/lib/workspace-roles";

// Public routes that don't require authentication
const publicPrefixes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  // Signup finishes here, and by definition the visitor has no session yet —
  // they are holding an emailed token instead. Both were behind the auth wall,
  // so the post-registration link bounced to /login and the flow died.
  // The route handler is the real gate: it demands a valid email-verify token.
  "/onboarding",
  "/api/users/onboarding",
  "/api/auth",
  "/api/my-tasks/calendar-feed",
  "/api/contact",
  // The retired public calculators. Nothing renders here any more — the proxy
  // answers every /resources path with the public 404 (publicNotFoundTarget)
  // before this list is read — but the prefix stays so that, if they return,
  // they are public from day one rather than behind the login wall.
  "/resources",
  "/api/load-gen",
  // Marketing: /services and every /services/<slug> detail page.
  // Safe as a prefix — the authenticated app has no /services route.
  "/services",
  // Spanish mirror of the whole marketing site: /es and /es/<anything>.
  // The trailing slash matters — "/es" alone would also match "/escalate".
  "/es/",
  // Public form submission: /forms/<formId> and its render/submit/track API.
  // The whole point is an external submitter (architect, owner, property
  // manager) with NO account — behind the auth wall the link bounced to
  // /login and the entire flow (submit + receipt email + tracking link)
  // died. Opening the prefix grants no new access: the submit handler gates
  // on form.visibility, the track handler on a signed token, and every
  // INTERNAL verb here (form PATCH/DELETE, submissions, export) still calls
  // getCurrentUserId → 401 and re-checks project access → 403 in-handler.
  // The middleware only stops being a redirect; the handler remains the
  // real gate.
  "/forms/",
  "/api/forms/",
  // Workspace invitation landing: /invite/<token> and its resolve/accept API.
  // The visitor is being invited, so by definition has no session yet — the
  // token in the path is the credential. The accept handler re-validates it
  // on every request (unknown → 404, non-pending → 410, expired → 410) and
  // owns all the branching (create account / sign in / email mismatch). Note
  // /api/invite/ already sat in clientApiPrefixes below, but that is the
  // read-only-role allowlist, a different gate — it never exempted these from
  // the session redirect, which is why the invite flow was unreachable.
  "/invite/",
  "/api/invite/",
];

// TTC public pages (marketing / informational) - no auth required.
//
// Derived from the site config so that adding a page to the marketing nav or
// footer can never leave it stranded behind the login redirect. Anything not
// covered by the nav is listed explicitly below.
//
// NOTE: /projects must stay an EXACT match. The authenticated app owns
// /projects/all, /projects/new and /projects/[id]; only the marketing index
// itself is public.
const publicExactRoutes = Array.from(
  new Set<string>([
    "/",
    "/projects",
    "/about",
    "/contact",
    "/existing-buildings",
    "/logo-styles",
    "/es",
    ...primaryNav.map((item) => item.href),
    ...legal.links.map((link) => link.href),
  ]),
).filter((href) => href !== "/projects/all" && href !== "/projects/new");

/** Exported for tests — pure string matching, no request needed. */
export function isPublicRoute(pathname: string): boolean {
  if (publicExactRoutes.includes(pathname)) {
    return true;
  }
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

/* ── Routes that may arrive without a session, but are NOT public ───────────
   A public prefix returns at isPublicRoute() below, which is UPSTREAM of the
   non-contributor role gate — so listing a route there quietly exempts it from
   isApiForbiddenForRole too. These routes only need the missing-session 401
   waived; every other rule still applies to them.

   /api/blob/upload is here because it answers two callers. The token request
   carries the caller's session and is authorised in-handler (getCurrentUserId
   plus verifyTaskAccess with requireWrite on the target task), so it must stay
   subject to the role gate: minting an upload token is a WRITE credential for
   the firm's blob store, and a read-only role has no business holding one.
   The only exception is the public-form kinds, which a signed-out stranger may
   mint anyway (see isRoleAgnosticUploadRequest). The upload-completed callback comes from Vercel Blob server-to-server with no
   cookie at all; handleUpload authenticates it by verifying x-vercel-signature
   against the store token and rejects it outright when that is missing or
   wrong. It is the callback, and only the callback, that the blanket 401 was
   killing.

   /api/cron/due-dates is Vercel Cron: it arrives with no cookie, only
   `Authorization: Bearer <CRON_SECRET>` (which getToken tries, and fails, to
   decode as a session). The handler authorises it with a timing-safe compare
   of that secret and fails closed when CRON_SECRET is unset, so waiving the
   401 here hands nothing to an anonymous caller. Being in this list also makes
   it host-neutral (see isHostNeutral): Vercel Cron does not follow redirects.

   EXACT match, not a prefix: /api/blob/upload-avatar and anything else that
   later lands under /api/blob/ (or /api/cron/) must not inherit this by
   accident. */
const sessionOptionalApiExact = ["/api/blob/upload", "/api/cron/due-dates"];

/** Exported for tests — pure string matching, no request needed. */
export function isSessionOptionalApi(pathname: string): boolean {
  return sessionOptionalApiExact.includes(pathname);
}

/* ── The non-contributor API allowlist ─────────────────────────────────────
   The entire server surface the (client) portal calls. Everything else under
   /api/ is internal, and a read-only workspace role — see
   NON_CONTRIBUTOR_ROLES in @/lib/workspace-roles, currently {GUEST, CLIENT} —
   is denied here, at the edge.

   A non-contributor now has NO UI at all: the client portal and the
   password-less share link were both removed, so what remains is pure
   self-service — the three /api/users/* routes plus /api/invite/ (accepting an
   invitation addressed to their own email). Everything else under /api/ is
   denied at the edge.

   WHY THIS EXISTS: the role gate below has always been PAGE-only, while
   config.matcher runs middleware over /api/* too — and no API handler checks
   WorkspaceRole. requireWorkspaceContributor (src/lib/auth-guards.ts:417) is
   the guard for this and is wired into 4 of 173 route files. So a signed-in
   non-contributor could call the internal JSON API directly and get 2xx,
   including POST /api/projects, which asserts only that a WorkspaceMember row
   EXISTS and then writes ownerId=self — the first link in a chain that ends
   with them minting a full internal MEMBER account on an email they control.

   ALLOWLIST, NOT BLOCKLIST: internal routes are added constantly and a
   blocklist silently exposes each new one. The self-service surface is tiny
   and stable.

   /api/auth/* is deliberately absent: it is a publicPrefix and returns at
   isPublicRoute() before this gate ever runs. */
const clientApiPrefixes = [
  // Accepting an invitation addressed to THEIR OWN email; the handler returns
  // 409 for any other address. This does NOT make a pre-existing rogue MEMBER
  // invitation safe — those must be revoked in the database.
  "/api/invite/",
];
const clientApiExact = [
  "/api/users/profile",
  "/api/users/preferences",
  "/api/users/password",
];

/** True when `pathname` belongs to the client portal's own API surface.
 *  Exported so the allowlist is unit-testable without a DB. */
export function isClientApi(pathname: string): boolean {
  return (
    clientApiExact.includes(pathname) ||
    clientApiPrefixes.some((p) => pathname.startsWith(p))
  );
}

/**
 * The whole /api/ role gate, as one pure decision. True ⇒ answer 403.
 *
 * Exported so the rule is unit-testable role-by-role without a DB, a request
 * or a JWT; `proxy()` below does nothing with the result but return the 403,
 * so testing this function tests the gate.
 *
 * ── THE SET, NOT AN EQUALITY TEST ─────────────────────────────────────────
 * This shipped as `userRole === "CLIENT"`, which left GUEST — the codebase's
 * OTHER read-only role, sitting right next to CLIENT in NON_CONTRIBUTOR_ROLES
 * since before this gate existed — running the full escalation chain described
 * above. A GUEST is assignable through shipped admin UI today (the role picker
 * in components/settings/workspace-section.tsx and app/(dashboard)/people, via
 * api/workspace/invitations:54 and api/workspace/members:64), so that was a
 * live hole, not a theoretical one.
 *
 * The membership test and NON_CONTRIBUTOR_ROLES must therefore name the SAME
 * roles, and the only way to guarantee that is to read the same set — hence
 * the import rather than a second literal here. See @/lib/workspace-roles.
 *
 * Contributors (OWNER / ADMIN / MEMBER / WORKER) and users with no role yet
 * (null, mid-onboarding) fall through untouched.
 *
 * SCOPE: /api/ only. Neither role has any UI left to be redirected TO — the
 * client portal and the share link are both gone — so the page tier is covered
 * instead by resolveProjectAccess, which refuses to count a non-contributor
 * membership as "in this workspace" (see @/lib/project-access). That is what
 * keeps the server-rendered project page, budget and all, away from them.
 */
export function isApiForbiddenForRole(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (!isNonContributorRole(role)) return false;
  if (!pathname.startsWith("/api/")) return false;
  return !isClientApi(pathname);
}

/* Upload-token kinds that a stranger with no session may already mint (a
   public intake form, a tracking reply). The handler authorises them by the
   form's own rules or the tracking token, never by workspace role, so denying
   them to a signed-in GUEST/CLIENT would only refuse someone what the same
   person could do signed out. */
const ROLE_AGNOSTIC_UPLOAD_KINDS = new Set(["form-attachment", "tracking-reply"]);

/**
 * True when a /api/blob/upload body asks for a token of a role-agnostic kind.
 * Pure over the parsed JSON body; exported for tests. The handler parses the
 * exact same body, so what is admitted here is what it authorises there. Any
 * other shape (including the signed completion callback) answers false and
 * stays under the role gate.
 */
export function isRoleAgnosticUploadRequest(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as { type?: unknown; payload?: { clientPayload?: unknown } };
  if (b.type !== "blob.generate-client-token") return false;
  const raw = b.payload?.clientPayload;
  if (typeof raw !== "string") return false;
  try {
    const target = JSON.parse(raw) as { kind?: unknown } | null;
    return (
      !!target &&
      typeof target.kind === "string" &&
      ROLE_AGNOSTIC_UPLOAD_KINDS.has(target.kind)
    );
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC 404 — unknown marketing paths, rendered by the server
   ═══════════════════════════════════════════════════════════════════════════
   The marketing site owns every path under /services, /es and /resources, and
   which of those are real pages is a small closed set known right here: the
   English pages (publicExactRoutes plus /services/<slug> for every slug in
   site.ts) and their Spanish mirrors. Any other path under those prefixes is
   REWRITTEN, with status 404, to the public 404 page of its language:

     /services/nope, /services/<slug>/x, /resources, /resources/*  → PUBLIC_NOT_FOUND
     /es/nope, /es/services/nope, /es/credits (English-only page)  → PUBLIC_NOT_FOUND_ES

   This is decided on EVERY host — localhost and previews included, split on
   or off — so what a visitor sees never depends on how the deployment is
   configured. With the split on, the public host also rewrites any unknown
   non-marketing path to PUBLIC_NOT_FOUND (see the host split below).

   WHY A REWRITE, NOT notFound(). Next 16 answers a notFound() thrown during
   SSR with its error shell: <html id="__next_error__"> and an empty <body>
   that the client fills in only after the whole JS bundle has run — no
   header, hero or copy without JavaScript, no stylesheet link in the HTML,
   and a <head> resolved from the layouts instead of the page. The rewrite
   targets are ordinary pages that render NotFoundView; the server completes
   them, and the status rides on the rewrite itself
   (NextResponse.rewrite(url, { status: 404 })). A direct request for either
   target gets the same 404, never a 200.

   The (public) catch-alls (es/[...rest], services/[slug]/[...rest],
   resources/[[...rest]]) and the not-found boundaries remain as a fallback for
   a path this list somehow misses. proxy.test.ts diffs the list against the
   (public) page files, so a page added without updating it fails the suite
   instead of 404ing in production.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The internal (public) routes unknown paths are rewritten to, one per
 *  language. Never linked, never in the sitemap. Each renders NotFoundView;
 *  the 404 status and the address the visitor typed both survive the rewrite. */
export const PUBLIC_NOT_FOUND = "/public-not-found";
export const PUBLIC_NOT_FOUND_ES = "/es/public-not-found";

/** Every English marketing page, exact. "/es" is left out: it is the Spanish
 *  home, and it is listed below with the rest of the mirror. */
export const EN_PUBLIC_PAGES: readonly string[] = [
  ...publicExactRoutes.filter((href) => href !== "/es"),
  ...services.map((s) => `/services/${s.slug}`),
];

/** The Spanish mirror: every English page that has a Spanish twin (all but
 *  i18n's English-only pages, /credits and /logo-styles), under /es. */
export const ES_PUBLIC_PAGES: readonly string[] = EN_PUBLIC_PAGES.filter(
  (href) => hasTranslation(href),
).map((href) => localePath(href, "es"));

const knownPublicPages = new Set<string>([...EN_PUBLIC_PAGES, ...ES_PUBLIC_PAGES]);

/** Prefixes whose every path is a marketing PAGE (unlike /api/contact). The
 *  app has no route under any of them. */
const marketingPagePrefixes = ["/services", "/es", "/resources"];

/**
 * Where an unknown public path is rewritten to, or null to carry on. A pure
 * function of the path — no host involved — exported for tests.
 *
 * It only ever answers for the two 404 targets themselves and for paths under
 * marketingPagePrefixes, so /api/*, /_next, /ttc/* and every file in public/
 * (none of which live under those prefixes; proxy.test.ts checks public/)
 * pass through untouched.
 */
/** The path as Next's router will match it: each segment percent-decoded.
 *  null when a segment is malformed or decodes to a "/" (%2F) — neither can
 *  be one of our pages, so the raw path (never in the set) is used instead. */
function decodedPath(pathname: string): string | null {
  const out: string[] = [];
  for (const seg of pathname.split("/")) {
    let d: string;
    try {
      d = decodeURIComponent(seg);
    } catch {
      return null;
    }
    if (d.includes("/")) return null;
    out.push(d);
  }
  return out.join("/");
}

export function publicNotFoundTarget(pathname: string): string | null {
  // The proxy sees the path still percent-encoded, but the router decodes it
  // before matching a page: /services/peer%2Dreview IS the peer-review page,
  // so the lookup must use the decoded form or a real page answers 404.
  const decoded = decodedPath(pathname) ?? pathname;
  // Next already 308s a trailing slash away before the proxy runs; tolerate
  // one anyway, so this answer never depends on that setting.
  const path = decoded.length > 1 ? decoded.replace(/\/+$/, "") || "/" : decoded;
  if (path === PUBLIC_NOT_FOUND || path === PUBLIC_NOT_FOUND_ES) return path;
  if (!marketingPagePrefixes.some((p) => path === p || path.startsWith(`${p}/`))) {
    return null;
  }
  if (knownPublicPages.has(path)) return null;
  return langFromPathname(path) === "es" ? PUBLIC_NOT_FOUND_ES : PUBLIC_NOT_FOUND;
}

/** A 404 the server renders in full: the target page, the 404 status, and
 *  the visitor's own address left in the bar. */
function rewriteToNotFound(request: NextRequest, target: string): NextResponse {
  return NextResponse.rewrite(new URL(target, request.url), { status: 404 });
}

/**
 * Maintenance mode — when true, every request from the public web
 * lands on /maintenance. Localhost (`next dev`) is NEVER affected
 * because the trip-wire below only fires on Vercel-hosted environments.
 *
 * To take the site live again, flip MAINTENANCE_MODE to `false` and
 * push. (Alternative: set MAINTENANCE_MODE_OFF=true in Vercel project
 * env vars to override without a code change.)
 */
const MAINTENANCE_MODE = false;

/* ═══════════════════════════════════════════════════════════════════════════
   HOST SPLIT — marketing on the apex, the authenticated app on its own host
   ═══════════════════════════════════════════════════════════════════════════
   One deployment serves both. Which half a request gets is decided here by
   Host, not by path, so the public site and the app stop sharing an origin —
   an XSS on the marketing site can then no longer read the app's DOM or
   storage. Cookies are already host-scoped (nothing sets `domain`), so the
   session does not follow across.

   INERT BY DEFAULT. Both vars must be set before anything is redirected, so
   this can ship before DNS moves and be switched on — or off — from the Vercel
   dashboard without a code change. (The one exception is www, below: it needs
   PUBLIC_HOST only.)

     APP_HOST=app.ttcivilstructural.com
     PUBLIC_HOST=ttcivilstructural.com

   Three deliberate safety properties:

   1. It only acts when the request's Host is one of the two configured hosts.
      `vercel pull` writes project env vars into `.env.local`, which is exactly
      how MAINTENANCE_MODE once redirected every local request (see above). If
      APP_HOST leaks into a local `.env.local`, `localhost:3002` matches
      neither host and falls straight through. Preview URLs on *.vercel.app are
      immune for the same reason.

   2. The redirects are 307, not 308. This is a config flip that may well be
      reverted mid-rollout, and a browser that has cached a permanent redirect
      to the wrong host is a genuinely painful thing to undo. Nothing on the
      app host is indexed, so there is no SEO argument for 308 here.
      The exception is www.<PUBLIC_HOST> → PUBLIC_HOST: that is not part of
      the reversible split — the apex is canonical either way — so it is a
      308, and it fires whenever PUBLIC_HOST is set. www used to serve a full
      duplicate of the site with a 200.

   3. The public host fails CLOSED. Marketing is an exact, known set; a path
      outside it is sent to the app host only when its first segment is one
      the app actually has (APP_SEGMENTS). Anything else — a typo, an old
      guess like /about-us, /wp-login.php — is rewritten, with status 404, to
      the public 404 (PUBLIC_NOT_FOUND) instead of bouncing a client through
      the staff login. An app route someone forgets to list therefore 404s on
      the apex; it can never render there. proxy.test.ts reads src/app and
      fails when the list and the route folders disagree. Unknown paths UNDER
      a marketing prefix (/services/nope, /es/nope) are not this rule's job:
      publicNotFoundTarget handles them, after the split, on every host.
   ═══════════════════════════════════════════════════════════════════════════ */

const APP_HOST = (process.env.APP_HOST ?? "").trim().toLowerCase();
const PUBLIC_HOST = (process.env.PUBLIC_HOST ?? "").trim().toLowerCase();

/** Paths that belong to the marketing site. Everything else is the app.
 *
 *  Marketing is the CLOSED set on purpose. The app grows new routes constantly
 *  and an app-route allowlist would silently leak each new one onto the public
 *  host; the marketing surface is small, known, and already enumerated above.
 *  Note `publicExactRoutes` is exact-match, which is what keeps the marketing
 *  `/projects` index separate from the app's `/projects/all`. */
const marketingPrefixes = ["/services", "/es", "/resources", "/api/contact", "/api/load-gen"];

/** Exported for tests — pure string matching. */
export function isMarketingRoute(pathname: string): boolean {
  if (publicExactRoutes.includes(pathname)) return true;
  return marketingPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * First URL segments that belong to the APP. On the public host a non-marketing
 * path is sent to the app host only when it starts with one of these; every
 * other path gets the public 404.
 *
 * This is NOT an allowlist of what may render on the apex — marketing stays
 * the closed set above, and nothing here makes a route public. It only decides
 * where a stray request is pointed: a missing entry fails closed (the apex
 * answers 404), it never leaks the route onto the public host.
 *
 * Mirrors the top-level folders of src/app, route groups flattened, (public)
 * excluded. proxy.test.ts diffs the two and fails on any drift, so adding an
 * app route folder without adding it here fails the suite.
 *
 * `projects` is shared on purpose: the bare /projects is the marketing index
 * (publicExactRoutes, matched first), /projects/<anything> is the app's.
 */
export const APP_SEGMENTS: readonly string[] = [
  // (auth)
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "verify-email",
  // Top-level app folders outside any group.
  "api",
  "forms",
  "invite",
  "maintenance",
  "onboarding",
  // (dashboard) — and (fullpage), whose only folder is teams.
  "goals",
  "home",
  "inbox",
  "knowledge",
  "my-tasks",
  "people",
  "portfolios",
  "profile",
  "projects",
  "reporting",
  "settings",
  "tasks",
  "teams",
  "templates",
  // (portal)
  "portal",
];

function isAppSegment(pathname: string): boolean {
  return APP_SEGMENTS.includes(pathname.split("/")[1] ?? "");
}

/** Served identically on both hosts — redirecting these would break asset
 *  loading, health checks and crawlers for no benefit. */
function isHostNeutral(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/ttc/") ||
    pathname.startsWith("/api/health") ||
    // NextAuth's own endpoints must answer on whichever host asked.
    //
    // SessionProvider is mounted in the ROOT layout, so every marketing page
    // polls /api/auth/session too, and one of the public components
    // (ttc/language-provider) calls useSession outright. Redirecting that poll
    // to the app host sent a credentialed same-origin fetch across origins:
    // the app host's cookies are not sent from the apex, and the browser will
    // not let the marketing page read the reply. Every public page load was
    // firing a session request that could only fail.
    //
    // Answering in place is also the CORRECT answer. Cookies are host-scoped,
    // so the apex genuinely has no session and returns null — which is the
    // truth for an anonymous visitor. Nobody can sign in here either: /login
    // and every app route still redirect to the app host, and NEXTAUTH_URL
    // points there, so callbacks land there. The isolation this split exists
    // for — the app's DOM and storage living on their own origin — is intact.
    pathname.startsWith("/api/auth") ||
    // The blob upload-completed callback must answer wherever Vercel Blob
    // sends it. The SDK does not derive that URL from the request Host: with
    // no explicit callbackUrl it uses VERCEL_PROJECT_PRODUCTION_URL, which
    // resolves to the shortest production domain — the apex, i.e. PUBLIC_HOST.
    // Redirecting it would answer the callback with a 307 to another host and
    // rely on the blob service replaying x-vercel-signature across it, so the
    // cleanup guard would quietly stop running the day the split is switched
    // on. Answering in place is safe: that route authenticates both of its
    // callers itself and holds no session.
    isSessionOptionalApi(pathname) ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/favicon.ico"
  );
}

/**
 * Where an app-host request for a marketing-only path should land instead.
 *
 * "/" and "/projects" are marketing pages, so on the app host they used to be
 * 307'd to the apex: typing the app's own address, or an in-app link to
 * "/projects", landed staff on the public site. On the app host they mean the
 * app's home and the project list. Exported for tests.
 */
export function appHostLanding(pathname: string): string | null {
  if (pathname === "/") return "/home";
  if (pathname === "/projects") return "/projects/all";
  return null;
}

/** What the host split does with a request: nothing (null), a redirect, or a
 *  rewrite to the public 404 (always with status 404). */
export type HostSplitAction =
  | { kind: "redirect"; location: string; status: 307 | 308 }
  | { kind: "rewrite"; pathname: string; status: 404 };

/**
 * The whole host-split decision, as a pure function of the Host header and
 * the path — so every branch is unit-testable without a request. `location`
 * is either absolute (another host) or a path on the SAME host; the caller
 * resolves it against the request URL. `hosts` defaults to the env config and
 * exists only so tests can supply their own.
 */
export function hostSplitAction(
  hostHeader: string,
  pathname: string,
  search: string,
  hosts: { app: string; public: string } = { app: APP_HOST, public: PUBLIC_HOST },
): HostSplitAction | null {
  const host = hostHeader.toLowerCase().split(":")[0];

  // www is never canonical. Checked before the both-vars guard below: it only
  // needs PUBLIC_HOST, and it applies to every path, assets included — no page
  // is ever rendered on www, so nothing there needs answering in place.
  if (hosts.public && host === `www.${hosts.public}`) {
    return {
      kind: "redirect",
      location: `https://${hosts.public}${pathname}${search}`,
      status: 308,
    };
  }

  if (!hosts.app || !hosts.public) return null;

  const isAppHost = host === hosts.app;
  const isPublicHost = host === hosts.public;
  // Anything else — localhost, a preview deployment, a bare IP — is left alone.
  if (!isAppHost && !isPublicHost) return null;

  if (isHostNeutral(pathname)) return null;

  const marketing = isMarketingRoute(pathname);

  if (isAppHost) {
    const landing = appHostLanding(pathname);
    if (landing) {
      return { kind: "redirect", location: `${landing}${search}`, status: 307 };
    }
    if (marketing) {
      return {
        kind: "redirect",
        location: `https://${hosts.public}${pathname}${search}`,
        status: 307,
      };
    }
    return null;
  }

  // Public host from here on.
  if (marketing) return null;
  if (isAppSegment(pathname)) {
    return {
      kind: "redirect",
      location: `https://${hosts.app}${pathname}${search}`,
      status: 307,
    };
  }
  // Fail closed: see safety property 3 above. Returned before the auth guard
  // in proxy(), so a typo on the apex never reaches the /login redirect. A
  // direct request for PUBLIC_NOT_FOUND lands here too, and gets its 404.
  return { kind: "rewrite", pathname: PUBLIC_NOT_FOUND, status: 404 };
}

/** Applies hostSplitAction to a live request; null means "carry on". */
function hostSplit(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  const action = hostSplitAction(
    request.headers.get("host") ?? "",
    pathname,
    search,
  );
  if (!action) return null;
  if (action.kind === "rewrite") return rewriteToNotFound(request, action.pathname);
  return NextResponse.redirect(new URL(action.location, request.url), action.status);
}

function isMaintenanceActive(): boolean {
  if (!MAINTENANCE_MODE) return false;
  if (process.env.MAINTENANCE_MODE_OFF === "true") return false;
  // NODE_ENV is the ONE flag Next.js owns end-to-end and that `.env.local`
  // cannot poison: `next dev` always exports "development" regardless of
  // what's checked into the repo's env files, and Vercel runs the built
  // image with "production". VERCEL_ENV/VERCEL won't work here because
  // `vercel pull` writes those into .env.local for emulation, which then
  // makes the dev server think it's in prod and redirects every request
  // to /maintenance — Juan hit this on first run.
  return process.env.NODE_ENV === "production";
}

/**
 * The /login redirect for a signed-out page request. Keeps the query string:
 * emailed deep links carry the task in it (/projects/X?task=Y), and dropping
 * it landed the user on the project with no task open after signing in. The
 * login page still restricts callbackUrl to same-origin paths. Exported for
 * tests.
 */
export function loginRedirectUrl(
  requestUrl: string,
  pathname: string,
  search: string,
): URL {
  const loginUrl = new URL("/login", requestUrl);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return loginUrl;
}

/** NextAuth's session cookie, including the chunked (.0, .1…) and
 *  __Secure- variants. Exported for tests. */
export function isSessionCookieName(name: string): boolean {
  const base = name.replace(/^__Secure-/, "").replace(/\.\d+$/, "");
  return base === "next-auth.session-token";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Maintenance mode (production-only) ──────────────────────────
  // Redirect every non-maintenance, non-asset request to /maintenance.
  if (isMaintenanceActive()) {
    if (
      pathname === "/maintenance" ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/ttc/") ||
      pathname.startsWith("/api/health") ||
      pathname === "/favicon.ico" ||
      pathname === "/robots.txt"
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  // ── Host split ──────────────────────────────────────────────────
  // Runs before everything else so a request is on the right host before any
  // other rule reasons about it. No-op until APP_HOST and PUBLIC_HOST are set
  // (except the www → apex redirect, which needs PUBLIC_HOST only).
  const wrongHost = hostSplit(request);
  if (wrongHost) return wrongHost;

  // ── Public 404 ──────────────────────────────────────────────────
  // An unknown path under a marketing prefix, on any host, or a direct hit on
  // either 404 target. Before the auth guard, so a stale public link never
  // reaches /login. (The retired /v2/* preview URLs are 308'd by
  // next.config.ts redirects(), which run before this proxy on every host.)
  const notFoundTarget = publicNotFoundTarget(pathname);
  if (notFoundTarget) return rewriteToNotFound(request, notFoundTarget);

  // Skip public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Skip static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for valid session token. A token flagged `invalid` (the password
  // was changed after it was issued — see the jwt callback in @/lib/auth)
  // still decodes, but every handler already treats it as signed out; letting
  // it through left the user in a shell whose every request 401s, with nothing
  // sending them to /login.
  const decoded = await getToken({ req: request });
  const tokenInvalidated =
    !!decoded && !!(decoded as Record<string, unknown>).invalid;
  const token = tokenInvalidated ? null : decoded;

  if (!token) {
    // A server-to-server caller that authenticates itself in the handler. Only
    // the 401 is waived — the role gate below still runs for anyone who DOES
    // arrive with a session, which is what keeps a read-only role from minting
    // blob-store write credentials.
    if (isSessionOptionalApi(pathname)) {
      return NextResponse.next();
    }
    // API routes return 401; page routes redirect to login.
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(
          loginRedirectUrl(request.url, pathname, request.nextUrl.search),
        );
    // Clear the dead cookie so it stops riding on every request. It is
    // housekeeping, not what keeps /login from looping (the session callback
    // already reports this token as signed out). cookies.delete() cannot do it
    // in production: it omits Secure, and a browser drops any Set-Cookie for a
    // __Secure- name without it, so the expiry is written with the attributes
    // NextAuth set the cookie with.
    if (tokenInvalidated) {
      for (const { name } of request.cookies.getAll()) {
        if (isSessionCookieName(name)) {
          response.cookies.set(name, "", {
            expires: new Date(0),
            path: "/",
            secure: name.startsWith("__Secure-"),
            httpOnly: true,
            sameSite: "lax",
          });
        }
      }
    }
    return response;
  }

  // Role-based redirects for authenticated users
  const userRole = (token as Record<string, unknown>).role as string | undefined;

  // API: default-deny for every read-only workspace role. 403 rather than 404
  // because the caller is authenticated and a route's existence is not a
  // secret; what they lack is a ROLE. Hiding a specific RECORD behind a 404
  // remains the handler's job.
  //
  // `code` was "client-role" while the gate was CLIENT-only. It now fires for
  // GUEST too, where that label would be a lie to whoever is reading the
  // response in devtools. Renamed rather than kept: a repo-wide grep for
  // "client-role" returns only this line — no client, test or log consumer —
  // so nothing keys off the old string.
  if (isApiForbiddenForRole(userRole, pathname)) {
    // The public form kinds of the upload-token route are not role-gated in
    // the handler (see isRoleAgnosticUploadRequest); every other kind still
    // gets the 403, so a read-only role never holds a write token for a
    // project, task or message.
    if (pathname === "/api/blob/upload") {
      let body: unknown = null;
      try {
        body = await request.clone().json();
      } catch {
        body = null;
      }
      if (isRoleAgnosticUploadRequest(body)) return NextResponse.next();
    }
    return NextResponse.json(
      { error: "Forbidden", code: "non-contributor-role" },
      { status: 403 },
    );
  }

  // The CLIENT-role redirect to /client/dashboard and the /client route gate
  // are gone with the client portal itself. CLIENT is still a WorkspaceRole and
  // still a NON_CONTRIBUTOR_ROLE, so such a user is denied the whole internal
  // /api/ surface by isApiForbiddenForRole above — they simply have no UI now.
  // The enum value is deliberately kept (dropping it is a destructive
  // migration), and production currently holds zero CLIENT members.

  // Prevent non-admin/owner users from accessing admin routes.
  // Redirect target is `/home` — there is NO `/dashboard` route in this
  // app (the dashboard root lives at `/home` inside the `(dashboard)`
  // route group). Previous `/dashboard` value bounced users to 404 —
  // fixed during QC Fase 1 on May 22 2026 (bugs CL-1, CL-2).
  if (
    pathname.startsWith("/portal") &&
    userRole !== "WORKER" &&
    userRole !== "ADMIN" &&
    userRole !== "OWNER"
  ) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
