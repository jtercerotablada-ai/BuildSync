import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId, getCurrentUser } from "@/lib/auth-utils";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { shouldNotify } from "@/lib/notification-prefs";
import { resolveAllowedMentionUserIds } from "@/lib/mentions";

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

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

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
        attachments: {
          orderBy: { createdAt: "asc" },
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
            attachments: {
              orderBy: { createdAt: "asc" },
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
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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

    // Verify user has access to this task
    await verifyTaskAccess(currentUser.id, taskId);

    const body = await req.json();
    const { content, parentId } = createCommentSchema.parse(body);

    // Verify task exists and get task name for notifications
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        name: true,
        projectId: true,
        assigneeId: true,
        creatorId: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // When replying, the parent comment must belong to THIS task — otherwise
    // a reply could be grafted onto a comment on another task/workspace.
    if (parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: parentId, taskId },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent comment not found on this task" },
          { status: 404 }
        );
      }
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

    // ── Notification fan-out (best-effort) ──────────────────────
    // Everything below is wrapped so a bad @-mention id or a prefs
    // hiccup can never 500 a comment that already saved successfully.
    const textPreview = getTextPreview(content);

    // Parse @-mentions from the client HTML. These are UNVALIDATED —
    // the data-user-id attributes come straight off the wire, so we
    // validate them against the project's membership before use to
    // avoid a foreign-key P2003 on createMany.
    const rawMentionIds = extractMentionedUserIds(content).filter(
      (id) => id !== currentUser.id
    );

    let mentionedUserIds: string[] = [];
    try {
      // Comments only carry mentions when the task lives in a project
      // (mentions resolve against project membership). Task-less tasks
      // (personal My Tasks) get no mention fan-out.
      if (rawMentionIds.length > 0 && task.projectId) {
        const gated = await Promise.all(
          (
            await resolveAllowedMentionUserIds(task.projectId, rawMentionIds)
          ).map(async (uid) => ((await shouldNotify(uid, "MENTIONED")) ? uid : null))
        );
        mentionedUserIds = gated.filter((uid): uid is string => uid !== null);
      }

      if (mentionedUserIds.length > 0) {
        await prisma.notification.createMany({
          data: mentionedUserIds.map((userId) => ({
            type: "MENTIONED" as const,
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
    } catch (err) {
      // A bad mention id (or any createMany failure) must never sink
      // a successfully-saved comment.
      console.error("[task comment MENTIONED fan-out] failed:", err);
      // The MENTIONED notifications did NOT actually get created, so these
      // users must not be treated as "already notified". Clear the exclusion
      // set so the COMMENT_ADDED fallback below can still ping an assignee/
      // creator who happened to be @-mentioned.
      mentionedUserIds = [];
    }

    // ── COMMENT_ADDED fan-out ───────────────────────────────────
    // Ping the task's assignee AND creator that a new comment landed.
    // Exclude the comment author and anyone already @-mentioned above
    // (they got a MENTIONED ping — no need to double-notify).
    try {
      const mentionedSet = new Set(mentionedUserIds);
      const commentRecipients = Array.from(
        new Set(
          [task.assigneeId, task.creatorId].filter(
            (id): id is string =>
              typeof id === "string" &&
              id.length > 0 &&
              id !== currentUser.id &&
              !mentionedSet.has(id)
          )
        )
      );

      const gatedRecipients: string[] = [];
      for (const uid of commentRecipients) {
        if (await shouldNotify(uid, "COMMENT_ADDED")) gatedRecipients.push(uid);
      }

      if (gatedRecipients.length > 0) {
        await prisma.notification.createMany({
          data: gatedRecipients.map((userId) => ({
            type: "COMMENT_ADDED" as const,
            title: `${currentUser.name || "Someone"} commented on a task`,
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
    } catch (err) {
      console.error("[task comment COMMENT_ADDED fan-out] failed:", err);
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

    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
