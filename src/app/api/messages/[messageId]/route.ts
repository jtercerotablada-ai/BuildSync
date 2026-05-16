import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { syncMentionsForEditedMessage } from "@/lib/mentions";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * PATCH /api/messages/:messageId — edit content (author only).
 * DELETE /api/messages/:messageId — delete (author OR scope admin).
 *
 * Works for both project and portfolio messages (Message is the
 * shared model). Mentions are currently project-only — portfolio
 * messages persist content + author but don't fan out @mentions yet.
 */

const patchSchema = z.object({
  content: z.string().min(1).max(10000),
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

export async function PATCH(
  req: Request,
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

    if (!access.isAuthor) {
      return NextResponse.json(
        { error: "Only the author can edit a message" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: parsed.data.content.trim() },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Mentions sync — currently project-only. Portfolio messages
    // persist text but don't run the @ fan-out yet.
    let resolvedMentions: {
      userId: string;
      name: string | null;
      image: string | null;
    }[] = [];
    const ids = parsed.data.mentionUserIds;
    if (ids !== undefined && access.message.projectId) {
      try {
        await syncMentionsForEditedMessage({
          messageId,
          projectId: access.message.projectId,
          actorUserId: userId,
          mentionUserIds: ids,
          authorName:
            updated.author?.name ?? updated.author?.email ?? "Someone",
          authorImage: updated.author?.image ?? null,
          contentPreview: updated.content,
          rootMessageId: access.message.parentMessageId ?? messageId,
        });
      } catch (err) {
        console.error("[message PATCH] mention sync failed:", err);
      }
    }
    const mentions = await prisma.messageMention.findMany({
      where: { messageId },
      select: {
        userId: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });
    resolvedMentions = mentions.map((mn) => ({
      userId: mn.userId,
      name: mn.user.name,
      image: mn.user.image,
    }));

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      isPinned: updated.isPinned,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      author: updated.author,
      mentions: resolvedMentions,
    });
  } catch (err) {
    console.error("[message PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (!access.isAuthor && !access.isAdmin) {
      return NextResponse.json(
        { error: "Only the author or a scope admin can delete" },
        { status: 403 }
      );
    }

    await prisma.message.delete({ where: { id: messageId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[message DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
