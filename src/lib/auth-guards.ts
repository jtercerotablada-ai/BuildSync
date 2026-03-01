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
 * Get the user's workspace ID (first workspace they belong to).
 * Used when we need to scope queries to a user's workspace.
 */
export async function getUserWorkspaceId(userId: string): Promise<string> {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  if (!member) {
    throw new AuthorizationError("No workspace found");
  }
  return member.workspaceId;
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
