import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// POST /api/tasks/:taskId/duplicate - Duplicate a task
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

    // Get the original task
    const originalTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subtasks: true,
      },
    });

    if (!originalTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get the max position in the same section/project
    const maxPosition = await prisma.task.aggregate({
      where: {
        projectId: originalTask.projectId,
        sectionId: originalTask.sectionId,
        parentTaskId: null,
      },
      _max: {
        position: true,
      },
    });

    // Create the duplicated task
    const duplicatedTask = await prisma.task.create({
      data: {
        name: `Copy of ${originalTask.name}`,
        description: originalTask.description,
        completed: false,
        startDate: originalTask.startDate,
        dueDate: originalTask.dueDate,
        priority: originalTask.priority,
        taskStatus: originalTask.taskStatus,
        taskType: originalTask.taskType,
        position: (maxPosition._max.position ?? 0) + 1,
        projectId: originalTask.projectId,
        sectionId: originalTask.sectionId,
        creatorId: userId,
        // Don't copy assignee - let user assign manually
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
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Duplicate subtasks if any
    if (originalTask.subtasks.length > 0) {
      await prisma.task.createMany({
        data: originalTask.subtasks.map((subtask, index) => ({
          name: subtask.name,
          description: subtask.description,
          completed: false,
          position: index,
          parentTaskId: duplicatedTask.id,
          projectId: originalTask.projectId,
          sectionId: originalTask.sectionId,
          creatorId: userId,
        })),
      });
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "TASK_CREATED",
        taskId: duplicatedTask.id,
        userId,
        data: { duplicatedFrom: taskId },
      },
    });

    return NextResponse.json(duplicatedTask, { status: 201 });
  } catch (error) {
    console.error("Error duplicating task:", error);
    return NextResponse.json(
      { error: "Failed to duplicate task" },
      { status: 500 }
    );
  }
}
