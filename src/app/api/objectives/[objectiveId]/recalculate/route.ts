import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-utils";
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
