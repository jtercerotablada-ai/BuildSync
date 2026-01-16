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
    const limit = parseInt(searchParams.get("limit") || "50");
    const archived = searchParams.get("archived") === "true";

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        archived,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Transform to frontend format
    const formattedNotifications = notifications.map((n) => {
      const data = n.data as Record<string, unknown> | null;

      return {
        id: n.id,
        title: n.title,
        preview: n.message || "",
        type: mapNotificationType(n.type),
        read: n.read,
        archived: n.archived,
        createdAt: n.createdAt.toISOString(),
        taskId: data?.taskId as string | undefined,
        projectId: data?.projectId as string | undefined,
        sender: {
          name: (data?.authorName as string) || "BuildSync",
          color: "#000000",
        },
      };
    });

    return NextResponse.json(formattedNotifications);
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
    const { ids, read, archived, markAllRead } = body;

    if (markAllRead) {
      // Mark all unread notifications as read
      await prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: "Invalid notification IDs" }, { status: 400 });
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
  };

  return typeMap[type] || "system";
}
