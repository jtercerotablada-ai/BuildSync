import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/work/search - Search for work items
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

    // Get user's workspace through membership
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    // Search projects
    const projects = await prisma.project.findMany({
      where: {
        workspaceId: workspaceMember?.workspaceId || undefined,
        name: {
          contains: query,
          mode: "insensitive",
        },
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
