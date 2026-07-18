import prisma from "@/lib/prisma";
import { resolveProjectAccess } from "@/lib/project-access";

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
    orderBy: { joinedAt: "asc" },
  });
  if (memberships.length === 0) {
    throw new AuthorizationError("No workspace found");
  }
  const real = memberships.find((m) => m.workspace._count.members > 1);
  return (real ?? memberships[0]).workspaceId;
}

/**
 * Resolve the user's effective workspace role using the same multi-member
 * heuristic as getUserWorkspaceId. Returns null when the user has no
 * membership. Used to populate the JWT so middleware role gates actually
 * fire (audit SEC-05).
 */
export async function getPrimaryWorkspaceRole(
  userId: string
): Promise<string | null> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      role: true,
      workspace: { select: { _count: { select: { members: true } } } },
    },
    orderBy: { joinedAt: "asc" },
  });
  if (memberships.length === 0) return null;
  const real = memberships.find((m) => m.workspace._count.members > 1);
  return (real ?? memberships[0]).role;
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
  opts: { requireWrite?: boolean } = {}
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
    return task;
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

  return task;
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
 * Verify a CLIENT user has access to a specific project via ClientProjectAccess.
 * Returns the access record with permission flags.
 */
export async function verifyClientAccess(userId: string, projectId: string) {
  const access = await prisma.clientProjectAccess.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!access) {
    throw new AuthorizationError("You don't have access to this project");
  }
  return access;
}

/**
 * Get the workspace role for a user (e.g. OWNER, ADMIN, MEMBER, WORKER, CLIENT).
 * Returns "GUEST" if no membership is found.
 */
export async function getUserRole(userId: string): Promise<string> {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { role: true },
  });
  return member?.role || "GUEST";
}

/**
 * Workspace roles that are read-only by design (Asana parity: a "guest" or
 * external "client" can view what they're shared but never author content).
 * GUEST is our viewer role; CLIENT is the external-portal role. Both must be
 * blocked from write verbs on core workspace-content routes.
 */
const NON_CONTRIBUTOR_ROLES = new Set(["GUEST", "CLIENT"]);

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
    orderBy: { joinedAt: "asc" },
  });
  if (memberships.length === 0) {
    throw new AuthorizationError("No workspace found");
  }
  const effective =
    memberships.find((m) => m.workspace._count.members > 1) ?? memberships[0];
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
