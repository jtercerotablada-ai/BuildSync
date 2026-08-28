import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { verifyObjectiveAccess } from "@/lib/objective-access";
import { GoalProgressService } from "@/lib/goal-progress";

const createKeyResultSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    targetValue: z.number(),
    startValue: z.number().optional(),
    currentValue: z.number().optional(),
    unit: z.string().optional(),
    format: z.enum(["NUMBER", "PERCENTAGE", "CURRENCY", "BOOLEAN"]).optional(),
  })
  // A key result whose target equals its start has no range to measure, and
  // the views disagree about what that means (one reads it as 100%, another
  // as 0%), so refuse to store one.
  .refine((d) => d.targetValue !== (d.startValue ?? 0), {
    message: "Target must differ from the start value",
    path: ["targetValue"],
  });

const updateKeyResultSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  targetValue: z.number().optional(),
  startValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().optional().nullable(),
  format: z.enum(["NUMBER", "PERCENTAGE", "CURRENCY", "BOOLEAN"]).optional(),
  note: z.string().optional(), // For update logging
});

// POST /api/objectives/:objectiveId/key-results - Create key result
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

    // A key result is part of the goal and feeds its progress, so every verb
    // here takes write access to the goal itself.
    await verifyObjectiveAccess(userId, objectiveId, { requireWrite: true });

    const body = await req.json();
    const data = createKeyResultSchema.parse(body);

    const keyResult = await prisma.keyResult.create({
      data: {
        name: data.name,
        description: data.description,
        targetValue: data.targetValue,
        startValue: data.startValue ?? 0,
        currentValue: data.currentValue ?? data.startValue ?? 0,
        unit: data.unit,
        format: data.format || "NUMBER",
        objectiveId,
        ownerId: userId,
      },
    });

    // Recalculate objective progress
    await GoalProgressService.recalculateProgress(objectiveId);

    return NextResponse.json(keyResult, { status: 201 });
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

    console.error("Error creating key result:", error);
    return NextResponse.json(
      { error: "Failed to create key result" },
      { status: 500 }
    );
  }
}

// PATCH /api/objectives/:objectiveId/key-results - Update key result
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { objectiveId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyObjectiveAccess(userId, objectiveId, { requireWrite: true });

    const { searchParams } = new URL(req.url);
    const keyResultId = searchParams.get("keyResultId");

    if (!keyResultId) {
      return NextResponse.json(
        { error: "Key result ID required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = updateKeyResultSchema.parse(body);

    // Get current value before update for logging
    const existing = await prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });

    // Bind the key result to THIS objective. Without this, keyResultId is
    // trusted from the query and any KeyResult in the database can be
    // edited by pairing it with an objective the caller owns — audit SEC-04.
    if (!existing || existing.objectiveId !== objectiveId) {
      return NextResponse.json(
        { error: "Key result not found" },
        { status: 404 }
      );
    }

    // Same zero-range guard as on create, but only when this request is
    // actually moving the target or the start — editing the name of a key
    // result that is already zero-range must still work.
    if (data.targetValue !== undefined || data.startValue !== undefined) {
      const nextTarget = data.targetValue ?? existing.targetValue;
      const nextStart = data.startValue ?? existing.startValue;
      if (nextTarget === nextStart) {
        return NextResponse.json(
          { error: "Target must differ from the start value" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.targetValue !== undefined) updateData.targetValue = data.targetValue;
    if (data.startValue !== undefined) updateData.startValue = data.startValue;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.format !== undefined) updateData.format = data.format;

    // If currentValue is being updated, create an update log
    if (data.currentValue !== undefined && data.currentValue !== existing.currentValue) {
      updateData.currentValue = data.currentValue;

      await prisma.keyResultUpdate.create({
        data: {
          keyResultId,
          authorId: userId,
          previousValue: existing.currentValue,
          newValue: data.currentValue,
          note: data.note,
        },
      });
    }

    const keyResult = await prisma.keyResult.update({
      where: { id: keyResultId },
      data: updateData,
      include: {
        updates: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    // Recalculate objective progress if currentValue changed
    if (data.currentValue !== undefined && data.currentValue !== existing.currentValue) {
      await GoalProgressService.recalculateProgress(existing.objectiveId);
    }

    return NextResponse.json(keyResult);
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

    console.error("Error updating key result:", error);
    return NextResponse.json(
      { error: "Failed to update key result" },
      { status: 500 }
    );
  }
}

// DELETE /api/objectives/:objectiveId/key-results - Delete key result
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

    await verifyObjectiveAccess(userId, objectiveId, { requireWrite: true });

    const { searchParams } = new URL(req.url);
    const keyResultId = searchParams.get("keyResultId");

    if (!keyResultId) {
      return NextResponse.json(
        { error: "Key result ID required" },
        { status: 400 }
      );
    }

    // Scope the delete to THIS objective so a keyResultId from another
    // objective/workspace deletes nothing (count 0 → 404) — audit SEC-04.
    const deleted = await prisma.keyResult.deleteMany({
      where: { id: keyResultId, objectiveId },
    });
    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Key result not found" },
        { status: 404 }
      );
    }

    // Recalculate objective progress after deleting key result
    await GoalProgressService.recalculateProgress(objectiveId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting key result:", error);
    return NextResponse.json(
      { error: "Failed to delete key result" },
      { status: 500 }
    );
  }
}
