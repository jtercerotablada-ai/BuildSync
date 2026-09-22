import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveAllowedPortfolioMentionUserIds } from "@/lib/mentions";
import { shouldNotify } from "@/lib/notification-prefs";
import { isNonContributorRole } from "@/lib/workspace-roles";

/**
 * GET /api/portfolios/:portfolioId/messages
 * POST /api/portfolios/:portfolioId/messages
 *
 * Portfolio-scoped channel. Mirrors the shape of project messages so
 * the shared MessagesView component can render it without changes.
 */

const createSchema = z.object({
  content: z.string().min(1).max(10000),
  // @-mention targets — persisted as MessageMention rows AND fanned out
  // as MENTIONED notifications (gated to the portfolio's audience).
  mentionUserIds: z.array(z.string().min(1)).max(50).optional(),
});

async function assertPortfolioAccess(portfolioId: string, userId: string) {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: {
      id: true,
      ownerId: true,
      privacy: true,
      workspaceId: true,
      members: { select: { userId: true, role: true } },
    },
  });

  if (!portfolio) return { ok: false as const, status: 404 };

  const member = portfolio.members.find((m) => m.userId === userId) ?? null;
  const isOwner = portfolio.ownerId === userId;
  const isMember = !!member;

  // Membership of the portfolio's OWN workspace is required for EVERY caller
  // — the blanket check the canonical GET /api/portfolios/[portfolioId] runs
  // via verifyWorkspaceAccess. Closes both PUBLIC granting any authenticated
  // user of any workspace (cross-tenant read + POST into the channel) and an
  // offboarded owner/member whose PortfolioMember row survived (no cascade on
  // WorkspaceMember delete). PUBLIC = "everyone in THIS workspace".
  const wsMember = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: portfolio.workspaceId },
    },
  });
  if (!wsMember) return { ok: false as const, status: 404 };

  // Same rule as decidePortfolioAccess in ../route.ts: WORKSPACE opens the
  // portfolio to every contributor, and workspace OWNER/ADMIN see every
  // portfolio. Posting is an edit: owner, member OWNER/EDITOR or workspace
  // manager — VIEWERs and people let in by privacy alone read only.
  const isContributor = !isNonContributorRole(wsMember.role);
  const isWorkspaceManager =
    wsMember.role === "OWNER" || wsMember.role === "ADMIN";
  const allowed =
    isOwner ||
    isMember ||
    isWorkspaceManager ||
    portfolio.privacy === "PUBLIC" ||
    (portfolio.privacy === "WORKSPACE" && isContributor);
  if (!allowed) return { ok: false as const, status: 404 };

  const canPost =
    isContributor &&
    (isOwner ||
      isWorkspaceManager ||
      member?.role === "OWNER" ||
      member?.role === "EDITOR");
  return { ok: true as const, portfolio, member, canPost };
}

const MAX_AUDIENCE = 200;

/**
 * Everyone who can READ the portfolio — the people an @mention can reach.
 * Same rule as resolveAllowedPortfolioMentionUserIds (the write path): the
 * owner and members with a seat, workspace OWNER/ADMIN, everyone on PUBLIC,
 * every contributor on WORKSPACE.
 */
async function loadMentionAudience(portfolio: {
  ownerId: string | null;
  privacy: string;
  workspaceId: string;
  members: { userId: string }[];
}) {
  const explicit = new Set<string>(portfolio.members.map((m) => m.userId));
  if (portfolio.ownerId) explicit.add(portfolio.ownerId);
  const seats = await prisma.workspaceMember.findMany({
    where: { workspaceId: portfolio.workspaceId },
    select: { userId: true, role: true },
    orderBy: { joinedAt: "asc" },
  });
  const readerIds = seats
    .filter(
      (wm) =>
        explicit.has(wm.userId) ||
        wm.role === "OWNER" ||
        wm.role === "ADMIN" ||
        portfolio.privacy === "PUBLIC" ||
        (portfolio.privacy === "WORKSPACE" && !isNonContributorRole(wm.role))
    )
    .map((wm) => wm.userId)
    .slice(0, MAX_AUDIENCE);
  const users = await prisma.user.findMany({
    where: { id: { in: readerIds } },
    select: { id: true, name: true, email: true, image: true, jobTitle: true },
    orderBy: { name: "asc" },
  });
  return users.map((user) => ({ user }));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { portfolioId } = await params;
    const access = await assertPortfolioAccess(portfolioId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: "Not found" },
        { status: access.status }
      );
    }

    // `?audience=1` answers what the caller may do in this channel and who
    // they can @mention, instead of the feed (same contract as the project
    // messages route).
    if (new URL(req.url).searchParams.get("audience") === "1") {
      return NextResponse.json({
        canPost: access.canPost,
        people: await loadMentionAudience(access.portfolio),
      });
    }
    // Moderation (pin, delete anyone's message) is the same set that may
    // post — see canPostInPortfolio in message-access.ts.
    const canModerate = access.canPost;

    // Root messages only — replies live under their parent and are
    // fetched on demand via /api/messages/:id/replies when a thread
    // is expanded.
    const messages = await prisma.message.findMany({
      where: { portfolioId, parentMessageId: null },
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
      },
    });

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
        // The stored url is a storage address; hand out the authenticated
        // read door instead, which re-checks this portfolio's access rule.
        attachments: m.attachments.map((a) => ({
          ...a,
          url: `/api/messages/${m.id}/attachments?file=${a.id}`,
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

    return NextResponse.json(shaped);
  } catch (err) {
    console.error("[portfolio messages GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { portfolioId } = await params;
    const access = await assertPortfolioAccess(portfolioId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: "Not found" },
        { status: access.status }
      );
    }

    // Only editors and above may post — VIEWER/public access is read-only.
    if (!access.canPost) {
      return NextResponse.json(
        { error: "You don't have permission to post in this portfolio" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.message.create({
      data: {
        portfolioId,
        workspaceId: access.portfolio.workspaceId,
        authorId: userId,
        content: parsed.data.content.trim(),
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Mentions: persist the rows so display works AND fan out a
    // MENTIONED notification to each mentioned user (mirroring project +
    // team message mentions). Best-effort — a failure here never blocks
    // the posted message.
    let resolvedMentions: {
      userId: string;
      name: string | null;
      image: string | null;
    }[] = [];
    const ids = parsed.data.mentionUserIds ?? [];
    if (ids.length > 0) {
      try {
        // Audience gate: only allow mentioning users who can read the
        // portfolio. Bogus or cross-workspace ids are silently dropped.
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

          // Notify everyone mentioned except the author (pinging
          // yourself is noise) and anyone who turned mention
          // notifications off. Type MENTIONED so it lands in the inbox.
          const others = allowed.filter((mid) => mid !== userId);
          const wants = await Promise.all(
            others.map((mid) => shouldNotify(mid, "MENTIONED"))
          );
          const recipients = others.filter((_, i) => wants[i]);
          if (recipients.length > 0) {
            const authorName =
              created.author?.name || created.author?.email || "Someone";
            const preview = created.content.slice(0, 140);
            await prisma.notification.createMany({
              data: recipients.map((mid) => ({
                userId: mid,
                type: "MENTIONED" as const,
                title: `${authorName} mentioned you`,
                message: preview,
                data: {
                  messageId: created.id,
                  portfolioId,
                  rootMessageId: created.id,
                  authorName,
                  authorImage: created.author?.image ?? null,
                },
              })),
            });
          }
        }
      } catch (err) {
        console.error("[portfolio messages POST] mention persist failed:", err);
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
  } catch (err) {
    console.error("[portfolio messages POST] error:", err);
    return NextResponse.json(
      { error: "Failed to post message" },
      { status: 500 }
    );
  }
}
