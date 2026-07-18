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
 *   - read:    owner | member | PUBLIC | ws OWNER/ADMIN | level >= 4 | team member
 *   - write:   owner | member role ADMIN or EDITOR | team member
 *   - comment: owner | member role ADMIN, EDITOR or COMMENTER | team member
 *   - manage:  owner | member role ADMIN | ws OWNER/ADMIN   (add/remove members, delete)
 *
 * TEAM SHARING (Asana model): a project attached to a team (Project.teamId)
 * is shared with that whole team — every member of the team gets Editor-level
 * access (read + write + comment) WITHOUT an explicit ProjectMember row, and
 * that access is dynamic (new team members gain it, removed members lose it).
 * An explicit ProjectMember row always takes precedence over team access, so a
 * deliberately-restricted VIEWER is never silently upgraded by the team. Team
 * access never confers `canManage` (add/remove members, delete, settings) —
 * that stays owner / project-ADMIN / workspace-manager.
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
  /** Access derives from membership in the project's team (Project.teamId),
   *  not an explicit ProjectMember row. Editor-level, never manage. */
  isTeamMember: boolean;
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
  /** The team this project is shared with, if any. Optional: when a caller's
   *  select omits it, resolveProjectAccess fetches just this scalar lazily. */
  teamId?: string | null;
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

  // Team sharing (Asana model): a member of the project's team gets access
  // even without an explicit ProjectMember row. Explicit membership and
  // ownership take precedence for the role, so we only consult the team for
  // users who are neither — a deliberately-restricted VIEWER stays a VIEWER.
  let isTeamMember = false;
  if (!isOwner && !isMember) {
    // The caller may not have selected teamId; fetch just that scalar when so
    // (undefined = not selected, null = selected-but-no-team).
    let teamId = project.teamId;
    if (teamId === undefined) {
      const p = await prisma.project.findUnique({
        where: { id: project.id },
        select: { teamId: true },
      });
      teamId = p?.teamId ?? null;
    }
    if (teamId) {
      // Require the team to live in the PROJECT's workspace — never grant
      // access across the workspace boundary even if a stale/mis-set teamId
      // points at a team elsewhere (defense in depth; the write sinks also
      // validate this).
      const tm = await prisma.teamMember.findFirst({
        where: {
          userId,
          teamId,
          team: { workspaceId: project.workspaceId },
        },
        select: { userId: true },
      });
      if (tm) {
        isTeamMember = true;
        canRead = true;
      }
    }
  }

  const canWrite =
    isOwner || memberRole === "ADMIN" || memberRole === "EDITOR" || isTeamMember;
  // Commenters can post messages/comments but NOT edit project content —
  // a superset of canWrite that also admits the COMMENTER role.
  const canComment = canWrite || memberRole === "COMMENTER";
  // Team access is Editor-level only: managing membership/settings/deletion
  // stays with the owner, project ADMINs, and workspace managers.
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
    isTeamMember,
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
      teamId: true,
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
      isTeamMember: false,
      canWrite: false,
      canComment: false,
      canManage: false,
    };
  }

  return resolveProjectAccess(project, userId);
}
