import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";
import { GoalProgressService } from "@/lib/goal-progress";

// POST /api/objectives/:objectiveId/recalculate - Manually trigger progress recalculation
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

    // Verify objective belongs to user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { workspaceId: true },
    });
    if (!objective || objective.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const newProgress = await GoalProgressService.recalculateProgress(objectiveId);

    return NextResponse.json({
      success: true,
      progress: Math.round(newProgress),
    });
  } catch (error) {
    console.error("Error recalculating progress:", error);
    return NextResponse.json(
      { error: "Failed to recalculate progress" },
      { status: 500 }
    );
  }
}
