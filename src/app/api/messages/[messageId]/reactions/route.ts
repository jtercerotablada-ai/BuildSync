import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * POST /api/messages/:messageId/reactions
 *
 * Toggle a reaction on a message. If the (messageId, userId, emoji)
 * row already exists, this DELETES it (un-react). Otherwise it
 * INSERTS. Idempotent semantics: clients can fire and forget; the
 * result reflects the new state.
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

    // Access gate — must be able to read the message's project.
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        project: {
          select: {
            ownerId: true,
            visibility: true,
            workspaceId: true,
            members: { select: { userId: true } },
          },
        },
      },
    });
    if (!msg) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (msg.project) {
      const member = msg.project.members.find((m) => m.userId === userId);
      const isOwner = msg.project.ownerId === userId;
      const isMember = !!member;
      let allowed =
        isOwner || isMember || msg.project.visibility === "PUBLIC";
      if (!allowed && msg.project.visibility === "WORKSPACE") {
        const wsMember = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId: msg.project.workspaceId,
            },
          },
        });
        if (wsMember) allowed = true;
      }
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Toggle — schema has a @@unique([messageId, userId, emoji])
    // constraint so we can find the existing row deterministically.
    const existing = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
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
