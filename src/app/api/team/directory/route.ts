import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  canChangeUserPosition,
  getPrimaryWorkspaceMembership,
} from "@/lib/auth-guards";
import { canChangeWorkspaceRole } from "@/lib/people-types";
import type { Position, WorkspaceRole } from "@prisma/client";

/**
 * GET /api/team/directory
 *
 * Workspace-wide people directory — every WorkspaceMember of the
 * current user's workspace, plus the person's Position, custom
 * title, department, and active project count.
 *
 * This is the "company chart" surface: it's the source of truth for
 * the @ mention typeahead in workspace messages, the assignee
 * picker on tasks (when the project is workspace-visible), and the
 * Members-add flow on every project. Owner of the workspace can
 * change any non-owner's WorkspaceRole here; only an OWNER/ADMIN can change a
 * Position (it feeds access — level 4+ reads every project); regular
 * members can only update their own title and department.
 *
 * PATCH /api/team/directory
 *
 * Updates a workspace member's role / position / title / department.
 * Permission gates documented inline.
 */

const patchSchema = z.object({
  userId: z.string().min(1),
  // All optional — missing field = leave that column alone.
  position: z
    .enum([
      "CEO",
      "COO",
      "PRINCIPAL_ENGINEER",
      "DIRECTOR_OF_ENGINEERING",
      "OFFICE_ADMIN",
      "ACCOUNTANT",
      "HR",
      "MARKETING",
      "PROJECT_MANAGER",
      "PROJECT_ENGINEER",
      "SENIOR_STRUCTURAL_ENGINEER",
      "STRUCTURAL_ENGINEER",
      "JUNIOR_ENGINEER",
      "DRAFTER",
      "ENGINEERING_INTERN",
      "ARCHITECT",
      "CIVIL_ENGINEER",
      "MEP_ENGINEER",
      "GEOTECH_ENGINEER",
      "SITE_SUPERINTENDENT",
      "CONSULTANT",
      "CONTRACTOR",
      "OTHER",
    ])
    .nullable()
    .optional(),
  customTitle: z.string().max(120).nullable().optional(),
  department: z.string().max(80).nullable().optional(),
  workspaceRole: z
    .enum(["OWNER", "ADMIN", "MEMBER", "WORKER", "GUEST"])
    .optional(),
});

async function getCallerWorkspace(userId: string) {
  return getPrimaryWorkspaceMembership(userId);
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await getCallerWorkspace(userId);
    if (!me) {
      return NextResponse.json({ error: "No workspace" }, { status: 404 });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: me.workspaceId },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            position: true,
            customTitle: true,
            department: true,
            bio: true,
            createdAt: true,
          },
        },
      },
    });

    // Active project count: DISTINCT non-archived projects in this workspace
    // that the person owns or is a member of. Summing the two relation counts
    // counted every created project twice (the creator is always also an
    // ADMIN member) and included archived jobs.
    const memberIds = members.map((m) => m.userId);
    const activeProjects = await prisma.project.findMany({
      where: {
        workspaceId: me.workspaceId,
        isArchived: false,
        OR: [
          { ownerId: { in: memberIds } },
          { members: { some: { userId: { in: memberIds } } } },
        ],
      },
      select: {
        ownerId: true,
        members: {
          where: { userId: { in: memberIds } },
          select: { userId: true },
        },
      },
    });
    const projectCountBy = new Map<string, number>();
    for (const project of activeProjects) {
      const people = new Set<string>(project.members.map((pm) => pm.userId));
      if (project.ownerId) people.add(project.ownerId);
      for (const id of people) {
        projectCountBy.set(id, (projectCountBy.get(id) ?? 0) + 1);
      }
    }

    const shaped = members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      jobTitle: m.user.jobTitle,
      position: m.user.position,
      customTitle: m.user.customTitle,
      department: m.user.department,
      bio: m.user.bio,
      workspaceRole: m.role,
      joinedAt: m.joinedAt.toISOString(),
      projectCount: projectCountBy.get(m.user.id) ?? 0,
      isMe: m.user.id === userId,
    }));

    return NextResponse.json({
      callerRole: me.role,
      members: shaped,
    });
  } catch (err) {
    console.error("[team/directory GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load directory" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = await getCallerWorkspace(userId);
    if (!me) {
      return NextResponse.json({ error: "No workspace" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }
    const { userId: targetUserId, position, customTitle, department, workspaceRole } =
      parsed.data;

    // The target must be in the caller's workspace.
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId: me.workspaceId,
        },
      },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isSelf = targetUserId === userId;
    const isOwner = me.role === "OWNER";
    const isAdmin = me.role === "ADMIN" || isOwner;

    // Permission matrix:
    // - workspaceRole: canChangeWorkspaceRole, the same rule PUT
    //   /api/workspace/members enforces — only the OWNER changes roles,
    //   never their own, never another owner's, and never TO owner (there
    //   is no transfer-ownership flow).
    // - position: OWNER/ADMIN only, never self-service. Position level 4+
    //   reads every project in the workspace, so a self-editable Position
    //   was a one-click self-promotion.
    // - customTitle / department: ADMIN may change for anyone; non-admins
    //   may only change their own.
    if (workspaceRole !== undefined && workspaceRole !== targetMembership.role) {
      if (!isOwner) {
        return NextResponse.json(
          {
            error:
              "Only the workspace owner can change roles; ask them to update.",
          },
          { status: 403 }
        );
      }
      if (workspaceRole === "OWNER") {
        return NextResponse.json(
          { error: "A member can't be made an owner here." },
          { status: 400 }
        );
      }
      if (!canChangeWorkspaceRole(me.role, targetMembership.role, isSelf)) {
        return NextResponse.json(
          {
            error: isSelf
              ? "You can't change your own role."
              : "An owner's role can't be changed.",
          },
          { status: 400 }
        );
      }
    }

    const wantsProfileChange =
      position !== undefined ||
      customTitle !== undefined ||
      department !== undefined;
    if (wantsProfileChange && !isAdmin && !isSelf) {
      return NextResponse.json(
        { error: "You can only edit your own profile fields." },
        { status: 403 }
      );
    }

    // A client may send the current position along with the other fields,
    // so only an actual CHANGE is gated — a member saving their own
    // department with an unchanged position must still succeed.
    if (position !== undefined) {
      const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { position: true },
      });
      const changes = (target?.position ?? null) !== (position ?? null);
      if (changes && !(await canChangeUserPosition(userId, targetUserId))) {
        // Position is stored on the user, so the rule spans every shared
        // workspace the target is in. A manager here can still be refused
        // because of a workspace they have no admin seat in; say so, or
        // the owner reads "only an owner can" and is left guessing.
        return NextResponse.json(
          {
            error: isAdmin
              ? "This person also belongs to another workspace where you're not an owner or admin, so their position can't be changed here."
              : "Only a workspace owner or admin can change a position.",
          },
          { status: 403 }
        );
      }
    }

    // Apply user-level updates (position / customTitle / department).
    const userData: {
      position?: Position | null;
      customTitle?: string | null;
      department?: string | null;
    } = {};
    if (position !== undefined) userData.position = position;
    if (customTitle !== undefined) userData.customTitle = customTitle;
    if (department !== undefined) userData.department = department;

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: userData,
      });
    }

    // Apply membership role change.
    if (workspaceRole !== undefined && workspaceRole !== targetMembership.role) {
      await prisma.workspaceMember.update({
        where: { id: targetMembership.id },
        data: { role: workspaceRole as WorkspaceRole },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[team/directory PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
