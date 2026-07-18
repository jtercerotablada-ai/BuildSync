import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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
// job title. Role changes are LEAD-only; a job title can be set by a LEAD (for
// anyone) or by the member on their own row.
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

    // The caller must belong to this team.
    const currentUserMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!currentUserMember) {
      return NextResponse.json(
        { error: "You don't have access to this team" },
        { status: 403 }
      );
    }
    const isLead = currentUserMember.role === "LEAD";

    // Verify memberId belongs to this team.
    const memberToUpdate = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!memberToUpdate || memberToUpdate.teamId !== teamId) {
      return NextResponse.json({ error: "Member not found in this team" }, { status: 404 });
    }

    // Role change: leads only, and never demote the last lead.
    if (data.role !== undefined) {
      if (!isLead) {
        return NextResponse.json(
          { error: "Only team leads can change member roles" },
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

    // Job title: a lead can set anyone's; a member can set only their own.
    if (data.jobTitle !== undefined) {
      const isSelf = memberToUpdate.userId === userId;
      if (!isLead && !isSelf) {
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

    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId/members/:memberId - Remove member from team
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

    // Check if current user is team lead or removing themselves
    const currentUserMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    const canRemove =
      currentUserMember?.role === "LEAD" ||
      memberToRemove.userId === userId;

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
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
