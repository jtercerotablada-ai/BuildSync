import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { verifyObjectiveAccess } from "@/lib/objective-access";
import { notifyObjectiveActivity } from "@/lib/objective-notifications";

const createCommentSchema = z.object({
  text: z.string().min(1).max(2000),
});

// POST /api/objectives/:objectiveId/comments - Add a comment as a status update
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

    // Commenting is part of reading the goal, not changing it: every reader
    // may comment, a Read-only member of a private goal included.
    await verifyObjectiveAccess(userId, objectiveId, { requireComment: true });

    const body = await req.json();
    const data = createCommentSchema.parse(body);

    const comment = await prisma.objectiveStatusUpdate.create({
      data: {
        objectiveId,
        authorId: userId,
        // No status: this is a comment. Stamping the goal's current status
        // here is what made the activity feed report check-ins that never
        // happened.
        status: null,
        summary: data.text,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    // The owner and members hear about it; before this a question asked on a
    // goal reached nobody. Best-effort, never fails the comment.
    await notifyObjectiveActivity({
      objectiveId,
      actorUserId: userId,
      kind: "comment",
      summary: data.text,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

// GET /api/objectives/:objectiveId/comments - List comments (status updates) for the objective
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

    await verifyObjectiveAccess(userId, objectiveId);

    const comments = await prisma.objectiveStatusUpdate.findMany({
      where: { objectiveId },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}
