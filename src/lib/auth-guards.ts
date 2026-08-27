import prisma from "@/lib/prisma";
import type { Position, WorkspaceRole } from "@prisma/client";
import { resolveProjectAccess } from "@/lib/project-access";
import {
  NON_CONTRIBUTOR_ROLES,
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
 * Assert a client-supplied projectId belongs to `workspaceId`. Use in any
 * route that already verified the caller's parent resource (team, portfolio,
 * objective) and then accepts a projectId from the request body/query.
 * Throws NotFoundError (→ 404) if the project is missing or cross-workspace.
 */
export async function assertProjectInWorkspace(
  projectId: string,
  workspaceId: string
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });
  if (!project || project.workspaceId !== workspaceId) {
    throw new NotFoundError("Project not found");
  }
  return project;
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
 * Verify user has access to a task via its project's ACCESS RULES —
 * not merely its workspace. This is the security chokepoint for every
 * /api/tasks/[taskId]/* endpoint.
 *
 * A bare workspace-membership check (the previous behaviour) was strictly
 * weaker than the read gate the project page enforces: any workspace member
 * could GET/PATCH/DELETE tasks of PRIVATE or WORKSPACE-visibility projects
 * they cannot even open (audit: critical task leak + timeline-drag write).
 * We now apply the SAME rule as the page via resolveProjectAccess:
 *   owner | project member | PUBLIC | ws OWNER/ADMIN | Position level >= 4.
 *
 * The task's own creator or assignee always retains access (My Tasks,
 * assigned-to-me flows) even when they are not a formal ProjectMember.
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
  // Creator, assignee, or a follower always keeps READ access to the task.
  const hasPersonalTie = isOwnTask || isCollaborator;

  if (!task.project) {
    // Task without a project - check if user created it, is assigned, or follows
    if (!hasPersonalTie) {
      throw new AuthorizationError("You don't have access to this task");
    }
    // ...and then apply the SAME capability flags the project branch does.
    // This used to return unconditionally, so on a personal task a follower —
    // who has no capability by any measure — could archive it, delete its
    // attachments, even delete the task. verifyBulkTaskAccess already got
    // this right ("only the creator or assignee may touch it"); the two
    // disagreed, so /api/tasks/bulk refused what DELETE /api/tasks/:id let
    // through.
    if (opts.requireWrite && !isOwnTask) {
      throw new AuthorizationError(
        "You don't have permission to modify this task"
      );
    }
    // A follower on a personal task IS the intended audience for a reply.
    if (opts.requireComment && !isOwnTask && !isCollaborator) {
      throw new AuthorizationError(
        "You don't have permission to comment on this task"
      );
    }
    // `access: null` — a task with no project has no project access to speak
    // of. Callers that need to know what the caller may do here read the
    // personal rules directly (creator/assignee writes, followers comment).
    return { ...task, access: null };
  }

  const access = await resolveProjectAccess(task.project, userId);

  // Hide existence with a 404 for users who can't read the project,
  // matching the project page (unless they own/are assigned/follow the task).
  if (!access.ok && !hasPersonalTie) {
    throw new NotFoundError("Task not found");
  }

  // Write requires real edit capability: project owner/ADMIN/EDITOR, or the
  // caller being the task's creator/assignee. A pure follower can read but
  // not mutate.
  if (opts.requireWrite && !access.canWrite && !isOwnTask) {
    throw new AuthorizationError(
      "You don't have permission to modify this task"
    );
  }

  // Commenting is a lower bar than writing — the COMMENTER project role
  // exists for exactly this — but it is still a bar: a VIEWER could post on
  // any task they could open.
  //
  // Three escapes, each deliberate:
  //   • isWorkspaceManager — workspace OWNER/ADMIN and Position level 4+ are
  //     NOT in canWrite/canComment, yet POST /api/projects/:id/messages
  //     explicitly admits them ("or workspace leadership"). Without this the
  //     firm's owner could post in a project's channel and be refused on a
  //     task in the same project, in the same minute.
  //   • isOwnTask — the creator/assignee already escapes requireWrite.
  //   • isCollaborator — a follower is an EXPLICIT grant: adding someone else
  //     as one requires write, and this route notifies collaborators of every
  //     new comment. Refusing their reply is a notification that leads to a
  //     403. Self-adding as a follower now requires comment capability too
  //     (see the collaborators route), so a VIEWER cannot bootstrap through
  //     this door.
  if (
    opts.requireComment &&
    !access.canComment &&
    !access.isWorkspaceManager &&
    !isOwnTask &&
    !isCollaborator
  ) {
    throw new AuthorizationError(
      "You don't have permission to comment on this task"
    );
  }

  // The personal-tie escapes above (follower, creator, assignee) live on rows
  // that OUTLIVE offboarding: removing someone from a workspace deletes their
  // WorkspaceMember row and nothing else, so a TaskCollaborator row from last
  // year would otherwise still buy comment capability — and, on a task with a
  // tracking page, the ability to publish text to the client. Anyone leaning
  // on a personal tie must still hold a contributor seat in the task's
  // workspace.
  if (
    opts.requireComment &&
    !access.canComment &&
    !access.isWorkspaceManager
  ) {
    const seat = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: task.project.workspaceId },
      },
      select: { role: true },
    });
    if (!seat || NON_CONTRIBUTOR_ROLES.has(seat.role)) {
      throw new AuthorizationError(
        "You don't have permission to comment on this task"
      );
    }
  }

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
 * Verify user is a member of a team. Returns the membership record.
 */
export async function verifyTeamAccess(userId: string, teamId: string) {
  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (!member) {
    throw new AuthorizationError("You don't have access to this team");
  }
  return member;
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

  // Cache the write decision per project so a bulk of N tasks in the same
  // project costs one access resolution, not N.
  const projectDecision = new Map<string, boolean>();

  for (const task of tasks) {
    const isOwnTask =
      task.creatorId === userId || task.assigneeId === userId;

    if (!task.project) {
      // Projectless (personal / My Tasks) task: only the creator or
      // assignee may touch it — never any workspace member.
      if (!isOwnTask) {
        throw new AuthorizationError(
          "You don't have access to one or more tasks"
        );
      }
      continue;
    }

    let canWrite = projectDecision.get(task.project.id);
    if (canWrite === undefined) {
      const access = await resolveProjectAccess(task.project, userId);
      canWrite = access.canWrite;
      projectDecision.set(task.project.id, canWrite);
    }
    if (!canWrite && !isOwnTask) {
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
