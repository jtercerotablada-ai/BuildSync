import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { buildProjectVisibilityClauses } from "@/lib/project-visibility";
import { getTemplateById } from "@/lib/templates-data";
import { readJson, jsonErrorResponse } from "@/lib/http";
import { legacyGateFor, stagesForType } from "@/lib/pipelines";
import { INITIALLY_HIDDEN_VIEWS } from "@/lib/project-views";
import { templateTaskDates } from "@/lib/template-schedule";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().optional().default("#c9a84c"),
  icon: z.string().optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().optional(),
  templateId: z.string().optional(), // Template to use for project creation
  startDate: z.string().optional(), // For calculating relative due dates
  endDate: z.string().optional(), // Target completion date
  // Engineering firm extensions
  type: z.enum(["CONSTRUCTION", "DESIGN", "RECERTIFICATION", "PERMIT", "BSIP"]).optional(),
  // No `gate` here on purpose. It is derived from the stage below, and zod
  // drops the key silently, so the template gallery can keep sending the one
  // its presets carry without a 400 and without a second writer.
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  budget: z.number().optional(),
  currency: z.string().optional(),
  clientName: z.string().optional(),
  // Explicit initial sections — when provided (e.g. from a project
  // template gallery pick) we use these instead of the default
  // "To do / In progress / Done" so the kanban columns reflect the
  // template's intent.
  sections: z.array(z.string().min(1).max(80)).optional(),
  // Pre-baked tasks (with optional subtasks) created after sections.
  // Each task's `section` must match one of the section names exactly
  // — unmatched tasks are silently skipped (defensive).
  tasks: z
    .array(
      z.object({
        section: z.string().min(1).max(80),
        name: z.string().min(1).max(200),
        type: z.enum(["TASK", "MILESTONE", "APPROVAL"]).optional(),
        // The step's instructions. A template that carries only titles makes
        // the next engineer re-derive how the work is actually done.
        description: z.string().max(5000).optional(),
        priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
        // Days from the project start date (today, unless overridden) to
        // set as the task's due date — lets a template ship a starting
        // schedule anchored on "today" that the engineer then adjusts.
        relativeDueDate: z.number().int().optional(),
        // The mirror offset, to the task's START date. Without it every
        // template task lands as a one-day bar and a 40-year recertification
        // opens as ~35 of them for the engineer to stretch by hand.
        relativeStartDate: z.number().int().optional(),
        // Names of other tasks in this payload that must finish before this
        // one — materialized as finish-to-start TaskDependencies after all
        // tasks are created. Unmatched names are skipped defensively.
        dependsOn: z.array(z.string().min(1).max(200)).optional(),
        subtasks: z.array(z.string().min(1).max(200)).optional(),
        // Custom-field values keyed by field NAME (not id). Resolved
        // server-side after the customFields below are created.
        customFieldValues: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  // Custom field definitions a project-template wants applied. Created
  // + linked to the new project before task creation so tasks can
  // reference them by name via `customFieldValues`.
  customFields: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        type: z.enum([
          "TEXT",
          "NUMBER",
          "DATE",
          "DROPDOWN",
          "MULTI_SELECT",
          "PEOPLE",
          "CHECKBOX",
          "CURRENCY",
          "PERCENTAGE",
        ]),
        options: z
          .array(
            z.object({
              id: z.string().min(1),
              label: z.string().min(1).max(80),
              color: z.string().optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

// GET /api/projects - Get user's projects
//
// ── Access control ────────────────────────────────────────────
// Visibility is hierarchical, not flat:
//
//   OWNER + L5+ Executive  → all workspace projects, period.
//   L4 Management          → all workspace projects (PM/PE/Office
//                            Admin need cross-project visibility
//                            to coordinate).
//   L1–L3                  → ONLY projects where they are the
//                            owner or an explicit ProjectMember.
//                            visibility=WORKSPACE no longer auto-
//                            grants access — that was leaking
//                            projects to invited users who were
//                            only meant to see one specific
//                            project.
//
// PUBLIC visibility still bypasses for everyone (intentionally
// open content like demo / showcase projects).
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const query = searchParams.get("q") || "";
    // Archived projects are hidden from the list by default.
    // ?includeArchived=true WIDENS the result to archived rows alongside
    // the active ones; ?archivedOnly=true NARROWS it to archived rows
    // only, so an Archived view can ask for what it renders instead of
    // fetching the whole workspace and throwing the active half away.
    // Precedence: archivedOnly wins — it is the more specific request,
    // and sending both is only ever a mistake.
    const includeArchived = searchParams.get("includeArchived") === "true";
    const archivedOnly = searchParams.get("archivedOnly") === "true";
    // Optional widget knobs. Absent params keep the historical behavior:
    // no row cap and updatedAt-desc ordering.
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : null;
    const take = limit && limit > 0 ? limit : undefined;
    const sort = searchParams.get("sort");
    const orderBy:
      | Prisma.ProjectOrderByWithRelationInput
      | Prisma.ProjectOrderByWithRelationInput[] =
      sort === "alphabetical"
        ? { name: "asc" }
        : sort === "status"
          ? [{ status: "asc" }, { updatedAt: "desc" }]
          : { updatedAt: "desc" };
    // ?fields=summary returns a slim row (id/name/color/icon/status +
    // task count) for lightweight consumers like the home projects
    // widget and @mention pickers — no owner, members or task rows.
    // Absent param keeps the historical fully-hydrated shape.
    const fields = searchParams.get("fields");

    // ── Per-workspace access resolution ────────────────────────
    // Critical: a user may belong to MULTIPLE workspaces (e.g.
    // their own personal workspace where they're OWNER, plus a
    // firm workspace where they were invited as MEMBER). The role
    // and effective level differ PER workspace. Resolving access
    // globally is wrong — the OWNER status of their personal
    // workspace would leak the firm workspace's projects too.
    //
    // We fetch each WorkspaceMember row and build a visibility
    // clause specific to that workspace, then OR them.
    // Shared with /api/mentions and /api/search — see @/lib/project-visibility.
    const visibilityClauses = await buildProjectVisibilityClauses(userId);
    if (!visibilityClauses) {
      return NextResponse.json([]);
    }

    const where: Prisma.ProjectWhereInput = {
      AND: [
        workspaceId ? { workspaceId } : {},
        query ? { name: { contains: query, mode: "insensitive" } } : {},
        archivedOnly
          ? { isArchived: true }
          : includeArchived
            ? {}
            : { isArchived: false },
        { OR: visibilityClauses },
      ],
    };

    if (fields === "summary") {
      const projects = await prisma.project.findMany({
        where,
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
          status: true,
          // Counted with the caller's own visibility, not a bare
          // `tasks: true`. A relation count ignores privacy, so the card
          // said "3 tasks" to someone who could open one of them — the
          // number disagreed with every list that renders it.
          _count: {
            select: {
              tasks: { where: taskPrivacyClause(userId) },
            },
          },
        },
        orderBy,
        ...(take ? { take } : {}),
      });
      return NextResponse.json(projects);
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        // Root-level tasks pulled with just `completed` so the
        // /projects/all PMI-grade list view can derive EV (Earned
        // Value), CPI, SPI, etc. client-side without N+1 calls.
        tasks: {
          where: { parentTaskId: null },
          select: {
            id: true,
            completed: true,
            taskType: true,
            dueDate: true,
          },
        },
        _count: {
          select: {
            // See the privacy note on the list query above.
            tasks: { where: taskPrivacyClause(userId) },
            sections: true,
          },
        },
      },
      orderBy,
      // Safety bound on the fully-hydrated shape (owner + every member +
      // every root task, per project). Without a cap one call could pull the
      // entire workspace; 500 is far above any realistic project count, and
      // ?limit still narrows it further for widgets.
      take: take ?? 500,
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create project
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJson(req);
    const {
      name,
      description,
      color,
      icon,
      workspaceId,
      teamId,
      templateId,
      startDate,
      endDate,
      type,
      location,
      latitude,
      longitude,
      budget,
      currency,
      clientName,
      sections: explicitSections,
      tasks: explicitTasks,
      customFields: explicitCustomFields,
    } = createProjectSchema.parse(body);

    // Get template if provided
    const template = templateId ? getTemplateById(templateId) : null;

    // Get or create default workspace
    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId) {
      // Find user's first workspace or create one
      const workspace = await prisma.workspace.findFirst({
        where: {
          members: {
            some: {
              userId,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (workspace) {
        targetWorkspaceId = workspace.id;
      } else {
        // Create a default workspace
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        const newWorkspace = await prisma.workspace.create({
          data: {
            name: `${user?.name || "My"}'s Workspace`,
            ownerId: userId,
            members: {
              create: {
                userId,
                role: "OWNER",
              },
            },
          },
        });

        targetWorkspaceId = newWorkspace.id;
      }
    }

    // Verify user has access to the workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: targetWorkspaceId,
        },
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        { error: "You don't have access to this workspace" },
        { status: 403 }
      );
    }

    // If sharing with a team at creation, that team must live in THIS
    // workspace — otherwise its members would gain access to a project in a
    // workspace they don't belong to (mirrors the /team PUT validation).
    if (teamId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { workspaceId: true },
      });
      if (!team || team.workspaceId !== targetWorkspaceId) {
        return NextResponse.json(
          { error: "Team not found in this workspace" },
          { status: 404 }
        );
      }
    }

    // Auto-generate the next human-readable project number for this
    // workspace. Format: TT-YYYY-NNN (3-digit zero-padded). Scoped to
    // the year + workspace so different workspaces keep independent
    // counters and a new year restarts at 001.
    const year = new Date().getFullYear();
    const prefix = `TT-${year}-`;
    const lastNumberedProject = await prisma.project.findFirst({
      where: {
        workspaceId: targetWorkspaceId,
        projectNumber: { startsWith: prefix },
      },
      orderBy: { projectNumber: "desc" },
      select: { projectNumber: true },
    });
    let nextSeq = 1;
    if (lastNumberedProject?.projectNumber) {
      const tail = lastNumberedProject.projectNumber.slice(prefix.length);
      const parsed = parseInt(tail, 10);
      if (!Number.isNaN(parsed)) nextSeq = parsed + 1;
    }
    const projectNumber = `${prefix}${String(nextSeq).padStart(3, "0")}`;

    // Determine sections — priority: explicit `sections` from a
    // project-template gallery pick → legacy `template.sections` →
    // default "To do / In progress / Done".
    const sectionsToCreate =
      explicitSections && explicitSections.length > 0
        ? explicitSections.map((name, index) => ({
            name: name.trim(),
            position: index,
          }))
        : template
          ? template.sections.map((section, index) => ({
              name: section.name,
              position: index,
            }))
          : [
              { name: "To do", position: 0 },
              { name: "In progress", position: 1 },
              { name: "Done", position: 2 },
            ];

    // Determine views based on template or default
    const viewsToCreate = template
      ? [
          { name: "List", type: "LIST" as const, isDefault: template.defaultView === "LIST" },
          { name: "Board", type: "BOARD" as const, isDefault: template.defaultView === "BOARD" },
          { name: "Timeline", type: "TIMELINE" as const, isDefault: template.defaultView === "TIMELINE" },
          { name: "Calendar", type: "CALENDAR" as const, isDefault: template.defaultView === "CALENDAR" },
        ]
      : [
          { name: "List", type: "LIST" as const, isDefault: true },
          { name: "Board", type: "BOARD" as const, isDefault: false },
          { name: "Timeline", type: "TIMELINE" as const, isDefault: false },
          { name: "Calendar", type: "CALENDAR" as const, isDefault: false },
        ];

    // A typed project starts at its pipeline's first stage — exactly what the
    // backfill did to the live rows, so a job created today behaves like every
    // job created before it. Leaving `stage` null instead would drop the new
    // project out of every board that groups by stage, and its own strip would
    // read "No stage set yet" until somebody noticed.
    const initialStage = stagesForType(type ?? null)[0] ?? null;

    // Create the project and everything a template seeds (sections, views,
    // members, custom fields, tasks, subtasks, custom-field values) inside a
    // SINGLE transaction so a failure part-way through rolls the whole thing
    // back instead of leaving a half-built project — audit DB-03. Timeout is
    // raised because large templates do many sequential writes.
    const project = await prisma.$transaction(
      async (tx) => {
        const created = await tx.project.create({
          data: {
            name,
            description: description || template?.description,
            color: color || template?.color || "#c9a84c",
            icon: icon || template?.icon,
            workspaceId: targetWorkspaceId,
            teamId: teamId || null,
            ownerId: userId,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : null,
            type: type ?? null,
            stage: initialStage?.key ?? null,
            stageEnteredAt: initialStage ? new Date() : null,
            // Derived here and nowhere else — see legacyGateFor().
            gate: legacyGateFor(initialStage?.key ?? null),
            location: location ?? null,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            budget: budget ?? null,
            currency: currency ?? "USD",
            clientName: clientName ?? null,
            projectNumber,
            members: {
              create: {
                userId,
                role: "ADMIN",
              },
            },
            sections: {
              createMany: {
                data: sectionsToCreate,
              },
            },
            views: {
              createMany: {
                data: viewsToCreate,
              },
            },
          },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            sections: {
              orderBy: { position: "asc" },
            },
            views: true,
          },
        });

        // ── Starting tab strip ──────────────────────────────────────
        // A new project opens on Overview / List / Board / Messages / Files.
        // The remaining built-ins are seeded HIDDEN rather than deleted: the
        // "+" un-hides one on demand (see addOrOpenView), so this is a starting
        // point and not a removal. Only new projects are seeded, so nothing
        // that already shows a tab loses it.
        if (INITIALLY_HIDDEN_VIEWS.length > 0) {
          await tx.projectViewPref.createMany({
            data: INITIALLY_HIDDEN_VIEWS.map((viewKey) => ({
              projectId: created.id,
              viewKey,
              baseView: viewKey,
              hidden: true,
            })),
            skipDuplicates: true,
          });
        }

        // ── Project-template custom fields ──────────────────────────
        // Created BEFORE tasks so task creation can resolve their
        // customFieldValues by field name.
        const customFieldDefByName = new Map<
          string,
          { id: string; type: string }
        >();
        if (explicitCustomFields && explicitCustomFields.length > 0) {
          for (let i = 0; i < explicitCustomFields.length; i++) {
            const cf = explicitCustomFields[i];
            // Dropdown / multi-select need options; skip silently if
            // they're missing rather than blow up the whole create.
            const needsOptions =
              cf.type === "DROPDOWN" || cf.type === "MULTI_SELECT";
            if (needsOptions && (!cf.options || cf.options.length === 0)) {
              continue;
            }
            const def = await tx.customFieldDefinition.create({
              data: {
                name: cf.name,
                type: cf.type,
                options: needsOptions && cf.options
                  ? JSON.parse(JSON.stringify(cf.options))
                  : null,
                workspaceId: targetWorkspaceId,
              },
            });
            await tx.projectCustomField.create({
              data: { projectId: created.id, fieldId: def.id, position: i },
            });
            customFieldDefByName.set(cf.name, { id: def.id, type: def.type });
          }
        }

        // ── Pre-baked tasks from a project-template gallery pick ────
        if (explicitTasks && explicitTasks.length > 0) {
          const sectionByName = new Map(
            created.sections.map((s) => [s.name, s])
          );
          const positionBySection = new Map<string, number>();
          // name -> created parent id, for wiring dependencies in a 2nd pass
          const parentIdByName = new Map<string, string>();
          for (const t of explicitTasks) {
            const section = sectionByName.get(t.section);
            if (!section) continue;
            const parentPosition = positionBySection.get(section.id) ?? 0;
            positionBySection.set(section.id, parentPosition + 1);
            // Anchor the task's start and due dates on the project start
            // (today unless the caller passed a start date) + the template's
            // relative offsets in days, so the project opens with a real
            // schedule of real durations — see templateTaskDates(), which
            // also clamps a start the template put after its own due date.
            const { startDate: taskStartDate, dueDate } = templateTaskDates(
              new Date(created.startDate ?? new Date()),
              t.relativeStartDate,
              t.relativeDueDate
            );
            const parent = await tx.task.create({
              data: {
                name: t.name,
                projectId: created.id,
                sectionId: section.id,
                creatorId: userId,
                position: parentPosition * 1000,
                taskType: t.type ?? "TASK",
                description: t.description || null,
                priority: t.priority ?? "NONE",
                startDate: taskStartDate,
                dueDate,
              },
              select: { id: true },
            });
            parentIdByName.set(t.name, parent.id);
            if (t.subtasks && t.subtasks.length > 0) {
              await tx.task.createMany({
                data: t.subtasks.map((subName, i) => ({
                  name: subName,
                  projectId: created.id,
                  sectionId: section.id,
                  creatorId: userId,
                  parentTaskId: parent.id,
                  position: i * 1000,
                })),
              });
            }
            if (t.customFieldValues) {
              for (const [fieldName, rawValue] of Object.entries(
                t.customFieldValues
              )) {
                const def = customFieldDefByName.get(fieldName);
                if (!def) continue;
                await tx.customFieldValue.create({
                  data: {
                    taskId: parent.id,
                    fieldId: def.id,
                    value: JSON.parse(JSON.stringify(rawValue)),
                  },
                });
              }
            }
          }

          // ── Wire finish-to-start dependencies (the "Blocked by" links /
          // Gantt arrows) once every task exists, so a template can ship a
          // pre-linked plan. Unresolved names are skipped defensively.
          for (const t of explicitTasks) {
            if (!t.dependsOn || t.dependsOn.length === 0) continue;
            const dependentId = parentIdByName.get(t.name);
            if (!dependentId) continue;
            for (const blockerName of new Set(t.dependsOn)) {
              const blockingId = parentIdByName.get(blockerName);
              if (!blockingId || blockingId === dependentId) continue;
              await tx.taskDependency.create({
                data: {
                  dependentTaskId: dependentId,
                  blockingTaskId: blockingId,
                },
              });
            }
          }
        }

        // If template has tasks, create them
        if (template && template.tasks.length > 0) {
          const projectStartDate = startDate ? new Date(startDate) : new Date();

          for (const templateTask of template.tasks) {
            const section = created.sections[templateTask.sectionIndex];
            if (!section) continue;

            // The SECOND copy of this write — the built-in templates land
            // here, the custom/payload ones above. Both go through the same
            // helper on purpose: fixing one copy of a duplicated write and
            // shipping a no-op is a mistake this file has made before.
            // Read optionally: templates-data.ts's TemplateTask (the legacy
            // generic family this path serves) has no relativeStartDate field
            // yet, so this path behaves exactly as before until one of those
            // definitions grows a start offset — at which point the duration
            // shows up with no further change here.
            const relativeStartDate = (
              templateTask as { relativeStartDate?: number }
            ).relativeStartDate;
            const { startDate: taskStartDate, dueDate } = templateTaskDates(
              projectStartDate,
              relativeStartDate,
              templateTask.relativeDueDate
            );

            const createdTask = await tx.task.create({
              data: {
                name: templateTask.name,
                description: templateTask.description || null,
                projectId: created.id,
                sectionId: section.id,
                creatorId: userId,
                priority: templateTask.priority || "NONE",
                taskType: templateTask.taskType || "TASK",
                startDate: taskStartDate,
                dueDate,
                position: 0,
              },
            });

            if (templateTask.subtasks && templateTask.subtasks.length > 0) {
              for (let i = 0; i < templateTask.subtasks.length; i++) {
                const subtask = templateTask.subtasks[i];
                await tx.task.create({
                  data: {
                    name: subtask.name,
                    description: subtask.description || null,
                    projectId: created.id,
                    sectionId: section.id,
                    creatorId: userId,
                    parentTaskId: createdTask.id,
                    position: i,
                  },
                });
              }
            }
          }
        }

        // The first row of the job's history, so "how long has this been on
        // someone's desk" has a start even for a project nobody has moved yet.
        // SEED, not FORWARD: arriving at the first stage is not progress.
        if (initialStage) {
          await tx.projectStageEvent.create({
            data: {
              projectId: created.id,
              fromStage: null,
              toStage: initialStage.key,
              direction: "SEED",
              userId,
            },
          });
        }

        return created;
      },
      { timeout: 20000, maxWait: 8000 }
    );

    // Fetch the complete project with tasks
    const completeProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        sections: {
          orderBy: { position: "asc" },
        },
        views: true,
        _count: {
          select: {
            tasks: { where: taskPrivacyClause(userId) },
          },
        },
      },
    });

    return NextResponse.json(completeProject, { status: 201 });
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

    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
