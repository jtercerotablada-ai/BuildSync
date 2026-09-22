import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  assertProjectInWorkspace,
  assertTaskInWorkspace,
  verifyTaskAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import {
  buildProjectVisibilityClauses,
  taskPrivacyClause,
} from "@/lib/project-visibility";
import { verifyObjectiveAccess } from "@/lib/objective-access";

/**
 * Confirm the keyResult belongs to the objective from the path. Without
 * this, keyResultId is trusted and connections of another objective's key
 * result (even in another workspace) can be read/mutated — audit SEC-04.
 */
async function assertKeyResultInObjective(keyResultId: string, objectiveId: string) {
  const kr = await prisma.keyResult.findFirst({
    where: { id: keyResultId, objectiveId },
    select: { id: true },
  });
  if (!kr) {
    throw new NotFoundError("Key result not found");
  }
}

/**
 * A task may be linked only when it is in the goal's workspace AND the caller
 * can open it. Same-workspace alone let a colleague link a private task (or a
 * task of a project they are not on) and then read its name and due date,
 * along with everyone else who can open the goal. Denial is a 404 either way.
 */
async function assertTaskLinkable(taskId: string, workspaceId: string, userId: string) {
  await assertTaskInWorkspace(taskId, workspaceId);
  try {
    await verifyTaskAccess(userId, taskId);
  } catch (err) {
    if (err instanceof AuthorizationError) throw new NotFoundError("Task not found");
    throw err;
  }
}

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
    const { objectiveId, keyResultId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyObjectiveAccess(userId, objectiveId);
    await assertKeyResultInObjective(keyResultId, objectiveId);

    // Only the linked work this reader may open. A link made by someone who
    // can see a PRIVATE project (or a private task) must not show its name,
    // status or due date to every other reader of the goal.
    const projectClauses = (await buildProjectVisibilityClauses(userId)) ?? [];

    const [projects, tasks] = await Promise.all([
      prisma.keyResultProject.findMany({
        where: { keyResultId, project: { OR: projectClauses } },
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
        where: {
          keyResultId,
          task: {
            AND: [taskPrivacyClause(userId), { project: { OR: projectClauses } }],
          },
        },
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
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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
    const { objectiveId, keyResultId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Linking work to a key result feeds the goal's progress, so it takes
    // write access to the goal.
    const { objective } = await verifyObjectiveAccess(userId, objectiveId, {
      requireWrite: true,
    });

    await assertKeyResultInObjective(keyResultId, objectiveId);

    const body = await req.json();
    const data = connectionSchema.parse(body);

    // Scope connected project/task to the objective's workspace — audit SEC-04.
    // ...and to what the caller can open, since the link then shows the
    // project's or task's name to every reader of the goal.
    if (data.type === "project") {
      await assertProjectInWorkspace(data.projectId, objective.workspaceId, {
        readableBy: userId,
      });
    } else {
      await assertTaskLinkable(data.taskId, objective.workspaceId, userId);
    }

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
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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
    const { objectiveId, keyResultId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyObjectiveAccess(userId, objectiveId, { requireWrite: true });
    await assertKeyResultInObjective(keyResultId, objectiveId);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const connectionId = searchParams.get("connectionId");

    if (!type || !connectionId) {
      return NextResponse.json(
        { error: "Type and connectionId required" },
        { status: 400 }
      );
    }

    // Scope the delete to THIS key result so a foreign connectionId
    // removes nothing (count 0 → 404) — audit SEC-04.
    if (type === "project") {
      const res = await prisma.keyResultProject.deleteMany({
        where: { id: connectionId, keyResultId },
      });
      if (res.count === 0) {
        return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      }
    } else if (type === "task") {
      const res = await prisma.keyResultTask.deleteMany({
        where: { id: connectionId, keyResultId },
      });
      if (res.count === 0) {
        return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      }
    } else {
      return NextResponse.json(
        { error: "Invalid connection type" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting key result connection:", error);
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
