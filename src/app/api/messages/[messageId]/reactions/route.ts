import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * POST /api/messages/:messageId/reactions
 *
 * Toggle a reaction on a message. Idempotent semantics.
 */

const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { messageId } = await params;
    const body = await req.json();
    const parsed = reactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }
    const { emoji } = parsed.data;

    const access = await loadMessageWithAccess(messageId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const existing = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji },
      },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ active: false, emoji });
    }

    await prisma.messageReaction.create({
      data: { messageId, userId, emoji },
    });
    return NextResponse.json({ active: true, emoji });
  } catch (err) {
    console.error("[reaction] error:", err);
    return NextResponse.json(
      { error: "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}
