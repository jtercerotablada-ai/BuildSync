import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  uploadFile,
  isPrivateBlobUrl,
  isVercelBlobUrl,
  readPrivateBlob,
} from "@/lib/storage";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * Message attachments are private blobs, so the row's url is not something a
 * browser can follow — the bytes need an authenticated door, the way task
 * attachments have /api/files/attachment/:id. MessageAttachment is not one of
 * that route's record types, and its access rule is this file's
 * (loadMessageWithAccess), so the door lives here: the id travels as `?file=`
 * because the sibling path segment belongs to the DELETE route.
 */
const messageAttachmentUrl = (messageId: string, attachmentId: string) =>
  `/api/messages/${messageId}/attachments?file=${attachmentId}`;

/**
 * Types we are willing to render IN the page. Everything else downloads.
 * SVG is deliberately absent: served from the app's own origin it would run
 * its script against a logged-in session.
 */
const INLINE_SAFE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "application/pdf",
  "text/plain",
]);

function contentDisposition(name: string, inline: boolean): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * GET /api/messages/:messageId/attachments?file=<attachmentId>
 *
 * Stream one attachment's bytes to a caller who may READ the message's scope.
 * Denials answer 404, never 403 — a caller who may not read the file must not
 * learn that it exists.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { messageId } = await params;
    const url = new URL(req.url);
    const attachmentId = url.searchParams.get("file");
    const notFound = () =>
      NextResponse.json({ error: "File not found" }, { status: 404 });
    if (!attachmentId) return notFound();

    const access = await loadMessageWithAccess(messageId, userId);
    if (!access.ok) return notFound();

    const attachment = await prisma.messageAttachment.findFirst({
      where: { id: attachmentId, messageId },
      select: { name: true, url: true, mimeType: true },
    });
    if (!attachment) return notFound();

    const forceDownload = url.searchParams.get("download") === "1";

    if (isPrivateBlobUrl(attachment.url)) {
      const blob = await readPrivateBlob(attachment.url);
      if (!blob || blob.statusCode !== 200) return notFound();

      const contentType =
        attachment.mimeType ||
        blob.blob.contentType ||
        "application/octet-stream";
      const inline = !forceDownload && INLINE_SAFE_TYPES.has(contentType);

      return new NextResponse(blob.stream, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(blob.blob.size),
          "Content-Disposition": contentDisposition(attachment.name, inline),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    }

    // ── LEGACY PUBLIC BLOBS — DO NOT DELETE ──────────────────────────────
    // Everything uploaded before storage.ts switched to `access: "private"`
    // is a PUBLIC blob and its public url is the only address we hold for it:
    // Vercel Blob cannot flip an existing blob's access. Without this branch
    // every file already posted in a message stops opening.
    if (!isVercelBlobUrl(attachment.url)) return notFound();
    return NextResponse.redirect(attachment.url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("[message attachment GET] error:", err);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages/:messageId/attachments
 *
 * Upload a file and bind it to an existing message. Works for both
 * project and portfolio messages (Message is the shared model).
 *
 * Access: the actor must be able to read the message's scope AND
 * must be the message author (attachments are part of the message,
 * not a global comment thread).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { messageId } = await params;

    const access = await loadMessageWithAccess(messageId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }
    if (!access.isAuthor) {
      return NextResponse.json(
        { error: "Only the author can attach files to their message" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // uploadFile owns the size cap and the type allowlist — a second copy of
    // the ceiling here is how this route ended up rejecting files the store
    // would have taken. Its failures are the caller's fault, so surface the
    // reason as a 400 rather than the generic 500 the outer catch returns.
    let url: string;
    try {
      ({ url } = await uploadFile(file, `messages/${messageId}`));
    } catch (uploadErr) {
      return NextResponse.json(
        { error: uploadErr instanceof Error ? uploadErr.message : "Upload failed" },
        { status: 400 }
      );
    }

    const attachment = await prisma.messageAttachment.create({
      data: {
        name: file.name,
        url,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        messageId,
      },
    });

    return NextResponse.json(
      {
        id: attachment.id,
        name: attachment.name,
        url: messageAttachmentUrl(messageId, attachment.id),
        size: attachment.size,
        mimeType: attachment.mimeType,
        createdAt: attachment.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    // Log the detail server-side but return a generic message — raw
    // err.message can leak internals (paths, storage keys) to the client.
    console.error("[message attachment POST] error:", err);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
