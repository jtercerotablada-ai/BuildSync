import { NextResponse } from "next/server";
import { startOfTodayUtc } from "@/lib/date-only";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

/**
 * GET /api/teams/:teamId/workload
 *
 * Per-member workload snapshot — the data backing the Capacity
 * Matrix and Members table on the team workspace.
 *
 * For each member of the team:
 *   - openTasks            count of assigned tasks not yet completed,
 *                          excluding work sitting in archived projects
 *   - overdueTasks         subset of openTasks past due
 *   - completedLast30Days  velocity proxy (tasks closed in last 30d)
 *   - projectsActive       distinct projects they have open tasks on
 *   - taskByProject        { [projectId]: openCount } for the matrix
 *   - capacityPct          0-100, normalized across the team
 *                          (member_open / max(team_open, 1)) × 100
 *                          so the busiest person hits 100% and others
 *                          show their relative load.
 *
 * Plus a `projects` list (id, name, color, status) limited to the
 * projects this team owns (Project.teamId = teamId) so the matrix
 * has labeled columns.
 *
 * Pure derivation from existing tables — no schema changes. Cheap
 * enough that we don't bother caching.
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
    await verifyTeamAccess(userId, teamId);

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
      prisma.task.findMany({
        where: {
          assigneeId: { in: memberIds },
          completed: false,
          parentTaskId: null,
          // The archived projects above lost their column, so their open
          // tasks have to stop filling the bar and the row total too.
          // Tasks with no project at all are real load and still count.
          OR: [{ projectId: null }, { project: { isArchived: false } }],
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
          // Not filtered by archive, unlike the open set: this is what a
          // person shipped in 30 days, and archiving the job they just
          // finished must not erase their velocity. Nothing adds it to
          // openTasks or reads it through a matrix column, so the two
          // can hold different scopes without contradicting each other.
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

      const capacityPct = Math.round((own.length / maxOpen) * 100);

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
        capacityPct,
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
