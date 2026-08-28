import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  uploadFile,
  isPrivateBlobUrl,
  isVercelBlobUrl,
  readPrivateBlob,
} from "@/lib/storage";

/**
 * Team message attachments are private blobs, so the row's url is not
 * something a browser can follow — the bytes need an authenticated door, the
 * way task attachments have /api/files/attachment/:id. MessageAttachment is
 * not one of that route's record types, and team membership is this file's
 * rule, so the door lives here: the id travels as `?file=` because the
 * sibling path segment belongs to the DELETE route.
 */
const teamAttachmentUrl = (
  teamId: string,
  messageId: string,
  attachmentId: string
) =>
  `/api/teams/${teamId}/messages/${messageId}/attachments?file=${attachmentId}`;

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
 * GET /api/teams/:teamId/messages/:messageId/attachments?file=<attachmentId>
 *
 * Stream one attachment's bytes to a member of the team. Denials answer 404,
 * never 403 — a caller who may not read the file must not learn it exists.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId, messageId } = await params;
    const url = new URL(req.url);
    const attachmentId = url.searchParams.get("file");
    const notFound = () =>
      NextResponse.json({ error: "File not found" }, { status: 404 });
    if (!attachmentId) return notFound();

    const teamMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!teamMember) return notFound();

    // Bind the attachment to a message of THIS team, or a member of any team
    // could read another team's files by pairing their own teamId with a
    // foreign message id.
    const attachment = await prisma.messageAttachment.findFirst({
      where: {
        id: attachmentId,
        teamMessageId: messageId,
        teamMessage: { teamId },
      },
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
    // every file already posted in a team message stops opening.
    if (!isVercelBlobUrl(attachment.url)) return notFound();
    return NextResponse.redirect(attachment.url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error reading team message attachment:", error);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}

// POST /api/teams/:teamId/messages/:messageId/attachments - Upload message attachment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, messageId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is team member
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be a team member" },
        { status: 403 }
      );
    }

    // Verify message exists and belongs to the team
    const message = await prisma.teamMessage.findFirst({
      where: { id: messageId, teamId },
      select: { id: true, authorId: true },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Only the message author or a team lead may attach files (mirrors the
    // attachment DELETE gate + the UI, which only shows "Add file" on your
    // own messages).
    if (message.authorId !== userId && teamMember.role !== "LEAD") {
      return NextResponse.json(
        { error: "You can only attach files to your own messages" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // uploadFile owns the size cap and the type allowlist; a second copy of
    // the ceiling here is how this route ended up rejecting files the store
    // would have taken. Its errors (too large, disallowed type/extension) are
    // CLIENT errors — surface the specific reason as a 400 instead of the
    // generic 500 the outer catch would return.
    let url: string;
    try {
      ({ url } = await uploadFile(file, `messages/${messageId}`));
    } catch (uploadErr) {
      const msg =
        uploadErr instanceof Error ? uploadErr.message : "Upload failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const attachment = await prisma.messageAttachment.create({
      data: {
        name: file.name,
        url,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        teamMessageId: messageId,
      },
    });

    return NextResponse.json(
      {
        ...attachment,
        url: teamAttachmentUrl(teamId, messageId, attachment.id),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading message attachment:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
