import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const updateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  completed: z.boolean().optional(),
  sectionId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional().nullable(),
  taskStatus: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK"]).optional().nullable(),
  position: z.number().optional(),
});

// GET /api/tasks/:taskId - Get task details
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

    const task = await prisma.task.findUnique({
      where: { id: taskId },
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
        subtasks: {
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
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        dependencies: {
          include: {
            blockingTask: {
              select: {
                id: true,
                name: true,
                completed: true,
              },
            },
          },
        },
        dependents: {
          include: {
            dependentTask: {
              select: {
                id: true,
                name: true,
                completed: true,
              },
            },
          },
        },
        collaborators: {
          select: {
            userId: true,
          },
        },
        likes: {
          where: {
            userId,
          },
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            subtasks: true,
            comments: true,
            attachments: true,
            likes: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Add isLiked field
    const taskWithLiked = {
      ...task,
      isLiked: task.likes.length > 0,
    };

    return NextResponse.json(taskWithLiked);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/:taskId - Update task
export async function PATCH(
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
    const data = updateTaskSchema.parse(body);

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        name: true,
        completed: true,
        sectionId: true,
        assigneeId: true,
        dueDate: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    const activities: { type: string; data: Record<string, unknown> }[] = [];

    if (data.name !== undefined && data.name !== existingTask.name) {
      updateData.name = data.name;
      activities.push({
        type: "TASK_RENAMED",
        data: { oldName: existingTask.name, newName: data.name },
      });
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
      activities.push({
        type: "TASK_DESCRIPTION_CHANGED",
        data: {},
      });
    }

    if (data.completed !== undefined && data.completed !== existingTask.completed) {
      updateData.completed = data.completed;
      updateData.completedAt = data.completed ? new Date() : null;
      activities.push({
        type: data.completed ? "TASK_COMPLETED" : "TASK_UNCOMPLETED",
        data: {},
      });
    }

    if (data.sectionId !== undefined && data.sectionId !== existingTask.sectionId) {
      updateData.sectionId = data.sectionId;
      activities.push({
        type: "TASK_MOVED",
        data: { newSectionId: data.sectionId },
      });
    }

    if (data.assigneeId !== undefined && data.assigneeId !== existingTask.assigneeId) {
      updateData.assigneeId = data.assigneeId;
      activities.push({
        type: data.assigneeId ? "TASK_ASSIGNED" : "TASK_UNASSIGNED",
        data: { assigneeId: data.assigneeId },
      });
    }

    if (data.dueDate !== undefined) {
      const newDueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (newDueDate?.getTime() !== existingTask.dueDate?.getTime()) {
        updateData.dueDate = newDueDate;
        activities.push({
          type: "DUE_DATE_CHANGED",
          data: { dueDate: data.dueDate },
        });
      }
    }

    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }

    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }

    if (data.taskStatus !== undefined) {
      updateData.taskStatus = data.taskStatus;
    }

    if (data.position !== undefined) {
      updateData.position = data.position;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
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

    // Create activity logs
    for (const activity of activities) {
      await prisma.activity.create({
        data: {
          type: activity.type as "TASK_CREATED" | "TASK_COMPLETED" | "TASK_UNCOMPLETED" | "TASK_ASSIGNED" | "TASK_UNASSIGNED" | "TASK_MOVED" | "TASK_RENAMED" | "TASK_DESCRIPTION_CHANGED" | "DUE_DATE_CHANGED" | "COMMENT_ADDED" | "ATTACHMENT_ADDED" | "CUSTOM_FIELD_CHANGED" | "SUBTASK_ADDED" | "DEPENDENCY_ADDED",
          taskId,
          userId,
          data: activity.data as object,
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:taskId - Delete task
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

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { creatorId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
