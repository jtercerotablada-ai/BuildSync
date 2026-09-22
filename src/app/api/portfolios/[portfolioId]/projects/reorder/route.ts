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
import { isNonContributorRole } from "@/lib/workspace-roles";

const reorderSchema = z.object({
  projectIds: z.array(z.string().min(1)).min(1),
});

// PATCH /api/portfolios/:portfolioId/projects/reorder
// Body: { projectIds: string[] } — the new order, top to bottom.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const wsMember = await verifyWorkspaceAccess(userId, portfolio.workspaceId);

    // Owner, member OWNER/EDITOR or workspace OWNER/ADMIN, from a contributor
    // seat — same edit rule as decidePortfolioAccess in ../../route.ts.
    const memberRole = portfolio.members[0]?.role;
    const canEdit =
      !isNonContributorRole(wsMember.role) &&
      (portfolio.ownerId === userId ||
        wsMember.role === "OWNER" ||
        wsMember.role === "ADMIN" ||
        memberRole === "OWNER" ||
        memberRole === "EDITOR");
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const data = reorderSchema.parse(body);

    // Every supplied id must belong to this portfolio, once.
    const existing = await prisma.portfolioProject.findMany({
      where: { portfolioId },
      select: { projectId: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
    const existingIds = new Set(existing.map((e) => e.projectId));
    if (new Set(data.projectIds).size !== data.projectIds.length) {
      return NextResponse.json(
        { error: "Each project may appear only once" },
        { status: 400 }
      );
    }
    for (const id of data.projectIds) {
      if (!existingIds.has(id)) {
        return NextResponse.json(
          { error: `Project ${id} is not in this portfolio` },
          { status: 400 }
        );
      }
    }

    // The page cannot name rows it was never sent (projects the caller may
    // not read), so rows missing from the list keep their relative order
    // after the supplied ones. Renumbering the WHOLE table this way keeps
    // positions unique — renumbering only the supplied rows 1..n would
    // collide with the omitted ones' old positions.
    const supplied = new Set(data.projectIds);
    const finalOrder = [
      ...data.projectIds,
      ...existing.map((e) => e.projectId).filter((id) => !supplied.has(id)),
    ];

    await prisma.$transaction(
      finalOrder.map((projectId, index) =>
        prisma.portfolioProject.update({
          where: {
            portfolioId_projectId: { portfolioId, projectId },
          },
          data: { position: index + 1 },
        })
      )
    );

    return NextResponse.json({ success: true });
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
    // A row removed between the read and the write above.
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { error: "The portfolio changed — refresh and try again" },
        { status: 409 }
      );
    }
    console.error("Error reordering portfolio projects:", error);
    return NextResponse.json(
      { error: "Failed to reorder projects" },
      { status: 500 }
    );
  }
}
