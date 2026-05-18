import prisma from "@/lib/prisma";

/**
 * Fan out a FORM_SUBMITTED event after a public/internal form
 * submission successfully creates a Task.
 *
 * Writes:
 *   1. One Activity row on the new task (so the task's activity feed
 *      shows "Created from form submission" forever — beats the
 *      generic TASK_CREATED row).
 *   2. One Notification row per recipient (defaultAssignee + project
 *      owner, deduped). The inbox renders these as FORM_SUBMITTED
 *      with a deep-link to the task.
 *
 * Best-effort: every write is wrapped so a notification failure
 * never undoes the submission itself.
 *
 * Self-submit suppression: if the submitter is also the assignee or
 * owner (someone testing their own form), they don't get a
 * notification — it would be noise.
 */
export async function notifyFormSubmitted(opts: {
  taskId: string;
  projectId: string;
  projectName: string;
  formId: string;
  formName: string;
  submissionId: string;
  /** Snippet of the submission to show in the inbox preview. */
  previewLine: string;
  /** Display name for the submitter (or "Someone" for anonymous). */
  submitterName: string;
  /** Email captured from the form if there was an EMAIL field. */
  submitterEmail: string | null;
  /** When the submitter was signed in (ORGANIZATION forms). */
  submitterUserId: string | null;
  /** Users to notify. Deduped + self-submit filtered internally. */
  recipientUserIds: string[];
}) {
  const {
    taskId,
    projectId,
    projectName,
    formId,
    formName,
    submissionId,
    previewLine,
    submitterName,
    submitterEmail,
    submitterUserId,
    recipientUserIds,
  } = opts;

  // ── Activity row on the task ──────────────────────────────
  try {
    await prisma.activity.create({
      data: {
        type: "FORM_SUBMITTED",
        taskId,
        userId: submitterUserId, // null for anonymous public submits
        data: {
          formId,
          formName,
          submissionId,
          submitterName,
          submitterEmail,
        },
      },
    });
  } catch (err) {
    console.error("[notifyFormSubmitted] activity create failed:", err);
  }

  // ── Inbox notifications ───────────────────────────────────
  // Dedupe + drop self-submitters (no point in notifying yourself
  // about your own submission while you're testing the form).
  const unique = Array.from(
    new Set(
      recipientUserIds.filter(
        (id): id is string =>
          typeof id === "string" && id.length > 0 && id !== submitterUserId
      )
    )
  );

  if (unique.length === 0) return;

  for (const userId of unique) {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: "FORM_SUBMITTED",
          title: `${submitterName} submitted "${formName}"`,
          message: previewLine || `New submission in ${projectName}`,
          data: {
            taskId,
            projectId,
            formId,
            formName,
            submissionId,
            submitterName,
            submitterEmail,
            authorName: submitterName,
            // No avatar for anonymous external submitters — the inbox
            // falls back to the gold sender chip with the first letter.
            authorImage: null,
          },
        },
      });
    } catch (err) {
      console.error(
        "[notifyFormSubmitted] inbox create failed for user",
        userId,
        err
      );
    }
  }
}
