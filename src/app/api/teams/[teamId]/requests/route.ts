import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { contributorSeatSatisfied, getErrorStatus } from "@/lib/auth-guards";
import {
  requireTeamStanding,
  requireTeamMemberManagement,
} from "@/lib/team-access";
import { notifyMembershipGranted } from "@/lib/membership-notifications";

/**
 * /api/teams/:teamId/requests — the queue that makes "Membership by
 * request" mean something.
 *
 * Before this existed, Team.privacy = REQUEST_TO_JOIN was stored and then
 * ignored: /api/teams/:teamId/join treated it exactly like PUBLIC, so a
 * team labelled "a member has to request to join" let every workspace
 * member walk straight in. POST here creates the PENDING row instead;
 * GET is the review queue for whoever may manage the team's membership.
 *
 * Disclosure rule, same one teamVisibilityClause() enforces for search:
 * a caller outside the team's workspace — and a non-member of a PRIVATE
 * team — gets 404, never 403. A 403 confirms the id names a real team and
 * hands a stranger the fact that it exists.
 */

const createRequestSchema = z.object({
  message: z.string().trim().max(500).optional(),
});

/**
 * Resolve the team for a caller, applying the disclosure rule above.
 * Returns either the team plus the caller's team membership, or the
 * NextResponse to send back instead.
 *
 * NOT requireTeamStanding: that one refuses a non-member outright, and a
 * non-member is exactly who POSTs here. The seat rule it enforces is applied
 * below by hand for the same reason.
 */
async function resolveVisibleTeam(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      privacy: true,
      isArchived: true,
      workspaceId: true,
    },
  });
  const notFound = NextResponse.json(
    { error: "Team not found" },
    { status: 404 }
  );
  if (!team) return { error: notFound };

  // A CONTRIBUTOR seat, not merely a WorkspaceMember row. A GUEST/CLIENT seat
  // is read-only by design, and approving their request would create a
  // TeamMember row that buys them nothing — every team read goes through
  // requireTeamStanding, which refuses the same seat and answers "Team not
  // found" on a team their sidebar is listing. Refusing at the ask is the
  // honest place: the alternative is a request a lead can approve into a
  // membership that does not work.
  const inWorkspace = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: team.workspaceId } },
    select: { role: true },
  });
  if (!contributorSeatSatisfied(inWorkspace?.role)) return { error: notFound };

  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });

  // A PRIVATE team does not exist as far as a non-member is concerned.
  if (team.privacy === "PRIVATE" && !membership) return { error: notFound };

  return { team, membership };
}

/**
 * POST /api/teams/:teamId/requests — ask to join.
 *
 * Upsert rather than create: @@unique([teamId, userId]) means one row per
 * person per team, so re-asking after a DECLINE reopens the same row to
 * PENDING instead of erroring on the constraint or stacking duplicates in
 * the lead's queue.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId } = await params;

    const resolved = await resolveVisibleTeam(userId, teamId);
    if ("error" in resolved) return resolved.error;
    const { team, membership } = resolved;

    if (membership) {
      return NextResponse.json(
        { error: "You're already on this team" },
        { status: 409 }
      );
    }

    if (team.isArchived) {
      return NextResponse.json(
        { error: "This team is archived and isn't taking new members." },
        { status: 400 }
      );
    }

    if (team.privacy !== "REQUEST_TO_JOIN") {
      return NextResponse.json(
        {
          error:
            team.privacy === "PUBLIC"
              ? "This team is open — you can join it directly."
              : "This team doesn't accept join requests.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { message } = createRequestSchema.parse(body ?? {});
    const note = message && message.length > 0 ? message : null;

    const request = await prisma.teamJoinRequest.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: { teamId, userId, message: note, status: "PENDING" },
      update: {
        status: "PENDING",
        message: note,
        // Clear the previous verdict — this is a new ask, and leaving the
        // old decider stamped on a PENDING row would render as "declined
        // by Ana" next to an open request.
        decidedById: null,
        decidedAt: null,
      },
      select: { id: true, status: true, message: true, createdAt: true },
    });

    // Tell everyone who can act on it. Best-effort by design:
    // notifyMembershipGranted never throws, so a failed Inbox write cannot
    // roll back a request the requester was just told we saved.
    const leads = await prisma.teamMember.findMany({
      where: { teamId, role: "LEAD" },
      select: { userId: true },
    });
    // A team can end up with no LEAD at all — the only one leaves the firm.
    // Workspace OWNER/ADMINs may decide requests (requireTeamMemberManagement),
    // so they are who this reaches when there is nobody else; otherwise the
    // request would sit in a queue no notification points at.
    const reviewers =
      leads.length > 0
        ? leads
        : await prisma.workspaceMember.findMany({
            where: {
              workspaceId: team.workspaceId,
              role: { in: ["OWNER", "ADMIN"] },
            },
            select: { userId: true },
          });
    const requester = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const who = requester?.name || requester?.email || "Someone";
    await Promise.all(
      reviewers.map((reviewer) =>
        notifyMembershipGranted({
          userId: reviewer.userId,
          type: "TEAM_INVITATION",
          title: `${who} asked to join ${team.name}`,
          message: note ?? "Review it on the team's Members tab.",
          data: { teamId },
        })
      )
    );

    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating team join request:", error);
    return NextResponse.json(
      { error: "Failed to send join request" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teams/:teamId/requests — the review queue.
 * PENDING first, so the rows that need a decision are never below the
 * history of ones already handled.
 *
 * Open to whoever may manage this team's membership — LEAD or workspace
 * OWNER/ADMIN, the set requireTeamMemberManagement defines. A lead-only queue
 * reinstated the bug team-access.ts exists to kill: when the team's only LEAD
 * leaves the firm, a workspace owner can add, remove and re-role that team's
 * members but cannot see, let alone answer, a single pending request.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId } = await params;

    const standing = await requireTeamStanding(userId, teamId);
    requireTeamMemberManagement(standing);

    const rows = await prisma.teamJoinRequest.findMany({
      where: { teamId },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        decidedAt: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // PENDING first — ordering in SQL would need a CASE expression Prisma
    // can't express, and this list is one screenful of a 3-person firm.
    const requests = [
      ...rows.filter((r) => r.status === "PENDING"),
      ...rows.filter((r) => r.status !== "PENDING"),
    ];

    return NextResponse.json({ requests });
  } catch (error) {
    // requireTeamStanding answers 404 for a caller with no seat (and for a
    // non-member of a PRIVATE team) and requireTeamMemberManagement 403 for a
    // plain member; both would otherwise fall through to the 500 below.
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error listing team join requests:", error);
    return NextResponse.json(
      { error: "Failed to load join requests" },
      { status: 500 }
    );
  }
}
