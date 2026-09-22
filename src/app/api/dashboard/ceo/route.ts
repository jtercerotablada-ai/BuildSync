import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId, getEffectiveAccess } from "@/lib/auth-utils";
import {
  projectVisibilityClauseFor,
  taskPrivacyClause,
} from "@/lib/project-visibility";

// The two header chips on /home: "N tasks completed" in the selected period
// and "N collaborators".
//
// This route used to also build a full firm-wide "CEO cockpit" payload (map,
// KPI stack, queues, activity) for components that were no longer mounted
// anywhere. Nothing read it, yet any signed-in user could still trigger its
// ~9 queries, so it was removed together with those components. `?slim=1` is
// still accepted from older clients and changes nothing.

/**
 * People the caller actually shares work with.
 *
 * Two ways to reach a project in this product, and both make you a real
 * collaborator: an explicit ProjectMember row, or membership of the TEAM the
 * project is assigned to — project-access.ts grants read AND write on the team
 * alone (`if (input.isTeamMember) return true`). Counting only the explicit
 * rows would report 0 for a firm that hands every job to one team, while three
 * people edit it daily.
 *
 * The caller is excluded; you do not collaborate with yourself. Creating a
 * project writes an OWNER ProjectMember row, so owners are covered by the same
 * query rather than needing a special case.
 *
 * Deliberately NOT the visibility clause used for the tasks chip: a WORKSPACE
 * project is readable by the whole firm, and being able to open a job is not
 * working on it with someone.
 */
async function countSharedCollaborators(
  workspaceId: string,
  userId: string
): Promise<number> {
  // Projects the caller reaches either way. The team arm mirrors
  // project-access.ts, including its requirement that the team live in the
  // project's own workspace — never grant across the workspace boundary.
  const callerProjects = await prisma.project.findMany({
    where: {
      workspaceId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { team: { workspaceId, members: { some: { userId } } } },
      ],
    },
    select: { id: true, teamId: true },
  });
  if (callerProjects.length === 0) return 0;

  const projectIds = callerProjects.map((p) => p.id);
  const teamIds = [
    ...new Set(
      callerProjects
        .map((p) => p.teamId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [direct, viaTeam] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId: { in: projectIds }, userId: { not: userId } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    teamIds.length === 0
      ? Promise.resolve([] as { userId: string }[])
      : prisma.teamMember.findMany({
          where: { teamId: { in: teamIds }, userId: { not: userId } },
          select: { userId: true },
          distinct: ["userId"],
        }),
  ]);

  // One person reachable both ways is one collaborator.
  return new Set([...direct, ...viaTeam].map((r) => r.userId)).size;
}

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    // Floor for `summary.tasksCompleted` — the home header passes the
    // selected period's start as an ISO string; default last 7 days.
    const periodStartParam = searchParams.get("periodStart");
    const parsedPeriodStart = periodStartParam
      ? new Date(periodStartParam)
      : null;
    const periodStart =
      parsedPeriodStart && !Number.isNaN(parsedPeriodStart.getTime())
        ? parsedPeriodStart
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const access = await getEffectiveAccess(userId);
    if (!access) {
      return NextResponse.json({ summary: { tasksCompleted: 0, teamCount: 0 } });
    }
    const { workspaceId } = access;

    // Which projects' tasks count: exactly the ones this viewer may list, from
    // the one shared clause. A local owner/member-only copy of the rule left
    // out team-shared and workspace-visible projects the viewer works on
    // every day, so the chip undercounted real work.
    const visibleProjects = projectVisibilityClauseFor(userId, {
      workspaceId,
      role: access.workspaceRole,
      position: access.position,
    });

    // Not archive-scoped: this is what was shipped inside a window, and
    // archiving the job just finished must not erase it — the same call the
    // team workload route makes for completedLast30Days.
    //
    // Personal tasks (no project) are real completed work too; a relation
    // filter on `project` alone silently drops every one of them. Only the
    // viewer's own are counted — they are the only ones he can see.
    const completedTaskWhere = {
      completedAt: { gte: periodStart },
      AND: [
        // PRIVACY: reading a project is not reading every task in it.
        taskPrivacyClause(userId),
        {
          OR: [
            { project: visibleProjects },
            {
              projectId: null,
              OR: [{ assigneeId: userId }, { creatorId: userId }],
            },
          ],
        },
      ],
    };

    const [tasksCompleted, teamCount] = await Promise.all([
      prisma.task.count({ where: completedTaskWhere }),
      countSharedCollaborators(workspaceId, userId),
    ]);

    return NextResponse.json({ summary: { tasksCompleted, teamCount } });
  } catch (error) {
    console.error("Error in /api/dashboard/ceo:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
