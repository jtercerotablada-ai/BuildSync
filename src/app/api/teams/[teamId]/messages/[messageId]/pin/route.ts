import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyTeamAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

/**
 * POST /api/teams/:teamId/messages/:messageId/pin
 *
 * Toggles the pinned state of a team message. Any team member can
 * pin a root message — pinning is a flag for "important", not a
 * moderation action. Replies cannot be pinned (pin lives at the
 * thread root).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId, messageId } = await params;
    await verifyTeamAccess(userId, teamId);

    const msg = await prisma.teamMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg || msg.teamId !== teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (msg.parentMessageId) {
      return NextResponse.json(
        { error: "Replies can't be pinned — pin the parent message" },
        { status: 400 }
      );
    }

    const updated = await prisma.teamMessage.update({
      where: { id: messageId },
      data: { isPinned: !msg.isPinned },
      select: { id: true, isPinned: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[team message pin] error:", error);
    return NextResponse.json(
      { error: "Failed to toggle pin" },
      { status: 500 }
    );
  }
}
