import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createTaskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  description: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
  parentTaskId: z.string().optional().nullable(),
});

// GET /api/tasks - Get tasks
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const sectionId = searchParams.get("sectionId");
    const assigneeId = searchParams.get("assigneeId");
    const completed = searchParams.get("completed");
    const myTasks = searchParams.get("myTasks") === "true";

    const whereClause: Record<string, unknown> = {
      parentTaskId: null, // Only get top-level tasks
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (sectionId) {
      whereClause.sectionId = sectionId;
    }

    if (assigneeId) {
      whereClause.assigneeId = assigneeId;
    }

    if (completed !== null) {
      whereClause.completed = completed === "true";
    }

    if (myTasks) {
      whereClause.assigneeId = userId;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
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
          select: {
            id: true,
            name: true,
            completed: true,
          },
        },
        _count: {
          select: {
            subtasks: true,
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create task
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createTaskSchema.parse(body);

    // Get the next position for the task
    let position = 0;
    if (data.sectionId) {
      const lastTask = await prisma.task.findFirst({
        where: { sectionId: data.sectionId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = (lastTask?.position ?? -1) + 1;
    } else if (data.projectId) {
      const lastTask = await prisma.task.findFirst({
        where: { projectId: data.projectId, sectionId: null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = (lastTask?.position ?? -1) + 1;
    }

    // Auto-assign to current user if no assigneeId provided (for My Tasks)
    const assigneeId = data.assigneeId ?? userId;

    const task = await prisma.task.create({
      data: {
        name: data.name,
        description: data.description,
        projectId: data.projectId,
        sectionId: data.sectionId,
        assigneeId: assigneeId,
        creatorId: userId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        priority: data.priority || "NONE",
        parentTaskId: data.parentTaskId,
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

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "TASK_CREATED",
        taskId: task.id,
        userId,
        data: { taskName: task.name },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
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
