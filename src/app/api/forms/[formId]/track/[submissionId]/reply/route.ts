import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTrackingToken } from "@/lib/tracking-token";
import { uploadFile } from "@/lib/storage";

/**
 * POST /api/forms/:formId/track/:submissionId/reply
 *
 * Body: multipart/form-data with
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
  try {
    const { formId, submissionId } = await params;

    // Token can come from query string OR multipart body. Prefer body
    // (slightly less likely to leak via referrer / logs) but accept
    // query for flexibility.
    const url = new URL(req.url);
    let token = url.searchParams.get("token") || "";

    // Parse the multipart body so we can read content + files + body
    // token (if present).
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Reply body must be multipart/form-data." },
        { status: 400 }
      );
    }

    const bodyToken = formData.get("token");
    if (typeof bodyToken === "string" && bodyToken) token = bodyToken;

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

    const contentRaw = formData.get("content");
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

    if (!submission.taskId) {
      return NextResponse.json(
        { error: "This submission's task has been removed." },
        { status: 410 }
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
      // Scan original answers for an email — same trick the receipt
      // email uses.
      const data = (submission.data as Record<string, unknown>) || {};
      for (const v of Object.values(data)) {
        if (typeof v === "string" && /@/.test(v) && !guestEmail) {
          guestEmail = v.trim();
          guestName = guestEmail;
          break;
        }
      }
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
    const fileEntries = formData.getAll("file");
    for (const f of fileEntries) {
      if (!(f instanceof File) || f.size === 0) continue;
      // Soft cap — block files > 25MB so a runaway upload can't
      // hammer Vercel Blob. Frontend should pre-validate too.
      if (f.size > 25 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File "${f.name}" exceeds 25MB.` },
          { status: 400 }
        );
      }
      try {
        const { url } = await uploadFile(f, `tracking/${submissionId}`);
        uploadedFiles.push({
          name: f.name,
          url,
          size: f.size,
          mimeType: f.type || "application/octet-stream",
        });
      } catch (err) {
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
          content,
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
    return NextResponse.json(
      { error: "Failed to post reply." },
      { status: 500 }
    );
  }
}
