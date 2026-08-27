import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { GoalProgressService } from "@/lib/goal-progress";
import { verifyTaskAccess, verifyProjectAccess, verifySectionWritable, getUserWorkspaceId, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import {
  executeRulesOnSectionChange,
  executeRulesOnTaskCompleted,
} from "@/lib/workflow-engine";
import {
  notifyTaskAssigned,
  notifyTaskCompleted,
  notifyTaskCollaborators,
} from "@/lib/task-notifications";
import {
  cascadeDependentDates,
  type CascadeShift,
} from "@/lib/dependency-cascade";
import { startOfTodayUtc } from "@/lib/date-only";

const updateTaskSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  completed: z.boolean().optional(),
  // Task-level visibility (Asana "Visible to"). true = private to the
  // assignee, creator and collaborators; false = visible to the project.
  isPrivate: z.boolean().optional(),
  projectId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional().nullable(),
  taskStatus: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK"]).optional().nullable(),
  myTaskSection: z.enum(["RECENTLY_ASSIGNED", "DO_TODAY", "DO_NEXT_WEEK", "DO_LATER"]).optional().nullable(),
  // Convert-to action from the task panel "More options" menu —
  // lets a regular task become a MILESTONE (gold diamond) or an
  // APPROVAL (gold thumbs-up), or back to a plain task. The
  // create-task and project-template paths already accept this
  // field; the patch path was the missing piece.
  taskType: z.enum(["TASK", "MILESTONE", "APPROVAL"]).optional().nullable(),
  position: z.number().optional(),
});

// GET /api/tasks/:taskId - Get task details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task's workspace. The guard resolves the
    // caller's project access on the way through and hands it back, so the
    // capabilities shipped to the client below cost no extra queries — and,
    // more importantly, cannot disagree with what the guard will enforce.
    const guarded = await verifyTaskAccess(userId, taskId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
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
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { position: "asc" },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            // The panel renders per-comment attachments — without this
            // include they were silently dropped from every response.
            attachments: {
              orderBy: { createdAt: "asc" },
            },
          },
          // Oldest-first: the thread reads top-down with the composer at
          // the bottom (Asana order).
          orderBy: { createdAt: "asc" },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        dependencies: {
          include: {
            blockingTask: {
              select: {
                id: true,
                name: true,
                completed: true,
                startDate: true,
                dueDate: true,
              },
            },
          },
        },
        dependents: {
          include: {
            dependentTask: {
              select: {
                id: true,
                name: true,
                completed: true,
                startDate: true,
                dueDate: true,
              },
            },
          },
        },
        collaborators: {
          select: {
            id: true,
            userId: true,
          },
        },
        customFieldValues: {
          select: {
            fieldId: true,
            value: true,
          },
        },
        taskTags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        // Extra projects this task is multi-homed into (home = projectId).
        taskProjects: {
          select: {
            id: true,
            projectId: true,
            project: { select: { id: true, name: true, color: true } },
          },
        },
        likes: {
          where: {
            userId,
          },
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            subtasks: true,
            comments: true,
            attachments: true,
            likes: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Does this task have a public tracking page? Only then can a comment be
    // shared with the submitter, and only then should the panel offer it.
    const submission = await prisma.formSubmission.findFirst({
      where: { taskId },
      select: { id: true },
    });

    // What may the CALLER do here? The panel used to render the composer, the
    // attach buttons and a delete on every attachment for anyone who could
    // open the task, so a read-only member clicked them and got a bare
    // "HTTP 403" toast. Ship the same capabilities the API enforces so the UI
    // can stop offering what the server will refuse.
    const isOwnTask = task.creatorId === userId || task.assigneeId === userId;
    const isCollaborator = task.collaborators.some((c) => c.userId === userId);
    const access = guarded.access;
    const canWrite = access ? access.canWrite || isOwnTask : isOwnTask;
    const canComment = access
      ? access.canComment ||
        access.isWorkspaceManager ||
        isOwnTask ||
        isCollaborator
      : isOwnTask || isCollaborator;

    // Resolve collaborator user details
    const collaboratorUserIds = task.collaborators.map((c) => c.userId);
    const collaboratorUsers = collaboratorUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: collaboratorUserIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

    const taskWithLiked = {
      ...task,
      isLiked: task.likes.length > 0,
      collaborators: collaboratorUsers,
      hasExternalTracking: submission != null,
      canWrite,
      canComment,
    };

    return NextResponse.json(taskWithLiked);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/:taskId - Update task
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user can WRITE this task (project ADMIN/EDITOR, owner, or the
    // task's own creator/assignee) — not merely share its workspace.
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    const body = await req.json();
    const data = updateTaskSchema.parse(body);

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        name: true,
        completed: true,
        projectId: true,
        sectionId: true,
        assigneeId: true,
        startDate: true,
        dueDate: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // The start ≤ due invariant has to be checked against the task's
    // EFFECTIVE dates, not only against what this request carries. The
    // schema-level check gave up whenever one of the two was absent, so any
    // single-field PATCH — dragging one Timeline/Gantt handle past the other —
    // saved a task that ends before it begins, and cascadeDependentDates then
    // propagated that negative duration to every dependent. An explicit null
    // still clears the date rather than falling back to the stored one.
    //
    // Only enforced when the request actually touches a date. Rows created
    // before this check existed can already be inverted, and a PATCH that
    // carries no date at all (rename, complete, assign, drag between sections)
    // is not what broke them — rejecting those would make such a task
    // permanently uneditable, including through the pickers that would repair
    // it. Every inversion a user can still cause arrives with a date attached.
    if (data.startDate !== undefined || data.dueDate !== undefined) {
      const effectiveStartDate =
        data.startDate !== undefined
          ? data.startDate
            ? new Date(data.startDate)
            : null
          : existingTask.startDate;
      const effectiveDueDate =
        data.dueDate !== undefined
          ? data.dueDate
            ? new Date(data.dueDate)
            : null
          : existingTask.dueDate;
      // Compare CALENDAR DAYS, not raw instants. Task dates reach the DB at
      // three different precisions — UTC midnight from the date-only surfaces
      // (list/gantt/timeline/calendar), local midnight and local noon from the
      // My Tasks calendar — so two writes that mean the same day can differ by
      // hours and make a legitimate same-day start/due look inverted. Only the
      // day is meaningful for this invariant.
      const effectiveStartDay = effectiveStartDate
        ? startOfTodayUtc(effectiveStartDate)
        : null;
      const effectiveDueDay = effectiveDueDate
        ? startOfTodayUtc(effectiveDueDate)
        : null;
      if (
        effectiveStartDay &&
        effectiveDueDay &&
        effectiveStartDay > effectiveDueDay
      ) {
        return NextResponse.json(
          { error: "startDate must be on or before dueDate" },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    const activities: { type: string; data: Record<string, unknown> }[] = [];
    // Set when this PATCH re-homes the task into a project it was a guest of;
    // the link is consumed inside the update transaction, never before it.
    let consumeGuestLinkForProjectId: string | null = null;

    if (data.name !== undefined && data.name !== existingTask.name) {
      updateData.name = data.name;
      activities.push({
        type: "TASK_RENAMED",
        data: { oldName: existingTask.name, newName: data.name },
      });
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
      activities.push({
        type: "TASK_DESCRIPTION_CHANGED",
        data: {},
      });
    }

    if (data.completed !== undefined && data.completed !== existingTask.completed) {
      updateData.completed = data.completed;
      updateData.completedAt = data.completed ? new Date() : null;
      activities.push({
        type: data.completed ? "TASK_COMPLETED" : "TASK_UNCOMPLETED",
        data: {},
      });
    }

    if (data.projectId !== undefined && data.projectId !== existingTask.projectId) {
      // Moving a task INTO a project requires write access on the target
      // project — otherwise a user could push tasks into projects they
      // can't edit (or merely can't see).
      if (data.projectId) {
        await verifyProjectAccess(userId, data.projectId, { requireWrite: true });
        // Re-homing INTO a project the task was merely a guest of must consume
        // the guest link, or the task is both home and guest of the same
        // project: the project page renders it once from sections.include.tasks
        // and again from multiHomedBySection — two cards with the same React
        // key in one column, and the id twice in the drag SortableContext.
        // POST /api/tasks/[taskId]/projects already 409s "task already lives in
        // this project", so home-XOR-guest is the intended invariant.
        //
        // Recorded here, EXECUTED inside the update transaction below. Deleting
        // it now would commit before the request can still be rejected — the
        // sectionId branch further down can return 400, verifySectionWritable
        // can throw, the update itself can fail — and the task would then be
        // neither re-homed nor a guest any more: it would silently vanish from
        // that project's board. That is the exact failure this patch exists to
        // remove, so the link only dies if the re-home actually lands.
        consumeGuestLinkForProjectId = data.projectId;
      }

      updateData.projectId = data.projectId;

      // Auto-assign to the first section of the new project so the task appears in views
      if (data.projectId && !data.sectionId) {
        const firstSection = await prisma.section.findFirst({
          where: { projectId: data.projectId },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        if (firstSection) {
          updateData.sectionId = firstSection.id;
        }
      }

      // If removing from project, also clear sectionId
      if (!data.projectId) {
        updateData.sectionId = null;
      }

      activities.push({
        type: "TASK_MOVED",
        data: { newProjectId: data.projectId },
      });
    }

    // Validate a supplied destination section when it CHANGES, or whenever the
    // project is changing in the same request. That second case matters:
    // PATCH { projectId: B, sectionId: <the task's CURRENT section in A> }
    // leaves sectionId "unchanged", so keying the check purely on change let it
    // slip past both this guard and the auto-assign fallback above — committing
    // projectId=B with sectionId still in A, i.e. the very split this patch
    // exists to prevent. It is deliberately NOT validated when a caller merely
    // echoes the current sectionId with no project move, so an isOwnTask editor
    // updating some other field is not newly rejected.
    const projectIsChanging =
      data.projectId !== undefined && data.projectId !== existingTask.projectId;
    if (
      data.sectionId !== undefined &&
      (data.sectionId !== existingTask.sectionId || projectIsChanging) &&
      updateData.sectionId === undefined
    ) {
      // Require WRITE on the project that owns the destination section.
      // verifyTaskAccess above only authorizes the TASK — and it passes on
      // isOwnTask alone — so proving the section merely sits in the caller's
      // workspace (the previous check) was not authorization: any task you
      // created could be pushed into a project you cannot write to, or even
      // read. This is the same act as moving by projectId, which has always
      // required write on the target a few lines above.
      if (data.sectionId !== null) {
        // expectWorkspaceId restores the bound the previous
        // assertSectionInWorkspace call provided: write access alone does not
        // keep the destination inside the caller's workspace, because a
        // project OWNER has canWrite in any workspace — including the personal
        // one every account gets at onboarding.
        const callerWorkspaceId = await getUserWorkspaceId(userId);
        const destSection = await verifySectionWritable(userId, data.sectionId, {
          expectWorkspaceId: callerWorkspaceId,
        });
        // `sectionId` sets the task's HOME section, so the destination must
        // belong to the task's own project. Accepting a section from another
        // project left projectId=A with sectionId in B: the task disappeared
        // from A's board (which renders columns via sections.include.tasks)
        // while every projectId-scoped query still counted it in A. Moving a
        // task between projects goes through `projectId` above, which
        // re-homes it properly; putting it on ANOTHER project's board without
        // moving it is what the TaskProject link is for.
        const homeProjectId = data.projectId ?? existingTask.projectId;
        if (homeProjectId && destSection.projectId !== homeProjectId) {
          return NextResponse.json(
            { error: "Section does not belong to this task's project" },
            { status: 400 }
          );
        }
        if (!homeProjectId) {
          // A projectless personal task given a section joins that section's
          // project, rather than becoming a projectId=null row that renders on
          // the board but is invisible to every projectId-scoped query. Same
          // rule POST /api/tasks applies.
          updateData.projectId = destSection.projectId;
          // This is a re-home too, so it owes the same guest-link cleanup as
          // the projectId branch: a projectless task CAN already be a guest
          // (POST /api/tasks/[taskId]/projects only rejects the task's own home
          // project, and null is never equal to it). Without this the task ends
          // up homed in AND a guest of the same project, which the detail panel
          // renders as "Projects 2" with the home project also listed as an
          // extra — and excluded from its own home-project picker.
          consumeGuestLinkForProjectId = destSection.projectId;
        }
      }
      updateData.sectionId = data.sectionId;
      activities.push({
        type: "TASK_MOVED",
        data: { newSectionId: data.sectionId },
      });
    }

    if (data.assigneeId !== undefined && data.assigneeId !== existingTask.assigneeId) {
      updateData.assigneeId = data.assigneeId;
      activities.push({
        type: data.assigneeId ? "TASK_ASSIGNED" : "TASK_UNASSIGNED",
        data: { assigneeId: data.assigneeId },
      });
    }

    // Track whether either schedule date actually changed so we know
    // whether to cascade to dependents.
    let datesChanged = false;
    if (data.dueDate !== undefined) {
      const newDueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (newDueDate?.getTime() !== existingTask.dueDate?.getTime()) {
        updateData.dueDate = newDueDate;
        datesChanged = true;
        activities.push({
          type: "DUE_DATE_CHANGED",
          data: { dueDate: data.dueDate },
        });
      }
    }

    if (data.startDate !== undefined) {
      const newStartDate = data.startDate ? new Date(data.startDate) : null;
      if (newStartDate?.getTime() !== existingTask.startDate?.getTime()) {
        updateData.startDate = newStartDate;
        datesChanged = true;
      }
    }

    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }

    // Convert-to (task ⇄ milestone ⇄ approval) — the schema accepted
    // taskType but the handler never wrote it, so the panel's "Convert
    // to" menu silently no-op'd. Persist it here.
    if (data.taskType !== undefined && data.taskType !== null) {
      updateData.taskType = data.taskType;
    }

    // Task-level visibility toggle (Asana "Make private / public").
    if (data.isPrivate !== undefined) {
      updateData.isPrivate = data.isPrivate;
    }

    if (data.taskStatus !== undefined) {
      updateData.taskStatus = data.taskStatus;
    }

    if (data.myTaskSection !== undefined) {
      updateData.myTaskSection = data.myTaskSection;
    }

    if (data.position !== undefined) {
      updateData.position = data.position;
    }

    // Wrap the task update + dependency cascade in a single transaction
    // so we never leave the schedule half-shifted if cascade throws.
    let cascadeShifts: CascadeShift[] = [];
    const task = await prisma.$transaction(async (tx) => {
      // Consume the guest link in the SAME transaction as the re-home, so a
      // failure leaves the task a guest rather than nowhere.
      if (consumeGuestLinkForProjectId) {
        await tx.taskProject.deleteMany({
          where: { taskId, projectId: consumeGuestLinkForProjectId },
        });
      }
      const updated = await tx.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
          assignee: {
            select: { id: true, name: true, email: true, image: true },
          },
          creator: {
            select: { id: true, name: true, email: true, image: true },
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
          section: { select: { id: true, name: true } },
          subtasks: {
            select: { id: true, name: true, completed: true },
          },
          _count: {
            select: {
              subtasks: true,
              comments: true,
              attachments: true,
              likes: true,
            },
          },
        },
      });
      if (datesChanged) {
        // Pass the pre-edit dates so dependents shift by the same delta the
        // schedule moved (gap-preserving, both directions — MS-Project style)
        // instead of only being pushed when a constraint breaks.
        cascadeShifts = await cascadeDependentDates(tx, taskId, {
          start: existingTask.startDate,
          end: existingTask.dueDate,
        });
      }
      return updated;
    });

    // Create activity logs
    for (const activity of activities) {
      await prisma.activity.create({
        data: {
          type: activity.type as "TASK_CREATED" | "TASK_COMPLETED" | "TASK_UNCOMPLETED" | "TASK_ASSIGNED" | "TASK_UNASSIGNED" | "TASK_MOVED" | "TASK_RENAMED" | "TASK_DESCRIPTION_CHANGED" | "DUE_DATE_CHANGED" | "COMMENT_ADDED" | "ATTACHMENT_ADDED" | "CUSTOM_FIELD_CHANGED" | "SUBTASK_ADDED" | "DEPENDENCY_ADDED",
          taskId,
          userId,
          data: activity.data as object,
        },
      });
    }

    // Recalculate goal progress if task completion status changed
    if (data.completed !== undefined && data.completed !== existingTask.completed) {
      try {
        await GoalProgressService.recalculateForTask(taskId);
      } catch (progressError) {
        // Log but don't fail the request if progress calculation fails
        console.error("Error recalculating goal progress:", progressError);
      }
    }

    // Fire workflow rules when a task lands in a new section. The
    // engine is fire-and-forget for caller purposes — any rule
    // failure is logged inside the engine and never propagates
    // back to the user's task move. The new sectionId we look up
    // is whatever ended up in updateData.sectionId (could come
    // from explicit section change OR auto-assign on project move).
    const newSectionId =
      typeof updateData.sectionId === "string" ? updateData.sectionId : null;
    const sectionDidChange =
      newSectionId !== null && newSectionId !== existingTask.sectionId;
    const projectIdForRules = task.projectId;
    if (sectionDidChange && projectIdForRules) {
      await executeRulesOnSectionChange(
        { taskId, actorUserId: userId },
        newSectionId,
        projectIdForRules
      );
    }

    // Fire workflow rules on positive-completion transition only —
    // re-uncompleting a task doesn't re-fire the chain, by design.
    const completionDidFlipTrue =
      data.completed === true && existingTask.completed === false;
    if (completionDidFlipTrue && projectIdForRules) {
      await executeRulesOnTaskCompleted(
        { taskId, actorUserId: userId },
        projectIdForRules
      );
    }

    // Inbox notification + email when the assignment changed to a
    // NEW person (other than the actor). Unassignment and re-
    // assignments back to the same user stay silent.
    const assigneeDidChange =
      data.assigneeId !== undefined &&
      data.assigneeId !== existingTask.assigneeId &&
      data.assigneeId !== null &&
      data.assigneeId !== userId;
    if (assigneeDidChange && data.assigneeId) {
      try {
        await notifyTaskAssigned({
          taskId,
          assigneeId: data.assigneeId,
          assignerUserId: userId,
          taskName: task.name,
          projectId: task.projectId ?? null,
          projectName: task.project?.name ?? null,
          dueDate: task.dueDate ?? null,
        });
      } catch (err) {
        console.error("[tasks PATCH] notifyTaskAssigned failed:", err);
      }
    }

    // Inbox notification to the task creator when someone OTHER
    // than them flips the task to completed. Re-opening (true →
    // false) and self-completing stay silent. Mirror of the
    // assignment notify in the opposite direction.
    if (completionDidFlipTrue && task.creator?.id) {
      try {
        await notifyTaskCompleted({
          taskId,
          recipientUserId: task.creator.id,
          completerUserId: userId,
          taskName: task.name,
          projectId: task.projectId ?? null,
          projectName: task.project?.name ?? null,
        });
      } catch (err) {
        console.error("[tasks PATCH] notifyTaskCompleted failed:", err);
      }
    }

    // Fan the completion out to the task's collaborators (followers)
    // too — excluding the actor and the creator (who got the ping above).
    if (completionDidFlipTrue) {
      try {
        await notifyTaskCollaborators({
          taskId,
          actorUserId: userId,
          type: "TASK_COMPLETED",
          taskName: task.name,
          projectId: task.projectId ?? null,
          projectName: task.project?.name ?? null,
          excludeUserIds: task.creator?.id ? [task.creator.id] : [],
        });
      } catch (err) {
        console.error("[tasks PATCH] notifyTaskCollaborators failed:", err);
      }
    }

    return NextResponse.json({ ...task, cascadeShifts });
  } catch (error) {
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
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:taskId - Delete task
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user can WRITE (delete) this task, not merely share its workspace.
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    await prisma.task.delete({
      where: { id: taskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
