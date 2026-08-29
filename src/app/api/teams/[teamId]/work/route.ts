import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyProjectAccess,
  assertProjectInWorkspace,
  getErrorStatus,
  AuthorizationError,
} from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";
import { taskPrivacyClause } from "@/lib/project-visibility";

// POST /api/teams/:teamId/work - Link work to team
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

    // Team membership AND a live contributor seat in the team's workspace.
    // A TeamMember row outlives offboarding, so it was never proof on its own.
    const standing = await requireTeamStanding(userId, teamId);

    const body = await req.json();
    const { workId, workType } = body;

    // Link the project to the team
    if (workType === "project") {
      if (!workId) {
        return NextResponse.json({ error: "workId is required" }, { status: 400 });
      }
      // Scope the target project to THIS team's workspace before mutating it.
      // Without this, workId is trusted straight from the body, letting any
      // team member re-parent ANY project in the database — audit SEC-01.
      // The workspace comes from the standing resolved above, which already
      // loaded the team (and 404s when it does not exist).
      await assertProjectInWorkspace(workId, standing.workspaceId);

      // Attaching a project to a team now SHARES it with the whole team
      // (every team member gets Editor-level access), so this is a manage-
      // level action — require project MANAGE (owner / project ADMIN /
      // workspace manager), matching /api/projects/[projectId]/team. Write
      // access is deliberately not enough: an EDITOR (or a user with only
      // team-derived write) must not be able to broaden a project's audience.
      // Linking only *associates* the project with the team; it never renames
      // or overwrites the project's canonical name/description (audit DATA-01).
      const { access: workAccess } = await verifyProjectAccess(userId, workId);
      if (!workAccess.canManage) {
        throw new AuthorizationError(
          "You don't have permission to change this project's team"
        );
      }

      const project = await prisma.project.update({
        where: { id: workId },
        data: {
          teamId: teamId,
        },
      });
      return NextResponse.json(project);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error linking work to team:", error);
    return NextResponse.json(
      { error: "Failed to link work" },
      { status: 500 }
    );
  }
}

// GET /api/teams/:teamId/work - Get team's work items (projects, etc.)
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

    // Team membership AND a live contributor seat — see the POST above.
    await requireTeamStanding(userId, teamId);

    // Get projects associated with this team
    const projects = await prisma.project.findMany({
      // Archiving doesn't unlink a project from its team, it just stops
      // it being listed as work in flight.
      where: { teamId, isArchived: false },
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        status: true,
        description: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Task counts, computed with the caller's own visibility rather than a
    // bare `_count: { tasks: true }`. That relation count included tasks
    // flagged `isPrivate` — the same rows the calendar was leaking outright —
    // so two people looking at the same team saw the same number and one of
    // them could not open every task in it. taskPrivacyClause is the shared
    // list-query rule (@/lib/project-visibility).
    const countsByProject = new Map<string, number>();
    if (projects.length > 0) {
      const grouped = await prisma.task.groupBy({
        by: ["projectId"],
        where: {
          projectId: { in: projects.map((p) => p.id) },
          ...taskPrivacyClause(userId),
        },
        _count: { _all: true },
      });
      for (const row of grouped) {
        if (row.projectId) countsByProject.set(row.projectId, row._count._all);
      }
    }

    // Transform projects to work items format
    const workItems = projects.map((project) => ({
      id: project.id,
      name: project.name,
      type: "project" as const,
      color: project.color,
      icon: project.icon,
      status: project.status,
      description: project.description,
      _count: { tasks: countsByProject.get(project.id) ?? 0 },
    }));

    return NextResponse.json(workItems);
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching team work:", error);
    return NextResponse.json(
      { error: "Failed to fetch team work" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId/work?projectId=X - Remove a project from the team.
// Only unsets the project's teamId (it stays in the workspace). Requires
// team membership AND write access to the project — mirroring the link POST.
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

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    await requireTeamStanding(userId, teamId);
    // Unlinking revokes the whole team's access to the project — a manage-
    // level action, same bar as sharing it (see the POST handler above).
    const { access: unlinkAccess } = await verifyProjectAccess(userId, projectId);
    if (!unlinkAccess.canManage) {
      throw new AuthorizationError(
        "You don't have permission to change this project's team"
      );
    }

    // Scoped unlink: only clears teamId when the project actually belongs
    // to THIS team, so a stale/guessed id can't detach another team's work.
    const result = await prisma.project.updateMany({
      where: { id: projectId, teamId },
      data: { teamId: null },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Project is not in this team" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error removing project from team:", error);
    return NextResponse.json(
      { error: "Failed to remove project" },
      { status: 500 }
    );
  }
}
