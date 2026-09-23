import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import {
  APP_SEGMENTS,
  appHostLanding,
  EN_PUBLIC_PAGES,
  ES_PUBLIC_PAGES,
  hostSplitAction,
  isApiForbiddenForRole,
  isClientApi,
  isMarketingRoute,
  isPublicRoute,
  isRoleAgnosticUploadRequest,
  isSessionCookieName,
  isSessionOptionalApi,
  loginRedirectUrl,
  PUBLIC_NOT_FOUND,
  PUBLIC_NOT_FOUND_ES,
  publicNotFoundTarget,
} from "./proxy";
import nextConfig from "../next.config";
import { NON_CONTRIBUTOR_ROLES } from "@/lib/workspace-roles";
import { services } from "@/lib/ttc/site";

/**
 * The CLIENT API allowlist.
 *
 * `isClientApi` is the whole decision behind the default-deny gate in proxy.ts:
 * a signed-in CLIENT that fails it gets a 403 at the edge, before any route
 * handler runs. Two failure modes matter, and they pull in opposite directions:
 *
 *   - TOO NARROW silently breaks a non-contributor's own self-service screens.
 *   - TOO WIDE re-opens the privilege-escalation chain that starts at
 *     POST /api/projects.
 *
 * These tests pin both edges. They touch no database and construct no request —
 * the function is pure string matching on purpose.
 */
describe("isClientApi", () => {
  describe("allows the self-service surface a non-contributor still has", () => {
    it.each([
      // All that is left now that the client portal and the password-less
      // share link are both removed.
      "/api/users/profile",
      "/api/users/preferences",
      "/api/users/password",
      // Invitation round-trip from /invite/[token].
      "/api/invite/abc123",
      "/api/invite/abc123/accept",
    ])("%s", (pathname) => {
      expect(isClientApi(pathname)).toBe(true);
    });

    it("no longer allows the removed client-portal API", () => {
      expect(isClientApi("/api/client")).toBe(false);
      expect(isClientApi("/api/client/projects")).toBe(false);
      expect(isClientApi("/api/client/messages/msg_456/read")).toBe(false);
    });
  });

  describe("denies the internal API — the escalation chain", () => {
    it.each([
      // Step 1 of the chain: creating a project in the firm's workspace with
      // ownerId=self. This is the link that makes every later step possible.
      "/api/projects",
      // Step 2/3: project-admin-by-ownership, then inviting a fresh email.
      "/api/projects/x/members",
      "/api/teams/x/join",
      // General internal surface that no portal screen ever calls.
      "/api/tasks",
      "/api/search",
      "/api/team/directory",
      "/api/workspace/knowledge",
    ])("%s", (pathname) => {
      expect(isClientApi(pathname)).toBe(false);
    });
  });

  describe("prefix-vs-exact correctness", () => {

    it("does not let a longer route ride in on the /api/users exact entries", () => {
      expect(isClientApi("/api/users")).toBe(false);
      expect(isClientApi("/api/users/search")).toBe(false);
      expect(isClientApi("/api/users/profiles")).toBe(false);
      expect(isClientApi("/api/users/profile/avatar")).toBe(false);
      expect(isClientApi("/api/users/some-user-id")).toBe(false);
    });

    it("does not match a route that merely contains an allowlisted segment", () => {
      expect(isClientApi("/api/admin/client/projects")).toBe(false);
      expect(isClientApi("/api/workspace/invite/x")).toBe(false);
    });

    it("denies /api/invite without a token, and /api/invitations", () => {
      // "/api/invite/" is prefix-only: the bare collection is not portal
      // surface, and /api/workspace/invitations is admin-only.
      expect(isClientApi("/api/invite")).toBe(false);
      expect(isClientApi("/api/invitations")).toBe(false);
      expect(isClientApi("/api/workspace/invitations")).toBe(false);
    });
  });

  describe("boundaries", () => {
    it("denies the bare API root", () => {
      expect(isClientApi("/api")).toBe(false);
      expect(isClientApi("/api/")).toBe(false);
    });

    it("is case-sensitive, matching Next's own path handling", () => {
      // Next does not case-fold pathnames, so an uppercase variant reaches a
      // different (nonexistent) route. Denying is the safe answer.
      expect(isClientApi("/API/client/projects")).toBe(false);
      expect(isClientApi("/api/Client/projects")).toBe(false);
    });

    it("denies page paths — the gate only ever consults this for /api/", () => {
      expect(isClientApi("/projects/all")).toBe(false);
      expect(isClientApi("/home")).toBe(false);
    });
  });
});

/**
 * Read the WorkspaceRole enum straight out of the Prisma schema.
 *
 * Parsing the schema instead of hardcoding a role list is the point: it makes
 * the schema the arbiter, so adding a role in schema.prisma and forgetting to
 * classify it fails this suite instead of silently defaulting to "contributor"
 * — which is the permissive side, and therefore the dangerous default.
 */
function workspaceRolesFromPrismaSchema(): string[] {
  const schema = readFileSync(
    join(__dirname, "..", "prisma", "schema.prisma"),
    "utf8",
  );
  const block = /enum\s+WorkspaceRole\s*\{([^}]*)\}/.exec(schema);
  if (!block) throw new Error("WorkspaceRole enum not found in schema.prisma");
  const roles = block[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z_]+$/.test(line));
  if (roles.length === 0) throw new Error("WorkspaceRole enum parsed empty");
  return roles;
}

/**
 * The /api/ role gate.
 *
 * The bug this suite exists to prevent a repeat of: the gate shipped as
 * `userRole === "CLIENT"` while NON_CONTRIBUTOR_ROLES already read
 * {GUEST, CLIENT}. One equality test against a two-element set — GUEST kept
 * full access to the internal JSON API and could still run the escalation
 * chain from POST /api/projects to minting a workspace MEMBER.
 *
 * So the assertions below never name GUEST or CLIENT as literals. They derive
 * the expectation from NON_CONTRIBUTOR_ROLES, which is the same object the
 * middleware and requireWorkspaceContributor both consume. Add a role to that
 * set and these tests demand the gate already denies it; hardcode a role in
 * the gate instead of using the set and they fail.
 */
describe("isApiForbiddenForRole", () => {
  const allRoles = workspaceRolesFromPrismaSchema();

  it("sees a WorkspaceRole enum that still contains the known roles", () => {
    // Guards the parser itself: a regex that silently matched nothing would
    // make every it.each below vacuous and this file would pass while
    // asserting exactly nothing.
    expect(allRoles).toEqual(
      expect.arrayContaining(["OWNER", "ADMIN", "MEMBER", "GUEST", "WORKER", "CLIENT"]),
    );
  });

  it("classifies every role in the schema as contributor or non-contributor", () => {
    // The drift detector. A role added to schema.prisma is inert here until
    // someone decides which side of NON_CONTRIBUTOR_ROLES it belongs on, and
    // the deciding is what this test forces. Update the expected list in the
    // SAME commit that adds the role.
    expect([...allRoles].sort()).toEqual([
      "ADMIN",
      "CLIENT",
      "GUEST",
      "MEMBER",
      "OWNER",
      "WORKER",
    ]);
  });

  it("denies exactly the roles NON_CONTRIBUTOR_ROLES names — no more, no less", () => {
    // THE assertion. Not "denies GUEST and CLIENT" (a literal restates the
    // bug) but "the gate's verdict and the shared set agree on every role the
    // schema defines". Whichever list someone edits without the other, the
    // two sides stop agreeing here.
    const deniedByGate = allRoles
      .filter((role) => isApiForbiddenForRole(role, "/api/projects"))
      .sort();
    const expected = allRoles.filter((r) => NON_CONTRIBUTOR_ROLES.has(r)).sort();

    expect(deniedByGate).toEqual(expected);
    // ...and that the shared set is not itself empty or full, either of which
    // would make the equality above trivially true.
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(allRoles.length);
  });

  it("denies the escalation chain for EVERY non-contributor role", () => {
    // The regression the whole task is about: this must hold for GUEST, not
    // just CLIENT.
    for (const role of NON_CONTRIBUTOR_ROLES) {
      expect(isApiForbiddenForRole(role, "/api/projects")).toBe(true);
      expect(isApiForbiddenForRole(role, "/api/projects/x/members")).toBe(true);
      expect(isApiForbiddenForRole(role, "/api/workspace/invitations")).toBe(true);
      expect(isApiForbiddenForRole(role, "/api/tasks")).toBe(true);
    }
  });

  describe("contributors are untouched", () => {
    // The gate must fire ONLY on non-contributor roles. If any of these start
    // returning true the internal app is broken for staff.
    const contributors = workspaceRolesFromPrismaSchema().filter(
      (r) => !NON_CONTRIBUTOR_ROLES.has(r),
    );

    it.each(contributors)("%s may reach the internal API", (role) => {
      expect(isApiForbiddenForRole(role, "/api/projects")).toBe(false);
      expect(isApiForbiddenForRole(role, "/api/tasks")).toBe(false);
      expect(isApiForbiddenForRole(role, "/api/workspace/knowledge")).toBe(false);
    });

    it("covers OWNER, ADMIN, MEMBER and WORKER specifically", () => {
      // Belt and braces: if NON_CONTRIBUTOR_ROLES were ever widened to swallow
      // a staff role, the it.each above would just stop testing it. This
      // notices.
      expect(contributors.sort()).toEqual(["ADMIN", "MEMBER", "OWNER", "WORKER"]);
    });
  });

  describe("the allowlist applies to every non-contributor role", () => {
    // Step 3: GUEST has no UI of its own — no (guest) route group, no guest
    // layout, no guest-only endpoint — so it adds NO entries and inherits the
    // portal list unchanged. These pin that inheritance.
    it.each([...NON_CONTRIBUTOR_ROLES])(
      "%s keeps self-service and invite-accept",
      (role) => {
        expect(isApiForbiddenForRole(role, "/api/users/profile")).toBe(false);
        expect(isApiForbiddenForRole(role, "/api/users/preferences")).toBe(false);
        expect(isApiForbiddenForRole(role, "/api/users/password")).toBe(false);
        expect(isApiForbiddenForRole(role, "/api/invite/abc123")).toBe(false);
        expect(isApiForbiddenForRole(role, "/api/invite/abc123/accept")).toBe(false);
      },
    );

    it("denies the removed client-portal API for every non-contributor role", () => {
      // The portal is gone, so these are ordinary internal routes now and the
      // default-deny gate must cover them like any other.
      for (const role of NON_CONTRIBUTOR_ROLES) {
        expect(isApiForbiddenForRole(role, "/api/client")).toBe(true);
        expect(isApiForbiddenForRole(role, "/api/client/projects")).toBe(true);
      }
    });
  });

  describe("scope: /api/ only, and roles outside the set", () => {
    it("never fires on page paths, even for a non-contributor", () => {
      // This gate is /api/-only by design. The page tier is covered by
      // resolveProjectAccess refusing to count a non-contributor membership.
      for (const role of NON_CONTRIBUTOR_ROLES) {
        expect(isApiForbiddenForRole(role, "/home")).toBe(false);
        expect(isApiForbiddenForRole(role, "/projects/all")).toBe(false);
        expect(isApiForbiddenForRole(role, "/settings")).toBe(false);
      }
    });

    it("lets a user with no role yet through", () => {
      // getPrimaryWorkspaceRole (auth-guards.ts:55) returns null — NOT "GUEST"
      // — when the user has no WorkspaceMember row, and that null is what sits
      // in the JWT mid-signup. Treating absence as a read-only role would 403
      // the whole onboarding flow.
      expect(isApiForbiddenForRole(null, "/api/projects")).toBe(false);
      expect(isApiForbiddenForRole(undefined, "/api/projects")).toBe(false);
      expect(isApiForbiddenForRole("", "/api/projects")).toBe(false);
    });

    it("is case-sensitive on the role, matching the Prisma enum exactly", () => {
      // token.role is copied verbatim from the DB enum. A lowercase value can
      // only come from a bug, and failing open on it would be the wrong call —
      // but it also must not accidentally match and 403 a contributor.
      expect(isApiForbiddenForRole("guest", "/api/projects")).toBe(false);
      expect(isApiForbiddenForRole("Client", "/api/projects")).toBe(false);
    });
  });
});

/*
 * Public form submission and workspace invitation are both reached by someone
 * with NO account — an external submitter holding a form link, or an invitee
 * holding an emailed token. Behind the auth wall the middleware bounced them to
 * /login and the whole flow died. These pin that the edge lets them through,
 * and only them; the handlers stay the real gate for the internal verbs.
 */
describe("isPublicRoute — public forms", () => {
  const formId = "clabc123";

  it("opens the form page and its render/submit/track API", () => {
    expect(isPublicRoute(`/forms/${formId}`)).toBe(true);
    expect(isPublicRoute(`/api/forms/${formId}`)).toBe(true);
    expect(isPublicRoute(`/api/forms/${formId}/submit`)).toBe(true);
    expect(isPublicRoute(`/api/forms/${formId}/track/sub1`)).toBe(true);
    expect(isPublicRoute(`/api/forms/${formId}/track/sub1/reply`)).toBe(true);
  });

  it("does not open a lookalike route by prefix", () => {
    // The trailing slash keeps the bare collection (list/create) and any
    // future /formsomething route private.
    expect(isPublicRoute("/forms")).toBe(false);
    expect(isPublicRoute("/api/forms")).toBe(false);
    expect(isPublicRoute("/formstudio")).toBe(false);
  });
});

describe("isPublicRoute — workspace invitations", () => {
  const token = "invite-tok-123";

  it("opens the invite landing page and its resolve/accept API", () => {
    expect(isPublicRoute(`/invite/${token}`)).toBe(true);
    expect(isPublicRoute(`/api/invite/${token}`)).toBe(true);
    expect(isPublicRoute(`/api/invite/${token}/accept`)).toBe(true);
  });

  it("does not open a lookalike route by prefix", () => {
    expect(isPublicRoute("/invite")).toBe(false);
    expect(isPublicRoute("/api/invite")).toBe(false);
    // /api/workspace/invitations is the internal admin surface, not this.
    expect(isPublicRoute("/api/workspace/invitations")).toBe(false);
  });
});

describe("isPublicRoute — Spanish marketing mirror", () => {
  it("opens /es and everything under it", () => {
    expect(isPublicRoute("/es")).toBe(true);
    expect(isPublicRoute("/es/")).toBe(true);
    expect(isPublicRoute("/es/services")).toBe(true);
    expect(isPublicRoute("/es/services/building-recertification")).toBe(true);
    expect(isPublicRoute("/es/contact")).toBe(true);
  });

  it("does not open app routes that merely start with the letters es", () => {
    expect(isPublicRoute("/escalate")).toBe(false);
    expect(isPublicRoute("/estimates")).toBe(false);
  });
});

describe("isSessionOptionalApi — Vercel Cron", () => {
  it("lets the due-date cron reach its own handler without a session", () => {
    // Vercel Cron sends no cookie; the handler's CRON_SECRET check is the gate.
    expect(isSessionOptionalApi("/api/cron/due-dates")).toBe(true);
  });

  it("is exact-match: nothing else under /api/cron/ rides along", () => {
    expect(isSessionOptionalApi("/api/cron")).toBe(false);
    expect(isSessionOptionalApi("/api/cron/")).toBe(false);
    expect(isSessionOptionalApi("/api/cron/other")).toBe(false);
    expect(isSessionOptionalApi("/api/cron/due-dates/x")).toBe(false);
  });

  it("is not a public route (the role gate still applies to a session)", () => {
    expect(isPublicRoute("/api/cron/due-dates")).toBe(false);
  });
});

describe("appHostLanding", () => {
  it("sends the app host's root to the app, not the marketing site", () => {
    expect(appHostLanding("/")).toBe("/home");
  });

  it("sends the bare /projects index to the project list", () => {
    expect(appHostLanding("/projects")).toBe("/projects/all");
  });

  it("leaves every other path alone", () => {
    for (const path of ["/home", "/projects/all", "/projects/abc", "/about"]) {
      expect(appHostLanding(path)).toBeNull();
    }
  });
});

describe("loginRedirectUrl", () => {
  it("keeps the query string so emailed task links survive sign-in", () => {
    const url = loginRedirectUrl(
      "https://app.example.com/projects/p1?task=t1",
      "/projects/p1",
      "?task=t1",
    );
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl")).toBe("/projects/p1?task=t1");
  });

  it("works with no query string", () => {
    const url = loginRedirectUrl("https://app.example.com/home", "/home", "");
    expect(url.searchParams.get("callbackUrl")).toBe("/home");
  });
});

describe("isSessionCookieName", () => {
  it.each([
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.session-token.0",
    "__Secure-next-auth.session-token.1",
  ])("matches %s", (name) => {
    expect(isSessionCookieName(name)).toBe(true);
  });

  it.each([
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.callback-url",
    "next-auth.session-tokenx",
  ])("leaves %s alone", (name) => {
    expect(isSessionCookieName(name)).toBe(false);
  });
});

describe("isRoleAgnosticUploadRequest", () => {
  const tokenBody = (target: unknown) => ({
    type: "blob.generate-client-token",
    payload: { pathname: "x/y", clientPayload: JSON.stringify(target) },
  });

  it.each(["form-attachment", "tracking-reply"])(
    "admits a %s token request",
    (kind) => {
      expect(isRoleAgnosticUploadRequest(tokenBody({ kind }))).toBe(true);
    },
  );

  it.each([
    "task-attachment",
    "project-resource",
    "message-attachment",
    "team-message-attachment",
  ])("keeps %s under the role gate", (kind) => {
    expect(isRoleAgnosticUploadRequest(tokenBody({ kind }))).toBe(false);
  });

  it("rejects the completion callback, malformed payloads and non-objects", () => {
    expect(
      isRoleAgnosticUploadRequest({
        type: "blob.upload-completed",
        payload: { clientPayload: JSON.stringify({ kind: "form-attachment" }) },
      }),
    ).toBe(false);
    expect(
      isRoleAgnosticUploadRequest({
        type: "blob.generate-client-token",
        payload: { clientPayload: "{not json" },
      }),
    ).toBe(false);
    expect(isRoleAgnosticUploadRequest(null)).toBe(false);
    expect(isRoleAgnosticUploadRequest("form-attachment")).toBe(false);
  });
});

/**
 * Read the top-level URL segments straight out of src/app.
 *
 * Route groups — (auth), (dashboard)… — and @parallel slots add no segment, so
 * their children count as top-level. _private folders are not routable. The
 * (public) group is collected separately: it is the marketing site.
 *
 * Same idea as reading the WorkspaceRole enum from schema.prisma above: the
 * file system is the arbiter, so a new app folder that nobody added to
 * APP_SEGMENTS fails this suite instead of silently 404ing on the apex.
 */
function topLevelRouteSegments(): { app: string[]; marketing: string[] } {
  const app = new Set<string>();
  const marketing = new Set<string>();
  const walk = (dir: string, bucket: Set<string>) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith("_")) continue;
      if (/^\(.+\)$/.test(name) || name.startsWith("@")) {
        walk(join(dir, name), name === "(public)" ? marketing : bucket);
        continue;
      }
      bucket.add(name);
    }
  };
  walk(join(__dirname, "app"), app);
  return { app: [...app].sort(), marketing: [...marketing].sort() };
}

describe("APP_SEGMENTS — drift against src/app", () => {
  const { app, marketing } = topLevelRouteSegments();

  it("sees a route tree that still contains the known folders", () => {
    // Guards the walker itself: one that silently found nothing would make
    // every assertion below vacuous.
    expect(app).toEqual(expect.arrayContaining(["login", "home", "api", "projects"]));
    expect(marketing).toEqual(expect.arrayContaining(["about", "services", "es"]));
  });

  it("lists exactly the app's top-level route folders — no more, no less", () => {
    // A folder missing from APP_SEGMENTS 404s on the public host instead of
    // being sent to the app host; a stale entry keeps redirecting to a route
    // that no longer exists. Update APP_SEGMENTS in the SAME commit that adds
    // or removes the folder.
    expect([...APP_SEGMENTS].sort()).toEqual(app);
  });

  it("has no dynamic top-level segment the list could not represent", () => {
    // A top-level [param] folder would match every path, on both hosts.
    expect([...app, ...marketing].filter((s) => s.startsWith("["))).toEqual([]);
  });

  it("serves every (public) page folder as marketing on the apex", () => {
    // A public page missing from the marketing set would be treated as a
    // typo on the public host (404) and as an app path on the app host. The
    // English rewrite target is the one top-level (public) folder that is not
    // a page of its own (its Spanish twin lives under /es).
    const pages = marketing.filter((s) => `/${s}` !== PUBLIC_NOT_FOUND);
    for (const segment of pages) {
      expect(isMarketingRoute(`/${segment}`), segment).toBe(true);
    }
  });

  it("never lets an app segment double as a marketing prefix", () => {
    // /projects is the one deliberate overlap: the bare index is marketing,
    // everything under it is the app.
    for (const segment of APP_SEGMENTS) {
      expect(isMarketingRoute(`/${segment}/x`), segment).toBe(false);
      if (segment !== "projects") {
        expect(isMarketingRoute(`/${segment}`), segment).toBe(false);
      }
    }
  });
});

describe("hostSplitAction", () => {
  const hosts = { app: "app.example.com", public: "example.com" };
  const onPublic = (path: string, search = "") =>
    hostSplitAction("example.com", path, search, hosts);
  const onApp = (path: string, search = "") =>
    hostSplitAction("app.example.com", path, search, hosts);

  describe("inert unless configured, and only on the configured hosts", () => {
    it("does nothing when neither host is set", () => {
      const none = { app: "", public: "" };
      expect(hostSplitAction("example.com", "/abuot", "", none)).toBeNull();
      expect(hostSplitAction("www.example.com", "/about", "", none)).toBeNull();
    });

    it("leaves localhost, previews and bare IPs alone", () => {
      for (const host of ["localhost:3002", "ttc-git-x.vercel.app", "127.0.0.1:3002"]) {
        expect(hostSplitAction(host, "/abuot", "", hosts)).toBeNull();
        expect(hostSplitAction(host, "/login", "", hosts)).toBeNull();
        expect(hostSplitAction(host, "/", "", hosts)).toBeNull();
      }
    });
  });

  describe("www", () => {
    it("308s www to the apex, path and query intact", () => {
      expect(hostSplitAction("www.example.com", "/about", "?a=1", hosts)).toEqual({
        kind: "redirect",
        location: "https://example.com/about?a=1",
        status: 308,
      });
      expect(hostSplitAction("WWW.example.com:443", "/", "", hosts)).toEqual({
        kind: "redirect",
        location: "https://example.com/",
        status: 308,
      });
    });

    it("needs PUBLIC_HOST only — www is not part of the reversible split", () => {
      expect(
        hostSplitAction("www.example.com", "/es/about", "", { app: "", public: "example.com" }),
      ).toEqual({ kind: "redirect", location: "https://example.com/es/about", status: 308 });
    });

    it("does not treat the app host's own www as the public site", () => {
      expect(hostSplitAction("www.app.example.com", "/about", "", hosts)).toBeNull();
    });
  });

  describe("public host", () => {
    it("serves the marketing site in place", () => {
      for (const path of [
        "/",
        "/about",
        "/projects",
        "/services",
        "/services/building-recertification",
        "/credits",
        "/api/contact",
      ]) {
        expect(onPublic(path), path).toBeNull();
      }
    });

    it("leaves every /es/* path to publicNotFoundTarget — the split never rewrites it", () => {
      // Unknown Spanish paths still 404, in Spanish: proxy() asks
      // publicNotFoundTarget right after the split (see its tests below).
      for (const path of [
        "/es",
        "/es/about",
        "/es/nope",
        "/es/services/bogus",
        "/es/contacto",
        "/es/credits",
        PUBLIC_NOT_FOUND_ES,
      ]) {
        expect(onPublic(path), path).toBeNull();
      }
    });

    it("leaves unknown paths under the other marketing prefixes to publicNotFoundTarget too", () => {
      for (const path of [
        "/services/nope",
        "/services/peer-review/x",
        "/resources",
        "/resources/steel-member",
      ]) {
        expect(onPublic(path), path).toBeNull();
      }
    });

    it("answers host-neutral paths in place", () => {
      for (const path of ["/ttc/og/og-en.jpg", "/robots.txt", "/sitemap.xml", "/api/auth/session"]) {
        expect(onPublic(path), path).toBeNull();
      }
    });

    it("sends a real app path to the app host with a 307, query intact", () => {
      expect(onPublic("/login")).toEqual({
        kind: "redirect",
        location: "https://app.example.com/login",
        status: 307,
      });
      expect(onPublic("/projects/p1", "?task=t1")).toEqual({
        kind: "redirect",
        location: "https://app.example.com/projects/p1?task=t1",
        status: 307,
      });
      for (const path of ["/home", "/register", "/invite/tok", "/forms/f1", "/api/tasks", "/teams/t1"]) {
        expect(onPublic(path)?.kind, path).toBe("redirect");
      }
    });

    it("rewrites a typo or an unknown path to the public 404 instead of the login wall", () => {
      for (const path of [
        "/abuot",
        "/About",
        "/ES",
        "/servicess",
        "/about-us",
        "/blog",
        "/wp-login.php",
        "/apple-touch-icon.png",
        // Only the FIRST segment decides: these merely start like app routes.
        "/loginx",
        "/homes",
        "/escalate",
        "/icon.svg",
        // A direct request for the internal target itself: a 404, never a 200.
        PUBLIC_NOT_FOUND,
      ]) {
        expect(onPublic(path), path).toEqual({
          kind: "rewrite",
          pathname: PUBLIC_NOT_FOUND,
          status: 404,
        });
      }
    });
  });

  describe("app host", () => {
    it("lands the app's own root and /projects on the app", () => {
      expect(onApp("/", "?x=1")).toEqual({ kind: "redirect", location: "/home?x=1", status: 307 });
      expect(onApp("/projects")).toEqual({ kind: "redirect", location: "/projects/all", status: 307 });
    });

    it("sends marketing pages to the apex with a 307", () => {
      expect(onApp("/about")).toEqual({
        kind: "redirect",
        location: "https://example.com/about",
        status: 307,
      });
      expect(onApp("/es/services")?.kind).toBe("redirect");
    });

    it("leaves app paths — and its own unknown paths — to the app", () => {
      for (const path of ["/home", "/projects/all", "/login", "/abuot", "/api/tasks"]) {
        expect(onApp(path), path).toBeNull();
      }
    });
  });
});

/*
 * The public 404. Every unknown path under a marketing prefix is rewritten,
 * with status 404, to a (public) page that the SERVER renders in full — not
 * thrown with notFound(), which Next 16 answers with an empty client-built
 * error shell. These pin the decision (publicNotFoundTarget), the response
 * proxy() builds from it with the host split both off and on, and the drift
 * between the known-page lists and the (public) route files.
 */
describe("publicNotFoundTarget", () => {
  const slug = services[0].slug;

  it("lets every known English and Spanish page through", () => {
    for (const path of [...EN_PUBLIC_PAGES, ...ES_PUBLIC_PAGES]) {
      expect(publicNotFoundTarget(path), path).toBeNull();
    }
  });

  it("sends unknown English marketing paths to the English 404", () => {
    for (const path of [
      "/services/nope",
      `/services/${slug}/x`,
      "/services/x/y/z",
      // The retired calculators: the prefix is marketing, no page exists.
      "/resources",
      "/resources/steel-member",
      "/resources/load-gen",
    ]) {
      expect(publicNotFoundTarget(path), path).toBe(PUBLIC_NOT_FOUND);
    }
  });

  it("sends unknown Spanish paths to the Spanish 404, English-only pages included", () => {
    for (const path of [
      "/es/nope",
      "/es/contacto",
      "/es/services/nope",
      `/es/services/${slug}/x`,
      "/es/resources",
      // Real in English, but with no Spanish twin (i18n's EN_ONLY).
      "/es/credits",
      "/es/logo-styles",
    ]) {
      expect(publicNotFoundTarget(path), path).toBe(PUBLIC_NOT_FOUND_ES);
    }
  });

  it("answers a direct request for either 404 target with that target", () => {
    expect(publicNotFoundTarget(PUBLIC_NOT_FOUND)).toBe(PUBLIC_NOT_FOUND);
    expect(publicNotFoundTarget(PUBLIC_NOT_FOUND_ES)).toBe(PUBLIC_NOT_FOUND_ES);
  });

  it("matches real pages the way the router does — percent-decoded", () => {
    // The router decodes each segment before it matches a page, so these ARE
    // the real pages; looking up the raw string answered them with a 404.
    expect(publicNotFoundTarget("/services/peer%2Dreview")).toBeNull();
    expect(publicNotFoundTarget("/es/services/peer%2dreview")).toBeNull();
    expect(publicNotFoundTarget("/es/%61bout")).toBeNull();
    // An encoded "/" or a malformed escape is never one of our pages.
    expect(publicNotFoundTarget("/services/peer-review%2Fx")).toBe(PUBLIC_NOT_FOUND);
    expect(publicNotFoundTarget("/es/services/peer-review%2Fx")).toBe(PUBLIC_NOT_FOUND_ES);
    expect(publicNotFoundTarget("/services/%E0")).toBe(PUBLIC_NOT_FOUND);
  });

  it("does not depend on a trailing slash", () => {
    // Next 308s these away before the proxy runs; the answer must not change
    // if that setting ever does.
    expect(publicNotFoundTarget("/es/about/")).toBeNull();
    expect(publicNotFoundTarget(`/services/${slug}/`)).toBeNull();
    expect(publicNotFoundTarget("/es/")).toBeNull();
    expect(publicNotFoundTarget("/services/nope/")).toBe(PUBLIC_NOT_FOUND);
    expect(publicNotFoundTarget("/es/credits/")).toBe(PUBLIC_NOT_FOUND_ES);
  });

  it("never touches anything outside the marketing page prefixes", () => {
    // App routes, the API (marketing or not), assets, host-neutral files and
    // top-level typos are the host split's and the auth guard's business.
    for (const path of [
      "/",
      "/about",
      "/credits",
      "/projects",
      "/projects/p1",
      "/abuot",
      "/login",
      "/home",
      "/api/contact",
      "/api/load-gen",
      "/api/auth/session",
      "/_next/static/chunks/x.js",
      "/ttc/og/og-en.jpg",
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      // Lookalikes that merely start with a prefix's letters.
      "/escalate",
      "/servicesx",
      "/resourcesful",
      "/Services/nope",
    ]) {
      expect(publicNotFoundTarget(path), path).toBeNull();
    }
  });

  it("knows exactly the Spanish mirror of the translated English pages", () => {
    expect([...ES_PUBLIC_PAGES].sort()).toEqual(
      [
        "/es",
        "/es/about",
        "/es/contact",
        "/es/existing-buildings",
        "/es/privacy",
        "/es/projects",
        "/es/services",
        "/es/terms",
        ...services.map((s) => `/es/services/${s.slug}`),
      ].sort(),
    );
  });
});

describe("proxy() — the public 404 response", () => {
  const load = async (env: { app: string; public: string }) => {
    vi.stubEnv("APP_HOST", env.app);
    vi.stubEnv("PUBLIC_HOST", env.public);
    vi.resetModules();
    return (await import("./proxy")).proxy;
  };
  const call = async (
    proxy: (r: NextRequest) => Promise<Response>,
    host: string,
    path: string,
  ) => proxy(new NextRequest(`https://${host}${path}`, { headers: { host } }));
  const rewrittenTo = (res: Response) => {
    const header = res.headers.get("x-middleware-rewrite");
    return header ? new URL(header).pathname : null;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("host split OFF (localhost, previews)", () => {
    it("rewrites unknown marketing paths to the right language's 404, with status 404", async () => {
      const proxy = await load({ app: "", public: "" });
      for (const [path, target] of [
        ["/services/nope", PUBLIC_NOT_FOUND],
        [`/services/${services[0].slug}/x`, PUBLIC_NOT_FOUND],
        ["/resources", PUBLIC_NOT_FOUND],
        ["/resources/steel-member", PUBLIC_NOT_FOUND],
        [PUBLIC_NOT_FOUND, PUBLIC_NOT_FOUND],
        ["/es/nope", PUBLIC_NOT_FOUND_ES],
        ["/es/credits", PUBLIC_NOT_FOUND_ES],
        ["/es/services/nope", PUBLIC_NOT_FOUND_ES],
        [PUBLIC_NOT_FOUND_ES, PUBLIC_NOT_FOUND_ES],
      ]) {
        const res = await call(proxy, "localhost:3002", path);
        expect(res.status, path).toBe(404);
        expect(rewrittenTo(res), path).toBe(target);
      }
    });

    it("lets the real pages through untouched", async () => {
      const proxy = await load({ app: "", public: "" });
      for (const path of ["/", "/about", "/credits", "/services", `/services/${services[0].slug}`, "/es", "/es/about"]) {
        const res = await call(proxy, "localhost:3002", path);
        expect(res.headers.get("x-middleware-next"), path).toBe("1");
        expect(rewrittenTo(res), path).toBeNull();
      }
    });
  });

  describe("host split ON", () => {
    const hosts = { app: "app.example.com", public: "example.com" };

    it("public host: unknown marketing, typos and the target itself all 404 in place", async () => {
      const proxy = await load(hosts);
      for (const [path, target] of [
        ["/services/nope", PUBLIC_NOT_FOUND],
        ["/resources/load-gen", PUBLIC_NOT_FOUND],
        ["/abuot", PUBLIC_NOT_FOUND],
        ["/wp-login.php", PUBLIC_NOT_FOUND],
        [PUBLIC_NOT_FOUND, PUBLIC_NOT_FOUND],
        ["/es/contacto", PUBLIC_NOT_FOUND_ES],
        ["/es/logo-styles", PUBLIC_NOT_FOUND_ES],
      ]) {
        const res = await call(proxy, hosts.public, path);
        expect(res.status, path).toBe(404);
        expect(rewrittenTo(res), path).toBe(target);
      }
    });

    it("public host: real pages pass, app paths still 307 to the app host", async () => {
      const proxy = await load(hosts);
      for (const path of ["/", "/about", "/es/services", `/services/${services[0].slug}`]) {
        const res = await call(proxy, hosts.public, path);
        expect(res.headers.get("x-middleware-next"), path).toBe("1");
      }
      const login = await call(proxy, hosts.public, "/login");
      expect(login.status).toBe(307);
      expect(login.headers.get("location")).toBe("https://app.example.com/login");
    });

    it("app host: marketing paths, unknown ones included, still go to the apex", async () => {
      const proxy = await load(hosts);
      const res = await call(proxy, hosts.app, "/services/nope");
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://example.com/services/nope");
    });

    it("app host: a direct request for the English target is a 404, not a login bounce", async () => {
      const proxy = await load(hosts);
      const res = await call(proxy, hosts.app, PUBLIC_NOT_FOUND);
      expect(res.status).toBe(404);
      expect(rewrittenTo(res)).toBe(PUBLIC_NOT_FOUND);
    });
  });
});

/**
 * Every page file under src/app/(public), as a URL pattern: route groups and
 * @slots add no segment, _private folders are skipped. The file system is the
 * arbiter, as with APP_SEGMENTS above.
 */
function publicPageRoutes(): string[] {
  const routes: string[] = [];
  const walk = (dir: string, url: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_")) continue;
        const grouped = /^\(.+\)$/.test(entry.name) || entry.name.startsWith("@");
        walk(join(dir, entry.name), grouped ? url : `${url}/${entry.name}`);
      } else if (/^page\.[jt]sx?$/.test(entry.name)) {
        routes.push(url || "/");
      }
    }
  };
  walk(join(__dirname, "app", "(public)"), "");
  return routes.sort();
}

/** Files under (public) that would create a URL without being a page. */
function publicNonPageRouteFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        /^(route|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest|favicon)\./.test(
          entry.name,
        )
      ) {
        found.push(full);
      }
    }
  };
  walk(join(__dirname, "app", "(public)"));
  return found;
}

describe("public 404 — drift against src/app/(public)", () => {
  const routes = publicPageRoutes();
  const isCatchAll = (r: string) => r.includes("[...") || r.includes("[[...");
  const slugRoutes = ["/services/[slug]", "/es/services/[slug]"];
  const pages = routes
    .filter((r) => !isCatchAll(r))
    .flatMap((r) =>
      slugRoutes.includes(r) ? services.map((s) => r.replace("[slug]", s.slug)) : [r],
    )
    .filter((r) => r !== PUBLIC_NOT_FOUND && r !== PUBLIC_NOT_FOUND_ES);
  const isEs = (r: string) => r === "/es" || r.startsWith("/es/");

  it("sees a route tree that still contains the known pages", () => {
    // Guards the walker: one that found nothing would make the rest vacuous.
    expect(routes).toEqual(
      expect.arrayContaining(["/", "/about", "/es", "/es/about", "/services/[slug]"]),
    );
  });

  it("has a page file for both 404 targets", () => {
    expect(routes).toContain(PUBLIC_NOT_FOUND);
    expect(routes).toContain(PUBLIC_NOT_FOUND_ES);
  });

  it("knows exactly the English pages that exist — no more, no less", () => {
    // A page missing from EN_PUBLIC_PAGES would be rewritten to the 404; a
    // stale entry would let a dead path fall through to the app's not-found.
    expect(pages.filter((r) => !isEs(r)).sort()).toEqual([...EN_PUBLIC_PAGES].sort());
  });

  it("knows exactly the Spanish pages that exist under (public)/es", () => {
    expect(pages.filter(isEs).sort()).toEqual([...ES_PUBLIC_PAGES].sort());
  });

  it("has no dynamic page the known lists cannot enumerate", () => {
    // [slug] is expanded from site.ts; any other dynamic segment needs its
    // own entry in the proxy before it can be served.
    const dynamic = routes.filter((r) => r.includes("[") && !isCatchAll(r));
    expect(dynamic.sort()).toEqual([...slugRoutes].sort());
  });

  it("keeps every catch-all a fallback the proxy answers first", () => {
    // A catch-all under a path the proxy does not own would start serving
    // pages the known lists never heard of.
    const catchAlls = routes.filter(isCatchAll);
    expect(catchAlls.length).toBeGreaterThan(0);
    for (const route of catchAlls) {
      const sample = route
        .replace(/\[\[?\.\.\.[^\]]+\]\]?/, "x")
        .replace("[slug]", services[0].slug);
      expect(publicNotFoundTarget(sample), route).not.toBeNull();
      if (route.includes("[[...")) {
        // An optional catch-all also matches its bare parent.
        const bare = route.replace(/\/\[\[\.\.\.[^\]]+\]\]$/, "");
        expect(publicNotFoundTarget(bare), route).not.toBeNull();
      }
    }
  });

  it("has no route handler or metadata image the known lists would 404", () => {
    expect(publicNonPageRouteFiles()).toEqual([]);
  });

  it("shadows no file in public/", () => {
    // Middleware runs before public/ files are served, so a static file under
    // a marketing page prefix would be rewritten to the 404.
    const roots = readdirSync(join(__dirname, "..", "public"));
    for (const name of ["services", "es", "resources", PUBLIC_NOT_FOUND.slice(1)]) {
      expect(roots, name).not.toContain(name);
    }
  });
});

/*
 * Retired URLs are redirected in next.config.ts, which runs before the proxy.
 * The /v2 pair used to be a block in proxy() that sat after the host split,
 * so on the public host the split's fail-closed 404 answered first. Resolved
 * here with Next's own matcher (the one it builds for custom routes), so the
 * test covers what the config actually does, not merely what it lists.
 */
describe("next.config.ts — retired URL redirects", () => {
  const resolve = async (pathname: string) => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    for (const r of redirects) {
      const params = getPathMatch(r.source, { strict: true, removeUnnamedParams: true })(pathname);
      if (!params) continue;
      const { parsedDestination } = prepareDestination({
        appendParamsToQuery: false,
        destination: r.destination,
        params,
        query: {},
      });
      return { to: parsedDestination.pathname, permanent: "permanent" in r && r.permanent };
    }
    return null;
  };

  it.each([
    ["/v2", "/"],
    ["/v2/about", "/about"],
    ["/v2/services", "/services"],
    ["/v2/services/peer-review", "/services/peer-review"],
    ["/about.html", "/about"],
  ])("308s %s to %s", async (from, to) => {
    expect(await resolve(from)).toEqual({ to, permanent: true });
  });

  it("leaves the live pages alone", async () => {
    for (const path of ["/", "/about", "/v2x", "/es/v2"]) {
      expect(await resolve(path), path).toBeNull();
    }
  });

  it("the proxy no longer carries a /v2 rule of its own", () => {
    // Two copies drifted once already; the config is the only one now.
    const source = readFileSync(join(__dirname, "proxy.ts"), "utf8");
    expect(source).not.toMatch(/pathname\s*===\s*["']\/v2["']/);
    expect(source).not.toMatch(/startsWith\(\s*["']\/v2\//);
  });
});
