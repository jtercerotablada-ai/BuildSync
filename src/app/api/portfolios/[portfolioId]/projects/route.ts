import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyWorkspaceAccess,
  assertProjectInWorkspace,
  getErrorStatus,
  NotFoundError,
  AuthorizationError,
} from "@/lib/auth-guards";
import { isNonContributorRole } from "@/lib/workspace-roles";

const addProjectSchema = z.object({
  projectId: z.string().min(1),
});

/**
 * Workspace + portfolio edit gate. Adding/removing projects on a portfolio is
 * a mutation — the portfolio owner, a member with role OWNER/EDITOR or a
 * workspace OWNER/ADMIN may do it, and only from a contributor seat (same
 * rule as decidePortfolioAccess in ../route.ts). Everyone else gets 404 so a
 * portfolio id cannot be probed.
 */
async function resolveEditablePortfolio(
  userId: string,
  portfolioId: string
): Promise<{ workspaceId: string } | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: {
      workspaceId: true,
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });
  if (!portfolio) return null;
  const wsMember = await verifyWorkspaceAccess(userId, portfolio.workspaceId);
  if (isNonContributorRole(wsMember.role)) return null;
  const memberRole = portfolio.members[0]?.role;
  const canEdit =
    portfolio.ownerId === userId ||
    wsMember.role === "OWNER" ||
    wsMember.role === "ADMIN" ||
    memberRole === "OWNER" ||
    memberRole === "EDITOR";
  return canEdit ? { workspaceId: portfolio.workspaceId } : null;
}

// POST /api/portfolios/:portfolioId/projects - Add project to portfolio
export async function POST(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const portfolio = await resolveEditablePortfolio(userId, portfolioId);
    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { workspaceId } = portfolio;

    const body = await req.json();
    const data = addProjectSchema.parse(body);

    // Scope the project being attached to the portfolio's workspace AND to
    // what the caller can read. Without the first, an attacker attaches an
    // arbitrary cross-workspace project (audit SEC-02); without the second, a
    // colleague holding a PRIVATE project's id attaches it and reads its
    // budget and progress back through the portfolio.
    await assertProjectInWorkspace(data.projectId, workspaceId, {
      readableBy: userId,
    });

    // Get max position
    const maxPosition = await prisma.portfolioProject.aggregate({
      where: { portfolioId },
      _max: { position: true },
    });

    let portfolioProject;
    try {
      portfolioProject = await prisma.portfolioProject.create({
        data: {
          portfolioId,
          projectId: data.projectId,
          position: (maxPosition._max.position || 0) + 1,
        },
        // Only what the page needs; it refetches the portfolio afterwards.
        select: {
          id: true,
          portfolioId: true,
          projectId: true,
          position: true,
          project: { select: { id: true, name: true, color: true } },
        },
      });
    } catch (e) {
      // @@unique([portfolioId, projectId]) — also covers two concurrent adds.
      if ((e as { code?: string })?.code === "P2002") {
        return NextResponse.json(
          { error: "Project already in portfolio" },
          { status: 400 }
        );
      }
      throw e;
    }

    return NextResponse.json(portfolioProject, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }

    console.error("Error adding project to portfolio:", error);
    return NextResponse.json(
      { error: "Failed to add project to portfolio" },
      { status: 500 }
    );
  }
}

// DELETE /api/portfolios/:portfolioId/projects - Remove project from portfolio
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const portfolio = await resolveEditablePortfolio(userId, portfolioId);
    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      );
    }

    const removed = await prisma.portfolioProject.deleteMany({
      where: { portfolioId, projectId },
    });
    if (removed.count === 0) {
      return NextResponse.json(
        { error: "Project is not in this portfolio" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error removing project from portfolio:", error);
    return NextResponse.json(
      { error: "Failed to remove project from portfolio" },
      { status: 500 }
    );
  }
}
