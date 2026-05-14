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
import { persistTeamMentionsForNewMessage } from "@/lib/mentions";

/**
 * GET  /api/teams/:teamId/messages/:messageId/replies — fetch thread
 * POST /api/teams/:teamId/messages/:messageId/replies — post a reply
 *
 * Threads on team messages mirror the project messages model:
 * flat (1 level deep), bound to a root id. Replying to a reply
 * resolves to the actual root for the parentMessageId binding.
 */
const replyCreateSchema = z.object({
  content: z.string().min(1).max(10000),
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

async function loadParentOrRoot(messageId: string, teamId: string) {
  const msg = await prisma.teamMessage.findUnique({
    where: { id: messageId },
    select: { id: true, teamId: true, parentMessageId: true },
  });
  if (!msg || msg.teamId !== teamId) return null;
  return { parent: msg, rootId: msg.parentMessageId ?? msg.id };
}

export async function GET(
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

    const ctx = await loadParentOrRoot(messageId, teamId);
    if (!ctx) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const replies = await prisma.teamMessage.findMany({
      where: { parentMessageId: ctx.rootId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
            createdAt: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
        attachments: {
          select: {
            id: true,
            name: true,
            url: true,
            size: true,
            mimeType: true,
            createdAt: true,
          },
        },
        mentions: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    const shaped = replies.map((m) => {
      const reactionsByEmoji: Record<
        string,
        {
          emoji: string;
          count: number;
          users: { id: string; name: string | null }[];
          mine: boolean;
        }
      > = {};
      for (const r of m.reactions) {
        if (!reactionsByEmoji[r.emoji]) {
          reactionsByEmoji[r.emoji] = {
            emoji: r.emoji,
            count: 0,
            users: [],
            mine: false,
          };
        }
        reactionsByEmoji[r.emoji].count++;
        reactionsByEmoji[r.emoji].users.push({
          id: r.user.id,
          name: r.user.name,
        });
        if (r.userId === userId) {
          reactionsByEmoji[r.emoji].mine = true;
        }
      }
      return {
        id: m.id,
        content: m.content,
        isPinned: m.isPinned,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        author: m.author,
        reactions: Object.values(reactionsByEmoji).sort(
          (a, b) => b.count - a.count
        ),
        attachments: m.attachments.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
        mine: m.author?.id === userId,
        mentions: m.mentions.map((mn) => ({
          userId: mn.userId,
          name: mn.user.name,
          image: mn.user.image,
        })),
      };
    });

    return NextResponse.json(shaped);
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[team replies GET] error:", error);
    return NextResponse.json(
      { error: "Failed to load replies" },
      { status: 500 }
    );
  }
}

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

    const ctx = await loadParentOrRoot(messageId, teamId);
    if (!ctx) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Posting requires team membership (same gate as parent POST).
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be a team member to reply" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = replyCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const created = await prisma.teamMessage.create({
      data: {
        teamId,
        authorId: userId,
        content: parsed.data.content.trim(),
        parentMessageId: ctx.rootId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    let resolvedMentions: {
      userId: string;
      name: string | null;
      image: string | null;
    }[] = [];
    const ids = parsed.data.mentionUserIds ?? [];
    if (ids.length > 0) {
      try {
        await persistTeamMentionsForNewMessage({
          messageId: created.id,
          teamId,
          actorUserId: userId,
          mentionUserIds: ids,
          authorName:
            created.author?.name ?? created.author?.email ?? "Someone",
          authorImage: created.author?.image ?? null,
          contentPreview: created.content,
          rootMessageId: ctx.rootId,
        });
        const rows = await prisma.teamMessageMention.findMany({
          where: { teamMessageId: created.id },
          select: {
            userId: true,
            user: { select: { id: true, name: true, image: true } },
          },
        });
        resolvedMentions = rows.map((r) => ({
          userId: r.userId,
          name: r.user.name,
          image: r.user.image,
        }));
      } catch (err) {
        console.error("[team replies POST] mention fan-out failed:", err);
      }
    }

    return NextResponse.json(
      {
        id: created.id,
        content: created.content,
        isPinned: created.isPinned,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        author: created.author,
        reactions: [],
        attachments: [],
        mine: true,
        mentions: resolvedMentions,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[team replies POST] error:", error);
    return NextResponse.json(
      { error: "Failed to post reply" },
      { status: 500 }
    );
  }
}
