import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { AuthorizationError, getErrorStatus } from "@/lib/auth-guards";
import { sendInvitationEmail } from "@/lib/email";
import { notifyMembershipGranted } from "@/lib/membership-notifications";
import { WORKSPACE_ROLE_META } from "@/lib/people-types";

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
      throw new AuthorizationError("You must be a team member to invite others");
    }

    // Only team LEADs or workspace ADMIN/OWNER can invite members
    if (inviterMember.role !== "LEAD") {
      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: team.workspaceId } },
        select: { role: true },
      });
      if (!workspaceMember || (workspaceMember.role !== "ADMIN" && workspaceMember.role !== "OWNER")) {
        throw new AuthorizationError("Only team leads or workspace admins can invite members");
      }
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find the user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!invitedUser) {
      // Non-member email → don't dead-end with a 404. Create/refresh a
      // workspace-level invitation so they can join the workspace (and,
      // once in, be added to the team) and email them the magic link.
      // Upsert on the (email, workspaceId) unique key so re-inviting a
      // previously ACCEPTED/DECLINED/EXPIRED address doesn't 500.
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await prisma.workspaceInvitation.upsert({
        where: {
          email_workspaceId: {
            email: normalizedEmail,
            workspaceId: team.workspaceId,
          },
        },
        create: {
          email: normalizedEmail,
          role: "MEMBER",
          token,
          expiresAt,
          workspaceId: team.workspaceId,
          inviterId: userId,
          // Bind the invite to THIS team so acceptance adds them as a
          // TeamMember (not just a workspace member).
          teamId,
        },
        update: {
          role: "MEMBER",
          status: "PENDING",
          token,
          expiresAt,
          inviterId: userId,
          acceptedAt: null,
          acceptedUserId: null,
          teamId,
        },
      });

      // Best-effort email — keep the row even if delivery fails so the
      // admin can resend from the People/Settings invitation list.
      const inviter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      const inviterName = inviter?.name || inviter?.email || "A teammate";
      try {
        await sendInvitationEmail({
          email: normalizedEmail,
          token: invitation.token,
          inviterName,
          workspaceName: team.workspace.name,
          roleLabel: WORKSPACE_ROLE_META.MEMBER?.label || "Member",
          personalMessage: null,
          projectName: null,
        });
      } catch (mailErr) {
        console.error(
          "[team invite] email send failed — invitation kept:",
          mailErr
        );
        return NextResponse.json(
          {
            invited: true,
            email: normalizedEmail,
            warning:
              "Invitation saved but email delivery failed. Resend from Settings.",
          },
          { status: 201 }
        );
      }

      return NextResponse.json(
        { invited: true, email: normalizedEmail },
        { status: 201 }
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
    const existingWorkspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: invitedUser.id,
          workspaceId: team.workspaceId,
        },
      },
    });

    if (!existingWorkspaceMember) {
      await prisma.workspaceMember.create({
        data: {
          userId: invitedUser.id,
          workspaceId: team.workspaceId,
          role: "MEMBER",
        },
      });
    }

    // Let the added member know via their Inbox that they're now on the
    // team (they didn't request it). Best-effort; never blocks the response.
    await notifyMembershipGranted({
      userId: invitedUser.id,
      type: "TEAM_INVITATION",
      title: `You were added to ${team.name}`,
      data: { teamId },
    });

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

    if (error instanceof AuthorizationError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }

    console.error("Error inviting to team:", error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
