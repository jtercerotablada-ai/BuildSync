import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { uploadFile } from "@/lib/storage";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

// Uploads are private blobs: the url on the row is an address only the server
// can fetch. Every response from here publishes the authenticated read route
// instead, so the panels rendering these rows never hold a storage address.
function withReadUrl<T extends { id: string; url: string }>(a: T): T {
  return { ...a, url: `/api/files/attachment/${a.id}` };
}

// GET /api/tasks/:taskId/attachments - Get task attachments
export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attachments.map(withReadUrl));
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching attachments:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/:taskId/attachments - Upload attachment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read first (so a stranger gets the task's own 404/403), then gate on
    // capability once we know WHAT is being attached: read access alone used
    // to be enough to upload files onto anyone's task.
    await verifyTaskAccess(userId, taskId);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    // Optional commentId: when present, the upload is bound to a
    // specific comment so it renders inline under that message.
    const rawCommentId = formData.get('commentId');
    const commentId =
      typeof rawCommentId === "string" && rawCommentId.length > 0
        ? rawCommentId
        : null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    const fileSize = file.size;

    // If a commentId was supplied, make sure it belongs to this task.
    // Otherwise a malicious client could attach files to any comment
    // by guessing its id.
    let attachingToOwnComment = false;
    if (commentId) {
      const comment = await prisma.comment.findFirst({
        where: { id: commentId, taskId },
        select: { id: true, authorId: true },
      });
      if (!comment) {
        return NextResponse.json(
          { error: "Comment not found on this task" },
          { status: 404 }
        );
      }
      attachingToOwnComment = comment.authorId === userId;
    }

    // Attaching to YOUR OWN comment is part of commenting, so a COMMENTER
    // keeps it. Everything else — a loose file on the task, or a file on
    // someone else's comment — is a write.
    //
    // Deliberate and worth stating: a comment-bound file DOES appear in the
    // task's Attachments list and the project's Files tab, so a COMMENTER can
    // put a file there by attaching it to a comment of their own. That is
    // participation, not a bypass — they can already post the same file's
    // contents as a comment — and hiding comment attachments from the file
    // list would cost more than the distinction is worth.
    await verifyTaskAccess(userId, taskId, {
      requireWrite: !attachingToOwnComment,
      requireComment: attachingToOwnComment,
    });

    // uploadFile owns the size cap and the type allowlist — a second copy of
    // the ceiling here is how this route ended up rejecting files the store
    // would have taken. Its failures are the caller's fault, so surface the
    // reason as a 400 rather than the generic 500 the outer catch returns.
    let fileUrl: string;
    try {
      ({ url: fileUrl } = await uploadFile(file, `tasks/${taskId}`));
    } catch (uploadErr) {
      return NextResponse.json(
        { error: uploadErr instanceof Error ? uploadErr.message : "Upload failed" },
        { status: 400 }
      );
    }

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        name: fileName,
        url: fileUrl,
        mimeType: file.type || "application/octet-stream",
        size: fileSize,
        taskId,
        commentId,
        uploaderId: userId,
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "ATTACHMENT_ADDED",
        taskId,
        userId,
        data: { attachmentId: attachment.id, attachmentName: fileName },
      },
    });

    return NextResponse.json(withReadUrl(attachment), { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error uploading attachment:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
