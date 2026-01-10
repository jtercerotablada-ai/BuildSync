import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createKeyResultSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetValue: z.number(),
  startValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().optional(),
  format: z.enum(["NUMBER", "PERCENTAGE", "CURRENCY", "BOOLEAN"]).optional(),
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

    const body = await req.json();
    const data = createKeyResultSchema.parse(body);

    const keyResult = await prisma.keyResult.create({
      data: {
        name: data.name,
        description: data.description,
        targetValue: data.targetValue,
        startValue: data.startValue || 0,
        currentValue: data.currentValue || data.startValue || 0,
        unit: data.unit,
        format: data.format || "NUMBER",
        objectiveId,
        ownerId: userId,
      },
    });

    return NextResponse.json(keyResult, { status: 201 });
  } catch (error) {
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
    await params; // Just to consume the param

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (!existing) {
      return NextResponse.json(
        { error: "Key result not found" },
        { status: 404 }
      );
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

    return NextResponse.json(keyResult);
  } catch (error) {
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
    await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const keyResultId = searchParams.get("keyResultId");

    if (!keyResultId) {
      return NextResponse.json(
        { error: "Key result ID required" },
        { status: 400 }
      );
    }

    await prisma.keyResult.delete({
      where: { id: keyResultId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting key result:", error);
    return NextResponse.json(
      { error: "Failed to delete key result" },
      { status: 500 }
    );
  }
}
