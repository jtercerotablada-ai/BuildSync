import { NextResponse } from "next/server";
import { startOfTodayUtc } from "@/lib/date-only";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getErrorStatus } from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";
import { taskPrivacyClause } from "@/lib/project-visibility";

/**
 * GET /api/teams/:teamId/workload
 *
 * Per-member workload snapshot — the data behind the Capacity Matrix and the
 * Members table on the team workspace.
 *
 * EVERY NUMBER HERE IS SCOPED TO THIS TEAM'S PROJECTS. It did not used to be.
 * The query was `assigneeId: { in: memberIds }` with no team and no project
 * filter, plus an explicit `{ projectId: null }` arm — so a row labelled
 * "team capacity" counted every task those people were assigned ANYWHERE:
 * other teams' jobs, their personal My Tasks list, and projects in a
 * different workspace entirely. On a three-person firm where the same three
 * people are on every team, the "workload" of each team was identical and
 * none of them were the team's.
 *
 * Per member of the team, all within the team's own projects:
 *   - openTasks            assigned root tasks not yet completed, in the
 *                          team's ACTIVE (non-archived) projects
 *   - overdueTasks         subset of openTasks past due
 *   - completedLast30Days  tasks they closed in the last 30 days in this
 *                          team's projects, archived ones included (see below)
 *   - projectsActive       distinct team projects they have open tasks on
 *   - taskByProject        { [projectId]: openCount } for the matrix
 *   - relativeLoadPct      0-100, this member's open count as a share of the
 *                          BUSIEST member's. Not a capacity or utilisation
 *                          figure — nothing in the product records anyone's
 *                          capacity, so no honest percentage of one can be
 *                          computed. It was called `capacityPct`, which is
 *                          what made it a lie: with 3 open tasks against a
 *                          colleague's 4, "75% capacity" is a number about
 *                          the colleague, not about the person it sat beside.
 *
 * PRIVACY. Every task query is filtered by taskPrivacyClause
 * (@/lib/project-visibility), the same list-query rule search and reports
 * use. A private task must not raise a colleague's bar, name a project
 * column, or show up in a total.
 *
 * Pure derivation from existing tables — no schema changes.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId } = await params;
    // Team membership AND a live contributor seat in the team's workspace: a
    // TeamMember row outlives offboarding, so it was never proof on its own.
    await requireTeamStanding(userId, teamId);

    // 1. Load the team's members
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    const memberIds = members.map((m) => m.userId);

    // 2. Load the team's projects (so the matrix has columns)
    const projects = await prisma.project.findMany({
      // A shelved project gets no column — capacity is about live work.
      where: { teamId, isArchived: false },
      select: {
        id: true,
        name: true,
        color: true,
        status: true,
        gate: true,
        projectNumber: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    const projectIds = projects.map((p) => p.id);

    // 3. Load the relevant tasks in one shot
    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    );

    const [openTasks, recentlyDone] = await Promise.all([
      // Nothing to count when the team owns no live project — and an empty
      // `in` list would otherwise match nothing anyway, so this is the same
      // answer without the round trip.
      projectIds.length === 0
        ? Promise.resolve(
            [] as {
              id: string;
              assigneeId: string | null;
              projectId: string | null;
              dueDate: Date | null;
            }[]
          )
        : prisma.task.findMany({
            where: {
              assigneeId: { in: memberIds },
              completed: false,
              parentTaskId: null,
              // THE team scope. Tasks with no project at all used to be
              // counted here as "real load"; they are real, but they are not
              // this team's load, and they made every team's bars identical.
              projectId: { in: projectIds },
              ...taskPrivacyClause(userId),
            },
            select: {
              id: true,
              assigneeId: true,
              projectId: true,
              dueDate: true,
            },
          }),
      prisma.task.findMany({
        where: {
          assigneeId: { in: memberIds },
          completed: true,
          completedAt: { gte: thirtyDaysAgo },
          parentTaskId: null,
          // Scoped to the team by RELATION rather than to the live project
          // ids above: this is what a person shipped for this team in 30
          // days, and archiving the job they just finished must not erase
          // their velocity. Nothing adds it to openTasks or reads it through
          // a matrix column, so the two can hold different scopes without
          // contradicting each other.
          project: { teamId },
          ...taskPrivacyClause(userId),
        },
        select: {
          id: true,
          assigneeId: true,
        },
      }),
    ]);

    // 4. Build the per-member rollups
    const totalOpenByMember = new Map<string, number>();
    for (const t of openTasks) {
      if (!t.assigneeId) continue;
      totalOpenByMember.set(
        t.assigneeId,
        (totalOpenByMember.get(t.assigneeId) ?? 0) + 1
      );
    }
    const maxOpen = Math.max(1, ...Array.from(totalOpenByMember.values()));

    const memberWorkloads = members.map((m) => {
      const own = openTasks.filter((t) => t.assigneeId === m.userId);
      const overdue = own.filter(
        (t) => t.dueDate && new Date(t.dueDate) < startOfTodayUtc()
      );
      const completedLast30 = recentlyDone.filter(
        (t) => t.assigneeId === m.userId
      ).length;

      const projectsActive = new Set(
        own.map((t) => t.projectId).filter((v): v is string => !!v)
      );

      const taskByProject: Record<string, number> = {};
      for (const t of own) {
        if (!t.projectId) continue;
        taskByProject[t.projectId] = (taskByProject[t.projectId] ?? 0) + 1;
      }

      const relativeLoadPct = Math.round((own.length / maxOpen) * 100);

      return {
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
        openTasks: own.length,
        overdueTasks: overdue.length,
        completedLast30Days: completedLast30,
        projectsActive: projectsActive.size,
        taskByProject,
        relativeLoadPct,
      };
    });

    return NextResponse.json({
      members: memberWorkloads,
      projects,
      summary: {
        totalMembers: members.length,
        totalProjects: projects.length,
        totalOpenTasks: openTasks.length,
        totalOverdueTasks: openTasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < startOfTodayUtc()
        ).length,
        totalCompletedLast30Days: recentlyDone.length,
        maxOpenPerMember: maxOpen,
        // Says out loud what relativeLoadPct is measured against, so a screen
        // can label the bar honestly instead of implying a capacity model
        // this product does not have.
        loadBasis: "share-of-busiest-member" as const,
      },
      // Echoed for client-side rendering so the matrix can list
      // projects even if some have zero open tasks for this team.
      projectIds,
    });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error computing team workload:", error);
    return NextResponse.json(
      { error: "Failed to compute workload" },
      { status: 500 }
    );
  }
}
