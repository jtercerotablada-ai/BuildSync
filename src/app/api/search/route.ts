import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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

    // Get user's workspaces
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });

    const workspaceIds = userWorkspaces.map((w) => w.workspaceId);

    // Search in parallel
    const [tasks, projects, teams, users] = await Promise.all([
      // Tasks
      prisma.task.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
          project: {
            workspaceId: { in: workspaceIds },
          },
        },
        select: {
          id: true,
          name: true,
          project: {
            select: { id: true, name: true, color: true },
          },
        },
        take: 5,
      }),

      // Projects
      prisma.project.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          name: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
        take: 5,
      }),

      // Teams
      prisma.team.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          name: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
        },
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
