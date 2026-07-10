/**
 * Multi-homing endpoints (Asana parity): a task can appear in more than
 * one project. The task's PRIMARY/home project stays on Task.projectId;
 * these routes manage the EXTRA memberships in the TaskProject table.
 *
 *   POST   /api/tasks/:taskId/projects   { projectId }  → add
 *   DELETE /api/tasks/:taskId/projects?projectId=…      → remove
 *
 * Adding requires write access to BOTH the task and the target project.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyTaskAccess,
  verifyProjectAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

const bodySchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

// POST — add the task to an additional project.
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

    // Writing the task's homing needs write on the task…
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    const { projectId } = bodySchema.parse(await req.json());

    // …and write on the target project we're adding it to.
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // No-op if this IS the home project — it already lives there.
    if (task.projectId === projectId) {
      return NextResponse.json(
        { error: "Task already lives in this project" },
        { status: 409 }
      );
    }

    // Dedupe against an existing extra membership.
    const existing = await prisma.taskProject.findUnique({
      where: { taskId_projectId: { taskId, projectId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Task already added to this project" },
        { status: 409 }
      );
    }

    // Place it in the target project's first section so it shows up in
    // that project's views (mirrors the home-project move behavior).
    const firstSection = await prisma.section.findFirst({
      where: { projectId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    const created = await prisma.taskProject.create({
      data: { taskId, projectId, sectionId: firstSection?.id ?? null },
      select: {
        id: true,
        projectId: true,
        project: { select: { id: true, name: true, color: true } },
      },
    });

    // Touch the task so "Last modified" reflects the change.
    await prisma.task.update({
      where: { id: taskId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(created, { status: 201 });
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
    console.error("Error adding task to project:", error);
    return NextResponse.json(
      { error: "Failed to add task to project" },
      { status: 500 }
    );
  }
}

// DELETE — remove an additional project membership (never the home one).
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

    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.taskProject.findUnique({
      where: { taskId_projectId: { taskId, projectId } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Task is not in this project" },
        { status: 404 }
      );
    }

    await prisma.taskProject.delete({ where: { id: existing.id } });

    await prisma.task.update({
      where: { id: taskId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error removing task from project:", error);
    return NextResponse.json(
      { error: "Failed to remove task from project" },
      { status: 500 }
    );
  }
}
