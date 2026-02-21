import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/users - Get workspace users with optional filter
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const filter = searchParams.get("filter") || "all";

    // Find user's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
      orderBy: { joinedAt: "asc" },
    });

    if (!workspaceMember) {
      return NextResponse.json([]);
    }

    if (filter === "frequent") {
      // Find users who share the most projects with the current user
      const currentUserProjects = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });

      const projectIds = currentUserProjects.map((pm) => pm.projectId);

      if (projectIds.length === 0) {
        // No projects — fall back to workspace members
        const members = await prisma.user.findMany({
          where: {
            workspaceMembers: {
              some: { workspaceId: workspaceMember.workspaceId },
            },
            id: { not: userId },
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
          },
          take: limit,
        });

        return NextResponse.json(members);
      }

      // Get project members who share projects, grouped by user, counted
      const sharedMembers = await prisma.projectMember.groupBy({
        by: ["userId"],
        where: {
          projectId: { in: projectIds },
          userId: { not: userId },
        },
        _count: { projectId: true },
        orderBy: { _count: { projectId: "desc" } },
        take: limit,
      });

      const frequentUserIds = sharedMembers.map((m) => m.userId);

      if (frequentUserIds.length === 0) {
        // No shared members — fall back to workspace members
        const members = await prisma.user.findMany({
          where: {
            workspaceMembers: {
              some: { workspaceId: workspaceMember.workspaceId },
            },
            id: { not: userId },
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
          },
          take: limit,
        });

        return NextResponse.json(members);
      }

      const users = await prisma.user.findMany({
        where: { id: { in: frequentUserIds } },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          jobTitle: true,
        },
      });

      // Preserve frequency ordering
      const userMap = new Map(users.map((u) => [u.id, u]));
      const ordered = frequentUserIds
        .map((id) => userMap.get(id))
        .filter(Boolean);

      return NextResponse.json(ordered);
    }

    // Default: all workspace members
    const members = await prisma.user.findMany({
      where: {
        workspaceMembers: {
          some: { workspaceId: workspaceMember.workspaceId },
        },
        id: { not: userId },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        jobTitle: true,
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
