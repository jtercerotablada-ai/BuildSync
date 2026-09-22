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
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { requireTeamStanding, type TeamStanding } from "@/lib/team-access";

/**
 * A team message attachment's row url is a storage address (a private blob, or
 * an unguessable public one that must not leak), so the bytes need an
 * authenticated door, the
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

    // Same read rule as the feed that listed this file (team member or
    // workspace OWNER/ADMIN, with a live seat). Any refusal is a 404 here.
    try {
      await requireTeamStanding(userId, teamId);
    } catch (err) {
      if (err instanceof AuthorizationError || err instanceof NotFoundError) {
        return notFound();
      }
      throw err;
    }

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

    // ── PUBLIC BLOBS — DO NOT DELETE ─────────────────────────────────────
    // Legacy uploads, and every upload while SAAS_BLOB_ACCESS is "public",
    // are PUBLIC blobs whose url is the only address we hold: Vercel Blob
    // cannot flip an existing blob's access. The caller has just passed the
    // team-membership rule. Without this branch no team message file opens.
    if (!isVercelBlobUrl(attachment.url)) return notFound();
    // Carry `?download=1` across the hop: `<a download>` is ignored once a
    // redirect goes cross-origin, and Vercel Blob honours the param.
    const target = new URL(attachment.url);
    if (forceDownload) target.searchParams.set("download", "1");
    return NextResponse.redirect(target.toString(), {
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

// POST /api/teams/:teamId/messages/:messageId/attachments - Attach a file.
// JSON { blobUrl, name } for a file the browser uploaded straight to blob
// storage (token: /api/blob/upload — Vercel refuses a function body over
// ~4.5MB), or a multipart `file` for a small one.
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

    // Team member or workspace OWNER/ADMIN, with a live contributor seat — a
    // bare TeamMember row can outlive the seat.
    let standing: TeamStanding;
    try {
      standing = await requireTeamStanding(userId, teamId);
    } catch (err) {
      const { status, message } = getErrorStatus(err);
      if (status === 500) throw err;
      return NextResponse.json({ error: message }, { status });
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
    if (message.authorId !== userId && !standing.canManageMembers) {
      return NextResponse.json(
        { error: "You can only attach files to your own messages" },
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
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      // uploadFile owns the size cap and the type allowlist. Its errors (too
      // large, disallowed type/extension) are CLIENT errors — surface the
      // specific reason as a 400 instead of the generic 500.
      try {
        const { url } = await uploadFile(file, `messages/${messageId}`);
        record = {
          name: file.name,
          url,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        };
      } catch (uploadErr) {
        const msg =
          uploadErr instanceof Error ? uploadErr.message : "Upload failed";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const attachment = await prisma.messageAttachment.create({
      data: { ...record, teamMessageId: messageId },
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
