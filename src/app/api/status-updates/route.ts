import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";

// GET /api/status-updates - Get recent status updates
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getUserWorkspaceId(userId);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const statusUpdates = await prisma.statusUpdate.findMany({
      where: {
        project: { workspaceId },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        summary: true,
        createdAt: true,
        projectId: true,
        authorId: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Resolve author names
    const authorIds = [...new Set(statusUpdates.map((u) => u.authorId).filter(Boolean))] as string[];
    const authors = authorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, image: true } })
      : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    // Map to the shape the frontend widget expects
    const mapped = statusUpdates.map((update) => {
      const author = update.authorId ? authorMap.get(update.authorId) : null;
      return {
        id: update.id,
        content: update.summary,
        status: update.status,
        createdAt: update.createdAt.toISOString(),
        project: {
          id: update.project.id,
          name: update.project.name,
        },
        author: {
          name: author?.name || "",
          image: author?.image || null,
        },
      };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching status updates:", error);
    return NextResponse.json(
      { error: "Failed to fetch status updates" },
      { status: 500 }
    );
  }
}
