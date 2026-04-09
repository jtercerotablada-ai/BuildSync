import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#ef4444", // red
  "#eab308", // yellow
  "#8b5cf6", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#64748b", // slate
  "#84cc16", // lime
];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

// GET /api/reports - Get report data
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // my-impact | organization

    // Get user's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const isMyImpact = type === "my-impact";
    const baseWhere = {
      project: {
        workspaceId: workspaceMember.workspaceId,
      },
      ...(isMyImpact ? { assigneeId: userId } : {}),
    };

    // Get date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    // Calculate 6 months ago for tasksCompletedByMonth
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Fetch all metrics in parallel
    const [
      completedTasks,
      incompleteTasks,
      overdueTasks,
      totalTasks,
      tasksByProject,
      tasksByStatus,
      projectsByStatus,
      upcomingByAssigneeRaw,
      // New queries
      overdueByProjectRaw,
      tasksByAssigneeRaw,
      tasksByCreatorRaw,
      projectsByOwnerRaw,
      portfolioProjectsRaw,
      goalsByStatusRaw,
      projectsMostCompletedRaw,
      tasksCompletedByMonthRaw,
      tasksThisMonthByProjectRaw,
      upcomingByProjectRaw,
    ] = await Promise.all([
      // 1. Completed tasks
      prisma.task.count({
        where: {
          ...baseWhere,
          completed: true,
        },
      }),
      // 2. Incomplete tasks
      prisma.task.count({
        where: {
          ...baseWhere,
          completed: false,
        },
      }),
      // 3. Overdue tasks
      prisma.task.count({
        where: {
          ...baseWhere,
          completed: false,
          dueDate: {
            lt: now,
          },
        },
      }),
      // 4. Total tasks
      prisma.task.count({
        where: baseWhere,
      }),
      // 5. Tasks by project (incomplete)
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...baseWhere,
          completed: false,
          projectId: { not: null },
        },
        _count: true,
      }),
      // 6. Tasks by completion status this month
      prisma.task.findMany({
        where: {
          ...baseWhere,
          OR: [
            { dueDate: { gte: startOfMonth, lte: endOfMonth } },
            { completedAt: { gte: startOfMonth, lte: endOfMonth } },
          ],
        },
        select: {
          id: true,
          completed: true,
          dueDate: true,
          completedAt: true,
        },
      }),
      // 7. Projects by status
      prisma.project.groupBy({
        by: ["status"],
        where: {
          workspaceId: workspaceMember.workspaceId,
          ...(isMyImpact ? { ownerId: userId } : {}),
        },
        _count: true,
      }),
      // 8. Upcoming tasks this week by assignee
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          ...baseWhere,
          completed: false,
          dueDate: {
            gte: startOfWeek,
            lte: endOfWeek,
          },
          assigneeId: { not: null },
        },
        _count: true,
      }),
      // 9. Overdue tasks by project
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...baseWhere,
          completed: false,
          dueDate: { lt: now },
          projectId: { not: null },
        },
        _count: true,
      }),
      // 10. Tasks by assignee (all, for completed/incomplete breakdown)
      prisma.task.findMany({
        where: {
          ...baseWhere,
          assigneeId: { not: null },
        },
        select: {
          assigneeId: true,
          completed: true,
        },
      }),
      // 11. Tasks by creator
      prisma.task.groupBy({
        by: ["creatorId"],
        where: baseWhere,
        _count: true,
      }),
      // 12. Projects by owner
      prisma.project.groupBy({
        by: ["ownerId"],
        where: {
          workspaceId: workspaceMember.workspaceId,
          ...(isMyImpact ? { ownerId: userId } : {}),
        },
        _count: true,
      }),
      // 13. Portfolio-project relations for projects in this workspace
      prisma.portfolioProject.findMany({
        where: {
          portfolio: {
            workspaceId: workspaceMember.workspaceId,
          },
          project: {
            workspaceId: workspaceMember.workspaceId,
            ...(isMyImpact ? { ownerId: userId } : {}),
          },
        },
        select: {
          portfolioId: true,
          projectId: true,
        },
      }),
      // 14. Goals/Objectives by status
      prisma.objective.groupBy({
        by: ["status"],
        where: {
          workspaceId: workspaceMember.workspaceId,
          ...(isMyImpact ? { ownerId: userId } : {}),
        },
        _count: true,
      }),
      // 15. Projects ranked by completed tasks count
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...baseWhere,
          completed: true,
          projectId: { not: null },
        },
        _count: true,
      }),
      // 16. Tasks completed in last 6 months (for monthly chart)
      prisma.task.findMany({
        where: {
          ...baseWhere,
          completed: true,
          completedAt: {
            gte: sixMonthsAgo,
          },
        },
        select: {
          completedAt: true,
        },
      }),
      // 17. Tasks due this month grouped by project
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...baseWhere,
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          projectId: { not: null },
        },
        _count: true,
      }),
      // 18. Upcoming (due this week, not completed) tasks by project
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...baseWhere,
          completed: false,
          dueDate: {
            gte: startOfWeek,
            lte: endOfWeek,
          },
          projectId: { not: null },
        },
        _count: true,
      }),
    ]);

    // Collect all unique IDs we need to resolve names for
    const allProjectIds = new Set<string>();
    const allUserIds = new Set<string>();
    const allPortfolioIds = new Set<string>();

    // From existing queries
    tasksByProject.forEach((t) => t.projectId && allProjectIds.add(t.projectId));
    upcomingByAssigneeRaw.forEach((t) => t.assigneeId && allUserIds.add(t.assigneeId));

    // From new queries
    overdueByProjectRaw.forEach((t) => t.projectId && allProjectIds.add(t.projectId));
    tasksByAssigneeRaw.forEach((t) => t.assigneeId && allUserIds.add(t.assigneeId));
    tasksByCreatorRaw.forEach((t) => t.creatorId && allUserIds.add(t.creatorId));
    projectsByOwnerRaw.forEach((p) => p.ownerId && allUserIds.add(p.ownerId));
    portfolioProjectsRaw.forEach((pp) => allPortfolioIds.add(pp.portfolioId));
    projectsMostCompletedRaw.forEach((t) => t.projectId && allProjectIds.add(t.projectId));
    tasksThisMonthByProjectRaw.forEach((t) => t.projectId && allProjectIds.add(t.projectId));
    upcomingByProjectRaw.forEach((t) => t.projectId && allProjectIds.add(t.projectId));

    // Batch fetch all referenced entities
    const [allProjects, allUsers, allPortfolios] = await Promise.all([
      allProjectIds.size > 0
        ? prisma.project.findMany({
            where: { id: { in: Array.from(allProjectIds) } },
            select: { id: true, name: true, color: true },
          })
        : [],
      allUserIds.size > 0
        ? prisma.user.findMany({
            where: { id: { in: Array.from(allUserIds) } },
            select: { id: true, name: true },
          })
        : [],
      allPortfolioIds.size > 0
        ? prisma.portfolio.findMany({
            where: { id: { in: Array.from(allPortfolioIds) } },
            select: { id: true, name: true, color: true },
          })
        : [],
    ]);

    const projectMap = new Map(allProjects.map((p) => [p.id, p]));
    const userMap = new Map(allUsers.map((u) => [u.id, u.name || "Unknown"]));
    const portfolioMap = new Map(allPortfolios.map((p) => [p.id, p]));

    // Process tasks by status (existing)
    const upcoming = tasksByStatus.filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate) >= now
    ).length;
    const overdue = tasksByStatus.filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate) < now
    ).length;
    const noDate = tasksByStatus.filter((t) => !t.completed && !t.dueDate).length;
    const completed = tasksByStatus.filter((t) => t.completed).length;

    // Process tasksByAssigneeAndStatus
    const assigneeTaskMap = new Map<string, { completed: number; incomplete: number }>();
    for (const task of tasksByAssigneeRaw) {
      const id = task.assigneeId!;
      if (!assigneeTaskMap.has(id)) {
        assigneeTaskMap.set(id, { completed: 0, incomplete: 0 });
      }
      const entry = assigneeTaskMap.get(id)!;
      if (task.completed) {
        entry.completed++;
      } else {
        entry.incomplete++;
      }
    }
    const tasksByAssigneeAndStatus = Array.from(assigneeTaskMap.entries())
      .map(([assigneeId, counts]) => ({
        name: userMap.get(assigneeId) || "Unknown",
        completed: counts.completed,
        incomplete: counts.incomplete,
      }))
      .sort((a, b) => (b.completed + b.incomplete) - (a.completed + a.incomplete))
      .slice(0, 10);

    // Process portfolioProjectsRaw -> projectsByPortfolio
    const portfolioCountMap = new Map<string, number>();
    for (const pp of portfolioProjectsRaw) {
      portfolioCountMap.set(pp.portfolioId, (portfolioCountMap.get(pp.portfolioId) || 0) + 1);
    }
    const projectsByPortfolio = Array.from(portfolioCountMap.entries())
      .map(([portfolioId, count], i) => ({
        name: portfolioMap.get(portfolioId)?.name || "Unknown",
        value: count,
        color: portfolioMap.get(portfolioId)?.color || getColor(i),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Process goalsByStatus
    const goalStatusColors: Record<string, string> = {
      ON_TRACK: "#22c55e",
      AT_RISK: "#eab308",
      OFF_TRACK: "#ef4444",
      ACHIEVED: "#3b82f6",
    };
    const goalsByStatus = goalsByStatusRaw.map((g) => ({
      name: g.status.replace(/_/g, " "),
      value: g._count,
      color: goalStatusColors[g.status] || "#94a3b8",
    }));

    // Process tasksCompletedByMonth
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthCounts = new Map<string, number>();
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthCounts.set(key, 0);
    }
    for (const task of tasksCompletedByMonthRaw) {
      if (task.completedAt) {
        const d = new Date(task.completedAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (monthCounts.has(key)) {
          monthCounts.set(key, monthCounts.get(key)! + 1);
        }
      }
    }
    const tasksCompletedByMonth = Array.from(monthCounts.entries()).map(([key, count]) => {
      const [, monthStr] = key.split("-");
      return {
        name: monthNames[parseInt(monthStr)],
        value: count,
      };
    });

    return NextResponse.json({
      kpis: {
        completed: completedTasks,
        incomplete: incompleteTasks,
        overdue: overdueTasks,
        total: totalTasks,
      },
      tasksByProject: tasksByProject
        .map((t, i) => ({
          name: projectMap.get(t.projectId!)?.name || "Unknown",
          value: t._count,
          color: projectMap.get(t.projectId!)?.color || getColor(i),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      tasksByStatus: [
        { name: "Upcoming", value: upcoming, color: "#22c55e" },
        { name: "Overdue", value: overdue, color: "#ef4444" },
        { name: "No date", value: noDate, color: "#94a3b8" },
        { name: "Completed", value: completed, color: "#3b82f6" },
      ].filter((s) => s.value > 0),
      projectsByStatus: projectsByStatus.map((p) => ({
        name: p.status.replace("_", " "),
        value: p._count,
        color:
          p.status === "ON_TRACK"
            ? "#22c55e"
            : p.status === "AT_RISK"
            ? "#eab308"
            : p.status === "OFF_TRACK"
            ? "#ef4444"
            : p.status === "COMPLETE"
            ? "#3b82f6"
            : "#94a3b8",
      })),
      upcomingByAssignee: upcomingByAssigneeRaw
        .map((t) => ({
          name: userMap.get(t.assigneeId!) || "Unassigned",
          value: t._count,
          color: "#3b82f6",
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),

      // --- New data fields ---

      overdueByProject: overdueByProjectRaw
        .map((t, i) => ({
          name: projectMap.get(t.projectId!)?.name || "Unknown",
          value: t._count,
          color: projectMap.get(t.projectId!)?.color || getColor(i),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),

      tasksByAssigneeAndStatus,

      tasksByCreator: tasksByCreatorRaw
        .map((t, i) => ({
          name: (t.creatorId ? userMap.get(t.creatorId) : null) || "Unknown",
          value: t._count,
          color: getColor(i),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),

      projectsByOwner: projectsByOwnerRaw
        .map((p, i) => ({
          name: (p.ownerId ? userMap.get(p.ownerId) : null) || "Unknown",
          value: p._count,
          color: getColor(i),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),

      projectsByPortfolio,

      goalsByStatus,

      projectsMostCompleted: projectsMostCompletedRaw
        .map((t, i) => ({
          name: projectMap.get(t.projectId!)?.name || "Unknown",
          value: t._count,
          color: projectMap.get(t.projectId!)?.color || getColor(i),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),

      tasksCompletedByMonth,

      tasksThisMonthByProject: tasksThisMonthByProjectRaw
        .map((t, i) => ({
          name: projectMap.get(t.projectId!)?.name || "Unknown",
          value: t._count,
          color: projectMap.get(t.projectId!)?.color || getColor(i),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),

      upcomingByProject: upcomingByProjectRaw
        .map((t, i) => ({
          name: projectMap.get(t.projectId!)?.name || "Unknown",
          value: t._count,
          color: projectMap.get(t.projectId!)?.color || getColor(i),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching report data:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
