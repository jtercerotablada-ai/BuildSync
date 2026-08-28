import prisma from "@/lib/prisma";
import { sendTaskAssignedEmail } from "@/lib/email";
import { shouldNotify } from "@/lib/notification-prefs";

/**
 * Fan a notification out to a task's collaborators (followers) — the
 * behavior that makes "collaborators" meaningful in Asana. Used when a
 * comment is posted or the task is completed so followers stay in the
 * loop without being the assignee/creator.
 *
 * Best-effort + preference-gated per recipient. Always excludes the
 * actor, plus any ids in `excludeUserIds` (e.g. the creator, who gets
 * their own dedicated completion ping).
 */
export async function notifyTaskCollaborators(opts: {
  taskId: string;
  actorUserId: string;
  type: "COMMENT_ADDED" | "TASK_COMPLETED";
  taskName: string;
  projectId: string | null;
  projectName: string | null;
  title?: string;
  message?: string;
  excludeUserIds?: string[];
}) {
  const {
    taskId,
    actorUserId,
    type,
    taskName,
    projectId,
    projectName,
    excludeUserIds = [],
  } = opts;

  let recipientIds: string[] = [];
  try {
    const collabs = await prisma.taskCollaborator.findMany({
      where: { taskId },
      select: { userId: true },
    });
    const exclude = new Set([actorUserId, ...excludeUserIds]);
    recipientIds = [...new Set(collabs.map((c) => c.userId))].filter(
      (id) => !exclude.has(id)
    );
  } catch (err) {
    console.error("[notifyTaskCollaborators] collaborator lookup failed:", err);
    return;
  }
  if (recipientIds.length === 0) return;

  let actorName = "A teammate";
  let actorImage: string | null = null;
  try {
    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { name: true, email: true, image: true },
    });
    actorName = actor?.name ?? actor?.email ?? "A teammate";
    actorImage = actor?.image ?? null;
  } catch (err) {
    console.error("[notifyTaskCollaborators] actor lookup failed:", err);
  }

  const title =
    opts.title ??
    (type === "COMMENT_ADDED"
      ? `${actorName} commented on a task you follow`
      : `${actorName} completed a task you follow`);

  await Promise.all(
    recipientIds.map(async (uid) => {
      try {
        if (!(await shouldNotify(uid, type))) return;
        await prisma.notification.create({
          data: {
            userId: uid,
            type,
            title,
            message: opts.message ?? taskName,
            data: {
              taskId,
              projectId: projectId ?? null,
              taskName,
              projectName: projectName ?? null,
              authorName: actorName,
              authorImage: actorImage,
            },
          },
        });
      } catch (err) {
        console.error("[notifyTaskCollaborators] create failed:", err);
      }
    })
  );
}

/** Label a due date by its UTC calendar day — due dates are stored at UTC
 *  midnight, so a locale formatter left on server time renames the day. */
function formatDueDate(value: Date | null): string {
  if (!value) return "no date";
  return value.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Drop a Notification when a task's due date MOVES — the reschedule of a
 * filing or inspection date is the event the firm most needs to hear about,
 * and until now it happened silently.
 *
 * Goes to the assignee plus the task's collaborators, never to the person
 * making the change. Callers must NOT invoke this while creating a task: a
 * first date is set by the composer, not moved.
 *
 * Reuses DUE_DATE_APPROACHING because the notification types are a schema
 * enum and there is no reschedule member; the title carries the distinction
 * and the inbox already routes this type to its "update" row.
 *
 * Best-effort + preference-gated per recipient, like the producers above.
 */
export async function notifyTaskDueDateChanged(opts: {
  taskId: string;
  actorUserId: string;
  assigneeId: string | null;
  taskName: string;
  projectId: string | null;
  projectName: string | null;
  previousDueDate: Date | null;
  dueDate: Date | null;
}) {
  const {
    taskId,
    actorUserId,
    assigneeId,
    taskName,
    projectId,
    projectName,
    previousDueDate,
    dueDate,
  } = opts;

  // No actual move: nothing to say.
  if ((previousDueDate?.getTime() ?? null) === (dueDate?.getTime() ?? null)) {
    return;
  }

  let recipientIds: string[] = [];
  try {
    const collabs = await prisma.taskCollaborator.findMany({
      where: { taskId },
      select: { userId: true },
    });
    const candidates = [
      ...(assigneeId ? [assigneeId] : []),
      ...collabs.map((c) => c.userId),
    ];
    recipientIds = [...new Set(candidates)].filter((id) => id !== actorUserId);
  } catch (err) {
    console.error("[notifyTaskDueDateChanged] recipient lookup failed:", err);
    return;
  }
  if (recipientIds.length === 0) return;

  let actorName = "A teammate";
  let actorImage: string | null = null;
  try {
    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { name: true, email: true, image: true },
    });
    actorName = actor?.name ?? actor?.email ?? "A teammate";
    actorImage = actor?.image ?? null;
  } catch (err) {
    console.error("[notifyTaskDueDateChanged] actor lookup failed:", err);
  }

  const title = !dueDate
    ? `${actorName} cleared a due date`
    : !previousDueDate
      ? `${actorName} set a due date`
      : `${actorName} moved a due date`;
  const message = !dueDate
    ? `${taskName} — due date removed`
    : !previousDueDate
      ? `${taskName} — now due ${formatDueDate(dueDate)}`
      : `${taskName} — ${formatDueDate(previousDueDate)} → ${formatDueDate(dueDate)}`;

  await Promise.all(
    recipientIds.map(async (uid) => {
      try {
        if (!(await shouldNotify(uid, "DUE_DATE_APPROACHING"))) return;
        await prisma.notification.create({
          data: {
            userId: uid,
            type: "DUE_DATE_APPROACHING",
            title,
            message,
            data: {
              taskId,
              projectId: projectId ?? null,
              taskName,
              projectName: projectName ?? null,
              previousDueDate: previousDueDate?.toISOString() ?? null,
              dueDate: dueDate?.toISOString() ?? null,
              authorName: actorName,
              authorImage: actorImage,
            },
          },
        });
      } catch (err) {
        console.error("[notifyTaskDueDateChanged] create failed:", err);
      }
    })
  );
}

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

  // Preference gate: respect notifyTaskAssigned for BOTH the inbox
  // row and the email. When off, the whole producer is a no-op.
  if (!(await shouldNotify(assigneeId, "TASK_ASSIGNED"))) return;

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

  // Preference gate: recipient opted out of completion pings.
  if (!(await shouldNotify(recipientUserId, "TASK_COMPLETED"))) return;

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
