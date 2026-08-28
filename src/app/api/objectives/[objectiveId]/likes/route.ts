import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { verifyObjectiveAccess } from "@/lib/objective-access";

// POST /api/objectives/:objectiveId/likes - Toggle like for current user
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

    // A like is a row on the goal, so it takes write access to the goal.
    await verifyObjectiveAccess(userId, objectiveId, { requireWrite: true });

    const existing = await prisma.objectiveLike.findUnique({
      where: { objectiveId_userId: { objectiveId, userId } },
    });

    if (existing) {
      await prisma.objectiveLike.delete({
        where: { objectiveId_userId: { objectiveId, userId } },
      });
    } else {
      await prisma.objectiveLike.create({
        data: { objectiveId, userId },
      });
    }

    const count = await prisma.objectiveLike.count({ where: { objectiveId } });

    return NextResponse.json({ liked: !existing, count });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error toggling like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}
