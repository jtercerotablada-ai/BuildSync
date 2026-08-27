import prisma from "@/lib/prisma";
import { getLevel } from "@/lib/people-types";
import type { Prisma } from "@prisma/client";

/**
 * The per-workspace "which projects may this user SEE in a list?" clause.
 *
 * This is the LIST-query sibling of canReadProject (@/lib/project-access): that
 * one decides a single already-loaded project, this one is the Prisma `where`
 * that keeps invisible projects out of a result set in the first place.
 *
 * The rule, per workspace the caller belongs to:
 *   - workspace OWNER/ADMIN, or Position level >= 4 → every project in it
 *   - everyone else → only projects they own, are a member of, or PUBLIC
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
    include: { user: { select: { position: true } } },
  });
  if (memberships.length === 0) return null;

  return memberships.map((m) => {
    const level = getLevel(m.user.position);
    // L4+ rules vary by role: OWNER and ADMIN always see all workspace
    // projects; everyone else needs Position level >= 4 OR explicit project
    // membership.
    const seesAllInWorkspace =
      m.role === "OWNER" || m.role === "ADMIN" || level >= 4;

    if (seesAllInWorkspace) {
      return { workspaceId: m.workspaceId };
    }
    return {
      workspaceId: m.workspaceId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { visibility: "PUBLIC" as const },
      ],
    };
  });
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
 * 403, but /api/search listed every team in the workspace by name, so Cmd+K
 * disclosed private team names (and ids) behind a dead link.
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
