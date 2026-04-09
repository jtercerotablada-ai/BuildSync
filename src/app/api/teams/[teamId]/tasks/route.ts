import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

const createTaskSchema = z.object({
  name: z.string().min(1),
  dueDate: z.string(), // YYYY-MM-DD
  projectId: z.string().optional(),
});

// GET /api/teams/:teamId/tasks - Get tasks from team's projects (for calendar)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this team
    await verifyTeamAccess(userId, teamId);

    // Get all tasks from projects belonging to this team
    const tasks = await prisma.task.findMany({
      where: {
        project: {
          teamId,
        },
        dueDate: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        dueDate: true,
        completed: true,
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching team tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/teams/:teamId/tasks - Create a task for the team calendar
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, dueDate, projectId } = createTaskSchema.parse(body);

    // Verify user is team member
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be a team member to create tasks" },
        { status: 403 }
      );
    }

    // Resolve project: use provided or pick first team project
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      const firstProject = await prisma.project.findFirst({
        where: { teamId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (!firstProject) {
        return NextResponse.json(
          { error: "Team has no projects. Create a project first." },
          { status: 400 }
        );
      }
      resolvedProjectId = firstProject.id;
    }

    const task = await prisma.task.create({
      data: {
        name,
        dueDate: new Date(dueDate),
        projectId: resolvedProjectId,
        creatorId: userId,
      },
      select: {
        id: true,
        name: true,
        dueDate: true,
        completed: true,
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
