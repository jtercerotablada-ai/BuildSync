import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const inviteSchema = z.object({
  email: z.string().email(),
});

// POST /api/teams/:teamId/invite - Invite a user to the team
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

    const body = await req.json();
    const { email } = inviteSchema.parse(body);

    // Verify the team exists and user is a member
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        workspace: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const inviterMember = team.members.find((m) => m.userId === userId);
    if (!inviterMember) {
      return NextResponse.json(
        { error: "You must be a team member to invite others" },
        { status: 403 }
      );
    }

    // Find the user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!invitedUser) {
      // User doesn't exist in the system
      // In a real app, you might send an email invitation here
      return NextResponse.json(
        { error: "User not found. They need to register first." },
        { status: 404 }
      );
    }

    // Check if user is already a team member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: invitedUser.id,
          teamId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a team member" },
        { status: 400 }
      );
    }

    // Add user to the team
    const newMember = await prisma.teamMember.create({
      data: {
        userId: invitedUser.id,
        teamId,
        role: "MEMBER",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Also ensure user is a workspace member
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: invitedUser.id,
          workspaceId: team.workspaceId,
        },
      },
    });

    if (!workspaceMember) {
      await prisma.workspaceMember.create({
        data: {
          userId: invitedUser.id,
          workspaceId: team.workspaceId,
          role: "MEMBER",
        },
      });
    }

    return NextResponse.json({
      success: true,
      member: newMember,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      );
    }

    console.error("Error inviting to team:", error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
