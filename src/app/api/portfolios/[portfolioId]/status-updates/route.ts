import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const STATUS_VALUES = [
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "ON_HOLD",
  "COMPLETE",
] as const;

const createSchema = z.object({
  status: z.enum(STATUS_VALUES),
  summary: z.string().min(1).max(4000),
  // When true we also patch the portfolio itself so the portfolio
  // header badge stays in sync with the latest update.
  syncPortfolioStatus: z.boolean().optional().default(true),
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

function canEditPortfolio(
  portfolio: { ownerId: string | null },
  member: { role: string } | null,
  userId: string
): boolean {
  if (portfolio.ownerId === userId) return true;
  if (!member) return false;
  return member.role === "OWNER" || member.role === "EDITOR";
}

// GET /api/portfolios/:portfolioId/status-updates
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

    const updates = await prisma.portfolioStatusUpdate.findMany({
      where: { portfolioId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(
      updates.map((u) => ({
        id: u.id,
        status: u.status,
        summary: u.summary,
        createdAt: u.createdAt.toISOString(),
        author: u.author,
      }))
    );
  } catch (err) {
    console.error("[portfolio status-updates GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch status updates" },
      { status: 500 }
    );
  }
}

// POST /api/portfolios/:portfolioId/status-updates
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

    const wantsSync = parsed.data.syncPortfolioStatus;
    const canSync = canEditPortfolio(access.portfolio, access.member, userId);
    if (wantsSync && !canSync) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to change this portfolio's status. Ask an editor or owner.",
        },
        { status: 403 }
      );
    }

    const created = await prisma.portfolioStatusUpdate.create({
      data: {
        portfolioId,
        authorId: userId,
        status: parsed.data.status,
        summary: parsed.data.summary.trim(),
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    if (wantsSync) {
      await prisma.portfolio.update({
        where: { id: portfolioId },
        data: { status: parsed.data.status },
      });
    }

    return NextResponse.json(
      {
        id: created.id,
        status: created.status,
        summary: created.summary,
        createdAt: created.createdAt.toISOString(),
        author: created.author,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[portfolio status-updates POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create status update" },
      { status: 500 }
    );
  }
}
