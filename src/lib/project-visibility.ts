import prisma from "@/lib/prisma";
import { getLevel } from "@/lib/people-types";
import { isNonContributorRole } from "@/lib/workspace-roles";
import type { Position, Prisma } from "@prisma/client";

/**
 * The per-workspace "which projects may this user SEE in a list?" clause.
 *
 * This is the LIST-query sibling of canReadProject (@/lib/project-access): that
 * one decides a single already-loaded project, this one is the Prisma `where`
 * that keeps invisible projects out of a result set in the first place. The
 * two must grant exactly the same projects — a project you can open but never
 * find is as much a bug as one you can find but not open.
 *
 * The rule, per workspace the caller belongs to (see project-access.ts):
 *   - contributor who is workspace OWNER/ADMIN, or Position level >= 4
 *       → every project in it
 *   - any other contributor → projects they own, are a member of, whose team
 *       they are on, or whose visibility is WORKSPACE/PUBLIC
 *   - a non-contributor seat (GUEST/CLIENT) → only projects they own or were
 *       explicitly added to; no implicit grant of any kind
 *
 * WHY THIS FILE EXISTS: the clause was copy-pasted into GET /api/projects and
 * /api/mentions, and a THIRD consumer — /api/search — never got it at all and
 * filtered on workspaceId alone, so Cmd+K listed the names of PRIVATE projects
 * and their tasks to people who cannot open them. Two copies drift; three
 * copies where one is missing is how a leak hides. One function now.
 *
 * Returns `null` when the user has no workspace membership at all — callers
 * decide whether that is an empty result or an error.
 */
export async function buildProjectVisibilityClauses(
  userId: string,
): Promise<Prisma.ProjectWhereInput[] | null> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      workspaceId: true,
      role: true,
      user: { select: { position: true } },
    },
  });
  if (memberships.length === 0) return null;

  return memberships.map((m) =>
    projectVisibilityClauseFor(userId, {
      workspaceId: m.workspaceId,
      role: m.role,
      position: m.user.position,
    }),
  );
}

/** One workspace's clause, as a pure function so it is testable without a DB. */
export function projectVisibilityClauseFor(
  userId: string,
  m: { workspaceId: string; role: string; position: Position | null },
): Prisma.ProjectWhereInput {
  const explicit: Prisma.ProjectWhereInput[] = [
    { ownerId: userId },
    { members: { some: { userId } } },
  ];

  if (isNonContributorRole(m.role)) {
    return { workspaceId: m.workspaceId, OR: explicit };
  }

  const seesAllInWorkspace =
    m.role === "OWNER" ||
    m.role === "ADMIN" ||
    getLevel(m.position) >= 4;
  if (seesAllInWorkspace) {
    return { workspaceId: m.workspaceId };
  }

  return {
    workspaceId: m.workspaceId,
    OR: [
      ...explicit,
      { visibility: { in: ["WORKSPACE", "PUBLIC"] } },
      // Team sharing, scoped to a team in the SAME workspace — mirrors the
      // team grant in resolveProjectAccess.
      {
        team: {
          workspaceId: m.workspaceId,
          members: { some: { userId } },
        },
      },
    ],
  };
}

/**
 * Tasks a user may see in a list: everything that is not flagged private, plus
 * their own private ones. Mirrors the filter in /api/ai/assist.
 *
 * `Task.isPrivate` means "visible only to the assignee, creator and
 * collaborators" — collaborators are omitted here deliberately, because a list
 * query would need a join per row and the cost is not worth it for a search
 * result; the task detail route is the real gate and does honour them.
 */
export function taskPrivacyClause(userId: string): Prisma.TaskWhereInput {
  return {
    OR: [{ isPrivate: false }, { assigneeId: userId }, { creatorId: userId }],
  };
}

/**
 * Teams a user may see in a list. PRIVATE teams are invisible to non-members —
 * GET /api/teams already filtered this way and GET /api/teams/[teamId] answers
 * 404, but /api/search listed every team in the workspace by name, so Cmd+K
 * disclosed private team names (and ids) behind a dead link.
 *
 * Both team routes also admit a workspace OWNER/ADMIN to PRIVATE teams. This
 * clause takes no role, so it does not: a caller that knows the viewer is a
 * workspace manager must widen it itself.
 */
export function teamVisibilityClause(userId: string): Prisma.TeamWhereInput {
  return {
    OR: [
      { privacy: "PUBLIC" as const },
      { privacy: "REQUEST_TO_JOIN" as const },
      { members: { some: { userId } } },
    ],
  };
}
