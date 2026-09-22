import { NextResponse } from "next/server";
import type { ProjectType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId, getEffectiveAccess } from "@/lib/auth-utils";
import {
  projectVisibilityClauseFor,
  taskPrivacyClause,
} from "@/lib/project-visibility";
import { getLevel } from "@/lib/people-types";
import { isNonContributorRole } from "@/lib/workspace-roles";
import { resolveStage, stageLabel, type StageDirection } from "@/lib/pipelines";
import {
  STALE_AFTER_DAYS,
  assembleOverdue,
  daysInStage,
  emptyCockpitPayload,
  isStale,
  pickPeUserIds,
  resolveCallerToday,
  resolveJobStage,
  type CockpitJob,
  type CockpitPayload,
  type CockpitUser,
} from "@/lib/cockpit";
import { buildCockpitScopes } from "@/lib/cockpit-scopes";

// GET /api/dashboard/ceo
//
//   (default)  The Firm cockpit on /home: every active job the caller can see,
//              grouped client-side by pipeline stage and holder, plus the P.E.
//              sign queue, overdue tasks by person and the last stage moves.
//              `?today=YYYY-MM-DD` is the viewer's calendar day (useToday()),
//              trusted within ±1 day of the UTC day; it decides "overdue".
//   ?slim=1    The two header chips: "N tasks completed" in the selected
//              period and "N collaborators". `?periodStart=` without `?today=`
//              is also answered slim, for bundles cached from before the split.
//
// Visibility has ONE source: the caller's clause from project-visibility.ts,
// ANDed with the active-job rule in cockpit-scopes.ts. Never a local copy.
// Read-only: nothing here writes a stage, a gate or a deadline.

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const JOB_LIMIT = 300;
const OVERDUE_SAMPLE = 200;
const APPROVAL_SAMPLE = 25;
const MOVES_LIMIT = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

async function slimSummary(
  request: Request,
  userId: string
): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams;
  // Floor for `summary.tasksCompleted` — the home header passes the
  // selected period's start as an ISO string; default last 7 days.
  const periodStartParam = searchParams.get("periodStart");
  const parsedPeriodStart = periodStartParam ? new Date(periodStartParam) : null;
  const periodStart =
    parsedPeriodStart && !Number.isNaN(parsedPeriodStart.getTime())
      ? parsedPeriodStart
      : new Date(Date.now() - 7 * MS_PER_DAY);

  const access = await getEffectiveAccess(userId);
  if (!access) {
    return NextResponse.json(
      { summary: { tasksCompleted: 0, teamCount: 0 } },
      { headers: NO_STORE }
    );
  }
  const { workspaceId } = access;

  // Which projects' tasks count: exactly the ones this viewer may list, from
  // the one shared clause.
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

  return NextResponse.json(
    { summary: { tasksCompleted, teamCount } },
    { headers: NO_STORE }
  );
}

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;
const dayOnly = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;
const userOf = (
  u: { id: string; name: string | null; image: string | null } | null
): CockpitUser | null =>
  u ? { id: u.id, name: u.name ?? null, image: u.image ?? null } : null;

async function cockpit(request: Request, userId: string): Promise<NextResponse> {
  const now = new Date();
  const searchParams = new URL(request.url).searchParams;
  const todayDay = resolveCallerToday(searchParams.get("today"), now);

  // Round trip 1.
  const access = await getEffectiveAccess(userId);
  if (!access) {
    return NextResponse.json(emptyCockpitPayload(userId, now, todayDay), {
      headers: NO_STORE,
    });
  }
  const { workspaceId } = access;
  const role = access.workspaceRole;
  const isContributor = !isNonContributorRole(role);
  const isManager =
    isContributor &&
    (role === "OWNER" || role === "ADMIN" || getLevel(access.position) >= 4);

  // The caller's clause for THIS workspace, from the shared rule. Same
  // function buildProjectVisibilityClauses maps over, fed from the
  // membership getEffectiveAccess already picked — one query fewer.
  const clause = projectVisibilityClauseFor(userId, {
    workspaceId,
    role,
    position: access.position,
  });
  const { projectWhere, taskScope, finishedWhere } = buildCockpitScopes(
    clause,
    userId
  );

  // Round trip 2: the people (PE queue + overdue rows).
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: {
      role: true,
      sealAuthorizedAt: true,
      user: {
        select: { id: true, name: true, image: true, position: true },
      },
    },
  });
  const peIds = pickPeUserIds(members);
  const overdueWhere = {
    AND: [taskScope, { completedAt: null, dueDate: { lt: todayDay } }],
  };
  const approvalWhere = {
    AND: [
      taskScope,
      {
        taskType: "APPROVAL" as const,
        completedAt: null,
        assigneeId: { in: peIds },
      },
    ],
  };

  // Round trip 3: everything else, in parallel.
  const [
    projects,
    finishedLast30Days,
    openByProject,
    overdueByProject,
    overdueByAssignee,
    overdueTasks,
    approvals,
    approvalCount,
    moves,
  ] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      take: JOB_LIMIT + 1,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        color: true,
        type: true,
        status: true,
        clientName: true,
        location: true,
        latitude: true,
        longitude: true,
        stage: true,
        stageEnteredAt: true,
        stageBlocker: true,
        regulatoryDeadline: true,
        jurisdiction: true,
        permitNumber: true,
        caseNumber: true,
        folioNumber: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.project.count({
      where: finishedWhere(new Date(now.getTime() - 30 * MS_PER_DAY)),
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { AND: [taskScope, { completedAt: null }] },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: overdueWhere,
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: overdueWhere,
      _count: { _all: true },
      _min: { dueDate: true },
    }),
    prisma.task.findMany({
      where: overdueWhere,
      orderBy: { dueDate: "asc" },
      take: OVERDUE_SAMPLE,
      select: {
        id: true,
        name: true,
        dueDate: true,
        assigneeId: true,
        project: { select: { id: true, name: true, color: true } },
      },
    }),
    peIds.length === 0
      ? Promise.resolve([])
      : prisma.task.findMany({
          where: approvalWhere,
          orderBy: [
            { dueDate: { sort: "asc", nulls: "last" } },
            { createdAt: "asc" },
          ],
          take: APPROVAL_SAMPLE,
          select: {
            id: true,
            name: true,
            dueDate: true,
            createdAt: true,
            project: { select: { id: true, name: true, color: true } },
            assignee: { select: { id: true, name: true, image: true } },
          },
        }),
    peIds.length === 0
      ? Promise.resolve(0)
      : prisma.task.count({ where: approvalWhere }),
    prisma.projectStageEvent.findMany({
      where: { project: projectWhere },
      orderBy: { createdAt: "desc" },
      take: MOVES_LIMIT,
      select: {
        id: true,
        createdAt: true,
        direction: true,
        fromStage: true,
        toStage: true,
        reason: true,
        project: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, image: true } },
      },
    }),
  ]);

  const truncated = projects.length > JOB_LIMIT;
  const openMap = new Map(
    openByProject.map((g) => [g.projectId, g._count._all])
  );
  const overdueMap = new Map(
    overdueByProject.map((g) => [g.projectId, g._count._all])
  );

  const jobs: CockpitJob[] = projects.slice(0, JOB_LIMIT).map((p) => {
    const resolved = resolveJobStage(p.type as ProjectType | null, p.stage);
    const dwell = daysInStage(p.stageEnteredAt, now);
    const limit = resolved.holder ? STALE_AFTER_DAYS[resolved.holder] : null;
    return {
      id: p.id,
      name: p.name,
      projectNumber: p.projectNumber ?? null,
      color: p.color,
      type: p.type ?? null,
      status: p.status,
      clientName: p.clientName ?? null,
      location: p.location ?? null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      owner: userOf(p.owner),
      stage: resolved.stageKey,
      pipelineId: resolved.pipelineId,
      stageLabel: resolved.stageLabel,
      stageIndex: resolved.stageIndex,
      stageCount: resolved.stageCount,
      holder: resolved.holder,
      stageEnteredAt: iso(p.stageEnteredAt),
      daysInStage: dwell,
      staleAfterDays: limit ?? null,
      stale: isStale(resolved.holder, dwell),
      blocker: p.stageBlocker?.trim() ? p.stageBlocker.trim() : null,
      regulatoryDeadline: dayOnly(p.regulatoryDeadline),
      jurisdiction: p.jurisdiction ?? null,
      permitNumber: p.permitNumber ?? null,
      caseNumber: p.caseNumber ?? null,
      folioNumber: p.folioNumber ?? null,
      openTasks: openMap.get(p.id) ?? 0,
      overdueTasks: overdueMap.get(p.id) ?? 0,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  const overdue = assembleOverdue(
    overdueByAssignee.map((g) => ({
      assigneeId: g.assigneeId,
      count: g._count._all,
      oldestDueDate: g._min.dueDate,
    })),
    members
  );

  const peSet = new Set(peIds);
  const payload: CockpitPayload = {
    version: 2,
    generatedAt: now.toISOString(),
    viewer: { userId, isManager, isPe: peSet.has(userId), isContributor },
    jobs,
    finishedLast30Days,
    truncated,
    peQueue: {
      peUsers: members
        .filter((m) => peSet.has(m.user.id))
        .filter(
          (m, i, all) => all.findIndex((x) => x.user.id === m.user.id) === i
        )
        .map((m) => userOf(m.user)!),
      tasks: approvals.flatMap((t) =>
        t.project && t.assignee
          ? [
              {
                id: t.id,
                name: t.name,
                dueDate: iso(t.dueDate),
                createdAt: t.createdAt.toISOString(),
                project: t.project,
                assignee: userOf(t.assignee)!,
              },
            ]
          : []
      ),
      taskCount: approvalCount,
    },
    overdue: {
      asOf: todayDay.toISOString().slice(0, 10),
      ...overdue,
      tasks: overdueTasks.flatMap((t) =>
        t.project && t.dueDate
          ? [
              {
                id: t.id,
                name: t.name,
                dueDate: t.dueDate.toISOString(),
                assigneeId: t.assigneeId,
                project: t.project,
              },
            ]
          : []
      ),
    },
    moves: moves.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      direction: (["FORWARD", "BACKWARD", "SEED"].includes(m.direction)
        ? m.direction
        : "FORWARD") as StageDirection,
      fromLabel: stageLabel(m.fromStage),
      toLabel: stageLabel(m.toStage),
      toHolder: resolveStage(m.toStage)?.stage.holder ?? null,
      reason: m.reason?.trim() ? m.reason.trim() : null,
      project: m.project,
      user: userOf(m.user),
    })),
  };

  return NextResponse.json(payload, { headers: NO_STORE });
}

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_STORE }
      );
    }
    const searchParams = new URL(request.url).searchParams;
    const slim =
      searchParams.get("slim") === "1" ||
      (searchParams.has("periodStart") && !searchParams.has("today"));
    return slim
      ? await slimSummary(request, userId)
      : await cockpit(request, userId);
  } catch (error) {
    console.error("Error in /api/dashboard/ceo:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500, headers: NO_STORE }
    );
  }
}
