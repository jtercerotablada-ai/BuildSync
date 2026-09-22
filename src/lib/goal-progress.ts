import prisma from "@/lib/prisma";
import { ProgressSource } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/** One key result's completion, 0-100. A zero range counts as done once the
 *  target is reached, the same reading the stored roll-up has always used. */
export function keyResultPercent(kr: {
  currentValue: number;
  targetValue: number;
  startValue: number;
}): number {
  const range = kr.targetValue - kr.startValue;
  if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  return Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100));
}

/**
 * The goals a reader may see in a list or a nested include, as a Prisma
 * `where`. It is the list-query twin of decideObjectiveAccess
 * (@/lib/objective-access) and must grant exactly the same goals: a
 * non-private goal to every contributor of its workspace, a private one to its
 * owner, the people named on it and the workspace OWNER/ADMIN. The caller has
 * already established the contributor seat; a GUEST/CLIENT gets no goals.
 *
 * Nested lists need it too. A parent's `children` used to be included with no
 * filter at all, so a private sub-goal reached everyone who could open its
 * parent — name, owner, progress and key results.
 */
export function objectiveReadClause(
  userId: string,
  workspaceId: string,
  seat: { isWorkspaceManager: boolean }
): Prisma.ObjectiveWhereInput {
  if (seat.isWorkspaceManager) return { workspaceId };
  return {
    workspaceId,
    OR: [
      { isPrivate: false },
      { ownerId: userId },
      { members: { some: { userId } } },
    ],
  };
}

/**
 * Service for calculating and updating goal (objective) progress
 */
export const GoalProgressService = {
  /**
   * Recalculate progress for a single objective based on its progressSource
   */
  async recalculateProgress(objectiveId: string, depth: number = 0, visited: Set<string> = new Set()): Promise<number> {
    if (depth > 10 || visited.has(objectiveId)) {
      return 0;
    }
    visited.add(objectiveId);

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
        // No automatic calculation for manual progress. This used to return
        // straight out, which also skipped the parent roll-up at the bottom of
        // this function, so a manual goal broke the chain and left a
        // SUB_OBJECTIVES ancestor showing a stale average forever.
        break;

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

    // Update the objective with new progress. A manual goal owns its own
    // number, so writing it back would only churn updatedAt.
    if (objective.progressSource !== ProgressSource.MANUAL) {
      await prisma.objective.update({
        where: { id: objectiveId },
        data: { progress: Math.round(newProgress) },
      });
    }

    // If this objective has a parent, recalculate parent's progress too
    if (objective.parentId) {
      await GoalProgressService.recalculateProgress(objective.parentId, depth + 1, visited);
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

    const totalProgress = keyResults.reduce((sum, kr) => sum + keyResultPercent(kr), 0);

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
   * The progress to SHOW for each objective, computed from live data the same
   * way recalculateProgress computes the stored number. Reads use this rather
   * than the stored column because not every write path recalculates (adding
   * or deleting a task in a linked project never did), and a stale number on
   * the goal page contradicted the live Related work panel beside it.
   *
   * Sub-goal and project roll-ups are aggregated over ALL children and linked
   * projects, never over the subset the reader may see: the percentage is the
   * goal's own fact, and averaging only the visible children would give two
   * readers two different numbers for one goal. Only aggregates leave here.
   */
  async liveProgress(
    objectives: Array<{
      id: string;
      progress: number;
      progressSource: ProgressSource;
      keyResults: Array<{ currentValue: number; targetValue: number; startValue: number }>;
    }>
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const subIds: string[] = [];
    const projectGoalIds: string[] = [];

    for (const o of objectives) {
      result.set(o.id, o.progress);
      if (o.progressSource === ProgressSource.KEY_RESULTS && o.keyResults.length > 0) {
        const sum = o.keyResults.reduce((acc, kr) => acc + keyResultPercent(kr), 0);
        result.set(o.id, Math.round(sum / o.keyResults.length));
      } else if (o.progressSource === ProgressSource.SUB_OBJECTIVES) {
        subIds.push(o.id);
      } else if (o.progressSource === ProgressSource.PROJECTS) {
        projectGoalIds.push(o.id);
      }
    }

    if (subIds.length > 0) {
      const averages = await prisma.objective.groupBy({
        by: ["parentId"],
        where: { parentId: { in: subIds } },
        _avg: { progress: true },
      });
      for (const row of averages) {
        if (row.parentId && row._avg.progress !== null) {
          result.set(row.parentId, Math.round(row._avg.progress));
        }
      }
    }

    if (projectGoalIds.length > 0) {
      const links = await prisma.objectiveProject.findMany({
        where: { objectiveId: { in: projectGoalIds } },
        select: { objectiveId: true, projectId: true },
      });
      if (links.length > 0) {
        const counts = await prisma.task.groupBy({
          by: ["projectId", "completed"],
          where: {
            projectId: { in: [...new Set(links.map((l) => l.projectId))] },
            parentTaskId: null, // Only top-level tasks, as in calculateFromProjects
          },
          _count: { _all: true },
        });
        const perProject = new Map<string, { total: number; done: number }>();
        for (const c of counts) {
          if (!c.projectId) continue;
          const entry = perProject.get(c.projectId) ?? { total: 0, done: 0 };
          entry.total += c._count._all;
          if (c.completed) entry.done += c._count._all;
          perProject.set(c.projectId, entry);
        }
        const perGoal = new Map<string, { total: number; done: number }>();
        for (const l of links) {
          const p = perProject.get(l.projectId);
          const entry = perGoal.get(l.objectiveId) ?? { total: 0, done: 0 };
          if (p) {
            entry.total += p.total;
            entry.done += p.done;
          }
          perGoal.set(l.objectiveId, entry);
        }
        for (const [goalId, { total, done }] of perGoal) {
          result.set(goalId, total > 0 ? Math.round((done / total) * 100) : 0);
        }
      }
    }

    return result;
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
