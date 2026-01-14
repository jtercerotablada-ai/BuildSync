import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const updateMemberSchema = z.object({
  role: z.enum(["LEAD", "MEMBER"]),
});

// PATCH /api/teams/:teamId/members/:memberId - Update member role
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
    const { role } = updateMemberSchema.parse(body);

    // Check if current user is team lead
    const currentUserMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!currentUserMember || currentUserMember.role !== "LEAD") {
      return NextResponse.json(
        { error: "Only team leads can change member roles" },
        { status: 403 }
      );
    }

    // Update the member
    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
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
