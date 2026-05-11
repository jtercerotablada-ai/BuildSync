import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";
import type { ObjectiveStatus } from "@prisma/client";

/**
 * POST /api/objectives/:objectiveId/check-in
 *
 * Quick weekly status update with confidence rating. Replaces the
 * looser "post a comment" pattern with a structured rhythm: status
 * + 1-10 confidence score + short summary.
 *
 * Stamps `lastCheckInAt` so the list view can surface goals that
 * haven't been checked in this week (drift detection).
 *
 * The check-in is persisted as an ObjectiveStatusUpdate so the
 * activity feed reads identically to comments and inline updates.
 */
const checkInSchema = z.object({
  status: z
    .enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ACHIEVED", "PARTIAL", "MISSED", "DROPPED"])
    .optional(),
  confidenceScore: z.number().int().min(1).max(10).optional(),
  summary: z.string().min(1, "A short note is required"),
});

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
    const parsed = checkInSchema.parse(body);

    // Verify the objective is in the user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { workspaceId: true, status: true },
    });
    if (!objective || objective.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const newStatus = (parsed.status ?? objective.status) as ObjectiveStatus;

    // Atomic: update the objective and append a status update entry.
    const [, statusUpdate] = await prisma.$transaction([
      prisma.objective.update({
        where: { id: objectiveId },
        data: {
          status: newStatus,
          confidenceScore: parsed.confidenceScore ?? undefined,
          lastCheckInAt: new Date(),
        },
      }),
      prisma.objectiveStatusUpdate.create({
        data: {
          objectiveId,
          authorId: userId,
          status: newStatus,
          summary: parsed.summary,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),
    ]);

    return NextResponse.json({ success: true, statusUpdate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating check-in:", error);
    return NextResponse.json(
      { error: "Failed to create check-in" },
      { status: 500 }
    );
  }
}
