import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/portfolios/:portfolioId/messages
 * POST /api/portfolios/:portfolioId/messages
 *
 * Portfolio-scoped channel. Mirrors /api/projects/[id]/messages but
 * gated on portfolio ownership/membership/public privacy instead of
 * project access. Stores in the same Message table — Asana exposes
 * one "Mensajes" per scope and we keep parity.
 */

const createSchema = z.object({
  content: z.string().min(1).max(10000),
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
  const isPublic = portfolio.privacy === "PUBLIC";

  if (isOwner || isMember || isPublic) {
    return { ok: true as const, portfolio, member };
  }

  return { ok: false as const, status: 404 };
}

export async function GET(
  _req: Request,
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

    // Root messages only — replies surface inside each thread.
    const messages = await prisma.message.findMany({
      where: { portfolioId, parentMessageId: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
        attachments: true,
        reactions: {
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
        _count: { select: { replies: true } },
      },
    });

    return NextResponse.json(
      messages.map((m) => ({
        id: m.id,
        content: m.content,
        isPinned: m.isPinned,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        author: m.author,
        attachments: m.attachments,
        reactions: m.reactions,
        replyCount: m._count.replies,
      }))
    );
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
        attachments: true,
        reactions: true,
        _count: { select: { replies: true } },
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        content: created.content,
        isPinned: created.isPinned,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        author: created.author,
        attachments: created.attachments,
        reactions: created.reactions,
        replyCount: created._count.replies,
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
