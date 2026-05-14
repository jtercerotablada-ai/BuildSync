import prisma from "@/lib/prisma";
import { sendTaskAssignedEmail } from "@/lib/email";

/**
 * Drop a TASK_ASSIGNED Notification row + fire an email when a task
 * is assigned to someone other than the actor.
 *
 * Best-effort: both the notification create and the email send are
 * wrapped in try/catch so a failure here never undoes the task
 * mutation itself.
 *
 * Skips the self-assignment case (creator assigning to themselves)
 * — it's noise to notify yourself.
 */
export async function notifyTaskAssigned(opts: {
  taskId: string;
  assigneeId: string;
  assignerUserId: string;
  taskName: string;
  projectId: string | null;
  projectName: string | null;
  dueDate: Date | null;
}) {
  const {
    taskId,
    assigneeId,
    assignerUserId,
    taskName,
    projectId,
    projectName,
    dueDate,
  } = opts;

  // Self-assign: silent.
  if (assigneeId === assignerUserId) return;

  // Resolve actor + recipient profile fields once for both the
  // inbox row and the email payload.
  let assignerName: string | null = null;
  let assignerImage: string | null = null;
  let recipientEmail: string | null = null;
  let recipientName: string | null = null;
  try {
    const [assigner, recipient] = await Promise.all([
      prisma.user.findUnique({
        where: { id: assignerUserId },
        select: { name: true, email: true, image: true },
      }),
      prisma.user.findUnique({
        where: { id: assigneeId },
        select: { name: true, email: true },
      }),
    ]);
    assignerName = assigner?.name ?? assigner?.email ?? "A teammate";
    assignerImage = assigner?.image ?? null;
    recipientEmail = recipient?.email ?? null;
    recipientName = recipient?.name ?? null;
  } catch (err) {
    console.error("[notifyTaskAssigned] profile lookup failed:", err);
  }

  // ── Inbox notification (always fires when possible) ─────────
  try {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: `${assignerName ?? "Someone"} assigned you a task`,
        message: taskName,
        data: {
          taskId,
          projectId: projectId ?? null,
          taskName,
          projectName: projectName ?? null,
          authorName: assignerName,
          authorImage: assignerImage,
        },
      },
    });
  } catch (err) {
    console.error("[notifyTaskAssigned] inbox create failed:", err);
  }

  // ── Email (only if the assignee has an email on file) ───────
  if (recipientEmail) {
    try {
      await sendTaskAssignedEmail({
        toEmail: recipientEmail,
        toName: recipientName,
        assignerName: assignerName ?? "A teammate",
        taskName,
        projectName,
        projectId,
        taskId,
        dueDate,
      });
    } catch (err) {
      // Email failure shouldn't block — the inbox row already
      // delivers the signal to the user.
      console.error("[notifyTaskAssigned] email send failed:", err);
    }
  }
}

/**
 * Drop a TASK_COMPLETED Notification when a teammate marks a task
 * complete. Mirror of notifyTaskAssigned but in the other direction:
 * when the assignee (or anyone) flips the task to completed, the
 * person who created/owns the task gets pinged so they know their
 * work is done.
 *
 * Inbox-only. No email — completions are informational, not action-
 * requiring; the inbox row is enough signal.
 *
 * Skips when:
 *   - The completer IS the recipient (self-complete is silent)
 *   - There's no recipient (task has no creator on file)
 */
export async function notifyTaskCompleted(opts: {
  taskId: string;
  recipientUserId: string;
  completerUserId: string;
  taskName: string;
  projectId: string | null;
  projectName: string | null;
}) {
  const {
    taskId,
    recipientUserId,
    completerUserId,
    taskName,
    projectId,
    projectName,
  } = opts;

  // Self-complete: silent. (You finished your own task — you know.)
  if (recipientUserId === completerUserId) return;

  // Resolve completer's display so the inbox can render their avatar
  // + name instead of the generic firm fallback.
  let completerName: string | null = null;
  let completerImage: string | null = null;
  try {
    const completer = await prisma.user.findUnique({
      where: { id: completerUserId },
      select: { name: true, email: true, image: true },
    });
    completerName = completer?.name ?? completer?.email ?? "A teammate";
    completerImage = completer?.image ?? null;
  } catch (err) {
    console.error("[notifyTaskCompleted] profile lookup failed:", err);
  }

  try {
    await prisma.notification.create({
      data: {
        userId: recipientUserId,
        type: "TASK_COMPLETED",
        title: `${completerName ?? "Someone"} completed your task`,
        message: taskName,
        data: {
          taskId,
          projectId: projectId ?? null,
          taskName,
          projectName: projectName ?? null,
          // authorName/Image keys match the inbox shaping path —
          // /api/notifications reads these to render the right
          // sender avatar/name on the row.
          authorName: completerName,
          authorImage: completerImage,
        },
      },
    });
  } catch (err) {
    console.error("[notifyTaskCompleted] inbox create failed:", err);
  }
}
