import prisma from "@/lib/prisma";

export async function canAccessProjectForTasks(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      visibility: true,
      members: {
        where: { userId },
        select: { userId: true },
      },
      workspace: {
        select: {
          members: {
            where: { userId },
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!project) return false;

  if (project.ownerId === userId || project.members.length > 0) {
    return true;
  }

  return project.visibility !== "PRIVATE" && project.workspace.members.length > 0;
}

export async function canAccessTask(userId: string, taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      creatorId: true,
      assigneeId: true,
      collaborators: {
        where: { userId },
        select: { userId: true },
      },
      project: {
        select: {
          ownerId: true,
          visibility: true,
          members: {
            where: { userId },
            select: { userId: true },
          },
          workspace: {
            select: {
              members: {
                where: { userId },
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!task) return false;

  if (task.creatorId === userId || task.assigneeId === userId || task.collaborators.length > 0) {
    return true;
  }

  if (!task.project) return false;

  if (task.project.ownerId === userId || task.project.members.length > 0) {
    return true;
  }

  return (
    task.project.visibility !== "PRIVATE" &&
    task.project.workspace.members.length > 0
  );
}
