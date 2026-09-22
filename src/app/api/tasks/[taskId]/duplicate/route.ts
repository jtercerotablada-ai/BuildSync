import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

// POST /api/tasks/:taskId/duplicate - Duplicate a task
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task's workspace
    // Duplicating CREATES a task carrying the original's projectId and
    // sectionId, so it is a write onto that project's board — a read-only
    // caller (a task follower, or a VIEWER/COMMENTER member) must not be able
    // to do it. requireWrite still admits the task's creator/assignee, so
    // duplicating your own task is unaffected.
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    // Get the original task
    const originalTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subtasks: { orderBy: { position: "asc" } },
        collaborators: { select: { userId: true } },
      },
    });

    if (!originalTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // A private task's copy must stay private — the flag defaulted to false,
    // so "Copy of <confidential note>" landed on the board for the whole
    // project. The copy's audience is the original's: a private task is seen
    // only by its creator, assignee and followers, so the copy keeps all three
    // (the same rule project duplication applies). Otherwise whoever clicked
    // Duplicate would become the only creator and the original's author and
    // assignee would be locked out of the copy. The caller rides along as a
    // follower so they can still open what they just made.
    const isPrivate = originalTask.isPrivate;

    // A projectless task lives only in its assignee's My Tasks, so an
    // unassigned projectless copy showed up in no view at all. Give it to the
    // caller, the same rule POST /api/tasks applies to a My Tasks quick-add.
    // Project tasks still leave the assignee for the user to choose.
    const defaultAssigneeId = originalTask.projectId ? null : userId;
    const assigneeId = isPrivate
      ? originalTask.assigneeId ?? defaultAssigneeId
      : defaultAssigneeId;
    const creatorId = isPrivate ? originalTask.creatorId ?? userId : userId;
    const collaboratorIds = isPrivate
      ? [
          ...new Set([
            ...originalTask.collaborators.map((c) => c.userId),
            userId,
          ]),
        ].filter((uid) => uid !== creatorId && uid !== assigneeId)
      : [];

    const duplicatedTask = await prisma.$transaction(async (tx) => {
      // A duplicated subtask is a sibling under the same parent, so its
      // position is counted among those siblings rather than the column's
      // top-level tasks.
      const maxPosition = await tx.task.aggregate({
        where: originalTask.parentTaskId
          ? { parentTaskId: originalTask.parentTaskId }
          : {
              projectId: originalTask.projectId,
              sectionId: originalTask.sectionId,
              parentTaskId: null,
            },
        _max: {
          position: true,
        },
      });

      const created = await tx.task.create({
        data: {
          name: `Copy of ${originalTask.name}`,
          description: originalTask.description,
          completed: false,
          startDate: originalTask.startDate,
          dueDate: originalTask.dueDate,
          priority: originalTask.priority,
          taskStatus: originalTask.taskStatus,
          taskType: originalTask.taskType,
          isPrivate,
          myTaskSection: originalTask.myTaskSection,
          position: (maxPosition._max.position ?? 0) + 1,
          projectId: originalTask.projectId,
          sectionId: originalTask.sectionId,
          parentTaskId: originalTask.parentTaskId,
          assigneeId,
          creatorId,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          section: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (collaboratorIds.length > 0) {
        await tx.taskCollaborator.createMany({
          data: collaboratorIds.map((uid) => ({ taskId: created.id, userId: uid })),
          skipDuplicates: true,
        });
      }

      // Duplicate subtasks in the same transaction, so a failure never leaves
      // a copy that silently lost its checklist.
      if (originalTask.subtasks.length > 0) {
        await tx.task.createMany({
          data: originalTask.subtasks.map((subtask, index) => ({
            name: subtask.name,
            description: subtask.description,
            completed: false,
            startDate: subtask.startDate,
            dueDate: subtask.dueDate,
            priority: subtask.priority,
            taskType: subtask.taskType,
            isPrivate: subtask.isPrivate,
            position: index,
            parentTaskId: created.id,
            projectId: originalTask.projectId,
            sectionId: originalTask.sectionId,
            // A private subtask keeps its own audience, like the parent copy.
            assigneeId: subtask.isPrivate
              ? subtask.assigneeId ?? assigneeId
              : assigneeId,
            creatorId: subtask.isPrivate ? subtask.creatorId ?? creatorId : userId,
          })),
        });
      }

      return created;
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "TASK_CREATED",
        taskId: duplicatedTask.id,
        userId,
        data: { duplicatedFrom: taskId },
      },
    });

    return NextResponse.json(duplicatedTask, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error duplicating task:", error);
    return NextResponse.json(
      { error: "Failed to duplicate task" },
      { status: 500 }
    );
  }
}
