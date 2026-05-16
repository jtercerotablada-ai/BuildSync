import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

const createDependencySchema = z.object({
  blockingTaskId: z.string().min(1, "Blocking task ID is required"),
  type: z
    .enum([
      "FINISH_TO_START",
      "START_TO_START",
      "FINISH_TO_FINISH",
      "START_TO_FINISH",
    ])
    .optional()
    .default("FINISH_TO_START"),
});

/**
 * Detect if adding a dependency would create a circular chain.
 * Checks whether `targetId` is reachable by traversing the blocking chain from `startId`.
 * i.e., if startId already (transitively) depends on targetId, adding targetId -> startId would create a cycle.
 */
async function detectCircularDependency(startId: string, targetId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    // Find all tasks that `current` depends on (current is the dependent, blocking tasks are upstream)
    const deps = await prisma.taskDependency.findMany({
      where: { dependentTaskId: current },
      select: { blockingTaskId: true },
    });

    for (const dep of deps) {
      if (!visited.has(dep.blockingTaskId)) {
        queue.push(dep.blockingTaskId);
      }
    }
  }

  return false;
}

// POST /api/tasks/:taskId/dependencies - Add a dependency
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

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    const body = await req.json();
    const data = createDependencySchema.parse(body);

    // Prevent self-dependency
    if (data.blockingTaskId === taskId) {
      return NextResponse.json(
        { error: "A task cannot depend on itself" },
        { status: 400 }
      );
    }

    // Verify user also has access to the blocking task
    await verifyTaskAccess(userId, data.blockingTaskId);

    // Check for existing dependency
    const existing = await prisma.taskDependency.findUnique({
      where: {
        dependentTaskId_blockingTaskId: {
          dependentTaskId: taskId,
          blockingTaskId: data.blockingTaskId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Dependency already exists" },
        { status: 409 }
      );
    }

    // Check for circular dependency (transitive chain detection)
    // If taskId depends on blockingTaskId, we need to make sure blockingTaskId
    // doesn't already transitively depend on taskId (which would create a cycle)
    const hasCircular = await detectCircularDependency(data.blockingTaskId, taskId);
    if (hasCircular) {
      return NextResponse.json(
        { error: "Circular dependency detected: this would create a dependency cycle" },
        { status: 400 }
      );
    }

    const dependency = await prisma.taskDependency.create({
      data: {
        dependentTaskId: taskId,
        blockingTaskId: data.blockingTaskId,
        type: data.type,
      },
      include: {
        blockingTask: {
          select: { id: true, name: true, completed: true },
        },
      },
    });

    return NextResponse.json(dependency, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating dependency:", error);
    return NextResponse.json(
      { error: "Failed to create dependency" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/:taskId/dependencies?id=… - Change dependency type
const patchDependencySchema = z.object({
  type: z.enum([
    "FINISH_TO_START",
    "START_TO_START",
    "FINISH_TO_FINISH",
    "START_TO_FINISH",
  ]),
});

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

    await verifyTaskAccess(userId, taskId);

    const { searchParams } = new URL(req.url);
    const dependencyId = searchParams.get("id");

    if (!dependencyId) {
      return NextResponse.json(
        { error: "Dependency ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = patchDependencySchema.parse(body);

    const existing = await prisma.taskDependency.findUnique({
      where: { id: dependencyId },
    });
    if (!existing || existing.dependentTaskId !== taskId) {
      return NextResponse.json(
        { error: "Dependency not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.taskDependency.update({
      where: { id: dependencyId },
      data: { type: data.type },
      include: {
        blockingTask: {
          select: { id: true, name: true, completed: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error updating dependency:", error);
    return NextResponse.json(
      { error: "Failed to update dependency" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:taskId/dependencies - Remove a dependency
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

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    const { searchParams } = new URL(req.url);
    const dependencyId = searchParams.get("id");

    if (!dependencyId) {
      return NextResponse.json(
        { error: "Dependency ID is required" },
        { status: 400 }
      );
    }

    const dependency = await prisma.taskDependency.findUnique({
      where: { id: dependencyId },
    });

    if (!dependency) {
      return NextResponse.json(
        { error: "Dependency not found" },
        { status: 404 }
      );
    }

    await prisma.taskDependency.delete({ where: { id: dependencyId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting dependency:", error);
    return NextResponse.json(
      { error: "Failed to delete dependency" },
      { status: 500 }
    );
  }
}
