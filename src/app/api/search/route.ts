import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  buildProjectVisibilityClauses,
  taskPrivacyClause,
  teamVisibilityClause,
} from "@/lib/project-visibility";

// GET /api/search?q=query - Unified search across tasks, projects, teams, users
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ tasks: [], projects: [], teams: [], users: [] });
    }

    // Scoping by workspace alone listed the NAMES of projects the caller
    // cannot open — PRIVATE ones, and archived ones the sidebar hides — plus
    // their tasks. Use the same visibility rule the project list and mentions
    // use, and drop archived projects and other people's private tasks.
    const visibilityClauses = await buildProjectVisibilityClauses(userId);
    if (!visibilityClauses) {
      return NextResponse.json({ tasks: [], projects: [], teams: [], users: [] });
    }
    const visibleProject = {
      isArchived: false,
      OR: visibilityClauses,
    };

    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const workspaceIds = userWorkspaces.map((w) => w.workspaceId);

    // Search in parallel. Every query below carries an explicit orderBy with
    // an id tiebreak: without one, `take` lets Postgres return any N of the
    // matching rows, so typing the same thing into the palette twice could
    // surface a different set and read as flaky search.
    const [tasks, projects, teams, users] = await Promise.all([
      // Tasks
      prisma.task.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
          project: visibleProject,
          ...taskPrivacyClause(userId),
        },
        select: {
          id: true,
          name: true,
          project: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 5,
      }),

      // Projects
      prisma.project.findMany({
        where: {
          ...visibleProject,
          name: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 5,
      }),

      // Teams
      prisma.team.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          name: { contains: query, mode: "insensitive" },
          ...teamVisibilityClause(userId),
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 3,
      }),

      // Users
      prisma.user.findMany({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
              ],
            },
            {
              workspaceMembers: {
                some: { workspaceId: { in: workspaceIds } },
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 5,
      }),
    ]);

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        type: "task" as const,
        extra: { projectId: t.project?.id, projectName: t.project?.name, projectColor: t.project?.color },
      })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        type: "project" as const,
        extra: { color: p.color },
      })),
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        type: "team" as const,
        extra: {},
      })),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        type: "user" as const,
        extra: { email: u.email, image: u.image },
      })),
    });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json(
      { error: "Failed to search" },
      { status: 500 }
    );
  }
}
