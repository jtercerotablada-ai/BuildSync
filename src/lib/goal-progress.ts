import prisma from "@/lib/prisma";
import { ProgressSource } from "@prisma/client";

/**
 * Service for calculating and updating goal (objective) progress
 */
export const GoalProgressService = {
  /**
   * Recalculate progress for a single objective based on its progressSource
   */
  async recalculateProgress(objectiveId: string): Promise<number> {
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        keyResults: true,
        children: true,
        projects: {
          include: {
            project: {
              include: {
                tasks: {
                  where: { parentTaskId: null }, // Only top-level tasks
                },
              },
            },
          },
        },
        tasks: {
          include: {
            task: true,
          },
        },
      },
    });

    if (!objective) {
      throw new Error(`Objective ${objectiveId} not found`);
    }

    let newProgress = objective.progress;

    switch (objective.progressSource) {
      case ProgressSource.MANUAL:
        // No automatic calculation for manual progress
        return objective.progress;

      case ProgressSource.KEY_RESULTS:
        newProgress = await this.calculateFromKeyResults(objective.keyResults);
        break;

      case ProgressSource.SUB_OBJECTIVES:
        newProgress = await this.calculateFromSubObjectives(objective.children);
        break;

      case ProgressSource.PROJECTS:
        newProgress = this.calculateFromProjects(objective.projects);
        break;
    }

    // Update the objective with new progress
    await prisma.objective.update({
      where: { id: objectiveId },
      data: { progress: Math.round(newProgress) },
    });

    // If this objective has a parent, recalculate parent's progress too
    if (objective.parentId) {
      await this.recalculateProgress(objective.parentId);
    }

    return newProgress;
  },

  /**
   * Calculate progress from key results (average of all key result progress)
   */
  async calculateFromKeyResults(
    keyResults: Array<{
      id: string;
      currentValue: number;
      targetValue: number;
      startValue: number;
    }>
  ): Promise<number> {
    if (keyResults.length === 0) return 0;

    const totalProgress = keyResults.reduce((sum, kr) => {
      const range = kr.targetValue - kr.startValue;
      if (range === 0) return sum + (kr.currentValue >= kr.targetValue ? 100 : 0);
      const progress = ((kr.currentValue - kr.startValue) / range) * 100;
      return sum + Math.min(100, Math.max(0, progress));
    }, 0);

    return totalProgress / keyResults.length;
  },

  /**
   * Calculate progress from sub-objectives (average of all child objective progress)
   */
  async calculateFromSubObjectives(
    children: Array<{ id: string; progress: number }>
  ): Promise<number> {
    if (children.length === 0) return 0;

    const totalProgress = children.reduce((sum, child) => sum + child.progress, 0);
    return totalProgress / children.length;
  },

  /**
   * Calculate progress from connected projects (based on task completion)
   */
  calculateFromProjects(
    objectiveProjects: Array<{
      project: {
        tasks: Array<{ completed: boolean }>;
      };
    }>
  ): number {
    if (objectiveProjects.length === 0) return 0;

    let totalTasks = 0;
    let completedTasks = 0;

    for (const op of objectiveProjects) {
      totalTasks += op.project.tasks.length;
      completedTasks += op.project.tasks.filter((t) => t.completed).length;
    }

    if (totalTasks === 0) return 0;
    return (completedTasks / totalTasks) * 100;
  },

  /**
   * Recalculate progress for all objectives that depend on a specific task
   */
  async recalculateForTask(taskId: string): Promise<void> {
    // Find all objectives connected to this task directly
    const objectiveTasks = await prisma.objectiveTask.findMany({
      where: { taskId },
      select: { objectiveId: true },
    });

    // Find all key results connected to this task
    const keyResultTasks = await prisma.keyResultTask.findMany({
      where: { taskId },
      include: {
        keyResult: {
          select: { objectiveId: true },
        },
      },
    });

    // Find the project this task belongs to
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });

    // Find all objectives connected to this project
    const projectObjectives = task?.projectId
      ? await prisma.objectiveProject.findMany({
          where: { projectId: task.projectId },
          select: { objectiveId: true },
        })
      : [];

    // Collect all unique objective IDs that need recalculation
    const objectiveIds = new Set<string>();

    objectiveTasks.forEach((ot) => objectiveIds.add(ot.objectiveId));
    keyResultTasks.forEach((krt) => objectiveIds.add(krt.keyResult.objectiveId));
    projectObjectives.forEach((po) => objectiveIds.add(po.objectiveId));

    // Recalculate each objective
    for (const objectiveId of objectiveIds) {
      await this.recalculateProgress(objectiveId);
    }
  },

  /**
   * Recalculate progress for all objectives connected to a project
   */
  async recalculateForProject(projectId: string): Promise<void> {
    const objectiveProjects = await prisma.objectiveProject.findMany({
      where: { projectId },
      select: { objectiveId: true },
    });

    for (const op of objectiveProjects) {
      await this.recalculateProgress(op.objectiveId);
    }
  },

  /**
   * Update a key result and recalculate parent objective progress
   */
  async updateKeyResultAndRecalculate(
    keyResultId: string,
    newValue: number,
    authorId: string,
    note?: string
  ): Promise<void> {
    const keyResult = await prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });

    if (!keyResult) {
      throw new Error(`KeyResult ${keyResultId} not found`);
    }

    // Create update record and update current value
    await prisma.$transaction([
      prisma.keyResultUpdate.create({
        data: {
          keyResultId,
          previousValue: keyResult.currentValue,
          newValue,
          note,
          authorId,
        },
      }),
      prisma.keyResult.update({
        where: { id: keyResultId },
        data: { currentValue: newValue },
      }),
    ]);

    // Recalculate objective progress
    await this.recalculateProgress(keyResult.objectiveId);
  },
};
