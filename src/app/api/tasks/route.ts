import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId, verifyProjectAccess, verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { readJson, jsonErrorResponse } from "@/lib/http";
import { notifyTaskAssigned } from "@/lib/task-notifications";

const createTaskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  description: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
  parentTaskId: z.string().optional().nullable(),
  taskType: z.enum(["TASK", "MILESTONE", "APPROVAL"]).optional(),
  myTaskSection: z.enum(["RECENTLY_ASSIGNED", "DO_TODAY", "DO_NEXT_WEEK", "DO_LATER"]).optional().nullable(),
});

// GET /api/tasks - Get tasks
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const sectionId = searchParams.get("sectionId");
    const assigneeId = searchParams.get("assigneeId");
    const completed = searchParams.get("completed");
    const myTasks = searchParams.get("myTasks") === "true";
    // Safety bound so a single request can't pull an unbounded result set
    // with the heavy include below (audit DB-02). Default 1000 is well above
    // realistic per-view task counts; callers can raise it up to 2000.
    const take = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "1000", 10) || 1000, 1),
      2000
    );

    // Scope to user's workspace
    const workspaceId = await getUserWorkspaceId(userId);

    const whereClause: Record<string, unknown> = {
      parentTaskId: null, // Only get top-level tasks
    };

    if (myTasks) {
      // For "My Tasks", include tasks with a project in this workspace OR tasks without a project assigned to user
      whereClause.OR = [
        { project: { workspaceId } },
        { projectId: null, creatorId: userId },
      ];
      whereClause.assigneeId = userId;
    } else {
      // For project/section views, scope to workspace
      whereClause.project = { workspaceId };
    }

    if (projectId) {
      // Enforce project-level read access, not just workspace scoping:
      // otherwise any workspace member could list every task (with custom
      // fields, tags, dependencies) of a PRIVATE/WORKSPACE project they
      // cannot open. verifyProjectAccess throws NotFound/Authorization,
      // mapped to 404/403 in the catch below.
      if (!myTasks) {
        await verifyProjectAccess(userId, projectId);
      }
      whereClause.projectId = projectId;
    }

    if (sectionId) {
      whereClause.sectionId = sectionId;
    }

    if (assigneeId && !myTasks) {
      whereClause.assigneeId = assigneeId;
    }

    if (completed !== null) {
      whereClause.completed = completed === "true";
    }

    // When the caller asks specifically for completed tasks (My Tasks
    // "Completed" tab), surface the most-recent completions first.
    // Otherwise keep the position/createdAt ordering used everywhere else.
    const orderBy: Prisma.TaskOrderByWithRelationInput[] =
      completed === "true"
        ? [{ completedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        : [{ position: "asc" }, { createdAt: "desc" }];

    const tasks = await prisma.task.findMany({
      where: whereClause,
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
            type: true,
            gate: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        subtasks: {
          select: {
            id: true,
            name: true,
            completed: true,
          },
        },
        // Dependencies for the "Blocked by" / "Blocks" built-in
        // columns in My Tasks list. "dependencies" = rows where this
        // task IS the dependent → the blockingTask is what blocks me.
        // "dependents" = rows where this task IS the blocker → the
        // dependentTask is what I block.
        dependencies: {
          select: {
            blockingTask: {
              select: { id: true, name: true, completed: true },
            },
          },
        },
        dependents: {
          select: {
            dependentTask: {
              select: { id: true, name: true, completed: true },
            },
          },
        },
        // Custom field values + their definitions so the My Tasks
        // list can render pinned custom-field columns in one round
        // trip. Each row carries everything CustomFieldCell needs:
        // fieldId, value JSON, and the parent field's name/type/options.
        customFieldValues: {
          select: {
            fieldId: true,
            value: true,
            field: {
              select: {
                id: true,
                name: true,
                type: true,
                options: true,
              },
            },
          },
        },
        // Tags — for the "Tags" built-in column in My Tasks. Embedded
        // so chip rendering doesn't need a follow-up fetch per task.
        taskTags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: {
          select: {
            subtasks: true,
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy,
      take,
    });

    return NextResponse.json(tasks);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create task
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJson(req);
    const data = createTaskSchema.parse(body);

    // Verify user has access to the target project
    if (data.projectId) {
      await verifyProjectAccess(userId, data.projectId);
    }

    // When creating a subtask, the caller must have access to the parent —
    // otherwise a new task could be grafted under a parent in another
    // workspace, polluting that task's subtree.
    if (data.parentTaskId) {
      await verifyTaskAccess(userId, data.parentTaskId);
    }

    // Auto-assign to the creator ONLY for projectless personal tasks (the
    // My Tasks quick-add). Project tasks stay unassigned unless an assignee
    // is explicitly provided — otherwise every task typed into a project's
    // List/Board/Calendar would silently be assigned to whoever created it
    // (not Asana's behaviour). `undefined` = field omitted; `null` = an
    // explicit "leave unassigned".
    const assigneeId =
      data.assigneeId !== undefined
        ? data.assigneeId
        : data.projectId
        ? null
        : userId;

    // Wrap position calculation and task creation in a transaction to prevent race conditions
    const task = await prisma.$transaction(async (tx) => {
      // Auto-place a project task into the first section when none was given
      // (e.g. Calendar day-cell quick-add). The project page loads tasks only
      // through sections.include.tasks, so a sectionId-null project task would
      // be invisible everywhere. Subtasks (parentTaskId set) keep their own
      // placement and are skipped.
      let resolvedSectionId = data.sectionId ?? null;
      if (!resolvedSectionId && data.projectId && !data.parentTaskId) {
        const firstSection = await tx.section.findFirst({
          where: { projectId: data.projectId },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        if (firstSection) resolvedSectionId = firstSection.id;
      }

      // Get the next position for the task
      let position = 0;
      if (resolvedSectionId) {
        const lastTask = await tx.task.findFirst({
          where: { sectionId: resolvedSectionId },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        position = (lastTask?.position ?? -1) + 1;
      } else if (data.projectId) {
        const lastTask = await tx.task.findFirst({
          where: { projectId: data.projectId, sectionId: null },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        position = (lastTask?.position ?? -1) + 1;
      }

      return tx.task.create({
        data: {
          name: data.name,
          description: data.description,
          projectId: data.projectId,
          sectionId: resolvedSectionId,
          assigneeId: assigneeId,
          creatorId: userId,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          priority: data.priority || "NONE",
          taskType: data.taskType || "TASK",
          parentTaskId: data.parentTaskId,
          myTaskSection: data.myTaskSection || null,
          position,
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
              type: true,
              gate: true,
            },
          },
          section: {
            select: {
              id: true,
              name: true,
            },
          },
          subtasks: {
            select: {
              id: true,
              name: true,
              completed: true,
            },
          },
          _count: {
            select: {
              subtasks: true,
              comments: true,
              attachments: true,
            },
          },
        },
      });
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "TASK_CREATED",
        taskId: task.id,
        userId,
        data: { taskName: task.name },
      },
    });

    // Fire inbox notification + email when the task was assigned to
    // someone OTHER than the creator. Self-assignments stay silent.
    // Best-effort: a failure here doesn't undo the task creation.
    if (task.assigneeId && task.assigneeId !== userId) {
      try {
        await notifyTaskAssigned({
          taskId: task.id,
          assigneeId: task.assigneeId,
          assignerUserId: userId,
          taskName: task.name,
          projectId: task.projectId ?? null,
          projectName: task.project?.name ?? null,
          dueDate: task.dueDate ?? null,
        });
      } catch (err) {
        console.error("[tasks POST] notifyTaskAssigned failed:", err);
      }
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const badJson = jsonErrorResponse(error);
    if (badJson) return badJson;
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
