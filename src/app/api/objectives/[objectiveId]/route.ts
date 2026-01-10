import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const updateObjectiveSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ACHIEVED", "PARTIAL", "MISSED", "DROPPED"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  progressSource: z.enum(["MANUAL", "KEY_RESULTS", "SUB_OBJECTIVES", "PROJECTS"]).optional(),
  period: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
});

// GET /api/objectives/:objectiveId - Get objective details
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

    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            keyResults: true,
          },
        },
        keyResults: {
          include: {
            updates: {
              orderBy: { createdAt: "desc" },
              take: 5,
            },
          },
        },
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
                status: true,
              },
            },
          },
        },
        statusUpdates: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            keyResults: true,
            children: true,
            projects: true,
            likes: true,
          },
        },
      },
    });

    if (!objective) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }

    // Calculate progress based on source
    let calculatedProgress = objective.progress;

    if (objective.progressSource === "KEY_RESULTS" && objective.keyResults.length > 0) {
      const krProgress = objective.keyResults.map((kr) => {
        const range = kr.targetValue - kr.startValue;
        if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
        return Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100));
      });
      calculatedProgress = Math.round(krProgress.reduce((a, b) => a + b, 0) / krProgress.length);
    } else if (objective.progressSource === "SUB_OBJECTIVES" && objective.children.length > 0) {
      calculatedProgress = Math.round(
        objective.children.reduce((sum, c) => sum + c.progress, 0) / objective.children.length
      );
    }

    return NextResponse.json({
      ...objective,
      progress: calculatedProgress,
    });
  } catch (error) {
    console.error("Error fetching objective:", error);
    return NextResponse.json(
      { error: "Failed to fetch objective" },
      { status: 500 }
    );
  }
}

// PATCH /api/objectives/:objectiveId - Update objective
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

    const body = await req.json();
    const data = updateObjectiveSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.progressSource !== undefined) updateData.progressSource = data.progressSource;
    if (data.period !== undefined) updateData.period = data.period;
    if (data.teamId !== undefined) updateData.teamId = data.teamId;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    const objective = await prisma.objective.update({
      where: { id: objectiveId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        keyResults: true,
        _count: {
          select: {
            keyResults: true,
            children: true,
          },
        },
      },
    });

    return NextResponse.json(objective);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating objective:", error);
    return NextResponse.json(
      { error: "Failed to update objective" },
      { status: 500 }
    );
  }
}

// DELETE /api/objectives/:objectiveId - Delete objective
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

    await prisma.objective.delete({
      where: { id: objectiveId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting objective:", error);
    return NextResponse.json(
      { error: "Failed to delete objective" },
      { status: 500 }
    );
  }
}
