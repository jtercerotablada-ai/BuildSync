import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";

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

    const workspaceId = await getUserWorkspaceId(userId);
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
    if (!portfolio || portfolio.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isPortfolioOwner = portfolio.ownerId === userId;
    const memberRole = portfolio.members[0]?.role;
    const canEdit =
      isPortfolioOwner ||
      memberRole === "OWNER" ||
      memberRole === "EDITOR";
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const data = reorderSchema.parse(body);

    // Validate that all provided project IDs belong to this portfolio.
    const existing = await prisma.portfolioProject.findMany({
      where: { portfolioId },
      select: { projectId: true },
    });
    const existingIds = new Set(existing.map((e) => e.projectId));
    for (const id of data.projectIds) {
      if (!existingIds.has(id)) {
        return NextResponse.json(
          { error: `Project ${id} is not in this portfolio` },
          { status: 400 }
        );
      }
    }

    // Apply the new positions. We don't try to be clever about diffs:
    // a portfolio rarely has hundreds of projects, so just rewrite all.
    await prisma.$transaction(
      data.projectIds.map((projectId, index) =>
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
    console.error("Error reordering portfolio projects:", error);
    return NextResponse.json(
      { error: "Failed to reorder projects" },
      { status: 500 }
    );
  }
}
