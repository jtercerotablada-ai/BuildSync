import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * POST /api/messages/:messageId/pin
 *
 * Toggles the pinned state of a message. Any project/portfolio
 * member can pin a message — pinning is collaborative. Only root
 * messages are pinnable (replies aren't).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { messageId } = await params;

    const access = await loadMessageWithAccess(messageId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    // Pinning is not caller-scoped like a reaction: it changes what the whole
    // channel sees at the top. Read access was enough, so a VIEWER could
    // unpin the team's kickoff announcement.
    if (!access.canPost) {
      return NextResponse.json(
        { error: "You don't have permission to pin messages here." },
        { status: 403 }
      );
    }

    if (access.message.parentMessageId) {
      return NextResponse.json(
        { error: "Replies can't be pinned — pin the parent message" },
        { status: 400 }
      );
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isPinned: !access.message.isPinned },
      select: { id: true, isPinned: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[message pin] error:", err);
    return NextResponse.json(
      { error: "Failed to toggle pin" },
      { status: 500 }
    );
  }
}
