import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId, getCurrentUser } from "@/lib/auth-utils";

// Helper function to extract mentioned user IDs from HTML content
function extractMentionedUserIds(content: string): string[] {
  const mentionRegex = /data-user-id="([^"]+)"/g;
  const userIds: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match[1] && !userIds.includes(match[1])) {
      userIds.push(match[1]);
    }
  }

  return userIds;
}

// Helper function to strip HTML for notification preview
function getTextPreview(html: string, maxLength: number = 100): string {
  let text = html.replace(/<span[^>]*data-user-id="[^"]*"[^>]*>([^<]*)<\/span>/gi, "$1");
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + "...";
  }
  return text;
}

const createCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required"),
  parentId: z.string().optional(),
});

// GET /api/tasks/:taskId/comments - Get task comments
export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const comments = await prisma.comment.findMany({
      where: {
        taskId,
        parentId: null, // Only top-level comments
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
        replies: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/:taskId/comments - Create comment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const { taskId } = await params;

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content, parentId } = createCommentSchema.parse(body);

    // Verify task exists and get task name for notifications
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, name: true, projectId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        authorId: currentUser.id,
        parentId,
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
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "COMMENT_ADDED",
        taskId,
        userId: currentUser.id,
        data: {},
      },
    });

    // Extract mentioned users and create notifications
    const mentionedUserIds = extractMentionedUserIds(content);

    if (mentionedUserIds.length > 0) {
      // Filter out the comment author (don't notify yourself)
      const usersToNotify = mentionedUserIds.filter(id => id !== currentUser.id);

      if (usersToNotify.length > 0) {
        const textPreview = getTextPreview(content);

        // Create notifications for each mentioned user
        await prisma.notification.createMany({
          data: usersToNotify.map(userId => ({
            type: "MENTIONED",
            title: `${currentUser.name || "Someone"} mentioned you in a comment`,
            message: textPreview,
            userId,
            data: {
              taskId: task.id,
              taskName: task.name,
              projectId: task.projectId,
              commentId: comment.id,
              authorId: currentUser.id,
              authorName: currentUser.name,
            },
          })),
        });
      }
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
