import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, assertProjectInWorkspace, getErrorStatus } from "@/lib/auth-guards";

// POST /api/teams/:teamId/work - Link work to team
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this team
    await verifyTeamAccess(userId, teamId);

    const body = await req.json();
    const { workId, workType, customName, description } = body;

    // Link the project to the team
    if (workType === "project") {
      if (!workId) {
        return NextResponse.json({ error: "workId is required" }, { status: 400 });
      }
      // Scope the target project to THIS team's workspace before mutating it.
      // Without this, workId is trusted straight from the body, letting any
      // team member re-parent and rename ANY project in the database — audit SEC-01.
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { workspaceId: true },
      });
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      await assertProjectInWorkspace(workId, team.workspaceId);

      const project = await prisma.project.update({
        where: { id: workId },
        data: {
          teamId: teamId,
          name: customName || undefined,
          description: description || undefined,
        },
      });
      return NextResponse.json(project);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error linking work to team:", error);
    return NextResponse.json(
      { error: "Failed to link work" },
      { status: 500 }
    );
  }
}

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

    // Verify user has access to this team
    await verifyTeamAccess(userId, teamId);

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
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching team work:", error);
    return NextResponse.json(
      { error: "Failed to fetch team work" },
      { status: 500 }
    );
  }
}
