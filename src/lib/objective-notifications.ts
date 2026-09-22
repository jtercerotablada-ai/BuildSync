import prisma from "@/lib/prisma";
import { shouldNotify } from "@/lib/notification-prefs";
import { contributorSeatSatisfied } from "@/lib/auth-guards";

/**
 * Drop an OBJECTIVE_SHARED Notification when the owner adds someone
 * as a member of an objective. Inbox-only (no email — Asana parity:
 * objective sharing surfaces in the inbox as "X shared this
 * objective with you", not via email).
 *
 * Best-effort: failures are logged but never propagate back to the
 * caller. The membership write is the primary signal — the
 * notification is the nice-to-have on top.
 *
 * Skips when:
 *   - The sharer IS the recipient (you shared with yourself —
 *     happens only via API misuse, but harmless)
 */
export async function notifyObjectiveShared(opts: {
  objectiveId: string;
  recipientUserId: string;
  sharerUserId: string;
  objectiveName: string;
}) {
  const { objectiveId, recipientUserId, sharerUserId, objectiveName } = opts;

  // Self-share: silent.
  if (recipientUserId === sharerUserId) return;

  // Preference gate. OBJECTIVE_SHARED is unmapped today (always true),
  // but routing through shouldNotify keeps the producer honest if a
  // toggle is added later.
  if (!(await shouldNotify(recipientUserId, "OBJECTIVE_SHARED"))) return;

  // Resolve sharer's display info so the inbox row carries a real
  // avatar + name instead of the generic fallback.
  let sharerName: string | null = null;
  let sharerImage: string | null = null;
  try {
    const sharer = await prisma.user.findUnique({
      where: { id: sharerUserId },
      select: { name: true, email: true, image: true },
    });
    sharerName = sharer?.name ?? sharer?.email ?? "A teammate";
    sharerImage = sharer?.image ?? null;
  } catch (err) {
    console.error("[notifyObjectiveShared] profile lookup failed:", err);
  }

  try {
    await prisma.notification.create({
      data: {
        userId: recipientUserId,
        type: "OBJECTIVE_SHARED",
        title: `${sharerName ?? "Someone"} shared this objective with you`,
        message: objectiveName,
        data: {
          objectiveId,
          objectiveName,
          // authorName/Image keys match the inbox /api/notifications
          // shaping so the row renders the right avatar + sender.
          authorName: sharerName,
          authorImage: sharerImage,
        },
      },
    });
  } catch (err) {
    console.error("[notifyObjectiveShared] inbox create failed:", err);
  }
}

/**
 * Tell the people on a goal that someone commented on it or checked in.
 * Recipients are the owner and every ObjectiveMember, minus the author, and
 * only while they still hold a contributor seat in the goal's workspace (an
 * offboarded member must not keep receiving a goal's discussion).
 *
 * Comments go out as COMMENT_ADDED and check-ins as STATUS_UPDATE, so each
 * respects the matching toggle in the recipient's notification settings.
 * Inbox-only, like notifyObjectiveShared, and best-effort: a failure is
 * logged and never fails the comment or check-in that triggered it.
 */
export async function notifyObjectiveActivity(opts: {
  objectiveId: string;
  actorUserId: string;
  kind: "comment" | "check-in";
  summary: string;
  /** The status the check-in set; omitted for comments. */
  status?: string | null;
}) {
  const { objectiveId, actorUserId, kind, summary, status } = opts;
  const type = kind === "comment" ? "COMMENT_ADDED" : "STATUS_UPDATE";

  try {
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: {
        name: true,
        workspaceId: true,
        ownerId: true,
        members: { select: { userId: true } },
      },
    });
    if (!objective) return;

    const candidates = new Set<string>(objective.members.map((m) => m.userId));
    if (objective.ownerId) candidates.add(objective.ownerId);
    candidates.delete(actorUserId);
    if (candidates.size === 0) return;

    const [seats, actor] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: {
          workspaceId: objective.workspaceId,
          userId: { in: [...candidates] },
        },
        select: { userId: true, role: true },
      }),
      prisma.user.findUnique({
        where: { id: actorUserId },
        select: { name: true, email: true, image: true },
      }),
    ]);

    const actorName = actor?.name ?? actor?.email ?? "A teammate";
    const title =
      kind === "comment"
        ? `${actorName} commented on a goal`
        : `${actorName} checked in on a goal`;
    const excerpt = summary.length > 200 ? `${summary.slice(0, 197)}...` : summary;

    for (const { userId, role } of seats) {
      if (!contributorSeatSatisfied(role)) continue;
      if (!(await shouldNotify(userId, type))) continue;
      try {
        await prisma.notification.create({
          data: {
            userId,
            type,
            title,
            message: `${objective.name}: ${excerpt}`,
            data: {
              objectiveId,
              objectiveName: objective.name,
              ...(status ? { status } : {}),
              authorName: actorName,
              authorImage: actor?.image ?? null,
            },
          },
        });
      } catch (err) {
        console.error("[notifyObjectiveActivity] inbox create failed:", err);
      }
    }
  } catch (err) {
    console.error("[notifyObjectiveActivity] failed:", err);
  }
}
