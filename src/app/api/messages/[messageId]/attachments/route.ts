import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  BlobRejectedError,
  SAAS_BLOB_ACCESS,
  maxUploadBytes,
  uploadFile,
  isPrivateBlobUrl,
  isVercelBlobUrl,
  readPrivateBlob,
  verifyUploadedBlob,
} from "@/lib/storage";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * A message attachment's row url is a storage address (a private blob, or an
 * unguessable public one that must not leak), so the bytes need an
 * authenticated door, the way task
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

    // ── PUBLIC BLOBS — DO NOT DELETE ─────────────────────────────────────
    // Legacy uploads, and every upload while SAAS_BLOB_ACCESS is "public",
    // are PUBLIC blobs whose url is the only address we hold: Vercel Blob
    // cannot flip an existing blob's access. The caller has just passed the
    // message's read rule. Without this branch no message file opens.
    if (!isVercelBlobUrl(attachment.url)) return notFound();
    // Carry `?download=1` across the hop: `<a download>` is ignored once a
    // redirect goes cross-origin, and Vercel Blob honours the param.
    const target = new URL(attachment.url);
    if (forceDownload) target.searchParams.set("download", "1");
    return NextResponse.redirect(target.toString(), {
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
 * Bind a file to an existing message. Works for both project and portfolio
 * messages (Message is the shared model). Either JSON { blobUrl, name } for a
 * file the browser uploaded straight to blob storage (token:
 * /api/blob/upload — Vercel refuses a function body over ~4.5MB), or a
 * multipart `file` for a small one.
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

    let record: { name: string; url: string; size: number; mimeType: string };
    const isClientUpload = (req.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json");

    if (isClientUpload) {
      const body = (await req.json().catch(() => null)) as {
        blobUrl?: unknown;
        name?: unknown;
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
      // The url is the caller's word: our store, the expected access level,
      // this message's folder, and size/type read off the stored blob.
      try {
        record = await verifyUploadedBlob(
          body.blobUrl,
          body.name,
          `messages/${messageId}/`,
          SAAS_BLOB_ACCESS,
          maxUploadBytes()
        );
      } catch (err) {
        if (err instanceof BlobRejectedError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
      // One row per blob: deleting either row would strand the other.
      const already = await prisma.messageAttachment.findFirst({
        where: { url: record.url },
        select: { id: true },
      });
      if (already) {
        return NextResponse.json(
          { error: "That file is already attached" },
          { status: 409 }
        );
      }
    } else {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      // uploadFile owns the size cap and the type allowlist. Its failures are
      // the caller's fault, so surface the reason as a 400 rather than the
      // generic 500 the outer catch returns.
      try {
        const { url } = await uploadFile(file, `messages/${messageId}`);
        record = {
          name: file.name,
          url,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        };
      } catch (uploadErr) {
        return NextResponse.json(
          { error: uploadErr instanceof Error ? uploadErr.message : "Upload failed" },
          { status: 400 }
        );
      }
    }

    const attachment = await prisma.messageAttachment.create({
      data: { ...record, messageId },
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
