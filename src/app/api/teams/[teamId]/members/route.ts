import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

const updateMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["LEAD", "MEMBER"]),
});

/**
 * Helper — only LEAD members of the team are allowed to mutate
 * membership (change roles, remove members). Anyone with team access
 * can read.
 */
async function requireTeamLead(userId: string, teamId: string) {
  const me = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });
  if (!me || me.role !== "LEAD") {
    return NextResponse.json(
      { error: "Only team leads can modify membership" },
      { status: 403 }
    );
  }
  return null;
}

// GET /api/teams/:teamId/members - Get team members
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

    // Verify user has access to this team
    await verifyTeamAccess(userId, teamId);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
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
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json(team.members);
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
    await verifyTeamAccess(userId, teamId);
    const denied = await requireTeamLead(userId, teamId);
    if (denied) return denied;

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
    await verifyTeamAccess(userId, teamId);

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Self-removal is allowed (leaving a team). Otherwise the requester
    // must be a LEAD.
    if (targetUserId !== userId) {
      const denied = await requireTeamLead(userId, teamId);
      if (denied) return denied;
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
