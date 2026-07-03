import prisma from "@/lib/prisma";

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
 * Verify user has access to a task via its project's workspace.
 * Returns the task with project info.
 */
export async function verifyTaskAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      creatorId: true,
      assigneeId: true,
      project: {
        select: {
          id: true,
          workspaceId: true,
          ownerId: true,
          visibility: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  if (!task.project) {
    // Task without a project - check if user created it or is assigned
    if (task.creatorId !== userId && task.assigneeId !== userId) {
      throw new AuthorizationError("You don't have access to this task");
    }
    return task;
  }

  // Verify user belongs to the task's project workspace
  await verifyWorkspaceAccess(userId, task.project.workspaceId);
  return task;
}

/**
 * Verify user has access to a project. Returns workspace membership.
 */
export async function verifyProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      workspaceId: true,
      ownerId: true,
      visibility: true,
    },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  const member = await verifyWorkspaceAccess(userId, project.workspaceId);
  return { project, member };
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
 * Verify all taskIds belong to user's workspace.
 * Used for bulk operations.
 */
export async function verifyBulkTaskAccess(userId: string, taskIds: string[]) {
  const workspaceId = await getUserWorkspaceId(userId);

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      project: { select: { workspaceId: true } },
    },
  });

  if (tasks.length !== taskIds.length) {
    throw new NotFoundError("One or more tasks not found");
  }

  for (const task of tasks) {
    if (task.project && task.project.workspaceId !== workspaceId) {
      throw new AuthorizationError("You don't have access to one or more tasks");
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
