import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/teams/:teamId/work - Get team's work items (projects, etc.)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify team exists and user has access
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get projects associated with this team
    const projects = await prisma.project.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        status: true,
        description: true,
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Transform projects to work items format
    const workItems = projects.map((project) => ({
      id: project.id,
      name: project.name,
      type: "project" as const,
      color: project.color,
      icon: project.icon,
      status: project.status,
      description: project.description,
      _count: project._count,
    }));

    return NextResponse.json(workItems);
  } catch (error) {
    console.error("Error fetching team work:", error);
    return NextResponse.json(
      { error: "Failed to fetch team work" },
      { status: 500 }
    );
  }
}
