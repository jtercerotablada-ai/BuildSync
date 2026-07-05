import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyWorkspaceAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

/**
 * Goals API for a PORTFOLIO's Progress view — the "Goals this portfolio works
 * toward" block (Asana parity). Backed by the PortfolioObjective join table
 * (Portfolio <-> Objective). Portfolios are SHARED (PortfolioMember
 * OWNER/EDITOR/VIEWER, plus PUBLIC), so:
 *   • GET is open to any portfolio VIEWER (owner | member | PUBLIC).
 *   • POST (link) / DELETE (unlink) require EDIT capability (owner or member
 *     role OWNER/EDITOR).
 * The view/edit gate mirrors resolvePortfolioGate in the widgets route.
 *
 * A linked objective can only ever share the portfolio's workspaceId — POST
 * re-verifies this so a crafted request can never link a cross-workspace goal.
 */

interface PortfolioGate {
  workspaceId: string;
  ownerId: string | null;
  canEdit: boolean;
}

/**
 * Load a portfolio and resolve the caller's view + edit capability. Returns
 * null when the portfolio is missing, cross-workspace, or the caller cannot
 * VIEW it (owner | member | PUBLIC) — the caller maps null to 404 to mask
 * existence, matching GET /api/portfolios/[portfolioId] and the widgets route.
 */
async function resolvePortfolioGate(
  userId: string,
  portfolioId: string
): Promise<PortfolioGate | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: {
      workspaceId: true,
      ownerId: true,
      privacy: true,
      members: { select: { userId: true, role: true } },
    },
  });
  if (!portfolio) return null;

  // Must be a member of the portfolio's workspace at all.
  await verifyWorkspaceAccess(userId, portfolio.workspaceId);

  const isOwner = portfolio.ownerId === userId;
  const membership = portfolio.members.find((m) => m.userId === userId);
  const isMember = membership != null;
  const isPublic = portfolio.privacy === "PUBLIC";
  if (!isOwner && !isMember && !isPublic) return null;

  const memberRole = membership?.role;
  const canEdit = isOwner || memberRole === "OWNER" || memberRole === "EDITOR";

  return {
    workspaceId: portfolio.workspaceId,
    ownerId: portfolio.ownerId,
    canEdit,
  };
}

// Shape returned for each linked goal (and the ?available=1 picker rows).
const objectiveSelect = {
  id: true,
  name: true,
  status: true,
  progress: true,
  ownerId: true,
  owner: { select: { id: true, name: true, image: true } },
  team: { select: { id: true, name: true, color: true } },
  period: true,
} as const;

const linkSchema = z.object({ objectiveId: z.string().min(1) });

// ─── GET — linked goals (view gate), or ?available=1 picker list ──

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
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const wantAvailable = searchParams.get("available") === "1";

    // Ids already linked to this portfolio (used by both branches).
    const links = await prisma.portfolioObjective.findMany({
      where: { portfolioId },
      select: { objectiveId: true },
    });
    const linkedIds = links.map((l) => l.objectiveId);

    // ── ?available=1 → workspace objectives the caller can see, minus the
    // already-linked ones. Same privacy gate as GET /api/objectives (owner |
    // explicit member | team member) AND same workspace as the portfolio, so
    // link-eligibility is enforced server-side. Only offered to editors —
    // viewers can't link, so they don't need the picker list. ──
    if (wantAvailable) {
      if (!gate.canEdit) {
        return NextResponse.json(
          { error: "Only the portfolio owner or an Editor can link goals" },
          { status: 403 }
        );
      }
      const available = await prisma.objective.findMany({
        where: {
          workspaceId: gate.workspaceId,
          id: { notIn: linkedIds },
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
            { team: { members: { some: { userId } } } },
          ],
        },
        select: objectiveSelect,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(available);
    }

    // ── Default → the linked goals in link order (createdAt asc). ──
    const linked = await prisma.portfolioObjective.findMany({
      where: { portfolioId },
      include: { objective: { select: objectiveSelect } },
      orderBy: { createdAt: "asc" },
    });

    const goals = linked.map((row) => ({
      linkId: row.id,
      ...row.objective,
    }));

    return NextResponse.json({ goals, canEdit: gate.canEdit });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error listing portfolio goals:", error);
    return NextResponse.json(
      { error: "Failed to list goals" },
      { status: 500 }
    );
  }
}

// ─── POST — link a goal (requires edit capability) ────────────────

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
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 }
      );
    }
    if (!gate.canEdit) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an Editor can link goals" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { objectiveId } = linkSchema.parse(body);

    // The objective must exist AND share the portfolio's workspace. A
    // cross-workspace / missing objective is masked as 404.
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { workspaceId: true },
    });
    if (!objective || objective.workspaceId !== gate.workspaceId) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Create guarded by the @@unique([portfolioId, objectiveId]); a duplicate
    // link (P2002) is treated as idempotent success.
    try {
      await prisma.portfolioObjective.create({
        data: { portfolioId, objectiveId },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") throw e;
    }

    // Return the linked goal in the GET row shape.
    const link = await prisma.portfolioObjective.findUnique({
      where: { portfolioId_objectiveId: { portfolioId, objectiveId } },
      include: { objective: { select: objectiveSelect } },
    });
    if (!link) {
      return NextResponse.json(
        { error: "Failed to link goal" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { linkId: link.id, ...link.objective },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error linking portfolio goal:", error);
    return NextResponse.json({ error: "Failed to link goal" }, { status: 500 });
  }
}

// ─── DELETE — unlink a goal (requires edit capability) ────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 }
      );
    }
    if (!gate.canEdit) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an Editor can unlink goals" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const objectiveId = searchParams.get("objectiveId");
    if (!objectiveId) {
      return NextResponse.json(
        { error: "objectiveId required" },
        { status: 400 }
      );
    }

    // Bind to THIS portfolio so a foreign / already-removed link deletes
    // nothing (count 0 → 404).
    const deleted = await prisma.portfolioObjective.deleteMany({
      where: { portfolioId, objectiveId },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error unlinking portfolio goal:", error);
    return NextResponse.json(
      { error: "Failed to unlink goal" },
      { status: 500 }
    );
  }
}
