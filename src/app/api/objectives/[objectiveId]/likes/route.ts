import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyWorkspaceAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

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

    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { workspaceId: true },
    });

    if (!objective) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }

    await verifyWorkspaceAccess(userId, objective.workspaceId);

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
