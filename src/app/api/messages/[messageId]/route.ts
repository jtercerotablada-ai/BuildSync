import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      isPinned: updated.isPinned,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      author: updated.author,
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
