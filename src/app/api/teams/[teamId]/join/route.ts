import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { contributorSeatSatisfied } from "@/lib/auth-guards";

/**
 * POST /api/teams/:teamId/join
 *
 * Self-join endpoint for the "Copy invite link" flow in InviteTeamModal.
 * Adds the current user to the team as MEMBER if:
 *  - they're authenticated,
 *  - they hold a CONTRIBUTOR seat in the team's workspace (GUEST/CLIENT are
 *    read-only and get nothing from a team grant — see below),
 *  - the team is PUBLIC.
 *
 * REQUEST_TO_JOIN used to land here and self-join exactly like PUBLIC,
 * which made the privacy label a lie: a team whose setting reads
 * "membership by request" admitted anyone in the workspace with the link
 * and never asked a lead. It now answers 409 and points at
 * POST /api/teams/:teamId/requests, which opens a PENDING row instead.
 * PRIVATE still refuses outright.
 *
 * Disclosure rule (same one teamVisibilityClause() enforces for search):
 * a caller outside the workspace, and a non-member of a PRIVATE team, get
 * 404 rather than 403 — a 403 confirms that the id names a real team.
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
      select: {
        id: true,
        name: true,
        workspaceId: true,
        privacy: true,
        isArchived: true,
      },
    });
    const notFound = NextResponse.json(
      { error: "Team not found" },
      { status: 404 }
    );
    if (!team) return notFound;

    // A live CONTRIBUTOR seat in the team's workspace is required — invite
    // links are intra-workspace, and a bare existence check was not enough.
    // A GUEST/CLIENT seat is read-only by design: `resolveProjectAccess` drops
    // the team's Editor grant for them, so self-joining would buy nothing but
    // a misleading name in the members table and a team in their sidebar whose
    // every tab answers "Team not found" (requireTeamStanding refuses the same
    // seat). Same rule assertWorkspaceContributors enforces for /invite and
    // POST /members — this was the remaining door without the lock.
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: team.workspaceId },
      },
      select: { role: true },
    });
    if (!contributorSeatSatisfied(wsMember?.role)) return notFound;

    // Already on the team: say so before any privacy branch, so a member
    // of a PRIVATE team re-opening their own invite link isn't told the
    // team doesn't exist.
    const existing = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (existing) {
      return NextResponse.json({ joined: true, alreadyMember: true });
    }

    if (team.privacy === "PRIVATE") return notFound;

    if (team.privacy === "REQUEST_TO_JOIN") {
      return NextResponse.json(
        {
          error: "This team reviews membership requests.",
          requiresRequest: true,
        },
        { status: 409 }
      );
    }

    if (team.isArchived) {
      return NextResponse.json(
        { error: "This team is archived and isn't taking new members." },
        { status: 400 }
      );
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
