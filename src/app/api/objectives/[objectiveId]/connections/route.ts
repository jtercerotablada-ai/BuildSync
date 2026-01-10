import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { GoalProgressService } from "@/lib/goal-progress";

const connectProjectSchema = z.object({
  type: z.literal("project"),
  projectId: z.string(),
});

const connectTaskSchema = z.object({
  type: z.literal("task"),
  taskId: z.string(),
});

const connectionSchema = z.discriminatedUnion("type", [
  connectProjectSchema,
  connectTaskSchema,
]);

// GET /api/objectives/:objectiveId/connections - Get all connections
export async function GET(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { objectiveId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [projects, tasks] = await Promise.all([
      prisma.objectiveProject.findMany({
        where: { objectiveId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
              status: true,
              tasks: {
                where: { parentTaskId: null },
                select: { completed: true },
              },
            },
          },
        },
      }),
      prisma.objectiveTask.findMany({
        where: { objectiveId },
        include: {
          task: {
            select: {
              id: true,
              name: true,
              completed: true,
              dueDate: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate project progress
    const projectsWithProgress = projects.map((op) => {
      const totalTasks = op.project.tasks.length;
      const completedTasks = op.project.tasks.filter((t) => t.completed).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        id: op.id,
        type: "project" as const,
        project: {
          id: op.project.id,
          name: op.project.name,
          color: op.project.color,
          status: op.project.status,
          progress,
          totalTasks,
          completedTasks,
        },
      };
    });

    const tasksFormatted = tasks.map((ot) => ({
      id: ot.id,
      type: "task" as const,
      task: {
        id: ot.task.id,
        name: ot.task.name,
        completed: ot.task.completed,
        dueDate: ot.task.dueDate,
        project: ot.task.project,
      },
    }));

    return NextResponse.json({
      projects: projectsWithProgress,
      tasks: tasksFormatted,
    });
  } catch (error) {
    console.error("Error fetching connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

// POST /api/objectives/:objectiveId/connections - Connect project or task
export async function POST(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { objectiveId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = connectionSchema.parse(body);

    if (data.type === "project") {
      // Check if connection already exists
      const existing = await prisma.objectiveProject.findUnique({
        where: {
          objectiveId_projectId: {
            objectiveId,
            projectId: data.projectId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Project already connected to this goal" },
          { status: 400 }
        );
      }

      const connection = await prisma.objectiveProject.create({
        data: {
          objectiveId,
          projectId: data.projectId,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      // Recalculate goal progress
      await GoalProgressService.recalculateProgress(objectiveId);

      return NextResponse.json(connection, { status: 201 });
    } else {
      // Connect task
      const existing = await prisma.objectiveTask.findUnique({
        where: {
          objectiveId_taskId: {
            objectiveId,
            taskId: data.taskId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Task already connected to this goal" },
          { status: 400 }
        );
      }

      const connection = await prisma.objectiveTask.create({
        data: {
          objectiveId,
          taskId: data.taskId,
        },
        include: {
          task: {
            select: {
              id: true,
              name: true,
              completed: true,
            },
          },
        },
      });

      // Recalculate goal progress
      await GoalProgressService.recalculateProgress(objectiveId);

      return NextResponse.json(connection, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating connection:", error);
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }
}

// DELETE /api/objectives/:objectiveId/connections - Disconnect project or task
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { objectiveId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const connectionId = searchParams.get("connectionId");

    if (!type || !connectionId) {
      return NextResponse.json(
        { error: "Type and connectionId required" },
        { status: 400 }
      );
    }

    if (type === "project") {
      await prisma.objectiveProject.delete({
        where: { id: connectionId },
      });
    } else if (type === "task") {
      await prisma.objectiveTask.delete({
        where: { id: connectionId },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid connection type" },
        { status: 400 }
      );
    }

    // Recalculate goal progress
    await GoalProgressService.recalculateProgress(objectiveId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting connection:", error);
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
