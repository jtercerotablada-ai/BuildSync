import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { legal, primaryNav } from "@/lib/ttc/site";
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
  "/resources",
  "/api/load-gen",
  // Marketing: /services and every /services/<slug> detail page.
  // Safe as a prefix — the authenticated app has no /services route.
  "/services",
  // Password-less client project links: /p/<token>. The visitor is a
  // building owner with no account, so there is no session to check here;
  // the token IS the credential and the page re-validates it (unknown,
  // revoked and expired all 404) on every request via resolveShareLink.
  // The trailing slash keeps this from ever matching a future /projects
  // or /portal route by prefix.
  "/p/",
  // The share link's ONE write endpoint (the client reply box). Same trust
  // model as the page: the token in the path is the credential, and the
  // route 404s identically for unknown/revoked/expired links.
  "/api/p/",
  // Public form submission: /forms/<formId> and its render/submit/track API.
  // The whole point is an external submitter (architect, owner, property
  // manager) with NO account — behind the auth wall the link bounced to
  // /login and the entire flow (submit + receipt email + tracking link)
  // died. Opening the prefix grants no new access: the submit handler gates
  // on form.visibility, the track handler on a signed token, and every
  // INTERNAL verb here (form PATCH/DELETE, submissions, export) still calls
  // getCurrentUserId → 401 and re-checks project access → 403 in-handler.
  // Same trust model as /p/ above: the middleware only stops being a
  // redirect; the handler remains the real gate.
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

/* ── The non-contributor API allowlist ─────────────────────────────────────
   The entire server surface the (client) portal calls. Everything else under
   /api/ is internal, and a read-only workspace role — see
   NON_CONTRIBUTOR_ROLES in @/lib/workspace-roles, currently {GUEST, CLIENT} —
   is denied here, at the edge.

   The list is named for the client portal because that is the only UI a
   non-contributor role has: there is no (guest) route group, no guest layout
   and no guest-only endpoint anywhere in src/app. GUEST therefore adds no
   entries — it inherits this list unchanged, which for a GUEST means the three
   /api/users/* self-service routes plus /api/invite/ (accepting an invitation
   addressed to their own email). The /api/client/* entries are inert for a
   GUEST rather than a grant: each of those handlers re-checks
   ClientProjectAccess via verifyClientAccess (src/lib/auth-guards.ts:370), and
   a GUEST holds no such row, so they 403 in the handler.

   WHY THIS EXISTS: the role gate below has always been PAGE-only, while
   config.matcher runs middleware over /api/* too — and no API handler checks
   WorkspaceRole. requireWorkspaceContributor (src/lib/auth-guards.ts:417) is
   the guard for this and is wired into 4 of 173 route files. So a signed-in
   non-contributor could call the internal JSON API directly and get 2xx,
   including POST /api/projects, which asserts only that a WorkspaceMember row
   EXISTS and then writes ownerId=self — the first link in a chain that ends
   with them minting a full internal MEMBER account on an email they control.

   ALLOWLIST, NOT BLOCKLIST: internal routes are added constantly and a
   blocklist silently exposes each new one. The portal's surface is small and
   stable.

   /api/auth/* is deliberately absent: it is a publicPrefix and returns at
   isPublicRoute() before this gate ever runs. */
const clientApiPrefixes = [
  // Portal data. Each handler still re-checks ClientProjectAccess via
  // verifyClientAccess (src/lib/auth-guards.ts:370) — this only stops being a
  // 403; it grants nothing.
  "/api/client/",
  // Accepting an invitation addressed to THEIR OWN email; the handler returns
  // 409 for any other address. This does NOT make a pre-existing rogue MEMBER
  // invitation safe — those must be revoked in the database.
  "/api/invite/",
];
const clientApiExact = [
  "/api/client",
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
 * SCOPE: /api/ only. Page routing for these roles is unchanged and is handled
 * by the redirect rules below — deliberately, because CLIENT has a portal to
 * be sent to and GUEST does not.
 */
export function isApiForbiddenForRole(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (!isNonContributorRole(role)) return false;
  if (!pathname.startsWith("/api/")) return false;
  return !isClientApi(pathname);
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
   dashboard without a deploy.

     APP_HOST=app.ttcivilstructural.com
     PUBLIC_HOST=ttcivilstructural.com

   Two deliberate safety properties:

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
const marketingPrefixes = ["/services", "/resources", "/api/contact", "/api/load-gen"];

function isMarketingRoute(pathname: string): boolean {
  if (publicExactRoutes.includes(pathname)) return true;
  return marketingPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
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
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  );
}

/** Returns a redirect when the request reached the wrong host, else null. */
function hostSplit(request: NextRequest): NextResponse | null {
  if (!APP_HOST || !PUBLIC_HOST) return null;

  const host = (request.headers.get("host") ?? "")
    .toLowerCase()
    .split(":")[0];

  const isAppHost = host === APP_HOST;
  const isPublicHost = host === PUBLIC_HOST || host === `www.${PUBLIC_HOST}`;
  // Anything else — localhost, a preview deployment, a bare IP — is left alone.
  if (!isAppHost && !isPublicHost) return null;

  const { pathname, search } = request.nextUrl;
  if (isHostNeutral(pathname)) return null;

  const marketing = isMarketingRoute(pathname);
  if (isAppHost && marketing) {
    return NextResponse.redirect(
      `https://${PUBLIC_HOST}${pathname}${search}`,
      307,
    );
  }
  if (isPublicHost && !marketing) {
    return NextResponse.redirect(
      `https://${APP_HOST}${pathname}${search}`,
      307,
    );
  }
  return null;
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
      pathname === "/icon.svg" ||
      pathname === "/robots.txt"
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  // ── Host split ──────────────────────────────────────────────────
  // Runs before everything else so a request is on the right host before any
  // other rule reasons about it. No-op until APP_HOST and PUBLIC_HOST are set.
  const wrongHost = hostSplit(request);
  if (wrongHost) return wrongHost;

  // Retired /v2 preview routes → permanent redirect to the real public pages.
  // The editorial redesign now lives on /, /services, /about, /contact, /projects.
  if (pathname === "/v2" || pathname.startsWith("/v2/")) {
    const dest = pathname === "/v2" ? "/" : pathname.slice(3);
    return NextResponse.redirect(new URL(dest, request.url), 308);
  }

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

  // Check for valid session token
  const token = await getToken({ req: request });

  if (!token) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
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
    return NextResponse.json(
      { error: "Forbidden", code: "non-contributor-role" },
      { status: 403 },
    );
  }

  // CLIENT role users accessing internal dashboard should be sent to
  // their client portal. The actual internal dashboard lives under
  // `/home`, `/my-tasks`, `/projects`, etc. (no `/dashboard` route
  // exists). Match the (dashboard) group's actual root path.
  if (
    userRole === "CLIENT" &&
    (pathname === "/home" ||
      pathname.startsWith("/my-tasks") ||
      pathname.startsWith("/projects") ||
      pathname.startsWith("/inbox") ||
      pathname.startsWith("/reporting") ||
      pathname.startsWith("/portfolios") ||
      pathname.startsWith("/goals") ||
      pathname.startsWith("/teams"))
  ) {
    return NextResponse.redirect(new URL("/client/dashboard", request.url));
  }

  // WORKER role users accessing client portal should be redirected to portal
  if (userRole === "WORKER" && pathname.startsWith("/client")) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

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

  if (
    pathname.startsWith("/client") &&
    userRole !== "CLIENT" &&
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
