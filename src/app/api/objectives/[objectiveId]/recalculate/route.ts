import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { verifyObjectiveAccess } from "@/lib/objective-access";
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

    // Recalculating writes the goal's stored progress (and its ancestors'),
    // so it takes write access.
    await verifyObjectiveAccess(userId, objectiveId, { requireWrite: true });

    const newProgress = await GoalProgressService.recalculateProgress(objectiveId);

    return NextResponse.json({
      success: true,
      progress: Math.round(newProgress),
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error recalculating progress:", error);
    return NextResponse.json(
      { error: "Failed to recalculate progress" },
      { status: 500 }
    );
  }
}
