import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess } from "@/lib/project-access";
import { notifyMembershipGranted } from "@/lib/membership-notifications";

// Share a project with a whole team (Asana model): every member of the team
// gets Editor-level access to the project, dynamically. PUT sets the team,
// DELETE unshares. Managing the shared team is a manage-level action (owner /
// project ADMIN / workspace manager) — the same bar as adding members, since
// it grants access to many people at once.

const putSchema = z.object({ teamId: z.string().min(1) });

async function requireManage(projectId: string, userId: string) {
  const access = await getProjectAccess(projectId, userId);
  if (!access.ok) {
    return {
      denied: NextResponse.json({ error: "Project not found" }, { status: 404 }),
      access,
    };
  }
  if (!access.canManage) {
    return {
      denied: NextResponse.json(
        { error: "You don't have permission to share this project" },
        { status: 403 }
      ),
      access,
    };
  }
  return { denied: null as null, access };
}

// PUT /api/projects/:projectId/team — share the project with a team.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    const { denied, access } = await requireManage(projectId, userId);
    if (denied) return denied;

    const { teamId } = putSchema.parse(await req.json());

    // The team must live in the SAME workspace as the project — sharing across
    // workspaces would expose the project to an unrelated org.
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        members: { select: { userId: true } },
      },
    });
    if (!team || team.workspaceId !== access.workspaceId) {
      return NextResponse.json(
        { error: "Team not found in this workspace" },
        { status: 404 }
      );
    }

    // Skip work + notifications when it's already shared with this same team
    // (re-selecting it shouldn't re-notify the whole team).
    const current = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true, name: true },
    });
    const changed = current?.teamId !== teamId;

    if (changed) {
      await prisma.project.update({
        where: { id: projectId },
        data: { teamId },
        select: { id: true },
      });

      // Best-effort: let the team's members know they now have access (skip
      // the actor). notifyMembershipGranted never throws.
      await Promise.all(
        team.members
          .filter((m) => m.userId !== userId)
          .map((m) =>
            notifyMembershipGranted({
              userId: m.userId,
              type: "PROJECT_INVITATION",
              title: `You have access to "${current?.name ?? "a project"}" via ${team.name}`,
              data: { projectId },
            })
          )
      );
    }

    return NextResponse.json({ success: true, teamId: team.id, teamName: team.name });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("[project team PUT] error:", error);
    return NextResponse.json({ error: "Failed to share project" }, { status: 500 });
  }
}

// DELETE /api/projects/:projectId/team — stop sharing with a team.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    const { denied } = await requireManage(projectId, userId);
    if (denied) return denied;

    await prisma.project.update({
      where: { id: projectId },
      data: { teamId: null },
      select: { id: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[project team DELETE] error:", error);
    return NextResponse.json({ error: "Failed to unshare project" }, { status: 500 });
  }
}
