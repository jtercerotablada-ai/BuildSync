import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getErrorStatus } from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";
import {
  decideProjectCapabilities,
  type ProjectRole,
} from "@/lib/project-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    // Verify user has access to this team (also guarantees a contributor
    // seat in the team's workspace).
    const standing = await requireTeamStanding(userId, teamId);

    const projects = await prisma.project.findMany({
      // The team's live board — archived work is off it here for the same
      // reason GET /api/projects hides it by default.
      where: { teamId, isArchived: false },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Format projects with isJoined flag. canManage is the bar
    // DELETE /api/teams/:teamId/work enforces for "Remove from team", decided
    // by the same pure rule resolveProjectAccess uses (same facts as GET
    // /api/teams/:teamId/work): the manager/team standing only counts on a
    // project in the team's own workspace.
    const formattedProjects = projects.map((project) => {
      const sameWorkspace = project.workspaceId === standing.workspaceId;
      const memberRole = (project.members.find((m) => m.userId === userId)
        ?.role ?? null) as ProjectRole | null;
      const { canManage } = decideProjectCapabilities({
        visibility: project.visibility,
        projectWorkspaceId: project.workspaceId,
        viewerWorkspaceIds: [standing.workspaceId],
        isOwner: project.ownerId === userId,
        isMember: memberRole !== null,
        memberRole,
        isWorkspaceManager: sameWorkspace && standing.isWorkspaceManager,
        isTeamMember: sameWorkspace && standing.isMember,
      });
      return {
        id: project.id,
        name: project.name,
        icon: project.icon,
        color: project.color,
        members: project.members.map((m) => ({
          id: m.user.id,
          name: m.user.name || "",
          image: m.user.image,
        })),
        isJoined: project.members.some((m) => m.userId === userId),
        canManage,
      };
    });

    return NextResponse.json(formattedProjects);
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching team projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
