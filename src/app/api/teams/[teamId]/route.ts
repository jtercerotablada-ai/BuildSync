import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  avatar: z.string().optional().nullable(),
  privacy: z.enum(["PUBLIC", "REQUEST_TO_JOIN", "PRIVATE"]).optional(),
});

// GET /api/teams/:teamId - Get team details
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

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                jobTitle: true,
              },
            },
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
        objectives: {
          select: {
            id: true,
            name: true,
            progress: true,
            status: true,
          },
          take: 5,
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            projects: true,
            members: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check access - user must be a member of the workspace or team
    const isMember = team.members.some((m) => m.userId === userId);

    if (!isMember && team.privacy === "PRIVATE") {
      // Check workspace membership
      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: team.workspaceId,
          },
        },
      });

      if (!workspaceMember) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team" },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/:teamId - Update team
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateTeamSchema.parse(body);

    // Check if user has edit access (must be team lead)
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (teamMember.role !== "LEAD") {
      return NextResponse.json(
        { error: "Only team leads can edit team settings" },
        { status: 403 }
      );
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                jobTitle: true,
              },
            },
          },
        },
        objectives: {
          select: {
            id: true,
            name: true,
            progress: true,
            status: true,
          },
        },
        _count: {
          select: {
            projects: true,
            members: true,
          },
        },
      },
    });

    return NextResponse.json(updatedTeam);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating team:", error);
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId - Delete team
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is team lead
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!teamMember || teamMember.role !== "LEAD") {
      return NextResponse.json(
        { error: "Only team leads can delete the team" },
        { status: 403 }
      );
    }

    await prisma.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    );
  }
}
