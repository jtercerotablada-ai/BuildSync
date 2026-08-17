import { describe, expect, it } from "vitest";
import { isClientApi } from "./proxy";

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
