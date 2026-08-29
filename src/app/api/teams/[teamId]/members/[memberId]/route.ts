import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getErrorStatus } from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";

const updateMemberSchema = z
  .object({
    role: z.enum(["LEAD", "MEMBER"]).optional(),
    // The member's job title (a global User profile field). null/"" clears it.
    jobTitle: z.string().max(120).nullable().optional(),
  })
  .refine((v) => v.role !== undefined || v.jobTitle !== undefined, {
    message: "Nothing to update",
  });

// PATCH /api/teams/:teamId/members/:memberId - Update a member's role and/or
// job title.
//
// Role changes: whoever may manage this team's membership — team LEAD or
// workspace OWNER/ADMIN (@/lib/team-access). It used to be LEAD-only while
// POST /invite and POST /members already admitted workspace managers, so a
// workspace owner could put someone on a team and then not be able to change
// or remove them — and a team whose only LEAD left the firm was permanently
// unadministrable. A job title can be set by a manager (for anyone) or by the
// member on their own row.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, memberId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateMemberSchema.parse(body);

    // Team membership plus a live contributor seat in the TEAM's workspace —
    // 404 for anyone else, so a stale TeamMember row left behind by
    // offboarding can no longer re-role the people still here.
    const standing = await requireTeamStanding(userId, teamId);
    const canManage = standing.canManageMembers;

    // Verify memberId belongs to this team.
    const memberToUpdate = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!memberToUpdate || memberToUpdate.teamId !== teamId) {
      return NextResponse.json({ error: "Member not found in this team" }, { status: 404 });
    }

    // Role change: team leads or workspace admins, and never demote the last
    // lead.
    if (data.role !== undefined) {
      if (!canManage) {
        return NextResponse.json(
          { error: "Only team leads or workspace admins can change member roles" },
          { status: 403 }
        );
      }
      if (memberToUpdate.role === "LEAD" && data.role === "MEMBER") {
        const leadCount = await prisma.teamMember.count({
          where: { teamId, role: "LEAD" },
        });
        if (leadCount <= 1) {
          return NextResponse.json(
            { error: "Cannot demote the last team lead. Assign another lead first." },
            { status: 400 }
          );
        }
      }
    }

    // Job title: a manager can set anyone's; a member can set only their own.
    if (data.jobTitle !== undefined) {
      const isSelf = memberToUpdate.userId === userId;
      if (!canManage && !isSelf) {
        return NextResponse.json(
          { error: "You can only edit your own job title" },
          { status: 403 }
        );
      }
    }

    // Apply: role → TeamMember; jobTitle → the target User (global profile).
    await prisma.$transaction(async (tx) => {
      if (data.role !== undefined) {
        await tx.teamMember.update({
          where: { id: memberId },
          data: { role: data.role },
        });
      }
      if (data.jobTitle !== undefined) {
        await tx.user.update({
          where: { id: memberToUpdate.userId },
          data: { jobTitle: data.jobTitle?.trim() || null },
        });
      }
    });

    const updatedMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
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
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    // requireTeamStanding answers 404 for a caller with no seat in the team's
    // workspace and for a non-member of a PRIVATE team; without this it would
    // surface as a generic 500.
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }

    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId/members/:memberId - Remove member from team.
// Whoever may manage this team's membership (team LEAD or workspace
// OWNER/ADMIN), or the member removing themselves. Same rule as PATCH above —
// the two verbs enforcing different rules is how this surface got audited.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, memberId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the member to be removed
    const memberToRemove = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToRemove || memberToRemove.teamId !== teamId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Team lead / workspace admin, or the member leaving of their own accord.
    const standing = await requireTeamStanding(userId, teamId);
    const canRemove =
      standing.canManageMembers || memberToRemove.userId === userId;

    if (!canRemove) {
      return NextResponse.json(
        { error: "You don't have permission to remove this member" },
        { status: 403 }
      );
    }

    // Don't allow removing the last lead
    if (memberToRemove.role === "LEAD") {
      const leadCount = await prisma.teamMember.count({
        where: {
          teamId,
          role: "LEAD",
        },
      });

      if (leadCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last team lead. Assign another lead first." },
          { status: 400 }
        );
      }
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }

    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
