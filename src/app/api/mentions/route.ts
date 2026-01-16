import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/mentions - Get comments mentioning the current user
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Search for comments that contain the user's ID in a data-user-id attribute
    // The mention format is: <span data-user-id="userId">@Name</span>
    const comments = await prisma.comment.findMany({
      where: {
        content: {
          contains: `data-user-id="${userId}"`,
        },
        // Don't show user's own comments
        authorId: {
          not: userId,
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Transform to the expected format
    const mentions = comments.map((comment) => ({
      id: comment.id,
      content: stripHtmlTags(comment.content),
      taskId: comment.task.id,
      taskName: comment.task.name,
      projectId: comment.task.projectId,
      createdAt: comment.createdAt.toISOString(),
      author: {
        name: comment.author.name || "Unknown",
        image: comment.author.image,
      },
    }));

    return NextResponse.json(mentions);
  } catch (error) {
    console.error("Error fetching mentions:", error);
    return NextResponse.json(
      { error: "Failed to fetch mentions" },
      { status: 500 }
    );
  }
}

// Helper function to strip HTML tags but preserve text content
function stripHtmlTags(html: string): string {
  // Replace mention spans with @Name format
  let text = html.replace(/<span[^>]*data-user-id="[^"]*"[^>]*>([^<]*)<\/span>/gi, "$1");
  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  // Trim and normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}
