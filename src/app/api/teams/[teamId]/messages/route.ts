import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";
import { persistTeamMentionsForNewMessage } from "@/lib/mentions";

/**
 * GET  /api/teams/:teamId/messages — root messages (threads collapsed)
 * POST /api/teams/:teamId/messages — create a new team message
 *
 * Returns the SAME shape as /api/projects/:projectId/messages so the
 * shared messages-view UI component can render either source with
 * a single code path. Differences are scoped to the URL — the data
 * envelope is identical.
 *
 * Per-row fields:
 *   { id, content, isPinned, createdAt, updatedAt, author,
 *     reactions: [{ emoji, count, users, mine }],
 *     attachments: [{...}],
 *     mentions: [{ userId, name, image }],
 *     mine, canDelete, replyCount, lastReplyAt }
 *
 * `?audience=1` answers { canPost, people: [{ user }] } instead of the feed,
 * the same contract as the project route: people are the team's members,
 * the only users a team @mention can reach (resolveAllowedTeamMentionUserIds).
 */

const createSchema = z.object({
  content: z.string().min(1).max(10000),
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

const PAGE_SIZE = 100;

// Same read door the attachment POST hands back: the stored url is a storage
// address, never something to give a browser as a permanent link.
const teamAttachmentUrl = (
  teamId: string,
  messageId: string,
  attachmentId: string
) =>
  `/api/teams/${teamId}/messages/${messageId}/attachments?file=${attachmentId}`;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId } = await params;
    // Team member or workspace OWNER/ADMIN, with a contributor seat in the
    // team's workspace — the rule every other team tab already uses.
    const standing = await requireTeamStanding(userId, teamId);
    // Same bar the message DELETE enforces: author, team LEAD or workspace
    // OWNER/ADMIN.
    const canModerate = standing.canManageMembers;

    const searchParams = new URL(req.url).searchParams;
    if (searchParams.get("audience") === "1") {
      const members = await prisma.teamMember.findMany({
        where: { teamId },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              jobTitle: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      });
      // POST admits everyone with standing, which this caller just proved.
      return NextResponse.json({
        canPost: true,
        people: members.map((m) => ({ user: m.user })),
      });
    }

    // `?before=<ISO createdAt>` pages back through older root messages.
    const beforeParam = searchParams.get("before");
    const before = beforeParam ? new Date(beforeParam) : null;
    if (before && Number.isNaN(before.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'before' cursor" },
        { status: 400 }
      );
    }

    // Root messages only — replies are fetched on demand by the
    // shared MessagesView when a thread is expanded.
    const include = {
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
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      _count: { select: { replies: true } },
      mentions: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, image: true } },
        },
      },
    } satisfies Prisma.TeamMessageInclude;

    const page = await prisma.teamMessage.findMany({
      where: {
        teamId,
        parentMessageId: null,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include,
    });

    // Pinned messages ride along on the first page whatever their age: the
    // pinned list is built from this same array, so a pin older than the
    // newest page used to vanish from both the feed and the pinned list.
    const olderPinned = before
      ? []
      : await prisma.teamMessage.findMany({
          where: {
            teamId,
            parentMessageId: null,
            isPinned: true,
            id: { notIn: page.map((m) => m.id) },
          },
          orderBy: { createdAt: "desc" },
          include,
        });
    const messages = [...page, ...olderPinned];

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
          url: teamAttachmentUrl(teamId, m.id, a.id),
          createdAt: a.createdAt.toISOString(),
        })),
        mine: m.author?.id === userId,
        canDelete: m.author?.id === userId || canModerate,
        replyCount: m._count.replies,
        lastReplyAt: m.replies[0]?.createdAt.toISOString() ?? null,
        mentions: m.mentions.map((mn) => ({
          userId: mn.userId,
          name: mn.user.name,
          image: mn.user.image,
        })),
      };
    });

    // The page size rides in a header so the response stays the plain array
    // every existing caller expects; a full page means older messages exist.
    return NextResponse.json(shaped, {
      headers: { "X-Has-More": page.length === PAGE_SIZE ? "1" : "0" },
    });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching team messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId } = await params;

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }
    const { content, mentionUserIds } = parsed.data;

    // Team member or workspace OWNER/ADMIN, both with a live contributor seat.
    // A bare TeamMember row is not enough: it can outlive the seat.
    await requireTeamStanding(userId, teamId);

    const created = await prisma.teamMessage.create({
      data: {
        content: content.trim(),
        teamId,
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Persist mentions + fan out notifications. Errors are logged
    // but the message itself stays created (the optimistic UI swap
    // shouldn't be undone if a mention pipeline blip occurs).
    let resolvedMentions: {
      userId: string;
      name: string | null;
      image: string | null;
    }[] = [];
    if (mentionUserIds && mentionUserIds.length > 0) {
      try {
        await persistTeamMentionsForNewMessage({
          messageId: created.id,
          teamId,
          actorUserId: userId,
          mentionUserIds,
          authorName:
            created.author?.name ?? created.author?.email ?? "Someone",
          authorImage: created.author?.image ?? null,
          contentPreview: created.content,
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
        console.error("[team messages POST] mention fan-out failed:", err);
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
        canDelete: true,
        replyCount: 0,
        lastReplyAt: null,
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
    console.error("Error creating team message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
