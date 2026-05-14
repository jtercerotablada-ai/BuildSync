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
import { syncTeamMentionsForEditedMessage } from "@/lib/mentions";

/**
 * PATCH /api/teams/:teamId/messages/:messageId — edit content (author only).
 *   Optionally syncs mentions when mentionUserIds[] is present.
 * DELETE /api/teams/:teamId/messages/:messageId — delete (author OR team LEAD).
 */

const patchSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

export async function PATCH(
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

    const message = await prisma.teamMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.teamId !== teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (message.authorId !== userId) {
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

    const updated = parsed.data.content
      ? await prisma.teamMessage.update({
          where: { id: messageId },
          data: { content: parsed.data.content.trim() },
          include: {
            author: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        })
      : await prisma.teamMessage.findUnique({
          where: { id: messageId },
          include: {
            author: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        });
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Optional: sync mentions if the client included a fresh list.
    if (parsed.data.mentionUserIds !== undefined) {
      try {
        await syncTeamMentionsForEditedMessage({
          messageId,
          teamId,
          actorUserId: userId,
          mentionUserIds: parsed.data.mentionUserIds,
          authorName:
            updated.author?.name ?? updated.author?.email ?? "Someone",
          authorImage: updated.author?.image ?? null,
          contentPreview: updated.content,
          rootMessageId: message.parentMessageId ?? messageId,
        });
      } catch (err) {
        console.error("[team message PATCH] mention sync failed:", err);
      }
    }

    const mentions = await prisma.teamMessageMention.findMany({
      where: { teamMessageId: messageId },
      select: {
        userId: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      isPinned: updated.isPinned,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      author: updated.author,
      mentions: mentions.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        image: m.user.image,
      })),
    });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[team message PATCH] error:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const message = await prisma.teamMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.teamId !== teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Author or team LEAD can delete.
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    const canDelete =
      message.authorId === userId || teamMember?.role === "LEAD";

    if (!canDelete) {
      return NextResponse.json(
        { error: "Only the author or a team lead can delete" },
        { status: 403 }
      );
    }

    await prisma.teamMessage.delete({ where: { id: messageId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[team message DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
