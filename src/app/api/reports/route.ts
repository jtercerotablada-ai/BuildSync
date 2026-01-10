import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/reports - Get report data
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // my-impact | organization
    const metric = searchParams.get("metric");

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

    // Fetch all metrics in parallel
    const [
      completedTasks,
      incompleteTasks,
      overdueTasks,
      totalTasks,
      tasksByProject,
      tasksByStatus,
      projectsByStatus,
    ] = await Promise.all([
      // Completed tasks
      prisma.task.count({
        where: {
          ...baseWhere,
          completed: true,
        },
      }),
      // Incomplete tasks
      prisma.task.count({
        where: {
          ...baseWhere,
          completed: false,
        },
      }),
      // Overdue tasks
      prisma.task.count({
        where: {
          ...baseWhere,
          completed: false,
          dueDate: {
            lt: now,
          },
        },
      }),
      // Total tasks
      prisma.task.count({
        where: baseWhere,
      }),
      // Tasks by project (incomplete)
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          ...baseWhere,
          completed: false,
          projectId: { not: null },
        },
        _count: true,
      }),
      // Tasks by completion status this month
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
      // Projects by status
      prisma.project.groupBy({
        by: ["status"],
        where: {
          workspaceId: workspaceMember.workspaceId,
          ...(isMyImpact ? { ownerId: userId } : {}),
        },
        _count: true,
      }),
    ]);

    // Get project names for the tasks by project
    const projectIds = tasksByProject.map((t) => t.projectId).filter(Boolean) as string[];
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, color: true },
    });

    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // Process tasks by status
    const upcoming = tasksByStatus.filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate) >= now
    ).length;
    const overdue = tasksByStatus.filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate) < now
    ).length;
    const noDate = tasksByStatus.filter((t) => !t.completed && !t.dueDate).length;
    const completed = tasksByStatus.filter((t) => t.completed).length;

    return NextResponse.json({
      kpis: {
        completed: completedTasks,
        incomplete: incompleteTasks,
        overdue: overdueTasks,
        total: totalTasks,
      },
      tasksByProject: tasksByProject
        .map((t) => ({
          name: projectMap.get(t.projectId!)?.name || "Unknown",
          value: t._count,
          color: projectMap.get(t.projectId!)?.color || "#94a3b8",
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
    });
  } catch (error) {
    console.error("Error fetching report data:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
