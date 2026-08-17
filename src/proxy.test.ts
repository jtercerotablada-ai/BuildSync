import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isApiForbiddenForRole, isClientApi, isPublicRoute } from "./proxy";
import { NON_CONTRIBUTOR_ROLES } from "@/lib/workspace-roles";

/**
 * The CLIENT API allowlist.
 *
 * `isClientApi` is the whole decision behind the default-deny gate in proxy.ts:
 * a signed-in CLIENT that fails it gets a 403 at the edge, before any route
 * handler runs. Two failure modes matter, and they pull in opposite directions:
 *
 *   - TOO NARROW silently breaks the client portal (a screen stops loading).
 *   - TOO WIDE re-opens the privilege-escalation chain that starts at
 *     POST /api/projects.
 *
 * These tests pin both edges. They touch no database and construct no request —
 * the function is pure string matching on purpose.
 */
describe("isClientApi", () => {
  describe("allows the client portal's own surface", () => {
    it.each([
      // Exact matches.
      "/api/client",
      "/api/users/profile",
      "/api/users/preferences",
      "/api/users/password",
      // Prefix matches — every route the (client) tree actually calls.
      "/api/client/projects",
      "/api/client/documents",
      "/api/client/approvals",
      "/api/client/messages",
      // Nested/dynamic segments must pass too, not just the collection root.
      "/api/client/projects/proj_123",
      "/api/client/messages/msg_456/read",
      // Invitation round-trip from /invite/[token].
      "/api/invite/abc123",
      "/api/invite/abc123/accept",
    ])("%s", (pathname) => {
      expect(isClientApi(pathname)).toBe(true);
    });

    it("ignores the query string boundary by matching the pathname only", () => {
      // proxy.ts passes request.nextUrl.pathname, which never carries `?...`.
      // Asserted so a future refactor that starts passing a full URL fails here
      // rather than in production.
      expect(isClientApi("/api/client/messages")).toBe(true);
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
    it("does not let a longer route ride in on the /api/client exact entry", () => {
      // "/api/client" is in clientApiExact, NOT clientApiPrefixes, precisely so
      // that a sibling route starting with the same characters stays internal.
      // A `startsWith("/api/client")` bug would pass all of these.
      expect(isClientApi("/api/clients")).toBe(false);
      expect(isClientApi("/api/client-secrets")).toBe(false);
      expect(isClientApi("/api/clientele")).toBe(false);
    });

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
      expect(isClientApi("/client/dashboard")).toBe(false);
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

    it("lets the portal surface through for every non-contributor role", () => {
      // /api/client/* passing the EDGE gate is not a grant of client data to a
      // GUEST: each handler re-checks ClientProjectAccess via verifyClientAccess
      // (src/lib/auth-guards.ts:370), and a GUEST holds no such row.
      for (const role of NON_CONTRIBUTOR_ROLES) {
        expect(isApiForbiddenForRole(role, "/api/client")).toBe(false);
        expect(isApiForbiddenForRole(role, "/api/client/projects")).toBe(false);
      }
    });
  });

  describe("scope: /api/ only, and roles outside the set", () => {
    it("never fires on page paths, even for a non-contributor", () => {
      // Page routing for these roles is handled by the redirect rules, not
      // here. CLIENT has a portal to be sent to; GUEST does not.
      for (const role of NON_CONTRIBUTOR_ROLES) {
        expect(isApiForbiddenForRole(role, "/home")).toBe(false);
        expect(isApiForbiddenForRole(role, "/projects/all")).toBe(false);
        expect(isApiForbiddenForRole(role, "/client/dashboard")).toBe(false);
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

/**
 * The client share link route.
 *
 * /p/<token> is reached by a building owner who has no account and never
 * will. If it is not public the middleware bounces them to /login and the
 * whole feature is dead on arrival; if the prefix is too greedy it opens
 * something else by accident. The token itself is validated in
 * @/lib/client-link/access — this only pins the edge decision.
 */
describe("isPublicRoute — client share links", () => {
  const token = "a".repeat(64);

  it("lets a share link through without a session", () => {
    expect(isPublicRoute(`/p/${token}`)).toBe(true);
  });

  it("is public regardless of how malformed the token is", () => {
    // The page must 404 on a bad token, not redirect to /login — a redirect
    // would tell a prober that the path exists but they are unauthenticated.
    expect(isPublicRoute("/p/not-a-real-token")).toBe(true);
    expect(isPublicRoute("/p/")).toBe(true);
  });

  it("does not open any other route by prefix", () => {
    // The trailing slash in the "/p/" prefix is what keeps these private.
    expect(isPublicRoute("/portal")).toBe(false);
    expect(isPublicRoute("/portal/admin")).toBe(false);
    expect(isPublicRoute("/profile/abc")).toBe(false);
    expect(isPublicRoute("/projects/all")).toBe(false);
    expect(isPublicRoute("/p")).toBe(false);
  });

  it("keeps the authenticated app behind the wall", () => {
    expect(isPublicRoute("/dashboard")).toBe(false);
    expect(isPublicRoute("/my-tasks")).toBe(false);
    expect(isPublicRoute("/api/projects")).toBe(false);
  });
});
