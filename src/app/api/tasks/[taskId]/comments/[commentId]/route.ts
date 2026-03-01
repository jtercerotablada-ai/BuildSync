import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
});

// PATCH /api/tasks/:taskId/comments/:commentId - Edit a comment
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string; commentId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId, commentId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    // Verify comment exists and belongs to user
    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existing.authorId !== userId) {
      return NextResponse.json({ error: "Can only edit your own comments" }, { status: 403 });
    }

    const body = await req.json();
    const data = updateCommentSchema.parse(body);

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: data.content,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(comment);
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
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:taskId/comments/:commentId - Delete a comment
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string; commentId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId, commentId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    // Verify comment exists and belongs to user
    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existing.authorId !== userId) {
      return NextResponse.json({ error: "Can only delete your own comments" }, { status: 403 });
    }

    await prisma.comment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
