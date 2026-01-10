import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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

// GET /api/objectives/:objectiveId/key-results/:keyResultId/connections
export async function GET(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string; keyResultId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { keyResultId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [projects, tasks] = await Promise.all([
      prisma.keyResultProject.findMany({
        where: { keyResultId },
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
      prisma.keyResultTask.findMany({
        where: { keyResultId },
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

    const projectsWithProgress = projects.map((krp) => {
      const totalTasks = krp.project.tasks.length;
      const completedTasks = krp.project.tasks.filter((t) => t.completed).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        id: krp.id,
        type: "project" as const,
        project: {
          id: krp.project.id,
          name: krp.project.name,
          color: krp.project.color,
          status: krp.project.status,
          progress,
          totalTasks,
          completedTasks,
        },
      };
    });

    const tasksFormatted = tasks.map((krt) => ({
      id: krt.id,
      type: "task" as const,
      task: {
        id: krt.task.id,
        name: krt.task.name,
        completed: krt.task.completed,
        dueDate: krt.task.dueDate,
        project: krt.task.project,
      },
    }));

    return NextResponse.json({
      projects: projectsWithProgress,
      tasks: tasksFormatted,
    });
  } catch (error) {
    console.error("Error fetching key result connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

// POST /api/objectives/:objectiveId/key-results/:keyResultId/connections
export async function POST(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string; keyResultId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { keyResultId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = connectionSchema.parse(body);

    if (data.type === "project") {
      const existing = await prisma.keyResultProject.findUnique({
        where: {
          keyResultId_projectId: {
            keyResultId,
            projectId: data.projectId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Project already connected to this key result" },
          { status: 400 }
        );
      }

      const connection = await prisma.keyResultProject.create({
        data: {
          keyResultId,
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

      return NextResponse.json(connection, { status: 201 });
    } else {
      const existing = await prisma.keyResultTask.findUnique({
        where: {
          keyResultId_taskId: {
            keyResultId,
            taskId: data.taskId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Task already connected to this key result" },
          { status: 400 }
        );
      }

      const connection = await prisma.keyResultTask.create({
        data: {
          keyResultId,
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

      return NextResponse.json(connection, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating key result connection:", error);
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }
}

// DELETE /api/objectives/:objectiveId/key-results/:keyResultId/connections
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string; keyResultId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    await params;

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
      await prisma.keyResultProject.delete({
        where: { id: connectionId },
      });
    } else if (type === "task") {
      await prisma.keyResultTask.delete({
        where: { id: connectionId },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid connection type" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting key result connection:", error);
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
