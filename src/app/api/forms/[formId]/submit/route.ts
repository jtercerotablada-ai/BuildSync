import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { uploadFile } from "@/lib/storage";
import {
  type FormField,
  type FormSubmissionPayload,
  type FormAnswerValue,
  type FormAttachment,
  buildTaskFromSubmission,
  appendFormFooter,
  formatAnswerForText,
  pruneHiddenAnswers,
  isFieldVisible,
} from "@/lib/form-types";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

function isAttachmentValue(v: unknown): v is FormAttachment {
  return (
    typeof v === "object" &&
    v !== null &&
    "url" in v &&
    "name" in v &&
    "size" in v
  );
}
import {
  sendFormSubmissionEmail,
  sendFormSubmitterReceiptEmail,
} from "@/lib/email";
import { notifyFormSubmitted } from "@/lib/form-notifications";

/**
 * POST /api/forms/:formId/submit
 *
 * Accepts EITHER:
 *   - application/json  →  { answers: Record<fieldId, value> }
 *   - multipart/form-data → answers + files (for ATTACHMENT fields)
 *
 * Behavior:
 *   1. Reject if form is inactive (410).
 *   2. Reject anonymous submission if visibility === ORGANIZATION (401).
 *   3. Validate required visible fields (branching honored).
 *   4. Upload attachment files to Vercel Blob, replace File objects
 *      with their URL + metadata in the answers payload.
 *   5. Create FormSubmission + Task in a transaction, in the form's
 *      defaultSection (or fall back to project's first section).
 *   6. Apply defaultAssignee to the new task.
 *   7. Email admin (notifyOnSubmission) + submitter (if EMAIL field).
 *   8. Return success + custom confirmation message.
 */

interface AdminNotifyRecipient {
  email: string;
  name: string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;

    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        project: { select: { id: true, name: true, ownerId: true } },
        defaultAssignee: {
          select: { id: true, email: true, name: true },
        },
      },
    });
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }
    if (!form.isActive) {
      return NextResponse.json(
        { error: "This form is no longer accepting submissions." },
        { status: 410 }
      );
    }

    // ── Visibility enforcement ────────────────────────────────
    const submitterUserId = await getCurrentUserId();
    if (form.visibility === "ORGANIZATION" && !submitterUserId) {
      return NextResponse.json(
        {
          error:
            "This form is restricted to signed-in members of the workspace.",
        },
        { status: 401 }
      );
    }

    // ── Parse body — JSON or multipart ────────────────────────
    let answers: FormSubmissionPayload = {};
    const fields = (form.fields as unknown as FormField[]) || [];
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      // JSON-encoded answers come in the `answers` field; files in
      // `attachment:<fieldId>` fields, one File each.
      const answersRaw = formData.get("answers");
      if (typeof answersRaw === "string") {
        try {
          answers = JSON.parse(answersRaw) as FormSubmissionPayload;
        } catch {
          return NextResponse.json(
            { error: "Invalid answers payload" },
            { status: 400 }
          );
        }
      }
      // Upload every attachment file to Vercel Blob. Each ATTACHMENT
      // field can carry multiple files (typical RFI: marked-up
      // drawing + 2-3 site photos), all under the same multipart
      // key `attachment:<fieldId>`. formData.getAll() collects all
      // values for that key.
      const attachmentFieldIds = new Set<string>();
      for (const key of formData.keys()) {
        if (key.startsWith("attachment:")) {
          attachmentFieldIds.add(key.slice("attachment:".length));
        }
      }
      for (const fieldId of attachmentFieldIds) {
        const files = formData.getAll(`attachment:${fieldId}`);
        const uploaded: Array<{
          name: string;
          url: string;
          size: number;
          mimeType: string;
        }> = [];
        for (const v of files) {
          if (!(v instanceof File) || v.size === 0) continue;
          try {
            const { url } = await uploadFile(v, `forms/${form.id}`);
            uploaded.push({
              name: v.name,
              url,
              size: v.size,
              mimeType: v.type,
            });
          } catch (err) {
            return NextResponse.json(
              {
                error:
                  err instanceof Error
                    ? err.message
                    : "Attachment upload failed",
              },
              { status: 400 }
            );
          }
        }
        if (uploaded.length > 0) {
          answers[fieldId] = uploaded;
        }
      }
    } else {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return NextResponse.json(
          { error: "Invalid payload" },
          { status: 400 }
        );
      }
      const raw = (body as { answers?: unknown }).answers;
      if (raw && typeof raw === "object") {
        answers = raw as FormSubmissionPayload;
      }
    }

    // ── Branching-aware required validation ───────────────────
    const fieldsById = new Map(fields.map((f) => [f.id, f] as const));
    for (const f of fields) {
      if (!f.required) continue;
      if (f.type === "HEADING") continue;
      if (!isFieldVisible(f, answers, fieldsById)) continue;
      const v = answers[f.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        return NextResponse.json(
          { error: `Field "${f.label}" is required` },
          { status: 400 }
        );
      }
    }

    // ── Prune answers from hidden fields ──────────────────────
    answers = pruneHiddenAnswers(fields, answers);

    // ── Resolve target section ────────────────────────────────
    let targetSectionId = form.defaultSectionId;
    if (!targetSectionId) {
      const firstSection = await prisma.section.findFirst({
        where: { projectId: form.projectId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      targetSectionId = firstSection?.id ?? null;
    } else {
      // Sanity-check the default section still exists in the project
      // (might have been deleted but the onDelete:SetNull hasn't
      // run yet, or the form predates the delete).
      const sec = await prisma.section.findFirst({
        where: { id: targetSectionId, projectId: form.projectId },
        select: { id: true },
      });
      if (!sec) {
        const firstSection = await prisma.section.findFirst({
          where: { projectId: form.projectId },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        targetSectionId = firstSection?.id ?? null;
      }
    }
    if (!targetSectionId) {
      return NextResponse.json(
        {
          error:
            "This form's project has no sections yet — task can't be created.",
        },
        { status: 500 }
      );
    }

    // ── Build the task payload ────────────────────────────────
    const taskBuild = buildTaskFromSubmission(
      { fields, name: form.name },
      answers
    );

    // Resolve submitter display name once so we can show it both in
    // the description footer ("by Juan Tablada") and the inbox row.
    let submitterDisplay: string | null = null;
    if (submitterUserId) {
      try {
        const u = await prisma.user.findUnique({
          where: { id: submitterUserId },
          select: { name: true, email: true },
        });
        submitterDisplay = u?.name || u?.email || null;
      } catch {
        /* fall back to null — footer just omits the "by ..." line */
      }
    }
    // For anonymous public submitters, the EMAIL field (if present) is
    // the next-best identifier. Computed lazily here because we don't
    // need it for ORGANIZATION submissions where the user lookup wins.
    if (!submitterDisplay) {
      for (const f of fields) {
        if (f.type === "EMAIL") {
          const v = answers[f.id];
          if (typeof v === "string" && v.trim()) {
            submitterDisplay = v.trim();
            break;
          }
        }
      }
    }

    // Compose the final description with the "Submitted via [Form]"
    // footer + link back to the public form (Asana parity).
    const formUrl = `${APP_URL}/forms/${form.id}`;
    const descriptionWithFooter = appendFormFooter(
      taskBuild.description,
      form.name,
      formUrl,
      submitterDisplay
    );

    // Collect uploaded files from ATTACHMENT fields so we can mirror
    // them as real Task Attachments inside the transaction. The
    // uploader has to be a real User row (schema requires it); fall
    // back to project owner for anonymous public submissions. When
    // neither is available, we skip task-attachment creation but the
    // files still live in FormSubmission.data so the submissions
    // inbox keeps showing them.
    const uploaderForAttachments =
      submitterUserId || form.project.ownerId || null;
    const filesToMirror: FormAttachment[] = [];
    if (uploaderForAttachments) {
      for (const f of fields) {
        if (f.type !== "ATTACHMENT") continue;
        const v = answers[f.id];
        const list = Array.isArray(v) ? v : v != null ? [v] : [];
        for (const item of list) {
          if (isAttachmentValue(item)) filesToMirror.push(item);
        }
      }
    }

    // ── Persist in a transaction ──────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.formSubmission.create({
        data: {
          formId: form.id,
          submitterUserId: submitterUserId || null,
          data: JSON.parse(JSON.stringify(answers)),
        },
      });

      const createdTask = await tx.task.create({
        data: {
          name: taskBuild.name,
          description: descriptionWithFooter,
          dueDate: taskBuild.dueDate ? new Date(taskBuild.dueDate) : null,
          projectId: form.projectId,
          sectionId: targetSectionId,
          assigneeId: form.defaultAssigneeId,
          creatorId: submitterUserId || form.project.ownerId || null,
        },
      });

      await tx.formSubmission.update({
        where: { id: submission.id },
        data: { taskId: createdTask.id },
      });

      // Mirror form uploads as real task attachments so they show on
      // the task panel under "Attachments" (Asana parity). createMany
      // is one INSERT for the whole list — keeps the transaction
      // tight even when an RFI has marked-up drawing + 5 photos.
      if (uploaderForAttachments && filesToMirror.length > 0) {
        await tx.attachment.createMany({
          data: filesToMirror.map((a) => ({
            taskId: createdTask.id,
            uploaderId: uploaderForAttachments,
            name: a.name,
            url: a.url,
            size: a.size,
            mimeType: a.mimeType || "application/octet-stream",
          })),
        });
      }

      return { submissionId: submission.id, taskId: createdTask.id };
    });

    // ── Notifications (best-effort, soft-fail) ────────────────
    // Build a Q/A preview for the admin email.
    const previewAnswers: { label: string; value: string }[] = [];
    let submitterEmail: string | null = null;
    for (const f of fields) {
      if (f.type === "HEADING") continue;
      const v = answers[f.id];
      const text = formatAnswerForText(v);
      if (text) {
        previewAnswers.push({ label: f.label, value: text });
        if (f.type === "EMAIL" && typeof v === "string" && !submitterEmail) {
          submitterEmail = v.trim();
        }
      }
    }

    if (form.notifyOnSubmission) {
      // Collect admin recipients: form's default assignee + project owner.
      const recipients: AdminNotifyRecipient[] = [];
      if (form.defaultAssignee?.email) {
        recipients.push({
          email: form.defaultAssignee.email,
          name: form.defaultAssignee.name,
        });
      }
      if (
        form.project.ownerId &&
        form.project.ownerId !== form.defaultAssignee?.id
      ) {
        const owner = await prisma.user.findUnique({
          where: { id: form.project.ownerId },
          select: { email: true, name: true },
        });
        if (owner?.email) {
          recipients.push({ email: owner.email, name: owner.name });
        }
      }
      // Dedupe by email
      const seen = new Set<string>();
      for (const r of recipients) {
        if (seen.has(r.email)) continue;
        seen.add(r.email);
        await sendFormSubmissionEmail({
          toEmail: r.email,
          toName: r.name,
          formName: form.name,
          projectName: form.project.name,
          projectId: form.projectId,
          taskId: result.taskId,
          taskName: taskBuild.name,
          previewAnswers,
        });
      }
    }

    // Receipt to submitter if they gave an email.
    if (submitterEmail) {
      await sendFormSubmitterReceiptEmail({
        toEmail: submitterEmail,
        formName: form.name,
        confirmationMessage: form.confirmationMessage,
        answers: previewAnswers,
      });
    }

    // ── Inbox notifications (FORM_SUBMITTED) ──────────────────
    // Fires regardless of notifyOnSubmission — that toggle controls
    // EMAIL only. The inbox is the cheap, always-on signal so users
    // never silently miss a submission when email is unconfigured /
    // lands in spam. Activity row also lands on the new task so the
    // task's history shows "Created from form submission".
    const firstAnswer = previewAnswers[0];
    const previewLine = firstAnswer
      ? `${firstAnswer.label}: ${firstAnswer.value}`
      : "";

    await notifyFormSubmitted({
      taskId: result.taskId,
      projectId: form.projectId,
      projectName: form.project.name,
      formId: form.id,
      formName: form.name,
      submissionId: result.submissionId,
      previewLine,
      submitterName: submitterDisplay || "Someone",
      submitterEmail,
      submitterUserId: submitterUserId || null,
      recipientUserIds: [
        form.defaultAssigneeId,
        form.project.ownerId,
      ].filter((id): id is string => typeof id === "string" && id.length > 0),
    });

    return NextResponse.json(
      {
        success: true,
        submissionId: result.submissionId,
        confirmationMessage:
          form.confirmationMessage ||
          "Thanks — the project team has been notified and your submission has been added to their backlog.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[form submit] error:", err);
    return NextResponse.json(
      { error: "Failed to submit form" },
      { status: 500 }
    );
  }
}

/** unused: keeps the FormAnswerValue type pinned by the implementation
 *  for callers who narrow on this shape. */
export type _PinFormAnswerValue = FormAnswerValue;
