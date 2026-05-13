import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { persistMentionsForNewMessage } from "@/lib/mentions";

/**
 * GET  /api/messages/:messageId/replies — fetch the full thread.
 * POST /api/messages/:messageId/replies — post a new reply.
 *
 * Replies share the Message model with a `parentMessageId` link.
 * Threads are intentionally flat (only one level deep) — replying
 * to a reply binds to the same root, not to the reply itself.
 * That keeps reading order linear and the UI simple.
 *
 * Access is gated by the parent message's project access, just
 * like reactions and pin — anyone who can read the project can
 * see the thread; anyone who can post in the project can reply.
 */

const replyCreateSchema = z.object({
  content: z.string().min(1).max(10000),
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

interface ParentAccess {
  parent: {
    id: string;
    projectId: string | null;
    parentMessageId: string | null;
    project: {
      id: string;
      ownerId: string | null;
      visibility: string;
      workspaceId: string;
      members: { userId: string }[];
    } | null;
  };
  // The root we should bind replies to (resolves "reply-to-reply"
  // to the actual root, keeping threads flat).
  rootId: string;
}

async function loadParentWithAccess(
  messageId: string,
  userId: string
): Promise<
  | { ok: true; data: ParentAccess }
  | { ok: false; status: number; error: string }
> {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      projectId: true,
      parentMessageId: true,
      project: {
        select: {
          id: true,
          ownerId: true,
          visibility: true,
          workspaceId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!msg) {
    return { ok: false, status: 404, error: "Not found" };
  }

  if (msg.project) {
    const isOwner = msg.project.ownerId === userId;
    const isMember = msg.project.members.some((m) => m.userId === userId);
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
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }

  return {
    ok: true,
    data: {
      parent: msg,
      // Replies always attach to the root, never to another reply.
      rootId: msg.parentMessageId ?? msg.id,
    },
  };
}

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

    const access = await loadParentWithAccess(messageId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    // Always read replies off the root, even if a reply id was passed.
    const replies = await prisma.message.findMany({
      where: { parentMessageId: access.data.rootId },
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

    const access = await loadParentWithAccess(messageId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
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

    const created = await prisma.message.create({
      data: {
        projectId: access.data.parent.projectId,
        authorId: userId,
        content: parsed.data.content.trim(),
        parentMessageId: access.data.rootId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    let resolvedMentions: { userId: string; name: string | null; image: string | null }[] = [];
    const ids = parsed.data.mentionUserIds ?? [];
    if (ids.length > 0 && access.data.parent.projectId) {
      try {
        await persistMentionsForNewMessage({
          messageId: created.id,
          projectId: access.data.parent.projectId,
          actorUserId: userId,
          mentionUserIds: ids,
          authorName:
            created.author?.name ?? created.author?.email ?? "Someone",
          authorImage: created.author?.image ?? null,
          contentPreview: created.content,
          rootMessageId: access.data.rootId,
        });
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
