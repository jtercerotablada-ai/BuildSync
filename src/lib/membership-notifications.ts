import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { NotificationType } from "@prisma/client";

/**
 * Best-effort in-app notification for when a user is granted access to a
 * shared resource (workspace / portfolio / project / team). Called after the
 * membership row is created so the invitee actually learns they were added —
 * they no longer have to stumble on the resource in their sidebar.
 *
 * NEVER throws: a failed notification must not roll back or 500 the membership
 * mutation that triggered it. Callers should skip it when re-granting an
 * identical role (no real change) to avoid notification spam.
 */
export async function notifyMembershipGranted(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  /** Freeform payload the Inbox uses to deep-link, e.g. { portfolioId } */
  data?: Record<string, unknown>;
}): Promise<void> {
  const { userId, type, title, message, data } = params;
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message: message ?? null,
        data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("notifyMembershipGranted failed:", err);
  }
}
