import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/portfolios/:portfolioId/members
 *
 * Directory used by the @-mention typeahead in MessagesView. We
 * return: the explicit portfolio members + the portfolio owner +
 * (for PUBLIC portfolios) the rest of the workspace so anyone
 * reachable can be mentioned.
 *
 * Shape matches /api/projects/:id/members so the typeahead doesn't
 * need scope-aware code.
 */
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

    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        id: true,
        ownerId: true,
        privacy: true,
        workspaceId: true,
        members: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                jobTitle: true,
                position: true,
                customTitle: true,
              },
            },
          },
        },
      },
    });
    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Callers must be able to read the portfolio.
    const isCallerMember = portfolio.members.some((m) => m.user.id === userId);
    const isOwner = portfolio.ownerId === userId;
    const isPublic = portfolio.privacy === "PUBLIC";
    if (!isCallerMember && !isOwner && !isPublic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Start with the explicit members.
    const rows: Array<{
      id: string;
      role: string;
      joinedAt: string;
      user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
        jobTitle: string | null;
        position: string | null;
        customTitle: string | null;
      };
    }> = portfolio.members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    }));

    // Add the owner if missing from members.
    if (portfolio.ownerId && !rows.find((r) => r.user.id === portfolio.ownerId)) {
      const owner = await prisma.user.findUnique({
        where: { id: portfolio.ownerId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          jobTitle: true,
          position: true,
          customTitle: true,
        },
      });
      if (owner) {
        rows.unshift({
          id: `owner-${owner.id}`,
          role: "OWNER",
          joinedAt: new Date(0).toISOString(),
          user: owner,
        });
      }
    }

    // For PUBLIC portfolios, expand the audience to anyone in the
    // workspace so they can be @-mentioned. We tag those with
    // role "WORKSPACE" so the UI can dim them if needed.
    if (portfolio.privacy === "PUBLIC") {
      const existingIds = new Set(rows.map((r) => r.user.id));
      const wsMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: portfolio.workspaceId },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              jobTitle: true,
              position: true,
              customTitle: true,
            },
          },
        },
      });
      for (const wm of wsMembers) {
        if (existingIds.has(wm.user.id)) continue;
        rows.push({
          id: `ws-${wm.user.id}`,
          role: "WORKSPACE",
          joinedAt: new Date(0).toISOString(),
          user: wm.user,
        });
      }
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[portfolio members GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
