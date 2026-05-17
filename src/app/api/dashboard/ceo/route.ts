import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId, getEffectiveAccess } from "@/lib/auth-utils";
import { isWorkspaceOwner } from "@/lib/people-types";

// Aggregated payload for the home cockpit at /home.
// One endpoint, one round-trip, everything the home page needs to
// render. Shapes carefully so the UI can fail gracefully if any
// branch is empty.
//
// ── Access-control filtering ─────────────────────────────────
// The payload SHAPE is identical for every viewer (same fields,
// same types) but the CONTENT is filtered by the caller's
// hierarchy level:
//
//   L5+ / OWNER  → full workspace-wide view (the original
//                   "CEO cockpit")
//   L4           → workspace-wide projects + activity, financial
//                   KPIs visible
//   L1–L3        → membership-scoped projects, financial KPIs
//                   stripped (revenue pipeline empty, totalBudget
//                   masked), team load limited to peers, activity
//                   limited to projects they're members of.

const ACTIVE_GATES = ["PRE_DESIGN", "DESIGN", "PERMITTING", "CONSTRUCTION"] as const;

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getEffectiveAccess(userId);
    if (!access) {
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

    const { workspaceId } = access;
    // Coarse access bucket:
    //   - "executive" → full workspace data + financial KPIs visible
    //   - "management" → workspace projects + financial KPIs visible
    //   - "scoped" → only projects they belong to; financial KPIs stripped
    const isExecutive =
      isWorkspaceOwner(access.workspaceRole) || access.level >= 5;
    const isManagement = isExecutive || access.level >= 4;
    const isFinanceAllowed = isManagement; // L4+

    // Compute the project-id set this user is allowed to see.
    // Executive + Management see everything in the workspace.
    // Lower levels see only projects where they are owner or member.
    let scopedProjectIds: string[] | null = null; // null = no filter (sees all)
    if (!isManagement) {
      const myProjects = await prisma.project.findMany({
        where: {
          workspaceId,
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        },
        select: { id: true },
      });
      scopedProjectIds = myProjects.map((p) => p.id);
    }

    // ── Parallel fetch ──────────────────────────────────────
    const projectWhere =
      scopedProjectIds === null
        ? { workspaceId }
        : { workspaceId, id: { in: scopedProjectIds } };

    const taskWhere =
      scopedProjectIds === null
        ? { project: { workspaceId } }
        : { projectId: { in: scopedProjectIds } };

    const [projects, completedTaskCounts, workspaceMembers, recentTasks, recentActivities] =
      await Promise.all([
        prisma.project.findMany({
          where: projectWhere,
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

        // Completed-task counts per project — needed so the Skyline,
        // AI Brief, and Active Projects can compute real EV → SPI →
        // % complete. Before this query was added every consumer was
        // passing completedTaskCount: 0 which collapsed every PMI
        // metric to zero / "—" on the home page.
        prisma.task.groupBy({
          by: ["projectId"],
          where: { ...taskWhere, completedAt: { not: null } },
          _count: { _all: true },
        }),

        // Workspace team — everyone L4+ sees the full firm; lower
        // levels see only people they share a project with.
        isManagement
          ? prisma.workspaceMember.findMany({
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
            })
          : prisma.workspaceMember.findMany({
              where: {
                workspaceId,
                userId: {
                  in: await prisma.projectMember
                    .findMany({
                      where:
                        scopedProjectIds === null
                          ? { project: { workspaceId } }
                          : { projectId: { in: scopedProjectIds } },
                      select: { userId: true },
                      distinct: ["userId"],
                    })
                    .then((rows) => rows.map((r) => r.userId)),
                },
              },
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

        // Critical path — overdue + everything due in the next 14
        // days. The lower bound used to be `gte: new Date()` which
        // silently dropped every overdue task; the Priority Queue
        // widget on /home is supposed to lead with overdue, so the
        // floor is now removed and we just cap at +14 days.
        prisma.task.findMany({
          where: {
            ...taskWhere,
            completedAt: null,
            dueDate: {
              not: null,
              lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
          },
          select: {
            id: true,
            name: true,
            dueDate: true,
            priority: true,
            taskType: true,
            project: { select: { id: true, name: true, color: true, type: true } },
            assignee: { select: { id: true, name: true, image: true } },
          },
          orderBy: { dueDate: "asc" },
          // Bump take so the queue + milestones tiles both have enough
          // to filter from. They each slice down to the visible count.
          take: 24,
        }),

        // Activity stream — scoped to allowed projects.
        prisma.task.findMany({
          where: taskWhere,
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
    const countsByType = {
      CONSTRUCTION: 0,
      DESIGN: 0,
      RECERTIFICATION: 0,
      PERMIT: 0,
    } as Record<string, number>;
    const countsByGate = {
      PRE_DESIGN: 0,
      DESIGN: 0,
      PERMITTING: 0,
      CONSTRUCTION: 0,
      CLOSEOUT: 0,
    } as Record<string, number>;
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

    const activeProjects = projects.filter(
      (p) =>
        p.gate &&
        ACTIVE_GATES.includes(p.gate as (typeof ACTIVE_GATES)[number])
    ).length;

    // Team utilization — naive: % of visible members with at least
    // 1 in-flight task.
    const memberIds = workspaceMembers.map((m) => m.userId);
    const activeAssignees =
      memberIds.length > 0
        ? await prisma.task.findMany({
            where: {
              ...taskWhere,
              completedAt: null,
              assigneeId: { in: memberIds },
            },
            select: { assigneeId: true },
            distinct: ["assigneeId"],
          })
        : [];
    const utilization =
      memberIds.length > 0
        ? Math.round((activeAssignees.length / memberIds.length) * 100)
        : 0;

    // Compliance projects (recert / permit) within 60 days.
    const sixtyDays = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const compliance = projects
      .filter(
        (p) =>
          (p.type === "RECERTIFICATION" || p.type === "PERMIT") &&
          p.endDate &&
          new Date(p.endDate) <= sixtyDays
      )
      .sort(
        (a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime()
      )
      .slice(0, 6);

    // Revenue pipeline — hidden from non-finance viewers. We return
    // empty array (same field) so the UI can detect and hide the
    // chart without throwing.
    const months: { month: string; revenue: number }[] = [];
    if (isFinanceAllowed) {
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const label = target.toLocaleString("en-US", { month: "short" });
        const revenue = projects
          .filter(
            (p) =>
              p.endDate &&
              new Date(p.endDate).getMonth() === target.getMonth() &&
              new Date(p.endDate).getFullYear() === target.getFullYear()
          )
          .reduce((sum, p) => sum + (p.budget ? Number(p.budget) : 0), 0);
        months.push({ month: label, revenue });
      }
    }

    // Per-member load — only over the visible task set.
    const loadByUser = new Map<string, number>();
    const taskAssignees = await prisma.task.findMany({
      where: { ...taskWhere, completedAt: null, assigneeId: { not: null } },
      select: { assigneeId: true },
    });
    for (const t of taskAssignees) {
      if (t.assigneeId) {
        loadByUser.set(
          t.assigneeId,
          (loadByUser.get(t.assigneeId) ?? 0) + 1
        );
      }
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

    // Build a map of completedCount per project so we can attach it
    // to each project payload in O(N). Prisma types projectId as
    // nullable on the groupBy result; filter those out — orphan
    // tasks with no project don't belong on any project's count.
    const completedByProject = new Map<string, number>(
      completedTaskCounts
        .filter((row): row is typeof row & { projectId: string } =>
          row.projectId !== null
        )
        .map((row) => [row.projectId, row._count._all])
    );

    return NextResponse.json({
      projects: projects.map((p) => ({
        ...p,
        budget: isFinanceAllowed && p.budget ? Number(p.budget) : null,
        _count: {
          tasks: p._count.tasks,
          completedTasks: completedByProject.get(p.id) ?? 0,
        },
      })),
      countsByType,
      countsByGate,
      kpis: {
        activeProjects,
        // Hide totalBudget from L1–L3.
        totalBudget: isFinanceAllowed ? totalBudget : 0,
        currency,
        pendingSignatures: 0, // Placeholder
        teamUtilization: utilization,
      },
      team,
      criticalPath: recentTasks,
      compliance,
      revenuePipeline: months,
      activity: recentActivities,
      // Hint to the UI for graceful degradation. The Home page can
      // hide finance widgets entirely when this is false.
      viewerCapabilities: {
        canSeeFinancials: isFinanceAllowed,
        canSeeAllProjects: isManagement,
        level: access.level,
      },
    });
  } catch (error) {
    console.error("Error in /api/dashboard/ceo:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
