import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyTeamAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

/**
 * POST /api/teams/:teamId/messages/:messageId/reactions
 *
 * Toggle a reaction on a team message. If the (messageId, userId,
 * emoji) row exists, this DELETES it (un-react). Otherwise it
 * INSERTS. Idempotent semantics — clients can fire-and-forget and
 * use the active flag in the response to reconcile optimistic UI.
 *
 * Returns { active: boolean, emoji: string } matching the project
 * messages reactions endpoint so the shared MessagesView component
 * can use a single client-side handler.
 */
const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId, messageId } = await params;
    await verifyTeamAccess(userId, teamId);

    const body = await req.json();
    const parsed = reactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }
    const { emoji } = parsed.data;

    const message = await prisma.teamMessage.findUnique({
      where: { id: messageId },
      select: { id: true, teamId: true },
    });
    if (!message || message.teamId !== teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Toggle via the @@unique([teamMessageId, userId, emoji])
    // constraint.
    const existing = await prisma.messageReaction.findUnique({
      where: {
        teamMessageId_userId_emoji: {
          teamMessageId: messageId,
          userId,
          emoji,
        },
      },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ active: false, emoji });
    }

    await prisma.messageReaction.create({
      data: { teamMessageId: messageId, userId, emoji },
    });
    return NextResponse.json({ active: true, emoji });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[team reactions] error:", error);
    return NextResponse.json(
      { error: "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}
