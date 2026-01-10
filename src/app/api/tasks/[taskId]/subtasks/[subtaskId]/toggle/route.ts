import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { GoalProgressService } from "@/lib/goal-progress";

const toggleSchema = z.object({
  completed: z.boolean(),
});

// PATCH /api/tasks/:taskId/subtasks/:subtaskId/toggle - Toggle subtask completion
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
    const { completed } = toggleSchema.parse(body);

    // Verify subtask exists and belongs to parent task
    const subtask = await prisma.task.findFirst({
      where: {
        id: subtaskId,
        parentTaskId: taskId,
      },
      select: { id: true, completed: true },
    });

    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    const updatedSubtask = await prisma.task.update({
      where: { id: subtaskId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
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

    // Create activity log on parent task
    await prisma.activity.create({
      data: {
        type: completed ? "TASK_COMPLETED" : "TASK_UNCOMPLETED",
        taskId: subtaskId,
        userId,
        data: { parentTaskId: taskId },
      },
    });

    // Recalculate goal progress for subtask and parent task
    try {
      await GoalProgressService.recalculateForTask(subtaskId);
      await GoalProgressService.recalculateForTask(taskId);
    } catch (progressError) {
      console.error("Error recalculating goal progress:", progressError);
    }

    return NextResponse.json(updatedSubtask);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error toggling subtask:", error);
    return NextResponse.json(
      { error: "Failed to toggle subtask" },
      { status: 500 }
    );
  }
}
