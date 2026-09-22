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
    // ?ids=a,b,c fetches specific rows regardless of archived state. The
    // inbox's Favorites tab uses it: starred ids live in uiState, and once a
    // starred row was archived it could no longer be found in the archived=false
    // stream the tab used to filter. Capped, and never paginated.
    const idsParam = searchParams.get("ids");
    const ids =
      idsParam !== null
        ? Array.from(
            new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean))
          ).slice(0, 100)
        : null;

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
    if (cursor && !ids) {
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
      } else {
        // A cursor was supplied but no matching row exists for this user
        // (deleted or out of scope). Returning the unfiltered first page here
        // would make load-more duplicate/loop, so signal end-of-list instead.
        return NextResponse.json({ notifications: [], nextCursor: null });
      }
    }

    const notifications = await prisma.notification.findMany({
      where: ids
        ? { userId, id: { in: ids } }
        : {
            userId,
            archived,
            ...(cursorFilter ?? {}),
          },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ids ? ids.length || 1 : limit,
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
        // Team mentions carry teamId + teamMessageId; surface teamId and
        // treat teamMessageId as the messageId so the inbox can deep-link
        // to /teams/[teamId]/messages?message=...
        teamId: (data.teamId as string | undefined) ?? undefined,
        messageId:
          (data.messageId as string | undefined) ??
          (data.teamMessageId as string | undefined) ??
          undefined,
        rootMessageId:
          (data.rootMessageId as string | undefined) ?? undefined,
        // Goal shares and portfolio invitations / message mentions carry
        // these; dropping them left those rows with nowhere to go.
        objectiveId: (data.objectiveId as string | undefined) ?? undefined,
        portfolioId: (data.portfolioId as string | undefined) ?? undefined,
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
      !ids && notifications.length === limit
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

    // A malformed body is the client's fault, not a server failure.
    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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
    // ids with neither flag used to run an empty update and report success.
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update: send read and/or archived" },
        { status: 400 }
      );
    }

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
