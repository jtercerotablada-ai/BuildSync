import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { teamArchiveWhere } from "@/lib/team-access";

// GET /api/teams/list - Get all teams the user is a member of
//
// Archived teams are OUT by default — this list feeds the sidebar, the Goals
// team picker and the dashboard widget, and an archived team must not be
// offered as somewhere to file new work. `?archived=true` returns the archive
// on its own, `?archived=all` returns both (see teamArchiveWhere).
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // "My teams" = every team where I'm a member — the membership filter is
    // the correct scope on its own. We deliberately do NOT filter by a single
    // workspace: that was the bug. Team membership isn't bound to the user's
    // "primary" workspace, so scoping to one workspace (previously the unstable
    // workspaceMembers[0], which for multi-workspace users resolved to their
    // personal signup singleton) dropped real teams from the list even though
    // the user belongs to them. members.some.userId already guarantees the user
    // only ever sees teams they're actually in.
    const { searchParams } = new URL(req.url);

    const teams = await prisma.team.findMany({
      where: {
        ...teamArchiveWhere(searchParams.get("archived")),
        members: {
          some: {
            userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        privacy: true,
        // So a screen that asks for the archive can badge the rows, and the
        // Teams page can tell "you have no teams" apart from "your teams are
        // all archived".
        isArchived: true,
        archivedAt: true,
        _count: {
          select: {
            objectives: true,
            members: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}
