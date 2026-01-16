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

    // Get user's workspace
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMembers: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!user || user.workspaceMembers.length === 0) {
      return NextResponse.json([]);
    }

    const workspaceId = user.workspaceMembers[0].workspaceId;

    // Get all teams in the workspace that the user is a member of
    const teams = await prisma.team.findMany({
      where: {
        workspaceId,
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
