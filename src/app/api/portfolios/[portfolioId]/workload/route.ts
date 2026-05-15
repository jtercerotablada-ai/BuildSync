import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/portfolios/:portfolioId/workload
// Returns all open tasks across projects in this portfolio + the
// distinct assignees, so the Workload view can render a member×day
// heatmap without making one request per project.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { portfolioId } = await params;

    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        id: true,
        ownerId: true,
        privacy: true,
        workspaceId: true,
        members: { select: { userId: true } },
        projects: { select: { projectId: true } },
      },
    });

    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const isOwner = portfolio.ownerId === userId;
    const isMember = portfolio.members.some((m) => m.userId === userId);
    const isPublic = portfolio.privacy === "PUBLIC";
    if (!isOwner && !isMember && !isPublic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const projectIds = portfolio.projects.map((p) => p.projectId);
    if (projectIds.length === 0) {
      return NextResponse.json({ tasks: [], assignees: [] });
    }

    const tasks = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        completed: false,
      },
      select: {
        id: true,
        name: true,
        assigneeId: true,
        dueDate: true,
        completed: true,
        projectId: true,
      },
    });

    const assigneeIds = [
      ...new Set(tasks.map((t) => t.assigneeId).filter((v): v is string => !!v)),
    ];
    const assignees = assigneeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
          },
        })
      : [];

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        ...t,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      })),
      assignees,
    });
  } catch (err) {
    console.error("[portfolio workload GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch workload" },
      { status: 500 }
    );
  }
}
