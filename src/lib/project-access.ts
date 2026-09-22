/**
 * project-access.ts — single source of truth for "can this user touch
 * this project?" used by every /api/projects/[projectId]/* sub-route, the two
 * project pages (dashboard + portal), the task/section guards and @-mentions.
 *
 * WHY THIS EXISTS
 * The project page, GET/PATCH/DELETE /api/projects/[projectId] and the tab
 * sub-routes each used to roll their own OR clause, and they disagreed: one
 * copy granted WORKSPACE visibility and another did not; PATCH had no
 * workspace-manager arm while DELETE did. Every caller now delegates to
 * `resolveProjectAccess` (or, for already-resolved facts, the pure
 * `canReadProject` / `decideProjectCapabilities` below). The LIST-query
 * sibling is `buildProjectVisibilityClauses` (@/lib/project-visibility) and
 * must say the same thing.
 *
 * THE RULE (owner decision, 2026-09-21). Visibility answers "who at the firm
 * gets in without being invited":
 *
 *   PRIVATE    only the owner and the members you add (+ workspace managers)
 *   WORKSPACE  every CONTRIBUTOR of the project's own workspace, Editor-level
 *              (read + write + comment). The default for new projects:
 *              everyone at the firm can view and edit.
 *   PUBLIC     exactly like WORKSPACE. It has always meant "everyone in THIS
 *              workspace", never "everyone with an account" — the tenant
 *              check below is what keeps it from being a cross-tenant read.
 *
 * Roles (ProjectRole): ADMIN > EDITOR > COMMENTER > VIEWER.
 *   - read:    owner | member | team member | ws OWNER/ADMIN |
 *              Position level >= 4 | WORKSPACE/PUBLIC for a contributor of
 *              the project's own workspace
 *   - write:   owner | member ADMIN/EDITOR | ws OWNER/ADMIN |
 *              (no member row) team member or WORKSPACE/PUBLIC grant
 *   - comment: write | member COMMENTER
 *   - manage:  owner | member ADMIN | ws OWNER/ADMIN
 *              (members, settings, archive, rename, delete)
 *
 * IMPLICIT GRANTS (team sharing, WORKSPACE/PUBLIC visibility) are Editor-level
 * and never confer `canManage`. They apply only to a caller WITHOUT an explicit
 * ProjectMember row: a member deliberately restricted to VIEWER or COMMENTER
 * stays restricted — the explicit row always wins. They also require a
 * CONTRIBUTOR seat (a WorkspaceMember row in the project's workspace whose role
 * is not in NON_CONTRIBUTOR_ROLES), so GUEST/CLIENT get nothing implicit, and
 * an offboarded user (no row) with a stale TeamMember row gets nothing either.
 *
 * WORKSPACE MANAGERS (OWNER/ADMIN of the PROJECT's workspace) read, write,
 * comment and manage every project there, PRIVATE included, whether or not
 * they also hold a member row — adding the owner to a project as a VIEWER to
 * get notifications must not strip his leadership powers there.
 *
 * POSITION LEVEL >= 4 keeps the read-everything grant it always had and
 * nothing more: it is a job title, not a role. That grant is only safe because
 * a Position can be changed exclusively by a workspace OWNER/ADMIN (see
 * /api/team/directory and the /api/users routes) — a self-assignable Position
 * was a one-click self-promotion.
 */

import prisma from "@/lib/prisma";
import { getLevel } from "@/lib/people-types";
import { isNonContributorRole } from "@/lib/workspace-roles";

export type ProjectRole = "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";

/** Visibilities that open a project to every contributor of its workspace. */
export const WORKSPACE_OPEN_VISIBILITIES: readonly string[] = [
  "WORKSPACE",
  "PUBLIC",
];

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
  /** OWNER/ADMIN of the project's workspace. */
  isWorkspaceManager: boolean;
  /** Contributor with Position level >= 4 in the project's workspace: reads
   *  every project there, but gains no write/manage from it. */
  hasSeniorRead: boolean;
  /** The caller holds a CONTRIBUTOR seat in the project's workspace. Personal
   *  ties to a task (creator/assignee/follower) only count while this holds. */
  hasContributorSeat: boolean;
  /** Access derives from membership in the project's team (Project.teamId),
   *  not an explicit ProjectMember row. Editor-level, never manage. */
  isTeamMember: boolean;
  /** Access derives from WORKSPACE/PUBLIC visibility plus a contributor seat,
   *  not an explicit ProjectMember row. Editor-level, never manage. */
  isWorkspaceShared: boolean;
  /** Can create/edit content (tasks, sections, brief, status). */
  canWrite: boolean;
  /** Can post messages/comments. Superset of canWrite. */
  canComment: boolean;
  /** Can manage the project (members, settings, archive, delete). */
  canManage: boolean;
}

/** Everything the read decision depends on, and nothing else. */
export interface ProjectReadDecisionInput {
  /** Project.visibility: "PRIVATE" | "WORKSPACE" | "PUBLIC". */
  visibility: string;
  /** The workspace the project lives in. */
  projectWorkspaceId: string;
  /**
   * Workspaces where the VIEWER holds a CONTRIBUTOR seat. In practice
   * resolveProjectAccess only ever looks up the one membership that matters —
   * (viewer, project's workspace) — so this is `[projectWorkspaceId]` or `[]`.
   * A GUEST/CLIENT membership must NOT be listed: it earns no implicit grant.
   */
  viewerWorkspaceIds: readonly string[];
  isOwner: boolean;
  isMember: boolean;
  /** OWNER/ADMIN of the PROJECT's workspace. */
  isWorkspaceManager: boolean;
  /** Member of the project's team (team validated to be in the same workspace). */
  isTeamMember: boolean;
  /** Contributor with Position level >= 4 in the PROJECT's workspace. */
  hasSeniorRead?: boolean;
}

/**
 * THE read decision, as a pure function — no Prisma, no session, no I/O.
 *
 * SECURITY — do not "simplify" the WORKSPACE/PUBLIC branch to a bare
 * visibility test. It means "every contributor in THIS workspace", never
 * "everyone with an account". Without the workspace comparison, any
 * authenticated user of ANY workspace could open the project — a cross-tenant
 * read. `project-access.test.ts` fails loudly if that regresses.
 *
 * `isWorkspaceManager` and `hasSeniorRead` are only ever computed from a
 * membership in the PROJECT's workspace, so they cannot cross the tenant
 * boundary either.
 */
export function canReadProject(input: ProjectReadDecisionInput): boolean {
  if (input.isOwner || input.isMember) return true;
  if (input.isTeamMember) return true;
  if (input.isWorkspaceManager) return true;
  if (input.hasSeniorRead) return true;
  if (
    WORKSPACE_OPEN_VISIBILITIES.includes(input.visibility) &&
    input.viewerWorkspaceIds.includes(input.projectWorkspaceId)
  ) {
    return true;
  }
  return false;
}

/** Everything the full capability decision depends on. */
export interface ProjectCapabilityInput extends ProjectReadDecisionInput {
  memberRole: ProjectRole | null;
}

export interface ProjectCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canComment: boolean;
  canManage: boolean;
  /** The WORKSPACE/PUBLIC implicit Editor grant applied. */
  isWorkspaceShared: boolean;
}

/**
 * read / write / comment / manage from already-resolved facts. Pure, so the
 * whole rule is testable without a database, and so the server components
 * that already loaded these facts can't drift from the API.
 */
export function decideProjectCapabilities(
  input: ProjectCapabilityInput
): ProjectCapabilities {
  const canRead = canReadProject(input);
  const hasExplicitRole = input.isOwner || input.isMember;
  // Implicit Editor grants apply only to a caller with no explicit row, so a
  // deliberately restricted VIEWER/COMMENTER is never silently upgraded.
  const isWorkspaceShared =
    !hasExplicitRole &&
    WORKSPACE_OPEN_VISIBILITIES.includes(input.visibility) &&
    input.viewerWorkspaceIds.includes(input.projectWorkspaceId);
  const implicitEditor =
    !hasExplicitRole && (input.isTeamMember || isWorkspaceShared);

  const canWrite =
    input.isOwner ||
    input.isWorkspaceManager ||
    input.memberRole === "ADMIN" ||
    input.memberRole === "EDITOR" ||
    implicitEditor;
  const canComment = canWrite || input.memberRole === "COMMENTER";
  const canManage =
    input.isOwner || input.memberRole === "ADMIN" || input.isWorkspaceManager;

  // Nothing is granted on a project the caller cannot read.
  return {
    canRead,
    canWrite: canRead && canWrite,
    canComment: canRead && canComment,
    canManage: canRead && canManage,
    isWorkspaceShared,
  };
}

/**
 * May this caller move the project's pipeline stage (PATCH /stage, and the
 * stage offers the Deliverables tab makes after a seal request or an issue)?
 *
 * A stage move is an ordinary content edit, so this is exactly `canWrite` —
 * owner, workspace OWNER/ADMIN, member ADMIN/EDITOR, and the implicit
 * team / WORKSPACE-shared Editor grants. It exists as a named predicate so the
 * route that moves the stage and the code that OFFERS the move can never
 * disagree; change the rule here, not at a call site.
 */
export function canMoveStage(access: { canWrite: boolean }): boolean {
  return access.canWrite;
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
 * caller, resolve the full access result.
 *
 * Always does ONE workspaceMember lookup (the caller's seat in the PROJECT's
 * workspace): workspace-manager standing must hold even for a project member,
 * and the task guards need to know whether the caller still works here. Adds a
 * teamMember lookup only for a non-member contributor on a team-shared project.
 */
export async function resolveProjectAccess(
  project: MinimalProject,
  userId: string
): Promise<ProjectAccessResult> {
  const isOwner = project.ownerId === userId;
  const member = project.members.find((m) => m.userId === userId);
  const isMember = !!member;
  const memberRole = (member?.role as ProjectRole | undefined) ?? null;

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: project.workspaceId },
    },
    select: { role: true, user: { select: { position: true } } },
  });

  // A NON-CONTRIBUTOR (GUEST / CLIENT — see NON_CONTRIBUTOR_ROLES) and a user
  // with NO membership row (offboarded) are both refused every implicit grant.
  // Deliberately not the negation of isNonContributorRole: that one answers
  // false for "no role", which here means "removed from the firm".
  const hasContributorSeat =
    !!membership && !isNonContributorRole(membership.role);

  // Workspaces the viewer holds a contributor seat in, as far as this project
  // is concerned: [] or [project.workspaceId].
  const viewerWorkspaceIds: string[] = hasContributorSeat
    ? [project.workspaceId]
    : [];

  const isWorkspaceManager =
    hasContributorSeat &&
    (membership!.role === "OWNER" || membership!.role === "ADMIN");
  // Position sits behind the contributor check on purpose: it is independent
  // of WorkspaceRole, so a GUEST carrying an executive Position would
  // otherwise read PRIVATE projects.
  const hasSeniorRead =
    hasContributorSeat && getLevel(membership!.user.position) >= 4;

  // Team sharing (Asana model): a member of the project's team gets Editor
  // access without an explicit ProjectMember row. Only consulted for callers
  // who are neither owner nor member — a deliberately-restricted VIEWER stays a
  // VIEWER — and only for contributors: joining a team requires workspace
  // membership, so a TeamMember row without a seat is always stale.
  let isTeamMember = false;
  if (!isOwner && !isMember && hasContributorSeat) {
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
      // points at a team elsewhere.
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

  const caps = decideProjectCapabilities({
    visibility: project.visibility,
    projectWorkspaceId: project.workspaceId,
    viewerWorkspaceIds,
    isOwner,
    isMember,
    memberRole,
    isWorkspaceManager,
    isTeamMember,
    hasSeniorRead,
  });

  return {
    ok: caps.canRead,
    status: caps.canRead ? 200 : 404,
    error: caps.canRead ? undefined : "Project not found",
    projectId: project.id,
    workspaceId: project.workspaceId,
    ownerId: project.ownerId,
    visibility: project.visibility,
    isOwner,
    isMember,
    memberRole,
    isWorkspaceManager,
    hasSeniorRead,
    hasContributorSeat,
    isTeamMember,
    isWorkspaceShared: caps.isWorkspaceShared,
    canWrite: caps.canWrite,
    canComment: caps.canComment,
    canManage: caps.canManage,
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
      hasSeniorRead: false,
      hasContributorSeat: false,
      isTeamMember: false,
      isWorkspaceShared: false,
      canWrite: false,
      canComment: false,
      canManage: false,
    };
  }

  return resolveProjectAccess(project, userId);
}
