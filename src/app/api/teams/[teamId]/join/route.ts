import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * POST /api/teams/:teamId/join
 *
 * Self-join endpoint for the "Copy invite link" flow in InviteTeamModal.
 * Adds the current user to the team as MEMBER if:
 *  - they're authenticated,
 *  - they're a member of the team's workspace,
 *  - the team isn't private (PUBLIC and REQUEST_TO_JOIN are joinable;
 *    PRIVATE teams require a lead-initiated invite).
 *
 * Idempotent: if the user is already a team member, returns success.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId } = await params;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, workspaceId: true, privacy: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Workspace membership is required — invite links are intra-workspace.
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: team.workspaceId },
      },
    });
    if (!wsMember) {
      return NextResponse.json(
        { error: "You don't belong to this workspace" },
        { status: 403 }
      );
    }

    if (team.privacy === "PRIVATE") {
      return NextResponse.json(
        { error: "This team is private. Ask a Lead to invite you." },
        { status: 403 }
      );
    }

    const existing = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (existing) {
      return NextResponse.json({ joined: true, alreadyMember: true });
    }

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ joined: true, alreadyMember: false });
  } catch (err) {
    console.error("[teams/join] error:", err);
    return NextResponse.json(
      { error: "Failed to join team" },
      { status: 500 }
    );
  }
}
