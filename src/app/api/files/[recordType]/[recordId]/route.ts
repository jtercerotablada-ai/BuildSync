import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  isPrivateBlobUrl,
  isVercelBlobUrl,
  readPrivateBlob,
} from "@/lib/storage";
import {
  verifyProjectAccess,
  verifyTaskAccess,
  AuthorizationError,
  NotFoundError,
} from "@/lib/auth-guards";
import { canReadContactInbox } from "@/lib/contact-inbox";
import { parseContactAttachments } from "@/lib/contact-attachments";

/**
 * GET /api/files/:recordType/:recordId
 *
 * The one door to an uploaded file's BYTES. The URL stored on the row is never
 * handed out as a link — this route resolves the row, re-runs the owning
 * record's own access rule, and only then streams the content (private blob)
 * or redirects to it (public blob, see below).
 *
 *   attachment -> Attachment      (task attachment, or a comment's attachment)
 *   file       -> File            (the project Files tab)
 *   resource   -> ProjectResource (Overview "Key resources")
 *   contact    -> ContactSubmission.files[?i=n] (public proposal-request
 *                 attachments; gated on the FIRM's inbox, see contact-inbox.ts)
 *
 * Denials answer 404, never 403, matching project-access.ts: a caller who may
 * not read the file must not learn that it exists.
 */

const RECORD_TYPES = ["attachment", "file", "resource", "contact"] as const;
type RecordType = (typeof RECORD_TYPES)[number];

function isRecordType(value: string): value is RecordType {
  return (RECORD_TYPES as readonly string[]).includes(value);
}

/**
 * Types we are willing to render IN the page. Everything else downloads.
 *
 * SVG is deliberately absent even though it is an allowed upload: this route
 * serves from the app's own origin, so an inline SVG would execute its script
 * against a logged-in session.
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

const notFound = () =>
  NextResponse.json({ error: "File not found" }, { status: 404 });

interface ResolvedRecord {
  name: string;
  url: string;
  mimeType: string | null;
}

/**
 * Load the record and authorise the caller against its PARENT. Returns null
 * for every denial so the caller renders one indistinguishable 404.
 */
async function resolveRecord(
  recordType: RecordType,
  recordId: string,
  userId: string,
  index: number
): Promise<ResolvedRecord | null> {
  if (recordType === "contact") {
    // The inbox is global, so the gate is "may this user read the firm's
    // leads at all", not a per-record rule. Same helper the inbox page uses.
    if (!(await canReadContactInbox(userId))) return null;
    const submission = await prisma.contactSubmission.findUnique({
      where: { id: recordId },
      select: { files: true },
    });
    if (!submission) return null;
    const files = parseContactAttachments(submission.files);
    const f = files[index];
    if (!f) return null;
    return { name: f.name, url: f.url, mimeType: f.type || null };
  }

  if (recordType === "attachment") {
    const attachment = await prisma.attachment.findUnique({
      where: { id: recordId },
      select: {
        name: true,
        url: true,
        mimeType: true,
        taskId: true,
        comment: { select: { taskId: true } },
      },
    });
    if (!attachment) return null;
    // An attachment hangs off a task or off a comment; a comment always has a
    // task. Either way the task's rule decides, exactly as it does for
    // GET /api/tasks/:taskId/attachments.
    const taskId = attachment.taskId ?? attachment.comment?.taskId ?? null;
    if (!taskId) return null;
    await verifyTaskAccess(userId, taskId);
    return attachment;
  }

  if (recordType === "file") {
    const file = await prisma.file.findUnique({
      where: { id: recordId },
      select: { name: true, url: true, mimeType: true, projectId: true },
    });
    if (!file) return null;
    await verifyProjectAccess(userId, file.projectId);
    return file;
  }

  const resource = await prisma.projectResource.findUnique({
    where: { id: recordId },
    select: {
      name: true,
      url: true,
      mimeType: true,
      type: true,
      projectId: true,
    },
  });
  if (!resource) return null;
  // A LINK resource is an external URL somebody pasted, not bytes we hold.
  // Redirecting to it would turn this route into an open redirect.
  if (resource.type !== "FILE") return null;
  await verifyProjectAccess(userId, resource.projectId);
  return resource;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ recordType: string; recordId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recordType, recordId } = await params;
    if (!isRecordType(recordType)) {
      return notFound();
    }

    const index = Math.max(
      0,
      parseInt(new URL(req.url).searchParams.get("i") || "0", 10) || 0
    );

    let record: ResolvedRecord | null;
    try {
      record = await resolveRecord(recordType, recordId, userId, index);
    } catch (error) {
      // Both denials collapse to 404 on purpose. The guards distinguish "you
      // cannot see this" from "you can see it but not act on it"; reading the
      // bytes has no second verb, so the distinction would only tell a caller
      // which ids are real.
      if (
        error instanceof AuthorizationError ||
        error instanceof NotFoundError
      ) {
        return notFound();
      }
      throw error;
    }
    if (!record) return notFound();

    const forceDownload =
      new URL(req.url).searchParams.get("download") === "1";

    if (isPrivateBlobUrl(record.url)) {
      const blob = await readPrivateBlob(record.url);
      if (!blob || blob.statusCode !== 200) return notFound();

      const contentType =
        record.mimeType || blob.blob.contentType || "application/octet-stream";
      const inline = !forceDownload && INLINE_SAFE_TYPES.has(contentType);

      return new NextResponse(blob.stream, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(blob.blob.size),
          "Content-Disposition": contentDisposition(record.name, inline),
          "X-Content-Type-Options": "nosniff",
          // Per-caller bytes: never let a shared cache hold them, and never
          // let a stale copy outlive the permission that produced it.
          "Cache-Control": "private, no-store",
        },
      });
    }

    // ── PUBLIC BLOBS — DO NOT DELETE ─────────────────────────────────────
    // Legacy uploads, and every upload while SAAS_BLOB_ACCESS (storage.ts)
    // is "public" — the firm's store refuses private writes — are PUBLIC
    // blobs whose url is the only address we have: Vercel Blob has no
    // operation that flips an existing blob's access. The owning record's
    // rule has just passed, so the caller gets the bytes' address. Only a
    // url of OUR store is followed; anything else would make this route an
    // open redirect to a host someone else controls.
    if (!isVercelBlobUrl(record.url)) return notFound();
    // Carry `?download=1` across the hop. `<a download>` is ignored once a
    // navigation crosses origins, so dropping the parameter here is what made
    // Download preview a legacy PDF in a tab instead of saving it — the blob
    // host honours the same parameter and sets Content-Disposition itself.
    const legacy = new URL(record.url);
    if (forceDownload) legacy.searchParams.set("download", "1");
    return NextResponse.redirect(legacy.toString(), {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[file read] error:", error);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}
