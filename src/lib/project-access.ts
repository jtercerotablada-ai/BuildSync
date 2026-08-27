/**
 * project-access.ts — single source of truth for "can this user touch
 * this project?" used by every /api/projects/[projectId]/* sub-route.
 *
 * WHY THIS EXISTS
 * The project page (src/app/(dashboard)/projects/[projectId]/page.tsx) and
 * GET /api/projects/[projectId] enforce one rule: a user can READ a project
 * only if they own it, are a member, it's PUBLIC *and they are in the
 * project's workspace*, or they are an
 * OWNER/ADMIN of the project's workspace (or Position level >= 4). Both of
 * those callers now delegate the decision to `canReadProject` below instead of
 * keeping private copies of it. Crucially,
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
 *   - read:    owner | member | PUBLIC *within the project's own workspace* |
 *              ws OWNER/ADMIN | level >= 4 | team member
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
import { isNonContributorRole } from "@/lib/workspace-roles";

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

/** Everything the read decision depends on, and nothing else. */
export interface ProjectReadDecisionInput {
  /** Project.visibility: "PRIVATE" | "WORKSPACE" | "PUBLIC". */
  visibility: string;
  /** The workspace the project lives in. */
  projectWorkspaceId: string;
  /**
   * Workspaces the VIEWER belongs to. In practice resolveProjectAccess only
   * ever looks up the one membership that matters — (viewer, project's
   * workspace) — so this is `[projectWorkspaceId]` or `[]`. It is modelled as
   * a list because that is the honest question: "is the project's workspace
   * one of the viewer's?"
   */
  viewerWorkspaceIds: readonly string[];
  isOwner: boolean;
  isMember: boolean;
  /** OWNER/ADMIN of the PROJECT's workspace, or Position level >= 4 there. */
  isWorkspaceManager: boolean;
  /** Member of the project's team (team validated to be in the same workspace). */
  isTeamMember: boolean;
}

/**
 * THE read decision, as a pure function — no Prisma, no session, no I/O.
 *
 * Every read gate in the app (this module's resolver, the dashboard project
 * page, GET /api/projects/:id) must route through here. They each used to
 * carry their own copy of the rule, and that is precisely how the PUBLIC hole
 * below survived in three places at once.
 *
 * SECURITY — do not "simplify" the PUBLIC branch back to a bare
 * `visibility === "PUBLIC"`. PUBLIC means "everyone in THIS workspace", never
 * "everyone with an account". Without the workspace comparison, any
 * authenticated user of ANY workspace could open any PUBLIC project — a
 * cross-tenant read. `project-access.test.ts` fails loudly if that regresses.
 *
 * `isWorkspaceManager` is only ever computed from a membership in the
 * PROJECT's workspace, so it cannot cross the tenant boundary either.
 */
export function canReadProject(input: ProjectReadDecisionInput): boolean {
  if (input.isOwner || input.isMember) return true;
  if (input.isTeamMember) return true;
  if (input.isWorkspaceManager) return true;
  if (
    input.visibility === "PUBLIC" &&
    input.viewerWorkspaceIds.includes(input.projectWorkspaceId)
  ) {
    return true;
  }
  return false;
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

  let isWorkspaceManager = false;
  // Workspaces the viewer is known to belong to. We only ever look up the one
  // that matters (the project's), so this is [] or [project.workspaceId].
  const viewerWorkspaceIds: string[] = [];

  // The membership lookup used to be skipped whenever the project was PUBLIC,
  // because PUBLIC alone granted read. It no longer does — PUBLIC is scoped to
  // the project's own workspace now — so the lookup must run for every
  // non-owner/non-member viewer, PUBLIC included.
  // Resolve the viewer's workspace role ONCE. Both IMPLICIT grants — the
  // workspace-wide PUBLIC grant here and the team grant below — are gated on it.
  //
  // A NON-CONTRIBUTOR (GUEST / CLIENT — see NON_CONTRIBUTOR_ROLES) gets neither.
  // Those roles are default-denied across the whole /api/ surface by
  // src/proxy.ts, but callers of this rule include a server component that
  // serializes budget, member emails, tasks and view prefs straight into the
  // response — so an implicit read grant here handed a read-only role the
  // internal cockpit's contents. They have no client-facing surface at all any
  // more, so there is nothing this could legitimately be granting.
  //
  // `level >= 4` sits behind the same check on purpose: Position is independent
  // of WorkspaceRole, so a GUEST carrying an executive Position would otherwise
  // become a workspace manager and read PRIVATE projects too.
  //
  // EXPLICIT grants are untouched: a non-contributor who OWNS the project or
  // holds a real ProjectMember row still passes, via isOwner/isMember above.
  // True only when the viewer holds a CONTRIBUTOR membership in the project's
  // workspace. Deliberately not the negation of viewerIsNonContributor: a user
  // with NO membership row at all is not a non-contributor either, and the team
  // branch below must refuse them too (see its comment).
  let viewerIsContributor = false;
  if (!isOwner && !isMember) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
      include: { user: { select: { position: true } } },
    });
    viewerIsContributor = !!membership && !isNonContributorRole(membership.role);
    if (viewerIsContributor && membership) {
      viewerWorkspaceIds.push(project.workspaceId);
      const level = getLevel(membership.user.position);
      isWorkspaceManager =
        membership.role === "OWNER" ||
        membership.role === "ADMIN" ||
        level >= 4;
    }
  }

  // Team sharing (Asana model): a member of the project's team gets access
  // even without an explicit ProjectMember row. Explicit membership and
  // ownership take precedence for the role, so we only consult the team for
  // users who are neither — a deliberately-restricted VIEWER stays a VIEWER.
  //
  // Requires a CONTRIBUTOR membership in the project's workspace, for two
  // reasons. A non-contributor must not get in: isTeamMember feeds canWrite, so
  // an ungated team grant would let a read-only role AUTHOR content, flatly
  // contradicting NON_CONTRIBUTOR_ROLES. And a viewer with NO membership row
  // must not get in either: removing someone from a workspace deletes only
  // their WorkspaceMember row (DELETE /api/workspace/members), leaving their
  // TeamMember rows behind — so an offboarded user with a stale team row would
  // otherwise keep read AND write on every project shared with that team.
  // Joining a team requires workspace membership, so a TeamMember without one
  // is always stale.
  let isTeamMember = false;
  if (!isOwner && !isMember && viewerIsContributor) {
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
      }
    }
  }

  const canRead = canReadProject({
    visibility: project.visibility,
    projectWorkspaceId: project.workspaceId,
    viewerWorkspaceIds,
    isOwner,
    isMember,
    isWorkspaceManager,
    isTeamMember,
  });

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
