import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const updateSubtaskSchema = z.object({
  name: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  position: z.number().optional(),
});

// GET /api/tasks/:taskId/subtasks/:subtaskId - Get subtask details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string; subtaskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId, subtaskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
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
    });

    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    return NextResponse.json(subtask);
  } catch (error) {
    console.error("Error fetching subtask:", error);
    return NextResponse.json(
      { error: "Failed to fetch subtask" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/:taskId/subtasks/:subtaskId - Update subtask
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string; subtaskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId, subtaskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateSubtaskSchema.parse(body);

    // Verify subtask exists and belongs to parent task
    const existingSubtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        parentTaskId: taskId,
      },
      select: { id: true, completed: true },
    });

    if (!existingSubtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.completed !== undefined) {
      updateData.completed = data.completed;
      updateData.completedAt = data.completed ? new Date() : null;
    }

    if (data.assigneeId !== undefined) {
      updateData.assigneeId = data.assigneeId;
    }

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    if (data.position !== undefined) {
      updateData.position = data.position;
    }

    const subtask = await prisma.task.update({
      where: { id: subtaskId },
      data: updateData,
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

    return NextResponse.json(subtask);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating subtask:", error);
    return NextResponse.json(
      { error: "Failed to update subtask" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:taskId/subtasks/:subtaskId - Delete subtask
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string; subtaskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId, subtaskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify subtask exists and belongs to parent task
    const subtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        parentTaskId: taskId,
      },
      select: { id: true },
    });

    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    await prisma.task.delete({
      where: { id: subtaskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subtask:", error);
    return NextResponse.json(
      { error: "Failed to delete subtask" },
      { status: 500 }
    );
  }
}
