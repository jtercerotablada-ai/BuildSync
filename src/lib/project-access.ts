/**
 * project-access.ts — single source of truth for "can this user touch
 * this project?" used by every /api/projects/[projectId]/* sub-route.
 *
 * WHY THIS EXISTS
 * The project page (src/app/(dashboard)/projects/[projectId]/page.tsx) and
 * GET /api/projects/[projectId] enforce one rule: a user can READ a project
 * only if they own it, are a member, it's PUBLIC, or they are an
 * OWNER/ADMIN of the project's workspace (or Position level >= 4). Crucially,
 * `visibility === "WORKSPACE"` is NOT an auto-grant for ordinary workspace
 * members — that default was deliberately removed from the page.
 *
 * The tab sub-routes (messages, status-updates, activity, attachments,
 * members, custom-fields, objectives, dependencies, forms, …) historically
 * each rolled their own OR clause that INCLUDED `visibility: "WORKSPACE"`,
 * leaking tab data the page hides and letting non-members write. This module
 * centralizes the canonical rule so every route agrees with the page.
 *
 * Roles (ProjectRole): ADMIN > EDITOR > COMMENTER > VIEWER.
 *   - read:    owner | member | PUBLIC | ws OWNER/ADMIN | level >= 4
 *   - write:   owner | member role ADMIN or EDITOR
 *   - comment: owner | member role ADMIN, EDITOR or COMMENTER
 *   - manage:  owner | member role ADMIN   (add/remove members, delete)
 */

import prisma from "@/lib/prisma";
import { getLevel } from "@/lib/people-types";

export type ProjectRole = "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";

export interface ProjectAccessResult {
  ok: boolean;
  /** HTTP status to return when !ok (404 to hide existence, 403 when known). */
  status: number;
  error?: string;
  projectId: string;
  workspaceId: string | null;
  ownerId: string | null;
  visibility: string;
  isOwner: boolean;
  isMember: boolean;
  /** The caller's ProjectRole if they are a member, else null. */
  memberRole: ProjectRole | null;
  /** OWNER/ADMIN of the project's workspace, or Position level >= 4. */
  isWorkspaceManager: boolean;
  /** Can create/edit content (tasks, status): owner | ADMIN | EDITOR. */
  canWrite: boolean;
  /** Can post messages/comments: owner | ADMIN | EDITOR | COMMENTER. Superset of canWrite. */
  canComment: boolean;
  /** Can manage the project (members, settings, delete): owner | project ADMIN | ws OWNER/ADMIN. */
  canManage: boolean;
}

interface MinimalProject {
  id: string;
  ownerId: string | null;
  workspaceId: string;
  visibility: string;
  members: { userId: string; role: string }[];
}

/**
 * Core predicate — given an already-loaded project (with members) and the
 * caller, resolve the full access result. Does ONE extra DB read (the
 * workspaceMember lookup) only when the caller is not owner/member/PUBLIC,
 * mirroring GET /api/projects/[projectId] exactly.
 */
export async function resolveProjectAccess(
  project: MinimalProject,
  userId: string
): Promise<ProjectAccessResult> {
  const isOwner = project.ownerId === userId;
  const member = project.members.find((m) => m.userId === userId);
  const isMember = !!member;
  const memberRole = (member?.role as ProjectRole | undefined) ?? null;
  const isPublic = project.visibility === "PUBLIC";

  let isWorkspaceManager = false;
  let canRead = isOwner || isMember || isPublic;

  if (!canRead) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
      include: { user: { select: { position: true } } },
    });
    if (membership) {
      const level = getLevel(membership.user.position);
      isWorkspaceManager =
        membership.role === "OWNER" ||
        membership.role === "ADMIN" ||
        level >= 4;
      if (isWorkspaceManager) canRead = true;
    }
  }

  const canWrite =
    isOwner || memberRole === "ADMIN" || memberRole === "EDITOR";
  // Commenters can post messages/comments but NOT edit project content —
  // a superset of canWrite that also admits the COMMENTER role.
  const canComment = canWrite || memberRole === "COMMENTER";
  const canManage = isOwner || memberRole === "ADMIN" || isWorkspaceManager;

  return {
    ok: canRead,
    status: canRead ? 200 : 404,
    error: canRead ? undefined : "Project not found",
    projectId: project.id,
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    visibility: project.visibility,
    isOwner,
    isMember,
    memberRole,
    isWorkspaceManager,
    canWrite,
    canComment,
    canManage,
  };
}

/**
 * Convenience: load the project by id (minimal fields) and resolve access.
 * Returns `ok:false, status:404` when the project doesn't exist OR the caller
 * can't read it — a 404 (not 403) so restricted users can't probe existence,
 * matching how the page behaves.
 */
export async function getProjectAccess(
  projectId: string,
  userId: string
): Promise<ProjectAccessResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      workspaceId: true,
      visibility: true,
      members: { select: { userId: true, role: true } },
    },
  });

  if (!project) {
    return {
      ok: false,
      status: 404,
      error: "Project not found",
      projectId,
      workspaceId: null,
      ownerId: null,
      visibility: "PRIVATE",
      isOwner: false,
      isMember: false,
      memberRole: null,
      isWorkspaceManager: false,
      canWrite: false,
      canComment: false,
      canManage: false,
    };
  }

  return resolveProjectAccess(project, userId);
}
