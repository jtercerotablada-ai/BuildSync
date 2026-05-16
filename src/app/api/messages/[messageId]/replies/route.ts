import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  persistMentionsForNewMessage,
  resolveAllowedPortfolioMentionUserIds,
} from "@/lib/mentions";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * GET  /api/messages/:messageId/replies — fetch the full thread.
 * POST /api/messages/:messageId/replies — post a new reply.
 *
 * Replies share the Message model with a `parentMessageId` link.
 * Threads are intentionally flat (only one level deep) — replying
 * to a reply binds to the same root, not to the reply itself.
 */

const replyCreateSchema = z.object({
  content: z.string().min(1).max(10000),
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

export async function GET(
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
    const rootId = access.message.parentMessageId ?? access.message.id;

    const replies = await prisma.message.findMany({
      where: { parentMessageId: rootId },
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
  } catch (err) {
    console.error("[replies GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load replies" },
      { status: 500 }
    );
  }
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

    const access = await loadMessageWithAccess(messageId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }
    const rootId = access.message.parentMessageId ?? access.message.id;
    const projectId = access.message.projectId;
    const portfolioId = access.message.portfolioId;

    const body = await req.json();
    const parsed = replyCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const created = await prisma.message.create({
      data: {
        projectId,
        portfolioId,
        authorId: userId,
        content: parsed.data.content.trim(),
        parentMessageId: rootId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Mentions: project scope runs the full notification fan-out;
    // portfolio scope persists the mention rows (filtered against
    // the portfolio's audience) but skips the inbox notification.
    let resolvedMentions: {
      userId: string;
      name: string | null;
      image: string | null;
    }[] = [];
    const ids = parsed.data.mentionUserIds ?? [];
    if (ids.length > 0) {
      try {
        if (projectId) {
          await persistMentionsForNewMessage({
            messageId: created.id,
            projectId,
            actorUserId: userId,
            mentionUserIds: ids,
            authorName:
              created.author?.name ?? created.author?.email ?? "Someone",
            authorImage: created.author?.image ?? null,
            contentPreview: created.content,
            rootMessageId: rootId,
          });
        } else if (portfolioId) {
          const allowed = await resolveAllowedPortfolioMentionUserIds(
            portfolioId,
            ids
          );
          if (allowed.length > 0) {
            await prisma.messageMention.createMany({
              data: allowed.map((mid) => ({
                messageId: created.id,
                userId: mid,
              })),
              skipDuplicates: true,
            });
          }
        }
        const mentions = await prisma.messageMention.findMany({
          where: { messageId: created.id },
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
      } catch (err) {
        console.error("[replies POST] mention fan-out failed:", err);
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
  } catch (err) {
    console.error("[replies POST] error:", err);
    return NextResponse.json(
      { error: "Failed to post reply" },
      { status: 500 }
    );
  }
}
