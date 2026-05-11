import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// Aggregated payload for the CEO cockpit at /home.
// One endpoint, one round-trip, everything the home page needs to render.
// Shapes carefully so the UI can fail gracefully if any branch is empty.

const ACTIVE_GATES = ["PRE_DESIGN", "DESIGN", "PERMITTING", "CONSTRUCTION"] as const;

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user's primary workspace (CEO sees workspace-wide data)
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: "asc" },
      select: { workspaceId: true },
    });

    if (!membership) {
      return NextResponse.json({
        projects: [],
        countsByType: { CONSTRUCTION: 0, DESIGN: 0, RECERTIFICATION: 0, PERMIT: 0 },
        countsByGate: { PRE_DESIGN: 0, DESIGN: 0, PERMITTING: 0, CONSTRUCTION: 0, CLOSEOUT: 0 },
        kpis: { activeProjects: 0, totalBudget: 0, currency: "USD", pendingSignatures: 0, teamUtilization: 0 },
        team: [],
        criticalPath: [],
        compliance: [],
        revenuePipeline: [],
        activity: [],
      });
    }

    const workspaceId = membership.workspaceId;

    const [projects, workspaceMembers, recentTasks, recentActivities] = await Promise.all([
      prisma.project.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          color: true,
          status: true,
          type: true,
          gate: true,
          location: true,
          latitude: true,
          longitude: true,
          budget: true,
          currency: true,
          clientName: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, image: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),

      prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),

      // For critical-path: tasks due in next 14 days, not completed
      prisma.task.findMany({
        where: {
          project: { workspaceId },
          completedAt: null,
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          name: true,
          dueDate: true,
          priority: true,
          project: { select: { id: true, name: true, color: true, type: true } },
          assignee: { select: { id: true, name: true, image: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 8,
      }),

      // Activity stream: latest 12 tasks updated workspace-wide
      prisma.task.findMany({
        where: { project: { workspaceId } },
        select: {
          id: true,
          name: true,
          completedAt: true,
          updatedAt: true,
          project: { select: { id: true, name: true, color: true } },
          assignee: { select: { id: true, name: true, image: true } },
          creator: { select: { id: true, name: true, image: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
    ]);

    // Counts
    const countsByType = { CONSTRUCTION: 0, DESIGN: 0, RECERTIFICATION: 0, PERMIT: 0 } as Record<string, number>;
    const countsByGate = { PRE_DESIGN: 0, DESIGN: 0, PERMITTING: 0, CONSTRUCTION: 0, CLOSEOUT: 0 } as Record<string, number>;
    let totalBudget = 0;
    let currency = "USD";

    for (const p of projects) {
      if (p.type) countsByType[p.type] = (countsByType[p.type] ?? 0) + 1;
      if (p.gate) countsByGate[p.gate] = (countsByGate[p.gate] ?? 0) + 1;
      if (p.budget) {
        totalBudget += Number(p.budget);
        if (p.currency) currency = p.currency;
      }
    }

    const activeProjects = projects.filter((p) => p.gate && ACTIVE_GATES.includes(p.gate as (typeof ACTIVE_GATES)[number])).length;

    // Team utilization — naive: % of members with at least 1 in-flight task
    const memberIds = workspaceMembers.map((m) => m.userId);
    const activeAssignees = await prisma.task.findMany({
      where: {
        project: { workspaceId },
        completedAt: null,
        assigneeId: { in: memberIds },
      },
      select: { assigneeId: true },
      distinct: ["assigneeId"],
    });
    const utilization =
      memberIds.length > 0 ? Math.round((activeAssignees.length / memberIds.length) * 100) : 0;

    // Compliance: projects of type RECERTIFICATION or PERMIT with endDate within 60 days
    const sixtyDays = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const compliance = projects
      .filter(
        (p) =>
          (p.type === "RECERTIFICATION" || p.type === "PERMIT") &&
          p.endDate &&
          new Date(p.endDate) <= sixtyDays
      )
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
      .slice(0, 6);

    // Revenue pipeline: project budgets by month (next 6 months window)
    const now = new Date();
    const months: { month: string; revenue: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = target.toLocaleString("en-US", { month: "short" });
      const revenue = projects
        .filter((p) => p.endDate && new Date(p.endDate).getMonth() === target.getMonth() && new Date(p.endDate).getFullYear() === target.getFullYear())
        .reduce((sum, p) => sum + (p.budget ? Number(p.budget) : 0), 0);
      months.push({ month: label, revenue });
    }

    // Per-member load
    const loadByUser = new Map<string, number>();
    for (const t of await prisma.task.findMany({
      where: { project: { workspaceId }, completedAt: null, assigneeId: { not: null } },
      select: { assigneeId: true },
    })) {
      if (t.assigneeId) loadByUser.set(t.assigneeId, (loadByUser.get(t.assigneeId) ?? 0) + 1);
    }
    const team = workspaceMembers
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        load: loadByUser.get(m.user.id) ?? 0,
      }))
      .sort((a, b) => b.load - a.load)
      .slice(0, 8);

    return NextResponse.json({
      projects: projects.map((p) => ({
        ...p,
        budget: p.budget ? Number(p.budget) : null,
      })),
      countsByType,
      countsByGate,
      kpis: {
        activeProjects,
        totalBudget,
        currency,
        pendingSignatures: 0, // Placeholder — wire up when P.E. signature model lands
        teamUtilization: utilization,
      },
      team,
      criticalPath: recentTasks,
      compliance,
      revenuePipeline: months,
      activity: recentActivities,
    });
  } catch (error) {
    console.error("Error in /api/dashboard/ceo:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
