import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { buildCommentContent, commentToPlainText } from "@/lib/comment-format";
import { deleteFile } from "@/lib/storage";

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

    // Scoped to the task in the PATH, not just the id: an unscoped lookup
    // made the verifyTaskAccess check above decorative — any task the caller
    // could read acted as a pass-through to their comments in projects they
    // can no longer open.
    const existing = await prisma.comment.findFirst({
      where: { id: commentId, taskId },
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
        // Store HTML-escaped plain text (never trust client HTML). Editing
        // drops mention chips to plain @Name text — acceptable, and safe.
        content: buildCommentContent(commentToPlainText(data.content), []),
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

    // Scoped to the task in the PATH, not just the id: an unscoped lookup
    // made the verifyTaskAccess check above decorative — any task the caller
    // could read acted as a pass-through to their comments in projects they
    // can no longer open.
    const existing = await prisma.comment.findFirst({
      where: { id: commentId, taskId },
      select: { authorId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existing.authorId !== userId) {
      return NextResponse.json({ error: "Can only delete your own comments" }, { status: 403 });
    }

    // Files posted with a comment are also TASK attachments (they carry the
    // taskId and show in the task's Attachments list). Attachment.comment
    // cascades, so deleting the comment used to delete those rows too:
    // fixing a typo silently removed the deliverable from the task. Detach
    // them instead, so they stay on the task. Replies go with their parent
    // (Comment.parent cascades), so their files are handled the same way.
    const replies = await prisma.comment.findMany({
      where: { parentId: commentId },
      select: { id: true },
    });
    const threadIds = [commentId, ...replies.map((r) => r.id)];

    const orphanUrls = await prisma.$transaction(async (tx) => {
      await tx.attachment.updateMany({
        where: { commentId: { in: threadIds }, taskId: { not: null } },
        data: { commentId: null },
      });
      // Whatever is still bound to the thread has no task to fall back to and
      // is removed by the cascade; its blob is cleaned up below.
      const leftovers = await tx.attachment.findMany({
        where: { commentId: { in: threadIds } },
        select: { url: true },
      });
      await tx.comment.delete({ where: { id: commentId } });
      return [...new Set(leftovers.map((a) => a.url))];
    });

    // Best-effort, after the rows are gone: a storage hiccup must not turn a
    // completed delete into an error. A url another row still points at is
    // left alone.
    await Promise.allSettled(
      orphanUrls.map(async (url) => {
        const stillUsed = await prisma.attachment.count({ where: { url } });
        if (stillUsed === 0) await deleteFile(url);
      })
    );

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
