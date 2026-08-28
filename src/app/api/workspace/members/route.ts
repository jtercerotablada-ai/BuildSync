import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getPrimaryWorkspaceMembership } from "@/lib/auth-guards";

// GET /api/workspace/members - Get all workspace members
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceMember = await getPrimaryWorkspaceMembership(userId);

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspaceMember.workspaceId },
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
      orderBy: [
        { role: "asc" },
        { joinedAt: "asc" },
      ],
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching workspace members:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace members" },
      { status: 500 }
    );
  }
}

// PUT /api/workspace/members - Update member role
export async function PUT(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A member is named by the USER it belongs to, never by the
    // WorkspaceMember row id — the same contract as DELETE below and as
    // project membership. The row id is an implementation detail the
    // clients don't carry.
    const { userId: targetUserId, role } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // WORKER is a real role the invite and role pickers both offer; leaving
    // it out rejected a role the UI could produce. OWNER is deliberately NOT
    // assignable: there is no transfer-ownership flow anywhere in the app, so
    // granting it here would let an ADMIN mint owners. /api/team/directory
    // refuses it for the same reason.
    const validRoles = ["ADMIN", "MEMBER", "WORKER", "GUEST"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if current user is admin/owner
    const currentMember = await getPrimaryWorkspaceMembership(userId);

    if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // An ADMIN could otherwise re-role themselves down (or an OWNER out of
    // their own workspace) from a control the UI never shows for yourself.
    if (targetUserId === userId) {
      return NextResponse.json(
        { error: "You can't change your own role" },
        { status: 400 }
      );
    }

    // Prevent changing owner role; the lookup is scoped to the caller's
    // workspace, so a member of another workspace reads as not found.
    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId: currentMember.workspaceId,
        },
      },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot change owner role" },
        { status: 400 }
      );
    }

    const updatedMember = await prisma.workspaceMember.update({
      where: { id: targetMember.id },
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
    console.error("Error updating member role:", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/members?userId=... - Remove member from workspace
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const currentMember = await getPrimaryWorkspaceMembership(userId);

    if (!currentMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const workspaceId = currentMember.workspaceId;
    const isSelf = targetUserId === userId;

    // Gate: only OWNER/ADMIN may remove someone else. EXCEPT anyone can
    // remove themselves (leave), matching project membership.
    if (!isSelf && !["OWNER", "ADMIN"].includes(currentMember.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      select: { id: true, role: true },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // The workspace must never be left ownerless. An owner may be removed —
    // people do leave the firm — but only by another owner, and never the
    // last one: workspace leadership is what grants access to a PRIVATE
    // project nobody else is a member of, and the transfer below has to have
    // somewhere to send the departing owner's projects.
    if (targetMember.role === "OWNER") {
      if (currentMember.role !== "OWNER") {
        return NextResponse.json(
          { error: "Only an owner can remove another owner" },
          { status: 403 }
        );
      }
      const owners = await prisma.workspaceMember.count({
        where: { workspaceId, role: "OWNER" },
      });
      if (owners <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner of the workspace" },
          { status: 400 }
        );
      }
    }

    // A project whose owner has left is a hole, not a loose end: `isOwner` in
    // src/lib/project-access.ts grants read AND write before workspace
    // membership is ever consulted, so an offboarded owner keeps the job
    // forever. Nothing in the app can transfer project ownership, so the
    // removal does it here — leadership inherits, and every project keeps a
    // named owner.
    const ownedProjects = await prisma.project.count({
      where: { workspaceId, ownerId: targetUserId },
    });
    let heirId: string | null = null;
    if (ownedProjects > 0) {
      const heir =
        (await prisma.workspaceMember.findFirst({
          where: { workspaceId, role: "OWNER", userId: { not: targetUserId } },
          orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
          select: { userId: true },
        })) ??
        (await prisma.workspaceMember.findFirst({
          where: { workspaceId, role: "ADMIN", userId: { not: targetUserId } },
          orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
          select: { userId: true },
        }));
      // Refusing beats orphaning: an ownerless project is readable only by
      // workspace leadership, and there is none here to read it.
      if (!heir) {
        return NextResponse.json(
          {
            error:
              "This person owns projects and there is no other owner or admin to inherit them. Promote someone first.",
          },
          { status: 409 }
        );
      }
      heirId = heir.userId;
    }

    // One transaction: a half-removal that looks done is worse than the
    // removal failing. Everything below is a grant that answers on its own
    // row, without consulting workspace membership — deleting the seat alone
    // revokes none of it.
    const removed = await prisma.$transaction(async (tx) => {
      if (heirId) {
        await tx.project.updateMany({
          where: { workspaceId, ownerId: targetUserId },
          data: { ownerId: heirId },
        });
      }
      // canRead/canWrite say yes to an explicit ProjectMember row first thing.
      const projects = await tx.projectMember.deleteMany({
        where: { userId: targetUserId, project: { workspaceId } },
      });
      // verifyTeamAccess passes on the TeamMember row alone, so a stale one
      // keeps the team's messages, knowledge and custom fields open.
      const teams = await tx.teamMember.deleteMany({
        where: { userId: targetUserId, team: { workspaceId } },
      });
      // A follower row is a personal tie, and decideTaskAccess admits those
      // ahead of the project read gate — plus it keeps mailing them every new
      // comment on the task.
      const follows = await tx.taskCollaborator.deleteMany({
        where: { userId: targetUserId, task: { project: { workspaceId } } },
      });
      await tx.workspaceMember.delete({ where: { id: targetMember.id } });
      return {
        projectMemberships: projects.count,
        teamMemberships: teams.count,
        taskFollows: follows.count,
        projectsTransferred: ownedProjects,
      };
    });

    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("Error removing workspace member:", error);
    return NextResponse.json(
      { error: "Failed to remove workspace member" },
      { status: 500 }
    );
  }
}
