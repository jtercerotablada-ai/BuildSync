import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getErrorStatus } from "@/lib/auth-guards";
import {
  requireTeamStanding,
  requireTeamMemberManagement,
  assertTeamAcceptsNewMembers,
  assertWorkspaceContributors,
} from "@/lib/team-access";
import { notifyMembershipGranted } from "@/lib/membership-notifications";

/**
 * PATCH /api/teams/:teamId/requests/:requestId — approve or decline.
 *
 * The whole point of this file is the transaction: the status change and
 * the TeamMember row are written together. A half-applied approval is a
 * person who was told yes and is not in the team — they'd see "approved"
 * in their Inbox and still get "You don't have access to this team".
 */

const decideSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; requestId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId, requestId } = await params;

    const notFound = NextResponse.json(
      { error: "Request not found" },
      { status: 404 }
    );

    // One rule for the whole team surface (@/lib/team-access): a live
    // contributor seat in the team's OWN workspace to be here at all — which
    // also hides the team from a caller in another workspace — and then LEAD
    // or workspace OWNER/ADMIN to decide. This route hand-rolled a LEAD-only
    // check, so a workspace owner who may add and remove this team's members
    // could not answer a request to join one.
    const standing = await requireTeamStanding(userId, teamId);
    requireTeamMemberManagement(standing);

    const body = await req.json().catch(() => ({}));
    const { status } = decideSchema.parse(body ?? {});

    // Scoped by teamId as well as id, so a lead of team A cannot decide a
    // request belonging to team B by guessing its id.
    const request = await prisma.teamJoinRequest.findFirst({
      where: { id: requestId, teamId },
      select: { id: true, status: true, userId: true },
    });
    if (!request) return notFound;

    if (status === "APPROVED") {
      // Re-checked at the DECISION, not only at the ask. A request outlives
      // both of the things that could invalidate it: the team can be archived
      // (POST /invite and POST /members both refuse an archived team, so
      // approving into one would be the third door disagreeing again), and the
      // requester can be offboarded — DELETE /api/workspace/members deletes
      // their TeamMember rows but nothing cascades to a TeamJoinRequest, so a
      // stale row is still sitting in the queue with an Approve button.
      assertTeamAcceptsNewMembers(standing);
      await assertWorkspaceContributors([request.userId], standing.workspaceId);
    }

    const decided = await prisma.$transaction(async (tx) => {
      // Claim the row conditionally: two leads clicking Approve at the same
      // moment means exactly one of these updates matches a PENDING row,
      // and only that one goes on to create the membership.
      const claimed = await tx.teamJoinRequest.updateMany({
        where: { id: requestId, teamId, status: "PENDING" },
        data: { status, decidedById: userId, decidedAt: new Date() },
      });
      if (claimed.count === 0) return { changed: false };

      if (status === "APPROVED") {
        const existing = await tx.teamMember.findUnique({
          where: { userId_teamId: { userId: request.userId, teamId } },
          select: { id: true },
        });
        if (!existing) {
          await tx.teamMember.create({
            data: { teamId, userId: request.userId, role: "MEMBER" },
          });
        }
      }
      return { changed: true };
    });

    const fresh = await prisma.teamJoinRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        decidedAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Only notify on the transition. Re-sending the same decision is a
    // no-op (idempotent by contract) and must not re-notify the requester.
    if (decided.changed) {
      await notifyMembershipGranted({
        userId: request.userId,
        type: "TEAM_INVITATION",
        title:
          status === "APPROVED"
            ? `You're now on ${standing.teamName}`
            : `Your request to join ${standing.teamName} wasn't approved`,
        message:
          status === "APPROVED"
            ? "Your request to join was approved."
            : "Ask a team lead if you think you should have access.",
        data: { teamId },
      });
    }

    return NextResponse.json({ request: fresh, changed: decided.changed });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    // requireTeamStanding (404), requireTeamMemberManagement (403) and the two
    // approval preconditions (403, with the reason the lead needs to read)
    // all throw; without this they would surface as "Failed to update join
    // request", which tells the lead nothing about why.
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deciding team join request:", error);
    return NextResponse.json(
      { error: "Failed to update join request" },
      { status: 500 }
    );
  }
}
