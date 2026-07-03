import prisma from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/**
 * Preference gate for notification producers.
 *
 * Loads the recipient's UserPreferences once and returns whether a
 * notification of the given type should be delivered. Producers call
 * this before creating the Notification row AND before sending any
 * companion email, skipping both when it returns false.
 *
 * DEFAULT TRUE: if the recipient has no UserPreferences row, or the
 * type doesn't map to a toggle, we notify. Silence is opt-in, never
 * the accidental default.
 *
 * Type → toggle mapping:
 *   TASK_ASSIGNED  → notifyTaskAssigned
 *   TASK_COMPLETED → notifyTaskCompleted
 *   COMMENT_ADDED  → notifyCommentAdded
 *   MENTIONED      → notifyMentioned
 *   STATUS_UPDATE  → notifyProjectUpdates
 *
 * Unmapped types (OBJECTIVE_SHARED, FORM_SUBMITTED, PROJECT_INVITATION,
 * DUE_DATE_APPROACHING) always return true.
 */
const TYPE_TO_TOGGLE: Record<
  string,
  | "notifyTaskAssigned"
  | "notifyTaskCompleted"
  | "notifyCommentAdded"
  | "notifyMentioned"
  | "notifyProjectUpdates"
> = {
  TASK_ASSIGNED: "notifyTaskAssigned",
  TASK_COMPLETED: "notifyTaskCompleted",
  COMMENT_ADDED: "notifyCommentAdded",
  MENTIONED: "notifyMentioned",
  STATUS_UPDATE: "notifyProjectUpdates",
};

export async function shouldNotify(
  userId: string,
  type: NotificationType | string
): Promise<boolean> {
  const toggle = TYPE_TO_TOGGLE[type];
  // Unmapped type → always notify.
  if (!toggle) return true;

  try {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        notifyTaskAssigned: true,
        notifyTaskCompleted: true,
        notifyCommentAdded: true,
        notifyMentioned: true,
        notifyProjectUpdates: true,
      },
    });
    // No prefs row → default true.
    if (!prefs) return true;
    return prefs[toggle] !== false;
  } catch (err) {
    // Never let a prefs-lookup failure suppress a notification.
    console.error("[shouldNotify] prefs lookup failed:", err);
    return true;
  }
}
