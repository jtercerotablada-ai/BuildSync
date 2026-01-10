import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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

    await prisma.portfolio.delete({
      where: { id: portfolioId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting portfolio:", error);
    return NextResponse.json(
      { error: "Failed to delete portfolio" },
      { status: 500 }
    );
  }
}
