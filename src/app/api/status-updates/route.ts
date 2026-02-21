import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/status-updates - Get recent status updates
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const statusUpdates = await prisma.statusUpdate.findMany({
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

    // Map to the shape the frontend widget expects
    const mapped = statusUpdates.map((update) => ({
      id: update.id,
      content: update.summary,
      status: update.status,
      createdAt: update.createdAt.toISOString(),
      project: {
        id: update.project.id,
        name: update.project.name,
      },
      author: {
        name: "", // authorId exists but User relation is not defined on StatusUpdate
      },
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching status updates:", error);
    // Return empty array so the widget renders gracefully
    return NextResponse.json([]);
  }
}
