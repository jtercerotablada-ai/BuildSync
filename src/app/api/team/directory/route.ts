import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
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
 * change anyone's WorkspaceRole here; admins can change positions
 * of others; regular members can only update their own profile.
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
  return prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true, role: true },
  });
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
            // Active project count — only projects in the same
            // workspace where this user is a member or owner.
            _count: {
              select: {
                projectMembers: {
                  where: { project: { workspaceId: me.workspaceId } },
                },
                ownedProjects: {
                  where: { workspaceId: me.workspaceId },
                },
              },
            },
          },
        },
      },
    });

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
      // Approximate active project surface — members + owner-only
      // (the underlying _count doesn't dedupe across the two
      // relations but in practice owners are also members).
      projectCount:
        m.user._count.projectMembers + m.user._count.ownedProjects,
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
    // - workspaceRole change: only OWNER may demote ADMIN/MEMBER,
    //   only OWNER may make anyone OWNER (but we block that — must
    //   use the transfer-ownership endpoint to maintain the
    //   "exactly one owner" invariant).
    // - position / customTitle / department: ADMIN may change for
    //   anyone; non-admins may only change their own.
    if (workspaceRole !== undefined) {
      if (!isOwner) {
        return NextResponse.json(
          {
            error:
              "Only the workspace owner can change role; ask them to update.",
          },
          { status: 403 }
        );
      }
      if (workspaceRole === "OWNER") {
        return NextResponse.json(
          {
            error:
              "To set a new owner, use the transfer-ownership flow (not implemented yet).",
          },
          { status: 400 }
        );
      }
      // OWNER can't demote themselves with this endpoint either.
      if (isSelf) {
        return NextResponse.json(
          {
            error:
              "The owner can't change their own role here. Transfer ownership first.",
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
    if (workspaceRole !== undefined) {
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
