import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { executeRulesOnTaskCompleted } from "@/lib/workflow-engine";
import { GoalProgressService } from "@/lib/goal-progress";

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

    // Verify user has access to this task's workspace
    // This flips the task's completed state (and fires the completion rules
    // and goal-progress recalc below) — a mutation, so it needs write
    // capability, not the read access that merely opening the task grants.
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, completed: true, projectId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // For now, we'll mark the task as completed and delete it
    // In a full implementation, you'd have an 'archived' field
    // and move it to an archive section
    //
    // Archiving completes the task, so it owes the same side effects as
    // any other completion: an activity row, goal rollups and "when a task
    // is completed" rules. All of it — the write included — only on the
    // false→true transition: re-archiving an already-complete task used to
    // stamp a fresh completedAt, which reshuffles it to the top of every
    // "recently completed" list even though nothing changed.
    if (!task.completed) {
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

      await GoalProgressService.recalculateForTask(taskId).catch((err) =>
        console.error("[tasks archive] goal recalc failed:", err)
      );
      if (task.projectId) {
        await executeRulesOnTaskCompleted(
          { taskId, actorUserId: userId },
          task.projectId
        );
      }
    }

    return NextResponse.json({ archived: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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

    // Verify user has access to this task's workspace
    // This flips the task's completed state (and fires the completion rules
    // and goal-progress recalc below) — a mutation, so it needs write
    // capability, not the read access that merely opening the task grants.
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, completed: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Unarchiving re-opens the task, so it owes the mirror image of what POST
    // does: the TASK_UNCOMPLETED activity row and a goal recalc, which this
    // handler used to skip entirely — leaving goal rollups counting a task
    // that is no longer complete. Only on the true→false transition.
    if (task.completed) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          completed: false,
          completedAt: null,
        },
      });

      await prisma.activity.create({
        data: {
          type: "TASK_UNCOMPLETED",
          taskId,
          userId,
          data: { archived: false },
        },
      });

      await GoalProgressService.recalculateForTask(taskId).catch((err) =>
        console.error("[tasks archive] goal recalc failed:", err)
      );
    }

    return NextResponse.json({ archived: false });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error unarchiving task:", error);
    return NextResponse.json(
      { error: "Failed to unarchive task" },
      { status: 500 }
    );
  }
}
