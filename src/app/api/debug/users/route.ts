import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/debug/users - Get all users (DEBUG ONLY)
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        workspaceMembers: {
          select: {
            id: true,
            role: true,
            workspaceId: true,
            workspace: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        teamMembers: {
          select: {
            id: true,
            role: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        privacy: true,
        workspaceId: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            teams: true,
          },
        },
      },
    });

    return NextResponse.json({
      summary: {
        totalUsers: users.length,
        totalTeams: teams.length,
        totalWorkspaces: workspaces.length,
      },
      users,
      teams,
      workspaces,
    });
  } catch (error) {
    console.error("Error fetching debug data:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug data", details: String(error) },
      { status: 500 }
    );
  }
}
