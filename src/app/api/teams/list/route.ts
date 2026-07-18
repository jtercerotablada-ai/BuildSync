import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/teams/list - Get all teams the user is a member of
export async function GET() {
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
    const teams = await prisma.team.findMany({
      where: {
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
