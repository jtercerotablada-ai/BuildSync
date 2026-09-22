import prisma from "@/lib/prisma";
import type { Position, WorkspaceRole } from "@prisma/client";
import { resolveProjectAccess } from "@/lib/project-access";
import {
  NON_CONTRIBUTOR_ROLES,
  isNonContributorRole,
  pickPrimaryMembership,
  primaryWorkspacePin,
} from "@/lib/workspace-roles";

/**
 * Verify user is a member of the workspace. Returns the membership record.
 * Throws if not a member.
 */
export async function verifyWorkspaceAccess(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!member) {
    throw new AuthorizationError("You don't have access to this workspace");
  }
  return member;
}

/**
 * Get the user's effective workspace ID.
 *
 * A user may belong to several workspaces: the auto-generated personal
 * singleton from signup (member count = 1) plus the firm workspace they
 * were invited to (member count > 1). We prefer the FIRST workspace with
 * more than one member — that's where the user actually works — and only
 * fall back to the oldest singleton when no multi-member workspace exists.
 *
 * This mirrors getEffectiveAccess() in auth-utils so reads and writes
 * scope to the SAME workspace the rest of the app resolves. A bare
 * findFirst here (the previous behaviour) could scope a mutation to the
 * user's personal workspace and cross the intended boundary — audit SEC-06.
 */
export async function getUserWorkspaceId(userId: string): Promise<string> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      workspaceId: true,
      workspace: { select: { _count: { select: { members: true } } } },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
  });
  if (memberships.length === 0) {
    throw new AuthorizationError("No workspace found");
  }
  const picked = pickPrimaryMembership(memberships, primaryWorkspacePin());
  return (picked ?? memberships[0]).workspaceId;
}

/**
 * Resolve the user's effective workspace role using the same multi-member
 * heuristic as getUserWorkspaceId. Returns null when the user has no
 * membership. Used to populate the JWT so middleware role gates actually
 * fire (audit SEC-05).
 */
/**
 * The multi-member heuristic as a PURE function so it can run against
 * memberships loaded elsewhere — e.g. folded into the NextAuth jwt callback's
 * existing per-request user query — without a second round trip. `memberships`
 * MUST already be ordered by joinedAt ascending; the caller's query does that.
 * Single source of truth for the heuristic so getPrimaryWorkspaceRole and the
 * jwt callback can never drift apart.
 */
export function pickPrimaryWorkspaceRole(
  memberships: {
    role: string;
    workspaceId: string;
    workspace: { _count: { members: number } };
  }[]
): string | null {
  return (
    pickPrimaryMembership(memberships, primaryWorkspacePin())?.role ?? null
  );
}

/**
 * The user's PRIMARY membership - same heuristic as getUserWorkspaceId, but
 * returning the row so callers that also need the role (and the user's
 * Position for level gates) don't need a second query.
 *
 * Written because ~15 routes resolved the workspace with a bare
 * `workspaceMember.findFirst({ where: { userId } })`, which returns an
 * arbitrary row: /api/workspace/knowledge LISTED and CREATED entries in one
 * workspace while its PUT/DELETE checked another, so an entry you had just
 * written could not be edited ("Not found"). Same class as audit SEC-06.
 */
export async function getPrimaryWorkspaceMembership(userId: string): Promise<{
  workspaceId: string;
  role: WorkspaceRole;
  position: Position | null;
} | null> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      workspaceId: true,
      role: true,
      user: { select: { position: true } },
      workspace: { select: { _count: { select: { members: true } } } },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
  });
  const picked = pickPrimaryMembership(memberships, primaryWorkspacePin());
  if (!picked) return null;
  return {
    workspaceId: picked.workspaceId,
    role: picked.role,
    position: picked.user.position,
  };
}

export async function getPrimaryWorkspaceRole(
  userId: string
): Promise<string | null> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      role: true,
      workspaceId: true,
      workspace: { select: { _count: { select: { members: true } } } },
    },
    // id is the deterministic tiebreak: the role is now recomputed on every
    // request (BS-05), so equal joinedAt must not let the heuristic's pick
    // flap request-to-request.
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
  });
  return pickPrimaryWorkspaceRole(memberships);
}

/**
 * May `callerId` change `targetUserId`'s Position?
 *
 * Position is an ACCESS input — level 4+ reads every project in a workspace
 * (see @/lib/project-access) — so it may only be set by a workspace OWNER or
 * ADMIN, never self-service.
 *
 * And because Position lives on the USER, not the membership, one change
 * applies in every workspace the target belongs to. So the caller must be
 * OWNER/ADMIN in EVERY shared (multi-member) workspace the target is in, not
 * merely in one. Otherwise anyone could promote themselves, or an accomplice,
 * from a side workspace they own — every account owns the singleton workspace
 * signup creates, and one invite makes it multi-member — and carry the new
 * level into the firm. A singleton workspace is ignored: nobody else is there
 * to read.
 *
 * Nor does a workspace where the target sits as GUEST/CLIENT count: every
 * Position-derived grant sits behind a contributor seat, so a raise there opens
 * nothing, and letting such a seat veto the change only locked the firm's own
 * owner out of setting a colleague's Position.
 */
export async function canChangeUserPosition(
  callerId: string,
  targetUserId: string
): Promise<boolean> {
  const targetMemberships = await prisma.workspaceMember.findMany({
    where: { userId: targetUserId },
    select: {
      workspaceId: true,
      role: true,
      workspace: { select: { _count: { select: { members: true } } } },
    },
  });
  const shared = positionSensitiveWorkspaceIds(
    targetMemberships.map((m) => ({
      workspaceId: m.workspaceId,
      role: m.role,
      memberCount: m.workspace._count.members,
    }))
  );
  if (shared.length === 0) return false;

  const callerSeats = await prisma.workspaceMember.findMany({
    where: { userId: callerId, workspaceId: { in: shared } },
    select: { workspaceId: true, role: true },
  });
  return decidePositionChange(shared, callerSeats);
}

/** The target's workspaces whose OWNER/ADMIN must approve a Position change:
 *  shared (multi-member) ones where they hold a contributor seat, since that is
 *  where a Position opens anything. When the target has no contributor seat at
 *  all, every shared workspace they sit in approves instead: otherwise the list
 *  is empty, nobody may ever set the Position, and the firm owner cannot set a
 *  guest's Position before promoting them. Pure, for tests. */
export function positionSensitiveWorkspaceIds(
  memberships: readonly { workspaceId: string; role: string; memberCount: number }[]
): string[] {
  const shared = memberships.filter((m) => m.memberCount > 1);
  const contributorSeats = shared.filter((m) => !isNonContributorRole(m.role));
  return (contributorSeats.length > 0 ? contributorSeats : shared).map(
    (m) => m.workspaceId
  );
}

/** The pure half of canChangeUserPosition, for tests. */
export function decidePositionChange(
  targetSharedWorkspaceIds: readonly string[],
  callerSeats: readonly { workspaceId: string; role: string }[]
): boolean {
  if (targetSharedWorkspaceIds.length === 0) return false;
  return targetSharedWorkspaceIds.every((ws) =>
    callerSeats.some(
      (seat) =>
        seat.workspaceId === ws &&
        (seat.role === "OWNER" || seat.role === "ADMIN")
    )
  );
}

/**
 * Assert a client-supplied projectId belongs to `workspaceId`. Use in any
 * route that already verified the caller's parent resource (team, portfolio,
 * objective) and then accepts a projectId from the request body/query.
 * Throws NotFoundError (→ 404) if the project is missing or cross-workspace.
 *
 * Pass `opts.readableBy` (the caller's userId) whenever linking the project
 * exposes anything about it back to the caller — a portfolio or goal shows the
 * linked project's budget, status and progress. Being in the same workspace is
 * not read access: a PRIVATE project stays members-only, so without this a
 * colleague holding its id could attach it and read it through the parent.
 */
export async function assertProjectInWorkspace(
  projectId: string,
  workspaceId: string,
  opts: { readableBy?: string } = {}
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      workspaceId: true,
      ownerId: true,
      visibility: true,
      teamId: true,
      members: { select: { userId: true, role: true } },
    },
  });
  if (!project || project.workspaceId !== workspaceId) {
    throw new NotFoundError("Project not found");
  }
  if (opts.readableBy) {
    const access = await resolveProjectAccess(project, opts.readableBy);
    if (!access.ok) {
      throw new NotFoundError("Project not found");
    }
  }
  return { id: project.id, workspaceId: project.workspaceId };
}

/**
 * Assert a client-supplied taskId belongs to `workspaceId` (via its project).
 */
export async function assertTaskInWorkspace(taskId: string, workspaceId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, project: { select: { workspaceId: true } } },
  });
  if (!task || !task.project || task.project.workspaceId !== workspaceId) {
    throw new NotFoundError("Task not found");
  }
  return task;
}

/**
 * Assert a client-supplied sectionId belongs to `workspaceId` (via its project).
 */
export async function assertSectionInWorkspace(
  sectionId: string,
  workspaceId: string
) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, project: { select: { workspaceId: true } } },
  });
  if (!section || !section.project || section.project.workspaceId !== workspaceId) {
    throw new NotFoundError("Section not found");
  }
  return section;
}

/**
 * Assert the caller may WRITE into the project that owns `sectionId`, and
 * return the section with its projectId.
 *
 * Use this — not assertSectionInWorkspace — whenever a request body names a
 * DESTINATION section for a task (task PATCH, /api/tasks/reorder,
 * /api/tasks/bulk move_section).
 *
 * WHY: assertSectionInWorkspace only proves the section lives in the caller's
 * workspace. That is not authorization. The task-side gate does not close the
 * gap either — verifyTaskAccess(requireWrite) passes on isOwnTask alone, so a
 * caller who merely CREATED a task could move it into a section of a project
 * they cannot write to, and in fact cannot even read: the project page loads
 * its columns as `sections: { include: { tasks } }` filtered only by
 * parentTaskId, so the smuggled task then renders on that project's board for
 * every real member, and any workflow rule bound to the destination stage
 * fires on it. Moving a task by `projectId` has always required write on the
 * target (see the projectId branch of task PATCH); moving it by `sectionId`
 * is the same act and must cost the same.
 *
 * Throws NotFoundError (404) when the section is unknown or its project is
 * unreadable — verifyProjectAccess masks existence — and AuthorizationError
 * (403) when the caller can read but not write.
 */
export async function verifySectionWritable(
  userId: string,
  sectionId: string,
  opts: { expectWorkspaceId?: string } = {},
) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      projectId: true,
      project: { select: { workspaceId: true } },
    },
  });
  if (!section || !section.project) {
    throw new NotFoundError("Section not found");
  }
  // The write check ALONE is not a workspace bound: canWrite is granted to a
  // project's OWNER no matter which workspace that project lives in, and every
  // user owns a personal workspace from onboarding. So this must ADD to the
  // workspace check the callers used to do, never replace it — otherwise a
  // caller could move a firm task into a section of their own personal
  // workspace, where it vanishes from the firm's board (the project page
  // renders columns via sections.include.tasks) while still counting as the
  // firm's task.
  if (
    opts.expectWorkspaceId &&
    section.project.workspaceId !== opts.expectWorkspaceId
  ) {
    throw new NotFoundError("Section not found");
  }
  await verifyProjectAccess(userId, section.projectId, { requireWrite: true });
  return { id: section.id, projectId: section.projectId };
}

/**
 * Assert a client-supplied userId is a member of `workspaceId`. Use before
 * linking an arbitrary user to a resource (collaborator, assignee) so the
 * endpoint can't leak or attach out-of-workspace users — audit SEC-03.
 */
export async function assertUserInWorkspace(
  targetUserId: string,
  workspaceId: string
) {
  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    select: { userId: true },
  });
  if (!member) {
    throw new AuthorizationError("User is not a member of this workspace");
  }
  return member;
}

/**
 * ─── THE TASK DECISION, AS A PURE FUNCTION ────────────────────────────────
 *
 * Everything `verifyTaskAccess` decides once it has loaded the task, the
 * caller's personal ties to it, and the project access result. Lifted out of
 * that function so it can be exercised without a database —
 * `auth-guards.test.ts` pins every branch below, and DATABASE_URL points at
 * PRODUCTION (see vitest.config.ts), so an untestable chokepoint is an
 * unverified one. Nothing here does I/O.
 */
export interface TaskAccessDecisionInput {
  /** False for a personal / My Tasks task with no project attached. */
  hasProject: boolean;
  /**
   * `Task.isPrivate` — the detail panel's toggle, "This task is private — only
   * its collaborators can see it".
   */
  isPrivate: boolean;
  /** The caller created the task or is its assignee. */
  isOwnTask: boolean;
  /** The caller is a TaskCollaborator (follower) on the task. */
  isCollaborator: boolean;
  requireWrite: boolean;
  requireComment: boolean;
  /** resolveProjectAccess(...).ok — ignored when `hasProject` is false. */
  projectCanRead: boolean;
  /** resolveProjectAccess(...).canWrite. */
  projectCanWrite: boolean;
  /** resolveProjectAccess(...).canComment. */
  projectCanComment: boolean;
  /** resolveProjectAccess(...).isWorkspaceManager (workspace OWNER/ADMIN). */
  projectIsWorkspaceManager: boolean;
  /**
   * resolveProjectAccess(...).hasContributorSeat — the caller still holds a
   * contributor seat in the task's project workspace. Ignored when
   * `hasProject` is false.
   */
  projectHasContributorSeat: boolean;
}

export type TaskAccessDenial =
  /** 404 — the task's existence is hidden from this caller. */
  | { kind: "notFound"; message: string }
  /** 403 — the caller may see the task but not perform this verb. */
  | { kind: "forbidden"; message: string };

export interface TaskAccessDecision {
  /** null when the verb is allowed. */
  denial: TaskAccessDenial | null;
}

export function decideTaskAccess(
  input: TaskAccessDecisionInput
): TaskAccessDecision {
  const allowed = (): TaskAccessDecision => ({ denial: null });
  const forbid = (message: string): TaskAccessDecision => ({
    denial: { kind: "forbidden", message },
  });
  const notFound = (): TaskAccessDecision => ({
    denial: { kind: "notFound", message: "Task not found" },
  });

  // Personal ties (creator, assignee, follower) live on rows that OUTLIVE
  // offboarding: removing someone from a workspace deletes their
  // WorkspaceMember row and leaves creatorId/assigneeId/TaskCollaborator
  // behind. So on a project task a tie only counts while the caller still
  // holds a contributor seat in that task's workspace — otherwise an ex
  // employee would keep read, write and delete on every task they ever
  // created or were assigned. A personal (projectless) task has no workspace
  // to ask about, so its ties always count.
  const tiesCount = !input.hasProject || input.projectHasContributorSeat;
  const isOwnTask = input.isOwnTask && tiesCount;
  const isCollaborator = input.isCollaborator && tiesCount;
  const hasPersonalTie = isOwnTask || isCollaborator;

  // `isPrivate` narrows the audience to the three ties above; a project
  // ADMIN/EDITOR gets no escape from it.
  //
  // Workspace OWNER/ADMIN do, and must: nothing in the product can clear the
  // flag from OUTSIDE the task, so a task privatised by someone who then
  // leaves the firm — with no assignee and no follower — would be unreachable
  // by anybody, forever. Leadership keeps the key here for exactly the reason
  // `decideObjectiveAccess` gives it to them on a private goal
  // (@/lib/objective-access); the two private-content rules in this codebase
  // must not disagree. Position level does NOT open private tasks.
  //
  // 404, never 403, matching how this function hides a task in a project the
  // caller cannot read: a 403 tells someone walking ids that the task is real
  // and merely hidden, which is the one fact privacy exists to withhold.
  //
  // This is the DETAIL half of the rule. Its list-query counterpart is
  // `taskPrivacyClause` (@/lib/project-visibility), which deliberately omits
  // the collaborator leg — that leg costs a join per row. So a follower does
  // not see a private task in a list and can still open the one they were
  // told about, and the two halves must not be swapped for each other.
  const isWorkspaceManager = input.hasProject && input.projectIsWorkspaceManager;
  if (input.isPrivate && !hasPersonalTie && !isWorkspaceManager) {
    return notFound();
  }

  if (!input.hasProject) {
    // Task without a project - check if user created it, is assigned, or follows
    if (!hasPersonalTie) {
      return forbid("You don't have access to this task");
    }
    // ...and then apply the SAME capability flags the project branch does, so
    // a follower cannot archive or delete a personal task; this agrees with
    // verifyBulkTaskAccess ("only the creator or assignee may touch it").
    if (input.requireWrite && !isOwnTask) {
      return forbid("You don't have permission to modify this task");
    }
    // A follower on a personal task IS the intended audience for a reply.
    return allowed();
  }

  // Hide existence with a 404 for users who can't read the project,
  // matching the project page (unless they own/are assigned/follow the task).
  if (!input.projectCanRead && !hasPersonalTie) {
    return notFound();
  }

  // Write requires real edit capability (canWrite already includes workspace
  // OWNER/ADMIN and the implicit Editor grants), or the caller being the
  // task's creator/assignee. A pure follower can read but not mutate.
  if (input.requireWrite && !input.projectCanWrite && !isOwnTask) {
    return forbid("You don't have permission to modify this task");
  }

  // Commenting is a lower bar than writing — the COMMENTER project role exists
  // for exactly this — but it is still a bar: a VIEWER could post on any task
  // they could open. A follower is an EXPLICIT grant (adding someone else as
  // one requires write, and this route notifies collaborators of every new
  // comment), so refusing their reply would be a notification that leads to a
  // 403.
  if (
    input.requireComment &&
    !input.projectCanComment &&
    !isOwnTask &&
    !isCollaborator
  ) {
    return forbid("You don't have permission to comment on this task");
  }

  return allowed();
}

/**
 * Does this WorkspaceRole still buy a seat at the table?
 *
 * `null`/`undefined` means NO membership row — the offboarded case — and is
 * refused. This is deliberately the opposite default from
 * `isNonContributorRole`, which answers `false` for absence because a null
 * role there means "still mid-signup"; here it means "removed from the firm".
 * An empty string is refused for the same reason: absence of a role is not a
 * role, and this predicate must fail closed on anything it does not recognise.
 */
export function contributorSeatSatisfied(
  role: string | null | undefined
): boolean {
  return !!role && !NON_CONTRIBUTOR_ROLES.has(role);
}

function throwTaskDenial(denial: TaskAccessDenial): never {
  if (denial.kind === "notFound") {
    throw new NotFoundError(denial.message);
  }
  throw new AuthorizationError(denial.message);
}

/**
 * Verify user has access to a task via its project's ACCESS RULES —
 * not merely its workspace. This is the security chokepoint for every
 * /api/tasks/[taskId]/* endpoint.
 *
 * A bare workspace-membership check (the previous behaviour) was strictly
 * weaker than the read gate the project page enforces: any workspace member
 * could GET/PATCH/DELETE tasks of PRIVATE or WORKSPACE-visibility projects
 * they cannot even open (audit: critical task leak + timeline-drag write).
 * We now apply the SAME rule as the page via resolveProjectAccess (see the
 * rule table at the top of @/lib/project-access).
 *
 * The task's own creator or assignee retains access (My Tasks,
 * assigned-to-me flows) even when they are not a formal ProjectMember — but
 * only while they still hold a contributor seat in the task's workspace.
 *
 * A task flagged `isPrivate` narrows that audience to the assignee, the
 * creator, the task's collaborators and workspace OWNER/ADMIN — no project
 * role escapes it; see decideTaskAccess for why.
 *
 * @param opts.requireWrite  Also require write capability (project ADMIN/
 *   EDITOR, owner, or the caller being the task's creator/assignee). Use on
 *   mutating verbs so COMMENTER/VIEWER can't edit arbitrary tasks.
 * Returns the task with project info.
 */
export async function verifyTaskAccess(
  userId: string,
  taskId: string,
  opts: { requireWrite?: boolean; requireComment?: boolean } = {}
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      creatorId: true,
      assigneeId: true,
      isPrivate: true,
      // A task's followers (TaskCollaborator) may not be project members —
      // they're added workspace-wide. They must still be able to READ the
      // task they follow (and its comments/subtasks/attachments).
      collaborators: { where: { userId }, select: { userId: true } },
      project: {
        select: {
          id: true,
          workspaceId: true,
          ownerId: true,
          visibility: true,
          teamId: true,
          members: { select: { userId: true, role: true } },
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  const isOwnTask =
    task.creatorId === userId || task.assigneeId === userId;
  const isCollaborator = task.collaborators.length > 0;
  const requireWrite = !!opts.requireWrite;
  const requireComment = !!opts.requireComment;

  if (!task.project) {
    const personal = decideTaskAccess({
      hasProject: false,
      isPrivate: task.isPrivate,
      isOwnTask,
      isCollaborator,
      requireWrite,
      requireComment,
      projectCanRead: false,
      projectCanWrite: false,
      projectCanComment: false,
      projectIsWorkspaceManager: false,
      projectHasContributorSeat: false,
    });
    if (personal.denial) throwTaskDenial(personal.denial);
    // `access: null` — a task with no project has no project access to speak
    // of. Callers that need to know what the caller may do here read the
    // personal rules directly (creator/assignee writes, followers comment).
    return { ...task, access: null };
  }

  const access = await resolveProjectAccess(task.project, userId);

  const decision = decideTaskAccess({
    hasProject: true,
    isPrivate: task.isPrivate,
    isOwnTask,
    isCollaborator,
    requireWrite,
    requireComment,
    projectCanRead: access.ok,
    projectCanWrite: access.canWrite,
    projectCanComment: access.canComment,
    projectIsWorkspaceManager: access.isWorkspaceManager,
    projectHasContributorSeat: access.hasContributorSeat,
  });
  if (decision.denial) throwTaskDenial(decision.denial);

  // Hand the resolved access back: GET /api/tasks/:id needs exactly this to
  // tell the client what to render, and resolving it again there cost a
  // second project lookup plus its membership queries on every task open.
  return { ...task, access };
}

/**
 * Verify user has read access to a project via the canonical page rule.
 * Returns the project and the resolved access result (so callers can gate
 * writes on `access.canWrite` / `access.canManage`).
 */
export async function verifyProjectAccess(
  userId: string,
  projectId: string,
  opts: { requireWrite?: boolean } = {}
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      workspaceId: true,
      ownerId: true,
      visibility: true,
      teamId: true,
      members: { select: { userId: true, role: true } },
    },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const access = await resolveProjectAccess(project, userId);
  if (!access.ok) {
    throw new NotFoundError("Project not found");
  }
  if (opts.requireWrite && !access.canWrite) {
    throw new AuthorizationError(
      "You don't have permission to modify this project"
    );
  }

  return { project, access };
}

/**
 * Verify the caller may work inside a team (messages, knowledge, fields,
 * projects). Returns the caller's effective team role.
 *
 * Same standing rule as requireTeamStanding (@/lib/team-access): the caller
 * must hold a CONTRIBUTOR seat in the TEAM's own workspace — a TeamMember row
 * alone is not evidence that the person still works here, since a seat removed
 * outside DELETE /api/workspace/members leaves it behind — and then either be
 * on the team or be a workspace OWNER/ADMIN there. Managers act with LEAD
 * standing, as they already do for members/invites, so a team whose only lead
 * left the firm stays administrable.
 *
 * No seat → 404 (an outsider must not learn the team is real); seat but not on
 * the team → 403, the message these routes have always returned.
 */
export async function verifyTeamAccess(
  userId: string,
  teamId: string
): Promise<{ userId: string; teamId: string; role: "LEAD" | "MEMBER" }> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { workspaceId: true },
  });
  if (!team) {
    throw new NotFoundError("Team not found");
  }
  const [member, seat] = await Promise.all([
    prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
      select: { role: true },
    }),
    prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: team.workspaceId } },
      select: { role: true },
    }),
  ]);
  if (!contributorSeatSatisfied(seat?.role)) {
    throw new NotFoundError("Team not found");
  }
  const isWorkspaceManager = seat?.role === "OWNER" || seat?.role === "ADMIN";
  if (isWorkspaceManager) {
    return { userId, teamId, role: "LEAD" };
  }
  if (!member) {
    throw new AuthorizationError("You don't have access to this team");
  }
  return { userId, teamId, role: member.role };
}

/**
 * Verify the caller can WRITE all taskIds. Every /api/tasks/bulk and
 * /api/tasks/reorder action is a mutation, so this enforces write capability
 * (project owner/ADMIN/EDITOR, or the caller being the task's creator/
 * assignee) — mirroring the single-task PATCH/DELETE gate. Without this, a
 * read-only COMMENTER/VIEWER could bulk-delete/complete/reassign tasks the
 * single-task endpoints deny them.
 */
export async function verifyBulkTaskAccess(userId: string, taskIds: string[]) {
  const workspaceId = await getUserWorkspaceId(userId);

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      creatorId: true,
      assigneeId: true,
      isPrivate: true,
      // Same personal tie decideTaskAccess honours — scoped to the caller so
      // this stays one row per task, not the whole follower list.
      collaborators: { where: { userId }, select: { id: true } },
      project: {
        select: {
          id: true,
          workspaceId: true,
          ownerId: true,
          visibility: true,
          teamId: true,
          members: { select: { userId: true, role: true } },
        },
      },
    },
  });

  if (tasks.length !== taskIds.length) {
    throw new NotFoundError("One or more tasks not found");
  }

  // Cache the project access per project so a bulk of N tasks in the same
  // project costs one access resolution, not N.
  const projectAccess = new Map<
    string,
    Awaited<ReturnType<typeof resolveProjectAccess>>
  >();

  for (const task of tasks) {
    const isOwnTask =
      task.creatorId === userId || task.assigneeId === userId;

    let access: Awaited<ReturnType<typeof resolveProjectAccess>> | null = null;
    if (task.project) {
      access = projectAccess.get(task.project.id) ?? null;
      if (!access) {
        access = await resolveProjectAccess(task.project, userId);
        projectAccess.set(task.project.id, access);
      }
    }

    // The SAME decision the single-task routes make — this is a second entry
    // point to the task gate, so any rule it re-implemented (the private-task
    // audience, the contributor seat behind personal ties) drifted from it and
    // became the way around it.
    const { denial } = decideTaskAccess({
      hasProject: !!task.project,
      isPrivate: task.isPrivate,
      isOwnTask,
      isCollaborator: task.collaborators.length > 0,
      requireWrite: true,
      requireComment: false,
      projectCanRead: access?.ok ?? false,
      projectCanWrite: access?.canWrite ?? false,
      projectCanComment: access?.canComment ?? false,
      projectIsWorkspaceManager: access?.isWorkspaceManager ?? false,
      projectHasContributorSeat: access?.hasContributorSeat ?? false,
    });
    if (denial?.kind === "notFound") {
      throw new NotFoundError("One or more tasks not found");
    }
    if (denial) {
      throw new AuthorizationError(
        "You don't have permission to modify one or more tasks"
      );
    }
  }

  return workspaceId;
}

/**
 * Custom error classes for proper HTTP status code mapping.
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Get the workspace role for a user (e.g. OWNER, ADMIN, MEMBER, WORKER, CLIENT).
 * Returns "GUEST" if no membership is found.
 */
/* NON_CONTRIBUTOR_ROLES now lives in @/lib/workspace-roles (imported at the top
   of this file). It moved out because src/proxy.ts needs the identical list for
   its default-deny /api/ gate and, being Edge middleware, cannot import this
   module — line 1 here is the Prisma client. See that file for why the two
   enforcement points drifting apart is a security bug, not a style nit. */

/**
 * Assert the caller may CREATE / UPDATE / DELETE workspace content. Contributors
 * are OWNER / ADMIN / MEMBER / WORKER; GUEST and CLIENT are read-only and must
 * be rejected on every mutating verb (POST/PATCH/PUT/DELETE) of the core
 * content routes — projects, tasks, sections, portfolios, teams, etc.
 *
 * Resolves the role via the same multi-member heuristic as getUserWorkspaceId /
 * getPrimaryWorkspaceRole so it agrees with the workspace the rest of the app
 * scopes to, rather than an arbitrary findFirst membership.
 *
 * Throws AuthorizationError (→ 403) for a read-only role and when the user has
 * no membership at all. Returns the resolved { workspaceId, role } on success so
 * callers can reuse it without a second lookup.
 *
 * NOTE: the content routes themselves are not in this batch's file ownership —
 * they must adopt this guard on their write handlers as a follow-up (see the
 * concern noted for Batch C). The accept route already stamps GUEST/WORKER
 * invitations with the correct role, so the data is ready for enforcement.
 */
export async function requireWorkspaceContributor(
  userId: string
): Promise<{ workspaceId: string; role: string }> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      workspaceId: true,
      role: true,
      workspace: { select: { _count: { select: { members: true } } } },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
  });
  const effective = pickPrimaryMembership(memberships, primaryWorkspacePin());
  if (!effective) {
    throw new AuthorizationError("No workspace found");
  }
  if (NON_CONTRIBUTOR_ROLES.has(effective.role)) {
    throw new AuthorizationError(
      "Your role is view-only and can't modify workspace content"
    );
  }
  return { workspaceId: effective.workspaceId, role: effective.role };
}

/**
 * Map error to appropriate HTTP response.
 */
export function getErrorStatus(error: unknown): { status: number; message: string } {
  if (error instanceof AuthorizationError) {
    return { status: 403, message: error.message };
  }
  if (error instanceof NotFoundError) {
    return { status: 404, message: error.message };
  }
  return { status: 500, message: "Internal server error" };
}
