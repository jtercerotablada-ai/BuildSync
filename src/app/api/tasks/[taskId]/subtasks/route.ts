import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createSubtaskSchema = z.object({
  name: z.string().min(1, "Subtask name is required"),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

// GET /api/tasks/:taskId/subtasks - Get task subtasks
export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subtasks = await prisma.task.findMany({
      where: {
        parentTaskId: taskId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { position: "asc" },
    });

    return NextResponse.json(subtasks);
  } catch (error) {
    console.error("Error fetching subtasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch subtasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/:taskId/subtasks - Create subtask
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, assigneeId, dueDate } = createSubtaskSchema.parse(body);

    // Verify parent task exists
    const parentTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, sectionId: true },
    });

    if (!parentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get the highest position for subtasks of this parent
    const lastSubtask = await prisma.task.findFirst({
      where: { parentTaskId: taskId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = (lastSubtask?.position ?? -1) + 1;

    const subtask = await prisma.task.create({
      data: {
        name,
        parentTaskId: taskId,
        projectId: parentTask.projectId,
        sectionId: parentTask.sectionId,
        creatorId: userId,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        position,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "SUBTASK_ADDED",
        taskId,
        userId,
        data: { subtaskId: subtask.id, subtaskName: subtask.name },
      },
    });

    return NextResponse.json(subtask, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating subtask:", error);
    return NextResponse.json(
      { error: "Failed to create subtask" },
      { status: 500 }
    );
  }
}
