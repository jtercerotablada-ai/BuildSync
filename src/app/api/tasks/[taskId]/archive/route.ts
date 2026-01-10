import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// POST /api/tasks/:taskId/archive - Archive a task
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

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // For now, we'll mark the task as completed and delete it
    // In a full implementation, you'd have an 'archived' field
    // and move it to an archive section
    await prisma.task.update({
      where: { id: taskId },
      data: {
        completed: true,
        completedAt: new Date(),
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "TASK_COMPLETED",
        taskId,
        userId,
        data: { archived: true },
      },
    });

    return NextResponse.json({ archived: true });
  } catch (error) {
    console.error("Error archiving task:", error);
    return NextResponse.json(
      { error: "Failed to archive task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:taskId/archive - Unarchive a task
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        completed: false,
        completedAt: null,
      },
    });

    return NextResponse.json({ archived: false });
  } catch (error) {
    console.error("Error unarchiving task:", error);
    return NextResponse.json(
      { error: "Failed to unarchive task" },
      { status: 500 }
    );
  }
}
