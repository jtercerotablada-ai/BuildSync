import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getLevel } from "@/lib/people-types";

// GET /api/work/search - Search for work items (projects) the caller can link
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Resolve the caller's workspace and whether they manage it (OWNER/ADMIN
    // or Position level >= 4) — mirrors resolveProjectAccess.
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: {
        workspaceId: true,
        role: true,
        user: { select: { position: true } },
      },
    });

    if (!workspaceMember) {
      return NextResponse.json([]);
    }

    const isWorkspaceManager =
      workspaceMember.role === "OWNER" ||
      workspaceMember.role === "ADMIN" ||
      getLevel(workspaceMember.user?.position) >= 4;

    // Only surface projects the caller can actually READ (owner | member |
    // PUBLIC), unless they manage the workspace. Without this filter the
    // linker search leaks the names of private projects a user can't open
    // (audit SEC-02). `visibility: "WORKSPACE"` is intentionally NOT an
    // auto-grant — it matches the canonical project-page read rule.
    const accessFilter = isWorkspaceManager
      ? {}
      : {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
            { visibility: "PUBLIC" as const },
          ],
        };

    // Search projects the caller can see
    const projects = await prisma.project.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        name: {
          contains: query,
          mode: "insensitive",
        },
        ...accessFilter,
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
      take: 10,
    });

    // Map to work items format
    const results = projects.map((p) => ({
      id: p.id,
      name: p.name,
      type: "project" as const,
      color: p.color,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error searching work:", error);
    return NextResponse.json(
      { error: "Failed to search work" },
      { status: 500 }
    );
  }
}
