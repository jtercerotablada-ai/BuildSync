import prisma from "@/lib/prisma";

/**
 * Shared access helpers for the polymorphic `Message` model.
 *
 * A `Message` row can live under three parents:
 *   - `projectId` set  → project channel (most common)
 *   - `portfolioId` set → portfolio channel
 *   - both null         → workspace announcement (rare)
 *
 * The generic /api/messages/[id]/* endpoints (pin, reactions, replies,
 * attachments, PATCH, DELETE) are shared across project AND portfolio
 * scopes — so we centralize the access gate here instead of duplicating
 * it across six files.
 */

export interface MessageAccessParent {
  id: string;
  isPinned: boolean;
  authorId: string | null;
  parentMessageId: string | null;
  projectId: string | null;
  portfolioId: string | null;
  workspaceId: string | null;
  project: {
    id: string;
    ownerId: string | null;
    visibility: string;
    workspaceId: string;
    members: { userId: string; role: string }[];
  } | null;
  portfolio: {
    id: string;
    ownerId: string | null;
    privacy: string;
    workspaceId: string;
    members: { userId: string; role: string }[];
  } | null;
}

export type MessageAccess =
  | {
      ok: true;
      message: MessageAccessParent;
      // `isAuthor` is true when the caller wrote the message.
      // `isAdmin` is true when the caller can moderate (project ADMIN
      //   / portfolio OWNER+EDITOR) — used to allow delete-anyone.
      isAuthor: boolean;
      isAdmin: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * Load a Message + verify the caller can READ its parent (project
 * visibility, portfolio privacy, etc.). Used by every generic
 * /api/messages/[id]/* endpoint.
 */
export async function loadMessageWithAccess(
  messageId: string,
  userId: string
): Promise<MessageAccess> {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      isPinned: true,
      authorId: true,
      parentMessageId: true,
      projectId: true,
      portfolioId: true,
      workspaceId: true,
      project: {
        select: {
          id: true,
          ownerId: true,
          visibility: true,
          workspaceId: true,
          members: { select: { userId: true, role: true } },
        },
      },
      portfolio: {
        select: {
          id: true,
          ownerId: true,
          privacy: true,
          workspaceId: true,
          members: { select: { userId: true, role: true } },
        },
      },
    },
  });

  if (!msg) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const isAuthor = msg.authorId === userId;

  // Project-scoped message
  if (msg.project) {
    const member = msg.project.members.find((m) => m.userId === userId);
    const isOwner = msg.project.ownerId === userId;
    const isMember = !!member;
    let allowed = isOwner || isMember || msg.project.visibility === "PUBLIC";
    if (!allowed && msg.project.visibility === "WORKSPACE") {
      const wsMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: msg.project.workspaceId,
          },
        },
      });
      if (wsMember) allowed = true;
    }
    if (!allowed) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    const isAdmin = isOwner || member?.role === "ADMIN";
    return { ok: true, message: msg, isAuthor, isAdmin };
  }

  // Portfolio-scoped message
  if (msg.portfolio) {
    const member = msg.portfolio.members.find((m) => m.userId === userId);
    const isOwner = msg.portfolio.ownerId === userId;
    const isMember = !!member;
    const isPublic = msg.portfolio.privacy === "PUBLIC";
    if (!isOwner && !isMember && !isPublic) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    // Portfolio moderation: owner or OWNER/EDITOR member.
    const isAdmin =
      isOwner || member?.role === "OWNER" || member?.role === "EDITOR";
    return { ok: true, message: msg, isAuthor, isAdmin };
  }

  // Workspace-scoped fallback (rare). Only the author touches these.
  return {
    ok: true,
    message: msg,
    isAuthor,
    isAdmin: isAuthor,
  };
}
