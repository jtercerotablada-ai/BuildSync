import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getPrimaryWorkspaceMembership } from "@/lib/auth-guards";
import { buildProjectVisibilityClauses } from "@/lib/project-visibility";
import type { Prisma } from "@prisma/client";

// GET /api/work/search - Search for work items (projects) the caller can link
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    // The team doing the linking: its own projects are already on its list,
    // so they are left out of the results.
    const excludeTeamId = searchParams.get("teamId");

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Resolve the caller's workspace; linking is scoped to it.
    const workspaceMember = await getPrimaryWorkspaceMembership(userId);

    if (!workspaceMember) {
      return NextResponse.json([]);
    }

    // READ: the canonical list rule, so this search can never surface a
    // project the caller could not open anywhere else.
    const visibilityClauses = await buildProjectVisibilityClauses(userId);
    if (!visibilityClauses) {
      return NextResponse.json([]);
    }

    // MANAGE: POST /api/teams/[teamId]/work requires canManage (owner,
    // project ADMIN, or workspace OWNER/ADMIN — see decideProjectCapabilities),
    // because linking shares the project with the whole team. Offering
    // projects the caller can only read or edit ended every pick in a 403.
    const isWorkspaceManager =
      workspaceMember.role === "OWNER" || workspaceMember.role === "ADMIN";
    const manageFilter: Prisma.ProjectWhereInput = isWorkspaceManager
      ? {}
      : {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: "ADMIN" } } },
          ],
        };

    const projects = await prisma.project.findMany({
      where: {
        AND: [
          {
            workspaceId: workspaceMember.workspaceId,
            name: {
              contains: query,
              mode: "insensitive",
            },
            // The team's work list shows active projects only, so linking an
            // archived one reported success and then never appeared.
            isArchived: false,
            ...(excludeTeamId
              ? { OR: [{ teamId: null }, { teamId: { not: excludeTeamId } }] }
              : {}),
          },
          { OR: visibilityClauses },
          manageFilter,
        ],
      },
      select: {
        id: true,
        name: true,
        color: true,
        team: {
          select: {
            id: true,
            name: true,
            privacy: true,
            members: { where: { userId }, select: { userId: true } },
          },
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 10,
    });

    // Map to work items format
    const results = projects.map((p) => ({
      id: p.id,
      name: p.name,
      type: "project" as const,
      color: p.color,
      // The team the project already belongs to, so the picker can warn that
      // linking moves it. A PRIVATE team's name stays hidden from anyone who
      // is neither on it nor a workspace manager.
      team: p.team
        ? {
            id: p.team.id,
            name:
              p.team.privacy === "PRIVATE" &&
              p.team.members.length === 0 &&
              !isWorkspaceManager
                ? null
                : p.team.name,
          }
        : null,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error searching work:", error);
    return NextResponse.json(
      { error: "Failed to search work" },
      { status: 500 }
    );
  }
}
