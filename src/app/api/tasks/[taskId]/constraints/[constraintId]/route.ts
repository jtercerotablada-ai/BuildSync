import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyTaskAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

/**
 * PATCH  /api/tasks/:taskId/constraints/:constraintId — edit / resolve.
 * DELETE /api/tasks/:taskId/constraints/:constraintId — remove.
 */

const CONSTRAINT_TYPES = [
  "MATERIAL",
  "PERMIT",
  "LABOR",
  "DESIGN",
  "RFI",
  "EQUIPMENT",
  "INFORMATION",
  "SUBMITTAL",
  "SAFETY",
  "OTHER",
] as const;

const patchSchema = z.object({
  type: z.enum(CONSTRAINT_TYPES).optional(),
  description: z.string().min(1).max(1000).optional(),
  status: z.enum(["OPEN", "RESOLVED"]).optional(),
  responsibleId: z.string().nullable().optional(),
  needBy: z.string().nullable().optional(),
});

const responsibleSelect = {
  select: { id: true, name: true, email: true, image: true },
} as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string; constraintId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { taskId, constraintId } = await params;
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    // Ensure the constraint actually belongs to this task.
    const existing = await prisma.taskConstraint.findUnique({
      where: { id: constraintId },
      select: { id: true, taskId: true, status: true },
    });
    if (!existing || existing.taskId !== taskId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.type !== undefined) data.type = d.type;
    if (d.description !== undefined) data.description = d.description.trim();
    if (d.responsibleId !== undefined) data.responsibleId = d.responsibleId;
    if (d.needBy !== undefined) {
      data.needBy = d.needBy ? new Date(d.needBy) : null;
    }
    if (d.status !== undefined) {
      data.status = d.status;
      // Stamp / clear the resolution time as the status flips.
      data.resolvedAt = d.status === "RESOLVED" ? new Date() : null;
    }

    const updated = await prisma.taskConstraint.update({
      where: { id: constraintId },
      data,
      include: { responsible: responsibleSelect },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof NotFoundError) {
      const { status, message } = getErrorStatus(err);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[task constraint PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update constraint" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ taskId: string; constraintId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { taskId, constraintId } = await params;
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    const existing = await prisma.taskConstraint.findUnique({
      where: { id: constraintId },
      select: { id: true, taskId: true },
    });
    if (!existing || existing.taskId !== taskId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.taskConstraint.delete({ where: { id: constraintId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof NotFoundError) {
      const { status, message } = getErrorStatus(err);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[task constraint DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete constraint" },
      { status: 500 }
    );
  }
}
