import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

const reactionSchema = z.object({
  emoji: z.string().min(1),
});

// POST /api/teams/:teamId/messages/:messageId/reactions - Toggle reaction
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, messageId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this team
    await verifyTeamAccess(userId, teamId);

    const body = await req.json();
    const { emoji } = reactionSchema.parse(body);

    // Verify message belongs to team
    const message = await prisma.teamMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.teamId !== teamId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Toggle: check if reaction already exists
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
    } else {
      await prisma.messageReaction.create({
        data: {
          emoji,
          teamMessageId: messageId,
          userId,
        },
      });
    }

    // Return updated reactions for this message
    const reactions = await prisma.messageReaction.findMany({
      where: { teamMessageId: messageId },
      select: { emoji: true, userId: true },
    });

    // Group by emoji
    const grouped: Record<string, { count: number; hasReacted: boolean }> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { count: 0, hasReacted: false };
      }
      grouped[r.emoji].count++;
      if (r.userId === userId) {
        grouped[r.emoji].hasReacted = true;
      }
    }

    const result = Object.entries(grouped).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasReacted: data.hasReacted,
    }));

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error toggling reaction:", error);
    return NextResponse.json(
      { error: "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}
