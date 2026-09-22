import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId, verifyProjectAccess, verifyTaskAccess, verifySectionWritable, assertUserInWorkspace, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { readJson, jsonErrorResponse } from "@/lib/http";
import { buildProjectVisibilityClauses, taskPrivacyClause } from "@/lib/project-visibility";
import { notifyTaskAssigned, autoFollowTasks } from "@/lib/task-notifications";
import { executeRulesOnSectionChange } from "@/lib/workflow-engine";
import { GoalProgressService } from "@/lib/goal-progress";
import { recomputeRollupsForAncestors } from "@/lib/formula-eval";

// Hard ceiling for the open half of a My Tasks query (see GET below). Far
// above any real workload; it exists only so one request stays bounded.
const MY_TASKS_OPEN_CEILING = 5000;

// Schedule dates arrive as ISO strings. Validate them at the edge so a
// malformed one comes back as a 400 naming the field, instead of reaching
// Prisma as an `Invalid Date` and falling through to the generic 500. An
// empty string is still accepted: the handlers below read it as "no date",
// which is how the client clears a schedule field.
const dateString = z
  .string()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "Invalid date");

const createTaskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  description: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: dateString.optional().nullable(),
  startDate: dateString.optional().nullable(),
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
    // Pickers (dependencies, references) opt in to subtasks too, so a step
    // like "Submit sealed calcs" can be chosen as a blocker.
    const includeSubtasks = searchParams.get("includeSubtasks") === "true";
    // Optional name search (?q=). Pickers used to pull the whole workspace
    // list and filter it in the browser, which silently missed anything past
    // the row cap; a server-side match keeps them complete and small.
    const q = searchParams.get("q")?.trim() ?? "";
    // Opt-in slim mode (?fields=summary): dashboard widgets only need a
    // handful of fields, so skip the heavy include below entirely.
    const fields = searchParams.get("fields");
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
      // A task flagged private belongs to its assignee and creator; every
      // other colleague must not see it in a list, however wide their project
      // role. Same clause /api/search, /api/reports and /api/ai/assist use.
      //
      // It goes in an AND of its own, NOT merged into whereClause.OR: that key
      // belongs to the myTasks scope below, and an OR written twice replaces
      // the scope instead of intersecting it. And it goes in the WHERE rather
      // than a filter over the result, because `take` caps this query at 1000
      // rows — dropping rows afterwards would silently shorten a page the
      // caller is entitled to see.
      AND: [taskPrivacyClause(userId)],
    };
    if (!includeSubtasks) {
      whereClause.parentTaskId = null; // Only get top-level tasks
    }

    if (myTasks) {
      // For "My Tasks", include tasks with a project in this workspace OR any
      // projectless task assigned to the user, whoever created it (a
      // colleague's personal to-do handed to them must show up here).
      whereClause.OR = [
        { project: { workspaceId } },
        { projectId: null },
      ];
      whereClause.assigneeId = userId;
    } else if (projectId) {
      // A single project: verifyProjectAccess below is the read gate, and it
      // carries its own tenant check. No primary-workspace clause here, or a
      // readable project in another workspace comes back empty.
    } else {
      // No project named (pickers, ?sectionId=, ?assigneeId=): only projects
      // the caller could open. A bare workspace scope listed the tasks of
      // PRIVATE projects to people who get a 404 on the project itself.
      const visibility = await buildProjectVisibilityClauses(userId);
      if (!visibility) {
        return NextResponse.json([]);
      }
      whereClause.project = { AND: [{ workspaceId }, { OR: visibility }] };
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

    if (q) {
      whereClause.name = { contains: q, mode: "insensitive" };
    }

    // When the caller asks specifically for completed tasks (My Tasks
    // "Completed" tab), surface the most-recent completions first.
    // Otherwise keep the position/createdAt ordering used everywhere else.
    const orderBy: Prisma.TaskOrderByWithRelationInput[] =
      completed === "true"
        ? [{ completedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        : [{ position: "asc" }, { createdAt: "desc" }];

    // My Tasks with no completion filter used to share one 1000-row cap with
    // every task the user ever completed, so once history piled up, OPEN work
    // past the cap silently vanished from every My Tasks view. Open tasks are
    // now fetched in full (bounded only by a hard ceiling) and the cap applies
    // to completed ones, most recent first. The merged list keeps the usual
    // position / createdAt order.
    const splitMyTasks = myTasks && completed === null;
    const runQuery = async <T extends { completed: boolean; position: number; createdAt: Date }>(
      find: (args: {
        where: Record<string, unknown>;
        orderBy: Prisma.TaskOrderByWithRelationInput[];
        take: number;
      }) => Promise<T[]>
    ): Promise<T[]> => {
      if (!splitMyTasks) {
        return find({ where: whereClause, orderBy, take });
      }
      const [open, done] = await Promise.all([
        find({
          where: { ...whereClause, completed: false },
          orderBy,
          take: MY_TASKS_OPEN_CEILING,
        }),
        find({
          where: { ...whereClause, completed: true },
          orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
          take,
        }),
      ]);
      return [...open, ...done].sort(
        (a, b) =>
          a.position - b.position ||
          b.createdAt.getTime() - a.createdAt.getTime()
      );
    };

    if (fields === "summary") {
      const tasks = await runQuery((args) => prisma.task.findMany({
        ...args,
        select: {
          id: true,
          name: true,
          completed: true,
          // Lets widgets sort their Completed views by recency without
          // paying for the full include.
          completedAt: true,
          dueDate: true,
          taskType: true,
          projectId: true,
          // Needed only to merge the two halves of a My Tasks query in order.
          position: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      }));
      return NextResponse.json(tasks);
    }

    const tasks = await runQuery((args) => prisma.task.findMany({
      ...args,
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
            // Project privacy → drives the My Tasks "Visibility" column
            // (Lock/"Only me" for PRIVATE projects vs Globe/"My
            // workspace" for WORKSPACE). Projectless personal tasks are
            // treated as private client-side.
            visibility: true,
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
        // Collaborators — for the "Collaborators" built-in column in My
        // Tasks (Asana shows collaborators here, NOT the assignee). Up to
        // a handful of stacked avatars + a +N overflow render from this.
        collaborators: {
          select: {
            user: {
              select: { id: true, name: true, image: true },
            },
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
            // Likes count — for the optional "Likes" built-in column and
            // the Likes sort. The relation is `likes` on the Task model
            // (TaskLike[]), verified against prisma/schema.prisma.
            likes: true,
          },
        },
      },
    }));

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

    // A subtask belongs to its parent's project and column. The task panel
    // posts only { name, parentTaskId }, and this route used to store that as
    // a projectless row auto-assigned to whoever typed it — so no teammate
    // could check it off, rename or delete it (the projectless access branch
    // admits only creator/assignee), and project counts never saw it.
    //
    // The caller must be able to WRITE the parent, and that write is the
    // gate for the subtask too — this is the one subtask-create path, so it
    // carries the one rule: requireWrite still admits the parent's own
    // creator/assignee.
    let parentPlacement: { projectId: string | null; sectionId: string | null } | null = null;
    if (data.parentTaskId) {
      await verifyTaskAccess(userId, data.parentTaskId, { requireWrite: true });
      const parent = await prisma.task.findUnique({
        where: { id: data.parentTaskId },
        select: { projectId: true, sectionId: true },
      });
      if (!parent) {
        throw new NotFoundError("Task not found");
      }
      if (data.projectId && data.projectId !== parent.projectId) {
        return NextResponse.json(
          { error: "A subtask must belong to its parent's project" },
          { status: 400 }
        );
      }
      parentPlacement = parent;
      data.projectId = parent.projectId;
      data.sectionId = parent.sectionId;
    }

    // Verify user has WRITE access to the target project — a read-only
    // VIEWER/COMMENTER must not be able to create tasks. Projectless
    // personal tasks (My Tasks quick-add) skip this branch entirely.
    if (data.projectId && !parentPlacement) {
      await verifyProjectAccess(userId, data.projectId, { requireWrite: true });
    }

    // A client-supplied sectionId is a DESTINATION exactly like projectId, and
    // must cost the same. Without this the gate above could be skipped outright
    // by omitting projectId and naming only a section: the task was created
    // with projectId=null and the caller's section id written verbatim, and the
    // project page loads its columns as sections:{include:{tasks}} filtered
    // only by parentTaskId — so it rendered on that project's board for every
    // real member, created by someone with no access to it at all. Naming a
    // section of a DIFFERENT project than data.projectId was equally accepted
    // and left the row incoherent (projectId=A, sectionId in B).
    if (data.sectionId && !parentPlacement) {
      // expectWorkspaceId keeps the destination inside the caller's own
      // workspace: write access alone does not, since a project OWNER has
      // canWrite in any workspace (including their personal singleton).
      const callerWorkspaceId = await getUserWorkspaceId(userId);
      const section = await verifySectionWritable(userId, data.sectionId, {
        expectWorkspaceId: callerWorkspaceId,
      });
      if (data.projectId && data.projectId !== section.projectId) {
        return NextResponse.json(
          { error: "Section does not belong to the target project" },
          { status: 400 }
        );
      }
      // A task's section must belong to the task's own project. Callers that
      // name only a section (none ship today, but the shape is accepted) get
      // the owning project rather than a projectId=null orphan.
      data.projectId = section.projectId;
    }

    // Same start ≤ due invariant the PATCH handler enforces. Without it here,
    // create is a side door for the very rows that check exists to prevent: an
    // inverted schedule ships straight into cascadeDependentDates the first
    // time either date is nudged.
    if (data.startDate && data.dueDate) {
      if (new Date(data.startDate) > new Date(data.dueDate)) {
        return NextResponse.json(
          { error: "startDate must be on or before dueDate" },
          { status: 400 }
        );
      }
    }

    // Auto-assign to the creator ONLY for projectless personal tasks (the
    // My Tasks quick-add). Project tasks and subtasks stay unassigned unless
    // an assignee is explicitly provided — otherwise every task typed into a
    // project's List/Board/Calendar would silently be assigned to whoever
    // created it (not Asana's behaviour). `undefined` = field omitted; `null`
    // = an explicit "leave unassigned".
    const assigneeId =
      data.assigneeId !== undefined
        ? data.assigneeId
        : data.projectId || data.parentTaskId
        ? null
        : userId;

    // The assignee gets read and write on the task and an email naming it, so
    // it must be a member of the workspace the task lives in.
    if (assigneeId && assigneeId !== userId) {
      const assigneeWorkspaceId = data.projectId
        ? (
            await prisma.project.findUnique({
              where: { id: data.projectId },
              select: { workspaceId: true },
            })
          )?.workspaceId
        : await getUserWorkspaceId(userId);
      if (!assigneeWorkspaceId) {
        throw new NotFoundError("Project not found");
      }
      try {
        await assertUserInWorkspace(assigneeId, assigneeWorkspaceId);
      } catch (err) {
        if (err instanceof AuthorizationError) {
          return NextResponse.json(
            { error: "Assignee is not a member of this workspace" },
            { status: 400 }
          );
        }
        throw err;
      }
    }

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

      // Get the next position for the task. A subtask is ordered among its
      // siblings, not among the column's top-level cards.
      let position = 0;
      if (data.parentTaskId) {
        const lastSibling = await tx.task.findFirst({
          where: { parentTaskId: data.parentTaskId },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        position = (lastSibling?.position ?? -1) + 1;
      } else if (resolvedSectionId) {
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
    // The parent's feed records the new subtask, as the dedicated subtasks
    // route always did.
    if (task.parentTaskId) {
      await prisma.activity
        .create({
          data: {
            type: "SUBTASK_ADDED",
            taskId: task.parentTaskId,
            userId,
            data: { subtaskId: task.id, subtaskName: task.name },
          },
        })
        .catch((err) => {
          console.error("[tasks POST] subtask activity failed:", err);
        });
    }

    // A new subtask changes the set its ancestors' roll-ups aggregate.
    if (task.parentTaskId) {
      try {
        await recomputeRollupsForAncestors(task.parentTaskId);
      } catch (err) {
        console.error("[tasks POST] roll-up recompute failed:", err);
      }
    }

    // A goal fed by this project counts its top-level tasks, so a new one
    // moves the percentage just as a completion does.
    if (task.projectId && !task.parentTaskId) {
      try {
        await GoalProgressService.recalculateForProject(task.projectId);
      } catch (err) {
        console.error("[tasks POST] goal recalc failed:", err);
      }
    }

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
      // The assignee follows the task (Asana behaviour) so they keep hearing
      // about it; the creator is notified of comments and completion anyway.
      await autoFollowTasks(
        [{ taskId: task.id, userId: task.assigneeId }],
        "tasks POST"
      );
    }

    // A task created straight into a section has ENTERED that section just
    // like a card dragged in from another column, so it fires the same
    // rules (Asana's trigger is "task added to this section"). Without
    // this, "+ Add task" inside a column silently skipped the automation
    // while a drag into the same column ran it. Subtasks are excluded —
    // section rules only govern top-level tasks. The engine never throws.
    if (task.projectId && task.sectionId && !task.parentTaskId) {
      await executeRulesOnSectionChange(
        { taskId: task.id, actorUserId: userId },
        task.sectionId,
        task.projectId
      );
      // Rules may have just changed the row (assignee, priority, complete),
      // so re-read rather than returning the pre-rule snapshot.
      const fresh = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
          assignee: { select: { id: true, name: true, email: true, image: true } },
          creator: { select: { id: true, name: true, email: true, image: true } },
          project: { select: { id: true, name: true, color: true } },
          section: { select: { id: true, name: true } },
        },
      });
      if (fresh) return NextResponse.json(fresh, { status: 201 });
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
