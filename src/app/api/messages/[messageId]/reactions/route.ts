import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * POST /api/messages/:messageId/reactions
 *
 * Toggle a reaction on a message. Idempotent semantics: the response
 * always describes the STORED state of that emoji bucket after the
 * write, never what this particular request intended to do. Two clicks
 * racing each other therefore come back with the same truth, and the
 * client can reconcile onto it instead of trusting its optimistic
 * toggle.
 */

const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

/**
 * Read one emoji bucket back in the same shape the messages GET
 * serializes (emoji / count / users / mine), plus `active` for the
 * callers that only look at the flag.
 */
async function readBucket(messageId: string, userId: string, emoji: string) {
  const rows = await prisma.messageReaction.findMany({
    where: { messageId, emoji },
    select: { userId: true, user: { select: { id: true, name: true } } },
  });
  const mine = rows.some((r) => r.userId === userId);
  return {
    emoji,
    count: rows.length,
    users: rows.map((r) => ({ id: r.user.id, name: r.user.name })),
    mine,
    active: mine,
  };
}

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
      try {
        await prisma.messageReaction.delete({ where: { id: existing.id } });
      } catch (e) {
        // Mirror of the insert race below: a concurrent double-fire already
        // removed this row. The row is gone either way, which is what the
        // caller asked for, so this is a success — not a 500.
        if (
          !(
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2025"
          )
        ) {
          throw e;
        }
      }
    } else {
      try {
        await prisma.messageReaction.create({
          data: { messageId, userId, emoji },
        });
      } catch (e) {
        // Concurrent double-fire (both requests saw "not existing" and both
        // insert) trips the @@unique constraint. The reaction IS persisted,
        // so treat it as an idempotent success instead of 500 + UI rollback.
        if (
          !(
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          )
        ) {
          throw e;
        }
      }
    }

    return NextResponse.json(await readBucket(messageId, userId, emoji));
  } catch (err) {
    console.error("[reaction] error:", err);
    return NextResponse.json(
      { error: "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}
