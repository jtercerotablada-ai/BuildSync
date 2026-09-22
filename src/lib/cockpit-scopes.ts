import type { Prisma } from "@prisma/client";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { TERMINAL_STAGE_KEYS } from "@/lib/regulatory";
import { ACTIVE_JOB_WHERE } from "@/lib/cockpit";

/**
 * The three Prisma scopes the Firm cockpit reads through. Server-only (it
 * pulls taskPrivacyClause, whose module imports Prisma), which is why it is
 * not in cockpit.ts. Pure otherwise, and tested.
 *
 * `clause` is the caller's visibility clause for ONE workspace, from
 * project-visibility.ts — never a local copy of the rule. Everything is
 * composed with AND: a caller clause's own OR is kept intact inside its
 * object, never spread next to another OR.
 */
export interface CockpitScopes {
  projectWhere: Prisma.ProjectWhereInput;
  taskScope: Prisma.TaskWhereInput;
  finishedWhere: (since: Date) => Prisma.ProjectWhereInput;
}

export function buildCockpitScopes(
  clause: Prisma.ProjectWhereInput,
  userId: string
): CockpitScopes {
  const projectWhere: Prisma.ProjectWhereInput = {
    AND: [clause, ...ACTIVE_JOB_WHERE],
  };
  const taskScope: Prisma.TaskWhereInput = {
    AND: [
      { project: projectWhere },
      // PRIVACY: reading a project is not reading every task in it.
      taskPrivacyClause(userId),
      // Only top-level tasks count, everywhere on the cockpit.
      { parentTaskId: null },
    ],
  };
  const finishedWhere = (since: Date): Prisma.ProjectWhereInput => ({
    AND: [
      clause,
      { isArchived: false },
      { stage: { in: [...TERMINAL_STAGE_KEYS] } },
      { stageEnteredAt: { gte: since } },
    ],
  });
  return { projectWhere, taskScope, finishedWhere };
}
