import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTrackingToken } from "@/lib/tracking-token";
import {
  BlobRejectedError,
  PUBLIC_UPLOAD_MAX_BYTES,
  PUBLIC_UPLOAD_MAX_FILES,
  deleteFile,
  uploadPublicFile,
  verifyUploadedBlob,
} from "@/lib/storage";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { buildCommentContent, commentToPlainText } from "@/lib/comment-format";
import { shouldNotify } from "@/lib/notification-prefs";
import {
  type FormField,
  type FormSubmissionPayload,
  firstEmailAnswer,
} from "@/lib/form-types";

/**
 * POST /api/forms/:formId/track/:submissionId/reply
 *
 * Body: application/json { token, content, files?: { blobUrl, name }[] }
 * for files the browser uploaded straight to blob storage (token route:
 * /api/blob/upload; a function refuses a request body over ~4.5MB), or
 * multipart/form-data with
 *   - token: signed tracking token (same that gates the GET)
 *   - content: text body (required, max 4000 chars)
 *   - file[]: optional attachment(s)
 *
 * Effect: creates a Comment on the underlying Task with
 *   - source: TRACKING_REPLY
 *   - visibility: EXTERNAL (always — the submitter can't post
 *     internal-only notes)
 *   - authorId: null (no User)
 *   - guestName / guestEmail captured from the submission so the
 *     comment renders with the submitter's identity in the task UI
 *   - attachments: uploaded to Vercel Blob, linked to the Comment
 *     AND mirrored as Task Attachments (so the engineer sees them
 *     under Attachments in the task panel without expanding the
 *     comment)
 *
 * Notifies the task assignee + project owner so the reply doesn't
 * sit unread. Same notification fan-out as the original submission.
 */
export async function POST(
  req: Request,
  {
    params,
  }: { params: Promise<{ formId: string; submissionId: string }> }
) {
  // Blobs THIS request wrote (multipart path). Nothing points at them until
  // the comment commits, so any failure before that deletes them.
  const writtenUrls: string[] = [];
  const discardWritten = async () => {
    for (const u of writtenUrls.splice(0)) {
      await deleteFile(u).catch(() => {
        /* best effort — the request is already failing */
      });
    }
  };
  try {
    const { formId, submissionId } = await params;

    // A tracking link is valid for a year and travels by email, so whoever
    // holds one could loop this to fill the store and the engineers' inbox.
    const limited = rateLimit(
      `tracking-reply:${submissionId}:${clientIp(req.headers)}`,
      20,
      15 * 60 * 1000
    );
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many replies. Please try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    // Token can come from query string OR body. Prefer body (slightly less
    // likely to leak via referrer / logs) but accept query for flexibility.
    const url = new URL(req.url);
    let token = url.searchParams.get("token") || "";

    const isJson = (req.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json");
    let contentRaw: unknown = null;
    let fileEntries: unknown[] = [];
    let clientFiles: { blobUrl: string; name: string }[] = [];
    if (isJson) {
      const body = (await req.json().catch(() => null)) as {
        token?: unknown;
        content?: unknown;
        files?: unknown;
      } | null;
      if (!body) {
        return NextResponse.json({ error: "Invalid reply body." }, { status: 400 });
      }
      if (typeof body.token === "string" && body.token) token = body.token;
      contentRaw = body.content;
      clientFiles = (Array.isArray(body.files) ? body.files : []).filter(
        (v): v is { blobUrl: string; name: string } =>
          !!v &&
          typeof v === "object" &&
          typeof (v as { blobUrl?: unknown }).blobUrl === "string" &&
          typeof (v as { name?: unknown }).name === "string"
      );
    } else {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return NextResponse.json(
          { error: "Reply body must be JSON or multipart/form-data." },
          { status: 400 }
        );
      }
      const bodyToken = formData.get("token");
      if (typeof bodyToken === "string" && bodyToken) token = bodyToken;
      contentRaw = formData.get("content");
      fileEntries = formData.getAll("file");
    }

    if (!token) {
      return NextResponse.json(
        { error: "Missing tracking token." },
        { status: 401 }
      );
    }
    const verification = verifyTrackingToken(token, submissionId);
    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.reason },
        { status: 401 }
      );
    }

    const content =
      typeof contentRaw === "string" ? contentRaw.trim() : "";
    if (!content) {
      return NextResponse.json(
        { error: "Reply content is required." },
        { status: 400 }
      );
    }
    if (content.length > 4000) {
      return NextResponse.json(
        { error: "Reply is too long (4000 chars max)." },
        { status: 400 }
      );
    }

    // Resolve the submission + linked task. The submission's
    // submitterUser (if any) gives us a display name; otherwise we
    // fall back to EMAIL field captured at submit time.
    const submission = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: {
        form: {
          select: {
            id: true,
            name: true,
            fields: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            },
          },
        },
        submitterUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!submission || submission.formId !== formId) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 }
      );
    }

    // FormSubmission.taskId has no foreign key, so deleting the task leaves
    // the id behind: check the task itself, BEFORE any file is stored, or the
    // reply dies on the comment's FK with a 500 and orphans the uploads.
    const liveTask = submission.taskId
      ? await prisma.task.findUnique({
          where: { id: submission.taskId },
          select: { id: true },
        })
      : null;
    if (!submission.taskId || !liveTask) {
      return NextResponse.json(
        { error: "This submission's task has been removed." },
        { status: 410 }
      );
    }

    const realFiles = fileEntries.filter(
      (f): f is File => f instanceof File && f.size > 0
    );
    if (realFiles.length + clientFiles.length > PUBLIC_UPLOAD_MAX_FILES) {
      return NextResponse.json(
        { error: `Attach at most ${PUBLIC_UPLOAD_MAX_FILES} files per reply.` },
        { status: 400 }
      );
    }

    // Resolve the guest's display name. Prefer the authenticated
    // submitter's User record (ORGANIZATION-visibility forms), then
    // any EMAIL field captured in the original answers, then a
    // generic fallback.
    let guestName: string | null = null;
    let guestEmail: string | null = null;
    if (submission.submitterUser) {
      guestName =
        submission.submitterUser.name ||
        submission.submitterUser.email ||
        null;
      guestEmail = submission.submitterUser.email || null;
    } else {
      // The form's EMAIL field — the same address the receipt went to. Not
      // "any answer containing @": a note like "super @ gate 3" would be
      // taken for the sender, and jsonb key order isn't field order anyway.
      guestEmail = firstEmailAnswer(
        (submission.form.fields as unknown as FormField[]) || [],
        (submission.data as FormSubmissionPayload) || {}
      );
      guestName = guestEmail;
    }
    if (!guestName) guestName = "External submitter";

    // Upload any attachments BEFORE the DB write so a failed upload
    // doesn't leave a dangling comment without the file the user
    // expected to share.
    const uploadedFiles: {
      name: string;
      url: string;
      size: number;
      mimeType: string;
    }[] = [];
    // Files the browser already uploaded: the url is the caller's word, so
    // each must be a PUBLIC blob of our store under this submission's folder
    // (the only place the token route writes for it), not already attached,
    // with size and type read off the stored blob.
    for (const item of clientFiles) {
      if (uploadedFiles.some((u) => u.url === item.blobUrl)) continue;
      let verified;
      try {
        verified = await verifyUploadedBlob(
          item.blobUrl,
          item.name,
          `tracking/${submissionId}/`,
          "public",
          PUBLIC_UPLOAD_MAX_BYTES
        );
      } catch (err) {
        if (err instanceof BlobRejectedError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
      const already = await prisma.attachment.findFirst({
        where: { url: verified.url },
        select: { id: true },
      });
      if (already) {
        return NextResponse.json(
          { error: "That file was already posted." },
          { status: 409 }
        );
      }
      uploadedFiles.push(verified);
    }

    for (const f of realFiles) {
      // Soft cap so a runaway upload can't hammer Vercel Blob. The page
      // checks the same number before anything moves.
      if (f.size > PUBLIC_UPLOAD_MAX_BYTES) {
        await discardWritten();
        return NextResponse.json(
          {
            error: `File "${f.name}" exceeds ${Math.floor(PUBLIC_UPLOAD_MAX_BYTES / (1024 * 1024))}MB.`,
          },
          { status: 400 }
        );
      }
      try {
        const { url } = await uploadPublicFile(f, `tracking/${submissionId}`);
        writtenUrls.push(url);
        uploadedFiles.push({
          name: f.name,
          url,
          size: f.size,
          mimeType: f.type || "application/octet-stream",
        });
      } catch (err) {
        await discardWritten();
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : `Failed to upload "${f.name}".`,
          },
          { status: 400 }
        );
      }
    }

    // Need a real User row to be the `uploaderId` on Attachment
    // rows (schema requires it). Project owner is the safest
    // fallback for guest uploads — they always exist for an active
    // project. If the owner was deleted we still create the
    // Comment but skip attachment mirroring.
    const uploaderId =
      submission.submitterUser?.id ||
      submission.form.project.ownerId ||
      null;

    // ── Persist in a transaction ──────────────────────────────
    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          taskId: submission.taskId!,
          authorId: null, // guest — display name comes from guestName
          // Guests can't @-mention; store HTML-escaped plain text so a
          // hand-crafted request can't forge a mention chip on the public
          // tracking page (renderCommentContent un-escapes symmetrically).
          content: buildCommentContent(commentToPlainText(content), []),
          source: "TRACKING_REPLY",
          visibility: "EXTERNAL",
          guestName,
          guestEmail,
        },
      });

      if (uploaderId && uploadedFiles.length > 0) {
        // Link attachments to BOTH the comment AND the task so the
        // engineer sees them in the task's Attachments tab without
        // having to expand the comment.
        await tx.attachment.createMany({
          data: uploadedFiles.map((a) => ({
            commentId: c.id,
            taskId: submission.taskId!,
            uploaderId,
            name: a.name,
            url: a.url,
            size: a.size,
            mimeType: a.mimeType,
          })),
        });
      }

      return c;
    });
    // Committed: the comment and its attachments own those blobs now.
    writtenUrls.length = 0;

    // ── Notify the engineering team that a reply landed ────────
    // Fan out to the assignee + project owner so the reply doesn't
    // sit unread in the task panel. Best-effort; failures here
    // never undo the reply persistence.
    try {
      const task = await prisma.task.findUnique({
        where: { id: submission.taskId },
        select: { assigneeId: true, name: true },
      });
      const recipientIds = new Set<string>();
      if (task?.assigneeId) recipientIds.add(task.assigneeId);
      if (submission.form.project.ownerId) {
        recipientIds.add(submission.form.project.ownerId);
      }
      for (const userId of recipientIds) {
        // Same preference gate as every other COMMENT_ADDED producer.
        if (!(await shouldNotify(userId, "COMMENT_ADDED"))) continue;
        await prisma.notification.create({
          data: {
            userId,
            type: "COMMENT_ADDED",
            title: `${guestName} replied to ${submission.form.name}`,
            message: content.slice(0, 240),
            data: {
              taskId: submission.taskId,
              projectId: submission.form.projectId,
              formId: submission.form.id,
              submissionId: submission.id,
              authorName: guestName,
              authorImage: null,
            },
          },
        });
      }
    } catch (err) {
      console.error("[tracking reply] notify failed:", err);
    }

    return NextResponse.json(
      {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        authorName: guestName,
        attachments: uploadedFiles,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[tracking reply POST] error:", err);
    await discardWritten();
    return NextResponse.json(
      { error: "Failed to post reply." },
      { status: 500 }
    );
  }
}
