import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  AuthorizationError,
  contributorSeatSatisfied,
  getErrorStatus,
} from "@/lib/auth-guards";
import {
  requireTeamStanding,
  requireTeamMemberManagement,
  assertTeamAcceptsNewMembers,
} from "@/lib/team-access";
import { sendInvitationEmail } from "@/lib/email";
import { notifyMembershipGranted } from "@/lib/membership-notifications";
import { WORKSPACE_ROLE_META } from "@/lib/people-types";

const inviteSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/teams/:teamId/invite — invite somebody to a team by email.
 *
 * WHO MAY CALL IT: a team LEAD, or an OWNER/ADMIN of the team's workspace.
 * The page must ask GET /api/teams/:teamId/members?viewer=1 for
 * `viewer.canManageMembers` before it renders the button — it used to render
 * for every member, and a colleague who typed an address got
 * "Only team leads or workspace admins can invite members" after the fact.
 *
 * WHAT IT WILL NOT DO ANY MORE: create a WorkspaceMember row. This route
 * looked up ANY registered account by email, added the TeamMember, and then
 * minted a workspace seat with role MEMBER if the account did not have one —
 * so any team lead could pull any existing account in the database into the
 * firm's workspace, silently, with no workspace-admin approval anywhere.
 *
 * A team is a grouping INSIDE a workspace, never a side door into one, so the
 * two cases are now separate:
 *
 *   • the invitee already holds a contributor seat → they are added to the
 *     team directly, exactly as before;
 *
 *   • the invitee is an outsider (no account, or an account with no seat
 *     here) → only a workspace OWNER/ADMIN may proceed, and even they do not
 *     create the seat: a WorkspaceInvitation bound to this team is
 *     created/refreshed and emailed, and the seat appears when the INVITEE
 *     accepts it (POST /api/invite/:token/accept, which also adds the
 *     TeamMember). That path is auditable — it records who invited whom — and
 *     it is the one place in the product designed to grant a seat.
 *
 * A GUEST/CLIENT seat is refused outright: a team grant is Editor-level on
 * every project attached to the team, which is exactly the capability those
 * roles are defined not to have, so `resolveProjectAccess` drops the grant
 * for them and the row would buy nothing but a misleading name in the
 * members table.
 */
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

    // One rule for the whole team surface (@/lib/team-access): team
    // membership plus a live contributor seat to be here at all, LEAD or
    // workspace OWNER/ADMIN to add anyone.
    const standing = await requireTeamStanding(userId, teamId);
    requireTeamMemberManagement(standing);
    assertTeamAcceptsNewMembers(standing);

    const workspaceId = standing.workspaceId;
    const normalizedEmail = email.toLowerCase().trim();

    // Find the user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    // The invitee's standing in THIS workspace decides which of the two paths
    // below applies. Looked up once, here, so the branches cannot disagree.
    const inviteeSeat = invitedUser
      ? await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: { userId: invitedUser.id, workspaceId },
          },
          select: { role: true },
        })
      : null;

    // A seat that exists but is read-only is a definite NO, not an outsider
    // to be invited: re-inviting them would only mint a second invitation for
    // an address that is already inside the workspace.
    if (inviteeSeat && !contributorSeatSatisfied(inviteeSeat.role)) {
      throw new AuthorizationError(
        "That account is a view-only member of this workspace and can't be added to a team. Change their workspace role first."
      );
    }

    if (!invitedUser || !inviteeSeat) {
      // ── Outsider path ────────────────────────────────────────────────
      // No account at all, or an account with no seat in this workspace.
      // Bringing somebody INTO the firm is workspace leadership's call, not
      // a team lead's.
      if (!standing.canInviteOutsiders) {
        throw new AuthorizationError(
          `${normalizedEmail} isn't in this workspace yet. Ask a workspace admin to invite them, then you can add them to the team.`
        );
      }

      // Create/refresh a workspace-level invitation bound to THIS team and
      // email them the magic link. Accepting it creates the WorkspaceMember
      // AND the TeamMember in one transaction — the accept route handles a
      // brand-new email and an existing account that simply has to sign in.
      // Upsert on the (email, workspaceId) unique key so re-inviting a
      // previously ACCEPTED/DECLINED/EXPIRED address doesn't 500.
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await prisma.workspaceInvitation.upsert({
        where: {
          email_workspaceId: {
            email: normalizedEmail,
            workspaceId,
          },
        },
        create: {
          email: normalizedEmail,
          role: "MEMBER",
          token,
          expiresAt,
          workspaceId,
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
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });
      try {
        await sendInvitationEmail({
          email: normalizedEmail,
          token: invitation.token,
          inviterName,
          workspaceName: workspace?.name ?? "the workspace",
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

    // ── Insider path ─────────────────────────────────────────────────────
    // Already holds a contributor seat here, so adding them to the team
    // grants nothing they could not already have been granted.
    const insiderId = invitedUser.id;

    const existingMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: insiderId,
          teamId,
        },
      },
      select: { id: true },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a team member" },
        { status: 400 }
      );
    }

    const newMember = await prisma.teamMember.create({
      data: {
        userId: insiderId,
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

    // Let the added member know via their Inbox that they're now on the
    // team (they didn't request it). Best-effort; never blocks the response.
    await notifyMembershipGranted({
      userId: insiderId,
      type: "TEAM_INVITATION",
      title: `You were added to ${standing.teamName}`,
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

    // Covers AuthorizationError (403) and NotFoundError (404) — the latter is
    // how requireTeamStanding hides a team from a caller with no seat in its
    // workspace, and it used to fall through to the generic 500 below.
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }

    console.error("Error inviting to team:", error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
