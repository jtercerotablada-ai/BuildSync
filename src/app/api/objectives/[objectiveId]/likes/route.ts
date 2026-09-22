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

    // Liking is part of reading the goal: every reader may like it, a
    // Read-only member of a private goal included.
    await verifyObjectiveAccess(userId, objectiveId, { requireComment: true });

    const existing = await prisma.objectiveLike.findUnique({
      where: { objectiveId_userId: { objectiveId, userId } },
    });

    // Idempotent both ways: a double-click races two toggles, so the unlike
    // may find the row already gone and the like may hit the unique index.
    if (existing) {
      await prisma.objectiveLike.deleteMany({
        where: { objectiveId, userId },
      });
    } else {
      try {
        await prisma.objectiveLike.create({
          data: { objectiveId, userId },
        });
      } catch (e) {
        if ((e as { code?: string })?.code !== "P2002") throw e;
      }
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
