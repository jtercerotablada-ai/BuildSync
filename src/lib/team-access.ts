/**
 * team-access.ts — the single rule for "what may this caller do inside this
 * team?", the sibling of project-access.ts, objective-access.ts and
 * message-access.ts.
 *
 * WHY THIS FILE EXISTS
 *
 * Every team route hand-rolled its own check and they did not agree:
 *
 *   • POST /api/teams/:id/invite admitted a team LEAD *or* a workspace
 *     ADMIN/OWNER, while PATCH/DELETE /api/teams/:id/members admitted ONLY a
 *     LEAD. So a workspace owner could put someone on a team and then not be
 *     able to take them off again, and a team whose only LEAD left the firm
 *     was permanently unadministrable.
 *
 *   • GET /api/teams/:id/tasks, /work and /workload asked `verifyTeamAccess`
 *     alone, which proves nothing except that a TeamMember row exists — and a
 *     TeamMember row is not evidence that the person still works here. Proper
 *     offboarding does clean them up (DELETE /api/workspace/members deletes the
 *     TeamMember rows in the same transaction as the seat), but that is the
 *     only path that does: a seat removed any other way, or a row that predates
 *     that transaction, leaves a membership behind with nothing to revoke it.
 *     `resolveProjectAccess` already refuses the team grant to a caller with no
 *     contributor seat — for exactly that reason — while those three routes
 *     read tasks and projects straight out of Prisma and handed them to the
 *     stale row anyway. A GUEST/CLIENT seat fails the same check: read-only by
 *     design, and a team grant is Editor-level.
 *
 * The rule, in one place:
 *
 *   read    (tasks, work, workload)  team member | workspace OWNER/ADMIN
 *   manage  (add / remove / role)    team LEAD   | workspace OWNER/ADMIN
 *   outsider invite                  workspace OWNER/ADMIN only
 *
 * ...and EVERY branch first requires a contributor seat in the TEAM's own
 * workspace, never in some other workspace the caller happens to belong to.
 *
 * DISCLOSURE. A caller who fails the seat check, and a non-member of a PRIVATE
 * team, get 404 rather than 403 — a 403 confirms the id names a real team,
 * which is the one fact team privacy exists to withhold. Same rule
 * `teamVisibilityClause` (@/lib/project-visibility) enforces for search and
 * the join/requests routes enforce for their own entry points.
 */

import prisma from "@/lib/prisma";
import {
  AuthorizationError,
  NotFoundError,
  contributorSeatSatisfied,
} from "@/lib/auth-guards";

export interface TeamStanding {
  teamId: string;
  teamName: string;
  /** The team's OWN workspace. Every permission below is resolved in it. */
  workspaceId: string;
  isArchived: boolean;
  privacy: string;
  /** The caller holds a TeamMember row. */
  isMember: boolean;
  /** TeamMember.role, or null when the caller is not on the team. */
  teamRole: string | null;
  isLead: boolean;
  /** WorkspaceMember.role in the TEAM's workspace, or null when there is none. */
  workspaceRole: string | null;
  /** Workspace OWNER/ADMIN of the team's workspace. */
  isWorkspaceManager: boolean;
  /** May read the team's tasks / work / workload. */
  canRead: boolean;
  /** May add, remove and re-role members. */
  canManageMembers: boolean;
  /**
   * May pull somebody who is NOT yet in the workspace into it. Workspace
   * managers only — see `assertWorkspaceContributors` for why a team lead
   * must not.
   */
  canInviteOutsiders: boolean;
}

/**
 * Resolve the caller's standing in a team, or throw.
 *
 * Deliberately NOT a drop-in for `verifyTeamAccess`: that one answers "is
 * there a TeamMember row?" and returns it. This one answers "does this person
 * still work here, and what may they do?" — which is the question every team
 * route was actually asking.
 */
export async function requireTeamStanding(
  userId: string,
  teamId: string
): Promise<TeamStanding> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      isArchived: true,
      privacy: true,
    },
  });
  if (!team) {
    throw new NotFoundError("Team not found");
  }

  const [membership, wsMember] = await Promise.all([
    prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
      select: { role: true },
    }),
    prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: team.workspaceId },
      },
      select: { role: true },
    }),
  ]);

  // No contributor seat in the team's workspace = an outsider or an
  // offboarded account whose TeamMember row was left behind. It must not even
  // learn the team is real.
  if (!contributorSeatSatisfied(wsMember?.role)) {
    throw new NotFoundError("Team not found");
  }

  const isMember = !!membership;
  const teamRole = membership?.role ?? null;
  const isWorkspaceManager =
    wsMember?.role === "OWNER" || wsMember?.role === "ADMIN";

  const standing: TeamStanding = {
    teamId: team.id,
    teamName: team.name,
    workspaceId: team.workspaceId,
    isArchived: team.isArchived,
    privacy: team.privacy,
    isMember,
    teamRole,
    isLead: teamRole === "LEAD",
    workspaceRole: wsMember?.role ?? null,
    isWorkspaceManager,
    canRead: isMember || isWorkspaceManager,
    canManageMembers: teamRole === "LEAD" || isWorkspaceManager,
    canInviteOutsiders: isWorkspaceManager,
  };

  if (!standing.canRead) {
    // A PRIVATE team is invisible to workspace members who are not on it —
    // same answer teamVisibilityClause gives a search. PUBLIC and
    // REQUEST_TO_JOIN teams are listed by name already, so 403 there is not a
    // disclosure and keeps the message the UI has always shown.
    if (team.privacy === "PRIVATE") {
      throw new NotFoundError("Team not found");
    }
    throw new AuthorizationError("You don't have access to this team");
  }

  return standing;
}

/** Throw unless the caller may add / remove / re-role this team's members. */
export function requireTeamMemberManagement(standing: TeamStanding): void {
  if (!standing.canManageMembers) {
    throw new AuthorizationError(
      "Only team leads or workspace admins can manage members"
    );
  }
}

/**
 * Throw unless the team can still take new members.
 *
 * Mirrors POST /api/teams/:id/join, which already refuses an archived team.
 * Archiving is the reversible alternative to deleting, so the team is not
 * gone — it is simply not accepting anyone new until it is restored.
 */
export function assertTeamAcceptsNewMembers(standing: TeamStanding): void {
  if (standing.isArchived) {
    throw new AuthorizationError(
      "This team is archived and isn't taking new members. Restore it first."
    );
  }
}

/**
 * The `?archived=` filter shared by GET /api/teams and GET /api/teams/list.
 *
 * Archiving a team is the reversible alternative to deleting one (deleting
 * detaches every project and destroys the team's messages), so an archived
 * team is still real — it just must not sit in the Teams list next to live
 * work. Default is ACTIVE ONLY; `?archived=true` returns the archive on its
 * own, `?archived=all` returns both.
 *
 * Returns a `where` fragment to spread, so an unrecognised value fails closed
 * on the default rather than quietly widening the list.
 */
export function teamArchiveWhere(
  archivedParam: string | null
): { isArchived?: boolean } {
  if (archivedParam === "all") return {};
  if (archivedParam === "true" || archivedParam === "1") {
    return { isArchived: true };
  }
  return { isArchived: false };
}

/**
 * Assert that every one of `userIds` already holds a CONTRIBUTOR seat in
 * `workspaceId`, or throw.
 *
 * THE RULE THIS ENCODES: a team is a grouping INSIDE a workspace, never a
 * side door into one. Adding somebody to a team must never be what creates
 * their WorkspaceMember row.
 *
 * It used to be exactly that. POST /api/teams/:id/invite looked up ANY
 * registered account by email, added the TeamMember, and then created a
 * WorkspaceMember with role MEMBER if one was missing — so any team lead
 * could pull any existing account in the database into the firm's workspace,
 * with no workspace-admin approval anywhere and no notice to anyone. POST
 * /api/teams did the same thing in bulk, `createMany`-ing seats straight from
 * a client-supplied `memberIds` array.
 *
 * A seat is granted in exactly two places now: an invitation the invitee
 * themselves accepts (POST /api/invite/:token/accept) and the workspace
 * People screen. Both are auditable and both are gated on workspace
 * leadership; a TeamMember row is neither.
 *
 * Non-contributors (GUEST / CLIENT) are refused for a second reason: a team
 * grant is Editor-level on every project attached to the team, which is
 * flatly the capability those roles are defined not to have —
 * `resolveProjectAccess` drops the team grant for them, so the row would buy
 * nothing but a misleading name in the members table.
 */
export async function assertWorkspaceContributors(
  userIds: readonly string[],
  workspaceId: string
): Promise<void> {
  const wanted = Array.from(new Set(userIds));
  if (wanted.length === 0) return;

  const rows = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: wanted } },
    select: { userId: true, role: true },
  });
  const seated = new Set(
    rows.filter((r) => contributorSeatSatisfied(r.role)).map((r) => r.userId)
  );
  const rejected = wanted.filter((id) => !seated.has(id));

  if (rejected.length > 0) {
    throw new AuthorizationError(
      rejected.length === 1
        ? "That person isn't a member of this workspace. Invite them to the workspace first, then add them to the team."
        : `${rejected.length} of those people aren't members of this workspace. Invite them to the workspace first, then add them to the team.`
    );
  }
}
