import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  BlobRejectedError,
  SAAS_BLOB_ACCESS,
  fileReadUrl,
  maxUploadBytes,
  uploadFile,
  verifyUploadedBlob,
} from "@/lib/storage";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

// The url on the row is a storage address: private blobs only the server can
// fetch, public ones an unguessable link that must not leak. Every response
// from here publishes the authenticated read route instead, so the panels
// rendering these rows never hold a storage address.
function withReadUrl<T extends { id: string; url: string }>(a: T): T {
  return { ...a, url: fileReadUrl("attachment", a.id) };
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

    // Two ways a file arrives. Multipart still streams THROUGH this handler,
    // which is the simpler path for small files. A large one cannot: Vercel
    // refuses a function request body over ~4.5MB, so the browser uploads
    // straight to blob storage (token minted by /api/blob/upload) and then
    // posts JSON here describing the blob it finished.
    const isClientUpload = (req.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json");

    let file: File | null = null;
    let blobUrl: string | null = null;
    let fileName: string;
    let fileSize: number;
    let mimeType: string;
    // Optional commentId: when present, the upload is bound to a
    // specific comment so it renders inline under that message.
    let commentId: string | null;

    if (isClientUpload) {
      // Only the url, the display name and the comment binding. Size and type
      // are read back off the stored blob below rather than believed.
      const body = (await req.json().catch(() => null)) as {
        blobUrl?: unknown;
        name?: unknown;
        commentId?: unknown;
      } | null;

      if (
        !body ||
        typeof body.blobUrl !== "string" ||
        typeof body.name !== "string" ||
        body.name.length === 0
      ) {
        return NextResponse.json(
          { error: "blobUrl and name are required" },
          { status: 400 }
        );
      }

      /* ── GUARD 1 — SYNCHRONOUS, AUTHORITATIVE ────────────────────────────
         The url is the caller's word. verifyUploadedBlob proves it is a blob
         of OUR store, at the access level SAAS_BLOB_ACCESS expects (a token
         cannot pin access, so the browser chose it), under `tasks/<taskId>/`
         (the token refuses any other prefix, and uploadFile writes the same
         folder) and within the size and type rules — read off the stored
         blob, never believed from the body. Binding the folder matters beyond
         read scope: DELETE on an attachment deletes the blob behind it, so a
         row aliasing another record's file would turn a routine delete into
         the destruction of that file. Its other half is GUARD 2 in
         /api/blob/upload's onUploadCompleted. */
      let verified;
      try {
        verified = await verifyUploadedBlob(
          body.blobUrl,
          body.name,
          `tasks/${taskId}/`,
          SAAS_BLOB_ACCESS,
          maxUploadBytes()
        );
      } catch (err) {
        if (err instanceof BlobRejectedError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }

      // One row per blob: two rows sharing a url means deleting either one
      // leaves the other pointing at nothing.
      const alreadyAttached = await prisma.attachment.findFirst({
        where: { url: verified.url },
        select: { id: true },
      });
      if (alreadyAttached) {
        return NextResponse.json(
          { error: "That file is already attached" },
          { status: 409 }
        );
      }

      blobUrl = verified.url;
      fileName = verified.name;
      fileSize = verified.size;
      mimeType = verified.mimeType;
      commentId =
        typeof body.commentId === "string" && body.commentId.length > 0
          ? body.commentId
          : null;
    } else {
      const formData = await req.formData();
      file = formData.get('file') as File;
      const rawCommentId = formData.get('commentId');
      commentId =
        typeof rawCommentId === "string" && rawCommentId.length > 0
          ? rawCommentId
          : null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      fileName = file.name;
      fileSize = file.size;
      mimeType = file.type || "application/octet-stream";
    }

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
    if (blobUrl) {
      // Already in the store, and already through guard 1 above.
      fileUrl = blobUrl;
    } else {
      try {
        ({ url: fileUrl } = await uploadFile(file!, `tasks/${taskId}`));
      } catch (uploadErr) {
        return NextResponse.json(
          { error: uploadErr instanceof Error ? uploadErr.message : "Upload failed" },
          { status: 400 }
        );
      }
    }

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        name: fileName,
        url: fileUrl,
        mimeType,
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
