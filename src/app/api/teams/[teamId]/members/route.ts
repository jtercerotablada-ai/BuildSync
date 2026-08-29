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
  type TeamStanding,
} from "@/lib/team-access";
import { notifyMembershipGranted } from "@/lib/membership-notifications";

const updateMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["LEAD", "MEMBER"]),
});

/**
 * Add-member body. Accepts one id or a list, because "Add member" on the
 * members grid adds one person and the create/settings flows add several.
 */
const addMembersSchema = z.union([
  z
    .object({ userId: z.string().min(1) })
    .transform((v) => ({ userIds: [v.userId] })),
  z.object({ userIds: z.array(z.string().min(1)).min(1).max(50) }),
]);

/**
 * What the page needs to know about the CALLER before it draws anything.
 *
 * The Invite button used to render for everybody and work only for a lead:
 * a colleague filled in an email and got "Only team leads or workspace admins
 * can invite members" after the fact. The permission was only ever knowable
 * on the server, and no endpoint told the page — so this one does, opt-in via
 * `?viewer=1` so the plain array response every existing caller parses is
 * unchanged.
 */
function viewerPayload(userId: string, standing: TeamStanding) {
  return {
    userId,
    teamRole: standing.teamRole,
    isLead: standing.isLead,
    isMember: standing.isMember,
    workspaceRole: standing.workspaceRole,
    isWorkspaceManager: standing.isWorkspaceManager,
    /** Show/enable Add member, Invite, role menus and Remove. */
    canManageMembers: standing.canManageMembers,
    /** Show the invite-by-email field for people outside the workspace. */
    canInviteOutsiders: standing.canInviteOutsiders,
    /** False on an archived team — nobody can be added until it's restored. */
    canAddMembers: standing.canManageMembers && !standing.isArchived,
    isArchived: standing.isArchived,
  };
}

// GET /api/teams/:teamId/members - Get team members
// GET /api/teams/:teamId/members?viewer=1 - { members, viewer }
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

    // Team membership AND a live contributor seat in the team's workspace.
    const standing = await requireTeamStanding(userId, teamId);

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            // Position + customTitle are needed by the shared
            // MessagesView @-mention typeahead to render each
            // candidate's role next to their name.
            position: true,
            customTitle: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // LEAD first
        { joinedAt: "asc" },
      ],
    });

    const { searchParams } = new URL(req.url);
    if (searchParams.get("viewer") === "1") {
      return NextResponse.json({
        members,
        viewer: viewerPayload(userId, standing),
      });
    }

    // Default response shape is unchanged: a bare array.
    return NextResponse.json(members);
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams/:teamId/members — add colleagues who are ALREADY in the
 * workspace, by user id.
 *
 * "Add member" opened an invite-by-email / share-link dialog and nothing
 * else, so on a three-person firm the other two people — already sitting in
 * the workspace, already listed on the People screen — had to be sent an
 * email invitation to join a team. This is the missing verb.
 *
 * It is deliberately id-based and insider-only: `assertWorkspaceContributors`
 * refuses anyone without a live contributor seat here, so this endpoint can
 * never become the workspace side door that the by-email invite route used to
 * be (it created WorkspaceMember rows on a team lead's authority alone).
 * Outsiders still go through POST /api/teams/:teamId/invite, which a
 * workspace OWNER/ADMIN turns into a WorkspaceInvitation they accept
 * themselves.
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

    const standing = await requireTeamStanding(userId, teamId);
    requireTeamMemberManagement(standing);
    assertTeamAcceptsNewMembers(standing);

    const body = await req.json();
    const { userIds } = addMembersSchema.parse(body);
    const wanted = Array.from(new Set(userIds));

    // Every target must already hold a contributor seat in THIS team's
    // workspace. Throws 403 naming how many did not, rather than silently
    // dropping them — a member the caller asked for and never saw appear is
    // the same class of lie as the archive button that reported success.
    await assertWorkspaceContributors(wanted, standing.workspaceId);

    const existing = await prisma.teamMember.findMany({
      where: { teamId, userId: { in: wanted } },
      select: { userId: true },
    });
    const alreadyMembers = existing.map((m) => m.userId);
    const toAdd = wanted.filter((id) => !alreadyMembers.includes(id));

    if (toAdd.length > 0) {
      await prisma.teamMember.createMany({
        data: toAdd.map((id) => ({ userId: id, teamId, role: "MEMBER" as const })),
        // Two leads adding the same person at once must not 500.
        skipDuplicates: true,
      });
    }

    const added = await prisma.teamMember.findMany({
      where: { teamId, userId: { in: toAdd } },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, jobTitle: true },
        },
      },
    });

    // Tell them via their Inbox — they didn't ask to be added. Best-effort:
    // notifyMembershipGranted never throws, so a failed notification can't
    // undo the membership.
    await Promise.all(
      toAdd.map((id) =>
        notifyMembershipGranted({
          userId: id,
          type: "TEAM_INVITATION",
          title: `You were added to ${standing.teamName}`,
          data: { teamId },
        })
      )
    );

    return NextResponse.json({ added, alreadyMembers }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error adding team members:", error);
    return NextResponse.json(
      { error: "Failed to add members" },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/:teamId/members - Change a member's role
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
    // LEAD or workspace OWNER/ADMIN. It used to be LEAD only, while the
    // invite route already admitted workspace admins — so a workspace owner
    // could put someone on a team and then not take them off, and a team
    // whose only LEAD left the firm could never be re-administered by anyone.
    const standing = await requireTeamStanding(userId, teamId);
    requireTeamMemberManagement(standing);

    const body = await req.json();
    const data = updateMemberSchema.parse(body);

    // Don't allow demoting the last LEAD — would leave the team
    // un-administrable.
    if (data.userId === userId && data.role !== "LEAD") {
      const otherLeads = await prisma.teamMember.count({
        where: { teamId, role: "LEAD", userId: { not: userId } },
      });
      if (otherLeads === 0) {
        return NextResponse.json(
          { error: "Promote another member to Lead before stepping down" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.teamMember.update({
      where: { userId_teamId: { userId: data.userId, teamId } },
      data: { role: data.role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId/members?userId= - Remove a member
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
    const standing = await requireTeamStanding(userId, teamId);

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Self-removal is allowed (leaving a team). Otherwise the requester must
    // be a LEAD or a workspace OWNER/ADMIN.
    if (targetUserId !== userId) {
      requireTeamMemberManagement(standing);
    }

    // Don't remove the last LEAD.
    const target = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: targetUserId, teamId } },
      select: { role: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }
    if (target.role === "LEAD") {
      const otherLeads = await prisma.teamMember.count({
        where: { teamId, role: "LEAD", userId: { not: targetUserId } },
      });
      if (otherLeads === 0) {
        return NextResponse.json(
          { error: "Cannot remove the only Lead. Promote someone first." },
          { status: 400 }
        );
      }
    }

    await prisma.teamMember.delete({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
