import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { persistMentionsForNewMessage } from "@/lib/mentions";

/**
 * GET /api/projects/:projectId/messages
 * POST /api/projects/:projectId/messages
 *
 * The project's message thread — the team channel where status
 * updates, decisions, and discussion live. Same data model my-tasks
 * and the project Overview tab already write to, just surfaced
 * here as a chronologically sorted feed with author + reactions
 * + attachments.
 *
 * GET returns the most recent 100 messages (paginatable later via
 * a `before` cursor). Order is newest-first; the UI reverses to
 * read chronologically.
 *
 * POST creates a new message authored by the current user.
 */

const createSchema = z.object({
  content: z.string().min(1).max(10000),
  // Optional list of user ids the author tagged via @ mention.
  // Server validates each one against project membership before
  // persisting; unknown ids are silently dropped.
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      visibility: true,
      workspaceId: true,
      members: { select: { userId: true, role: true } },
    },
  });

  if (!project) return { ok: false as const, status: 404 };

  const member = project.members.find((m) => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const isMember = !!member;
  if (isOwner || isMember || project.visibility === "PUBLIC") {
    return { ok: true as const, project, member };
  }

  if (project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (wsMember) return { ok: true as const, project, member: null };
  }

  return { ok: false as const, status: 403 };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const access = await assertProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    // Root messages only — replies live under their parent and are
    // fetched on demand via /api/messages/:id/replies when the user
    // expands a thread. This keeps the main feed flat and snappy.
    const messages = await prisma.message.findMany({
      where: { projectId, parentMessageId: null },
      orderBy: { createdAt: "desc" },
      take: 100,
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
        // Thread meta: total reply count + the newest reply's
        // timestamp so the UI can render "3 replies · last 5m ago".
        replies: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
        _count: { select: { replies: true } },
        // Mentions — needed for chip rendering. Light shape: just
        // the user id + display fields.
        mentions: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    // Light shaping: ISO strings, group reactions by emoji for
    // simpler client rendering, expose the current user's reaction
    // state so the UI can toggle correctly.
    const shaped = messages.map((m) => {
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
        replyCount: m._count.replies,
        lastReplyAt: m.replies[0]?.createdAt.toISOString() ?? null,
        mentions: m.mentions.map((mn) => ({
          userId: mn.userId,
          name: mn.user.name,
          image: mn.user.image,
        })),
      };
    });

    return NextResponse.json(shaped);
  } catch (err) {
    console.error("[messages GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const access = await assertProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const created = await prisma.message.create({
      data: {
        projectId,
        authorId: userId,
        content: parsed.data.content.trim(),
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Fan-out mentions after creation. Errors here shouldn't fail
    // the user's send — log them but return the message anyway so
    // the optimistic UI swap completes.
    let resolvedMentions: { userId: string; name: string | null; image: string | null }[] = [];
    const ids = parsed.data.mentionUserIds ?? [];
    if (ids.length > 0) {
      try {
        await persistMentionsForNewMessage({
          messageId: created.id,
          projectId,
          actorUserId: userId,
          mentionUserIds: ids,
          authorName: created.author?.name ?? created.author?.email ?? "Someone",
          contentPreview: created.content,
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
        console.error("[messages POST] mention fan-out failed:", err);
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
        replyCount: 0,
        lastReplyAt: null,
        mentions: resolvedMentions,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[messages POST] error:", err);
    return NextResponse.json(
      { error: "Failed to post message" },
      { status: 500 }
    );
  }
}
