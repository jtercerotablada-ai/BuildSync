import prisma from "@/lib/prisma";
import { resolveProjectAccess } from "@/lib/project-access";
import { NON_CONTRIBUTOR_ROLES } from "@/lib/workspace-roles";

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
    teamId: string | null;
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
      /**
       * May the caller AUTHOR here (post a reply)? Read access is not enough:
       * POST /api/projects/:id/messages already refuses a VIEWER, but the
       * reply route only checked `ok`, so the same VIEWER could post
       * unlimited replies under any existing message in the channel. One flag
       * so the two entry points cannot drift.
       */
      canPost: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * May the caller author in a PROJECT channel? Pure — the composition of the
 * resolver's own flags, nothing else.
 *
 * This is the same predicate POST /api/projects/[projectId]/messages applies
 * before accepting a new message. It lives here as a named function so the two
 * entry points cannot drift: the reply route used to check only `ok`, so a
 * VIEWER who could READ the channel could post unlimited replies under any
 * message in it. `canComment` is the superset of `canWrite` that also admits
 * COMMENTER; workspace leadership is admitted on top.
 */
export function canPostInProject(access: {
  canComment: boolean;
  isWorkspaceManager: boolean;
}): boolean {
  return access.canComment || access.isWorkspaceManager;
}

/**
 * May the caller author in a PORTFOLIO channel? Pure.
 *
 * PortfolioRole is OWNER | EDITOR | VIEWER — there is no COMMENTER, so the
 * write bar is the same set that may moderate. A VIEWER reads.
 */
export function canPostInPortfolio(input: {
  isOwner: boolean;
  memberRole: string | null | undefined;
}): boolean {
  return (
    input.isOwner ||
    input.memberRole === "OWNER" ||
    input.memberRole === "EDITOR"
  );
}

/**
 * May the caller author on a WORKSPACE ANNOUNCEMENT? Pure.
 *
 * Any contributor of that workspace may reply; the view-only roles
 * (NON_CONTRIBUTOR_ROLES — GUEST / CLIENT) may not. Reads the shared set so
 * adding a read-only role in one place closes this branch too.
 */
export function canPostWorkspaceAnnouncement(role: string): boolean {
  return !NON_CONTRIBUTOR_ROLES.has(role);
}

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
          teamId: true,
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

  // Project-scoped message. Delegate the read decision to the ONE canonical
  // rule the project page uses (resolveProjectAccess) instead of a bespoke
  // copy. The old inline check was wrong in both directions: it let
  // `visibility === "PUBLIC"` grant read to any authenticated user of ANY
  // workspace (a cross-tenant leak — PUBLIC means "everyone in THIS
  // workspace", never "everyone with an account"), and it never admitted the
  // project's team members or workspace managers, so people who CAN open the
  // project were 403'd on its messages. resolveProjectAccess fixes both:
  // it scopes PUBLIC to the project's own workspace and grants team members
  // and workspace managers.
  if (msg.project) {
    const access = await resolveProjectAccess(msg.project, userId);
    if (!access.ok) {
      // The message row exists; withhold it with 403 (the prior contract)
      // rather than 404. resolveProjectAccess masks project EXISTENCE with
      // 404, but here the caller already holds a messageId.
      return { ok: false, status: 403, error: "Forbidden" };
    }
    // Moderation (delete-anyone) is unchanged: project owner or an explicit
    // project ADMIN. Deliberately NOT widened to workspace managers — read
    // access grew, moderation authority did not.
    const member = msg.project.members.find((m) => m.userId === userId);
    const isAdmin = access.isOwner || member?.role === "ADMIN";
    // Same predicate as POST /api/projects/[projectId]/messages.
    const canPost = canPostInProject(access);
    return { ok: true, message: msg, isAuthor, isAdmin, canPost };
  }

  // Portfolio-scoped message
  if (msg.portfolio) {
    const member = msg.portfolio.members.find((m) => m.userId === userId);
    const isOwner = msg.portfolio.ownerId === userId;
    const isMember = !!member;
    // Membership of the portfolio's OWN workspace is required for EVERY
    // caller — the blanket check the canonical GET /api/portfolios/
    // [portfolioId] runs via verifyWorkspaceAccess. This closes two paths at
    // once: PUBLIC granting any authenticated user of any workspace (the
    // cross-tenant leak), and an owner/member whose WorkspaceMember row was
    // removed on offboarding but whose PortfolioMember row survives (it does
    // NOT cascade) keeping access. PUBLIC then means "everyone in THIS
    // workspace", never "everyone with an account".
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: msg.portfolio.workspaceId,
        },
      },
    });
    const allowed =
      !!wsMember && (isOwner || isMember || msg.portfolio.privacy === "PUBLIC");
    if (!allowed) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    // Portfolio moderation: owner or OWNER/EDITOR member. Same set that may
    // author (see canPostInPortfolio), so both flags read from one predicate.
    const isAdmin = canPostInPortfolio({
      isOwner,
      memberRole: member?.role,
    });
    const canPost = isAdmin;
    return { ok: true, message: msg, isAuthor, isAdmin, canPost };
  }

  // Workspace-scoped announcement (projectId and portfolioId both null).
  // Gate on membership of the message's OWN workspace: without it any
  // authenticated user of any workspace could pin / react / reply on another
  // tenant's announcement through the generic /api/messages/[id]/* routes,
  // which check only loadMessageWithAccess. This is the same cross-tenant
  // class as the project and portfolio branches above — the third parent the
  // rewrite must not leave open. Mirrors the workspace scoping that
  // /api/workspace/messages enforces on its own PUT/DELETE.
  const wsMember = msg.workspaceId
    ? await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: msg.workspaceId },
        },
      })
    : null;
  if (!wsMember) {
    return { ok: false, status: 404, error: "Not found" };
  }
  return {
    ok: true,
    message: msg,
    isAuthor,
    isAdmin: isAuthor,
    // Workspace announcements: any contributor of that workspace may reply;
    // the view-only roles may not.
    canPost: canPostWorkspaceAnnouncement(wsMember.role),
  };
}
