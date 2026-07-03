import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/notifications - Get notifications for current user
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "30") || 30, 1), 100);
    const archived = searchParams.get("archived") === "true";
    const cursor = searchParams.get("cursor") || undefined;

    // Resolve the cursor row so we can page by (createdAt desc, id tiebreak).
    // cuid ids aren't time-ordered, so we filter on the cursor's createdAt.
    let cursorFilter:
      | {
          OR: (
            | { createdAt: { lt: Date } }
            | { createdAt: Date; id: { lt: string } }
          )[];
        }
      | undefined;
    if (cursor) {
      const cursorRow = await prisma.notification.findFirst({
        where: { id: cursor, userId },
        select: { id: true, createdAt: true },
      });
      if (cursorRow) {
        cursorFilter = {
          OR: [
            { createdAt: { lt: cursorRow.createdAt } },
            { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
          ],
        };
      }
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        archived,
        ...(cursorFilter ?? {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });

    // Unread count is independent of the current filter/page.
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false, archived: false },
    });

    // Transform to frontend format
    const formattedNotifications = notifications.map((n) => {
      const data = (n.data as Record<string, unknown> | null) ?? {};
      const senderName =
        (data.authorName as string | undefined) ??
        (data.senderName as string | undefined) ??
        "BuildSync";
      const senderImage =
        (data.authorImage as string | null | undefined) ??
        (data.senderImage as string | null | undefined) ??
        null;

      return {
        id: n.id,
        title: n.title,
        preview: n.message || "",
        type: mapNotificationType(n.type),
        read: n.read,
        archived: n.archived,
        createdAt: n.createdAt.toISOString(),
        // Deep-link payload — the inbox uses these to navigate.
        taskId: (data.taskId as string | undefined) ?? undefined,
        projectId: (data.projectId as string | undefined) ?? undefined,
        messageId: (data.messageId as string | undefined) ?? undefined,
        rootMessageId:
          (data.rootMessageId as string | undefined) ?? undefined,
        sender: {
          name: senderName,
          avatar: senderImage,
          // Brand gold — matches the monochrome+gold palette used
          // across the cockpit when there's no real avatar.
          color: "#c9a84c",
        },
      };
    });

    // Full page returned -> more may exist; expose the last id as the cursor.
    const nextCursor =
      notifications.length === limit
        ? notifications[notifications.length - 1].id
        : null;

    return NextResponse.json({
      notifications: formattedNotifications,
      nextCursor,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Mark notifications as read/archived
export async function PATCH(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ids, read, archived, markAllRead, archiveAll } = body;

    if (markAllRead) {
      // Mark all unread, non-archived notifications as read.
      await prisma.notification.updateMany({
        where: {
          userId,
          read: false,
          archived: false,
        },
        data: {
          read: true,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (archiveAll) {
      // Archive all of the caller's non-archived notifications.
      await prisma.notification.updateMany({
        where: {
          userId,
          archived: false,
        },
        data: {
          archived: true,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      !ids.every((id) => typeof id === "string")
    ) {
      return NextResponse.json({ error: "Invalid notification IDs" }, { status: 400 });
    }

    // Unbounded-guard: cap the number of ids per request.
    if (ids.length > 500) {
      return NextResponse.json(
        { error: "Too many notification IDs" },
        { status: 400 }
      );
    }

    // Reject non-boolean read/archived values.
    if (read !== undefined && typeof read !== "boolean") {
      return NextResponse.json({ error: "Invalid read value" }, { status: 400 });
    }
    if (archived !== undefined && typeof archived !== "boolean") {
      return NextResponse.json(
        { error: "Invalid archived value" },
        { status: 400 }
      );
    }

    const updateData: { read?: boolean; archived?: boolean } = {};
    if (typeof read === "boolean") updateData.read = read;
    if (typeof archived === "boolean") updateData.archived = archived;

    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId, // Ensure user can only update their own notifications
      },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// Helper to map database notification type to frontend type
function mapNotificationType(type: string): string {
  const typeMap: Record<string, string> = {
    TASK_ASSIGNED: "task_assigned",
    TASK_COMPLETED: "update",
    COMMENT_ADDED: "comment",
    MENTIONED: "mention",
    DUE_DATE_APPROACHING: "update",
    PROJECT_INVITATION: "system",
    STATUS_UPDATE: "update",
    OBJECTIVE_SHARED: "update",
    FORM_SUBMITTED: "form_submitted",
  };

  return typeMap[type] || "system";
}
