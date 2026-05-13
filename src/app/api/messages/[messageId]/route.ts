import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { syncMentionsForEditedMessage } from "@/lib/mentions";

/**
 * PATCH /api/messages/:messageId — edit content (author only).
 * DELETE /api/messages/:messageId — delete (author OR project
 *   owner/ADMIN).
 *
 * Permissions are intentionally narrow:
 *   - Authors can edit their own messages.
 *   - Authors can delete their own messages.
 *   - Project owners and ADMIN members can delete ANY message
 *     (moderation), but they can NOT edit someone else's words
 *     (integrity over moderation).
 */

const patchSchema = z.object({
  content: z.string().min(1).max(10000),
  // Edits sync mentions too — clients pass the new resolved set
  // and the server diffs against existing rows.
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

async function loadMessageWithProject(messageId: string) {
  return prisma.message.findUnique({
    where: { id: messageId },
    include: {
      project: {
        select: {
          id: true,
          ownerId: true,
          members: { select: { userId: true, role: true } },
        },
      },
    },
  });
}

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
    const msg = await loadMessageWithProject(messageId);
    if (!msg) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (msg.authorId !== userId) {
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

    // Sync mentions if the client included a new mention set.
    // Missing field = leave existing mentions alone (used for the
    // current text-only edit path; UI sends the array explicitly
    // once it tracks them).
    let resolvedMentions: {
      userId: string;
      name: string | null;
      image: string | null;
    }[] = [];
    const ids = parsed.data.mentionUserIds;
    if (ids !== undefined && msg.project?.id) {
      try {
        await syncMentionsForEditedMessage({
          messageId,
          projectId: msg.project.id,
          actorUserId: userId,
          mentionUserIds: ids,
          authorName: updated.author?.name ?? updated.author?.email ?? "Someone",
          contentPreview: updated.content,
          rootMessageId: msg.parentMessageId ?? messageId,
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
    const msg = await loadMessageWithProject(messageId);
    if (!msg) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!msg.project) {
      // Workspace-scoped messages have no project; only authors can
      // delete those.
      if (msg.authorId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const member = msg.project.members.find((m) => m.userId === userId);
      const isAuthor = msg.authorId === userId;
      const isOwner = msg.project.ownerId === userId;
      const isAdmin = member?.role === "ADMIN";
      if (!isAuthor && !isOwner && !isAdmin) {
        return NextResponse.json(
          { error: "Only the author or a project admin can delete" },
          { status: 403 }
        );
      }
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
