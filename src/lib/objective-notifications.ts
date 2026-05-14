import prisma from "@/lib/prisma";

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
