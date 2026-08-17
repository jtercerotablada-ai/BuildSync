/**
 * workspace-roles.ts — the one list of WorkspaceRole names that may not author
 * workspace content, shared by the Edge middleware and the server-side guards.
 *
 * ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────
 * This set used to live as a private const inside `src/lib/auth-guards.ts`,
 * where `requireWorkspaceContributor` uses it. The middleware in `src/proxy.ts`
 * needs the SAME list, but it cannot import auth-guards: that module's first
 * line is `import prisma from "@/lib/prisma"`, and middleware runs on the Edge
 * runtime, so importing it would pull the Prisma client into the middleware
 * bundle. Hence a third module that both sides import, holding nothing but
 * strings.
 *
 * KEEP IT DEPENDENCY-FREE. No prisma, no next-auth, no `@/lib/*` imports —
 * anything added here is added to the Edge bundle. Plain data only.
 *
 * ── WHY THE TWO CALLERS MUST NAME THE SAME ROLES ──────────────────────────
 * They are two halves of one rule, at two depths:
 *
 *   • `requireWorkspaceContributor` (auth-guards.ts) is the in-handler guard,
 *     and it is wired into only 4 of ~173 route files.
 *   • The `/api/` gate in proxy.ts is the default-deny chokepoint that covers
 *     the other ~169.
 *
 * When the two lists disagree, the gap is silent and it is exploitable. That
 * is not hypothetical — it is exactly what happened here. The middleware gate
 * shipped testing `userRole === "CLIENT"` while this set already read
 * `{GUEST, CLIENT}`, so a GUEST kept full run of the internal JSON API and
 * could still walk the escalation chain the gate was written to sever:
 *
 *     POST /api/projects            — authorizes on "a WorkspaceMember row
 *                                     EXISTS" and never reads .role, then
 *                                     writes ownerId=self + an ADMIN
 *                                     ProjectMember row for the caller
 *       → project ownership satisfies requireProjectAdmin
 *       → POST /api/projects/<id>/members invites any email as workspace
 *         role MEMBER (hardcoded)
 *       → an outsider has provisioned a full internal staff account with no
 *         admin anywhere in the loop.
 *
 * So: add a role here and BOTH enforcement points pick it up. `proxy.test.ts`
 * asserts the middleware gate denies exactly this set — and that every role in
 * the Prisma WorkspaceRole enum has been consciously placed on one side of it
 * — so re-hardcoding a literal in either caller fails the suite.
 */

/**
 * Workspace roles that are read-only by design (Asana parity: a "guest" or an
 * external "client" can view what they are shared but never author content).
 * GUEST is the internal viewer role; CLIENT is the external-portal role.
 *
 * Contributors — the complement of this set — are OWNER / ADMIN / MEMBER /
 * WORKER. Widening this set tightens security; narrowing it grants write
 * access, so treat a removal as a security change.
 */
export const NON_CONTRIBUTOR_ROLES: ReadonlySet<string> = new Set([
  "GUEST",
  "CLIENT",
]);

/**
 * True when `role` is a read-only workspace role.
 *
 * Accepts null/undefined and answers `false` for them, which is deliberate and
 * load-bearing: `getPrimaryWorkspaceRole` (auth-guards.ts:55) returns **null**,
 * not "GUEST", for a user with no WorkspaceMember row, and that null is what
 * lands in the JWT for someone still mid-signup. Treating "no role yet" as a
 * non-contributor would 403 every onboarding request. Absence of a role is not
 * a read-only role; it is handled by the auth checks that run before this one.
 */
export function isNonContributorRole(
  role: string | null | undefined,
): boolean {
  return typeof role === "string" && NON_CONTRIBUTOR_ROLES.has(role);
}
