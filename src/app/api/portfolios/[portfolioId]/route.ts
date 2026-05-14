import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyWorkspaceAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

const updatePortfolioSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
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
                    tasks: true,
                  },
                },
                tasks: {
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

    // Calculate stats for each project
    const projectsWithStats = portfolio.projects.map((pp) => {
      const project = pp.project;
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((t) => t.completed).length;
      const overdueTasks = project.tasks.filter(
        (t) => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()
      ).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...pp,
        project: {
          ...project,
          tasks: undefined, // Remove raw tasks from response
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
            projects: true,
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
