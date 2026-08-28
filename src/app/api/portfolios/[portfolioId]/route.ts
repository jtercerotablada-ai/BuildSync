import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyWorkspaceAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { daysFromToday } from "@/lib/date-only";

const updatePortfolioSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  icon: z.string().min(1).optional(),
  status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD", "COMPLETE"]).optional(),
  privacy: z.enum(["PRIVATE", "WORKSPACE", "PUBLIC"]).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

// GET /api/portfolios/:portfolioId - Get portfolio details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
                status: true,
                type: true,
                gate: true,
                budget: true,
                currency: true,
                startDate: true,
                endDate: true,
                isArchived: true,
                owner: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
                _count: {
                  select: {
                    tasks: true,
                  },
                },
                tasks: {
                  // Only top-level tasks, matching how goal roll-ups measure a
                  // project (src/lib/goal-progress.ts). Counting subtasks here
                  // made the same project read at a different percentage in the
                  // portfolio table than in a goal's related work.
                  where: { parentTaskId: null },
                  select: {
                    id: true,
                    completed: true,
                    dueDate: true,
                  },
                },
              },
            },
          },
          orderBy: { position: "asc" },
        },
        members: true,
        statusUpdates: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    if (!portfolio) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }

    // Verify user belongs to portfolio's workspace
    await verifyWorkspaceAccess(userId, portfolio.workspaceId);

    // ── Privacy gate (Asana parity) ──────────────────────────
    // Mask the portfolio as 404 unless the caller owns it, is an
    // explicit member, or it's PUBLIC. Workspace membership alone
    // doesn't auto-grant access.
    const isOwner = portfolio.ownerId === userId;
    const isMember = portfolio.members.some((m) => m.userId === userId);
    const isPublic = portfolio.privacy === "PUBLIC";
    if (!isOwner && !isMember && !isPublic) {
      return NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 }
      );
    }

    // An archived project is off the dashboard, the sidebar and every team
    // view; leaving it on this page's list, timeline and health rollup would
    // make the portfolio disagree with the dashboard beside it. Its OPEN work
    // is what stops counting — there is no surface left to work it down on.
    const activeProjects = portfolio.projects.filter(
      (pp) => !pp.project.isArchived
    );
    // Its FINISHED work still counts, though: archiving a delivered job must
    // not retroactively un-deliver it, so the tasks it completed stay in the
    // portfolio's totals (the same call the dashboard's completed counts
    // make). The client folds this into totalTasks AND completedTasks, so
    // progress can only rise toward the truth, never past 100%.
    const archivedCompletedTasks = portfolio.projects
      .filter((pp) => pp.project.isArchived)
      .reduce(
        (n, pp) => n + pp.project.tasks.filter((t) => t.completed).length,
        0
      );
    // The reorder endpoint renumbers the WHOLE join table and rejects a
    // partial list, so the page still has to name the rows it no longer
    // renders — otherwise dragging a row on a portfolio that contains an
    // archived project can only ever answer 400.
    const archivedProjectIds = portfolio.projects
      .filter((pp) => pp.project.isArchived)
      .map((pp) => pp.project.id);

    // Calculate stats for each project
    const projectsWithStats = activeProjects.map((pp) => {
      const project = pp.project;
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((t) => t.completed).length;
      // date-only overdue: a task due TODAY is NEVER overdue. daysFromToday
      // buckets by the UTC calendar day, so viewers west of UTC don't see
      // today's tasks flip to overdue (see src/lib/date-only.ts).
      const overdueTasks = project.tasks.filter(
        (t) => !t.completed && t.dueDate && daysFromToday(t.dueDate) < 0
      ).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Strip raw tasks; serialize Decimal budget as number for JSON.
      const { tasks: _tasks, budget, ...rest } = project;
      void _tasks;
      return {
        ...pp,
        project: {
          ...rest,
          budget: budget ? Number(budget) : null,
          stats: {
            total: totalTasks,
            completed: completedTasks,
            overdue: overdueTasks,
            progress,
          },
        },
      };
    });

    return NextResponse.json({
      ...portfolio,
      projects: projectsWithStats,
      _count: { ...portfolio._count, projects: projectsWithStats.length },
      archivedCompletedTasks,
      archivedProjectIds,
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching portfolio:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}

// PATCH /api/portfolios/:portfolioId - Update portfolio
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user belongs to portfolio's workspace
    const existingPortfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        workspaceId: true,
        ownerId: true,
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });
    if (!existingPortfolio) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    await verifyWorkspaceAccess(userId, existingPortfolio.workspaceId);

    // ── Edit gate ────────────────────────────────────────────
    // Only the portfolio owner or a member with role OWNER/EDITOR
    // can mutate. VIEWERs and non-members get 403.
    const isPortfolioOwner = existingPortfolio.ownerId === userId;
    const memberRole = existingPortfolio.members[0]?.role;
    const canEdit =
      isPortfolioOwner ||
      memberRole === "OWNER" ||
      memberRole === "EDITOR";
    if (!canEdit) {
      return NextResponse.json(
        {
          error:
            "Only the portfolio owner or an Editor can update this portfolio",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const data = updatePortfolioSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.privacy !== undefined) updateData.privacy = data.privacy;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    const portfolio = await prisma.portfolio.update({
      where: { id: portfolioId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        _count: {
          select: {
            // Same population the GET returns, so the page merging this
            // response after a rename doesn't resurrect the archived rows
            // in its "N projects" count.
            projects: { where: { project: { isArchived: false } } },
          },
        },
      },
    });

    return NextResponse.json(portfolio);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error updating portfolio:", error);
    return NextResponse.json(
      { error: "Failed to update portfolio" },
      { status: 500 }
    );
  }
}

// DELETE /api/portfolios/:portfolioId - Delete portfolio
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user belongs to portfolio's workspace
    const portToDelete = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        workspaceId: true,
        ownerId: true,
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });
    if (!portToDelete) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    await verifyWorkspaceAccess(userId, portToDelete.workspaceId);

    // ── Delete gate ──────────────────────────────────────────
    // Only the portfolio owner (Portfolio.ownerId) or a member
    // with role OWNER can delete. EDITOR can mutate fields but
    // not destroy the whole portfolio.
    const isPortfolioOwner = portToDelete.ownerId === userId;
    const isMemberOwner = portToDelete.members[0]?.role === "OWNER";
    if (!isPortfolioOwner && !isMemberOwner) {
      return NextResponse.json(
        { error: "Only the portfolio owner can delete it" },
        { status: 403 }
      );
    }

    await prisma.portfolio.delete({
      where: { id: portfolioId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting portfolio:", error);
    return NextResponse.json(
      { error: "Failed to delete portfolio" },
      { status: 500 }
    );
  }
}
