import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { buildProjectVisibilityClauses } from "@/lib/project-visibility";
import { readJson, jsonErrorResponse } from "@/lib/http";
import {
  legacyGateFor,
  resolveSectionStage,
  stagesForType,
} from "@/lib/pipelines";
import { INITIALLY_HIDDEN_VIEWS } from "@/lib/project-views";
import { templateTaskDates } from "@/lib/template-schedule";
import { getPrimaryWorkspaceMembership } from "@/lib/auth-guards";
import { isNonContributorRole } from "@/lib/workspace-roles";
import {
  allocateProjectNumber,
  firmTodayDateOnly,
} from "@/lib/project-number";
import { isStatusEarned } from "@/lib/project-status";
import { regulatoryFields, toDeadline } from "@/lib/regulatory-schema";

/**
 * What the "N tasks" count on a project card means: top-level tasks the caller
 * may see. Panel subtasks now carry projectId, so without the parentTaskId
 * filter the card would also count checklist items.
 */
function rootTaskCountClause(userId: string): Prisma.TaskWhereInput {
  return { AND: [taskPrivacyClause(userId), { parentTaskId: null }] };
}

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().optional().default("#c9a84c"),
  icon: z.string().optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().optional(),
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
  // Jurisdiction, reference numbers, regulatory deadline and client contact.
  // Shared with the PATCH schema so the two cannot drift.
  ...regulatoryFields,
  // Explicit initial sections — when provided (e.g. from a project
  // template gallery pick) we use these instead of the default
  // "To do / In progress / Done" so the kanban columns reflect the
  // template's intent.
  // A plain name, or a name plus the pipeline stage whose work that column
  // carries. The string form is what the template gallery sends and stays
  // supported forever; the object form lets a caller state the stage outright
  // instead of relying on the column being NAMED as its stage (see
  // resolveSectionStage below). A stage from another pipeline is a 400, never
  // a silent drop — a silently dropped stage is how the board and the strip
  // became two vocabularies in the first place.
  sections: z
    .array(
      z.union([
        z.string().min(1).max(80),
        z.object({
          name: z.string().min(1).max(80),
          stage: z.string().min(1).max(80).nullable().optional(),
        }),
      ])
    )
    .optional(),
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
// The list shows exactly the projects the caller can open: the rule lives in
// buildProjectVisibilityClauses (@/lib/project-visibility), the list-query
// sibling of canReadProject (@/lib/project-access). Do not restate it here.

/**
 * "Status" sort, most urgent first. The enum's own order (ON_TRACK first) put
 * the healthy — and the never-rated, which default to ON_TRACK — ahead of
 * everything, so a 4-row widget never showed the job that was off track.
 * A status nobody chose ranks after every real one (see isStatusEarned).
 */
function statusSortRank(p: {
  status: string;
  statusSetAt: Date | null;
}): number {
  if (p.status === "COMPLETE") return 5;
  if (!isStatusEarned(p.statusSetAt)) return 4;
  switch (p.status) {
    case "OFF_TRACK":
      return 0;
    case "AT_RISK":
      return 1;
    case "ON_HOLD":
      return 2;
    default:
      return 3;
  }
}

function sortByStatusSeverity<
  T extends { status: string; statusSetAt: Date | null },
>(rows: T[], take: number | undefined): T[] {
  // Array.prototype.sort is stable, so the updatedAt-desc order the query
  // returned survives inside each bucket.
  const sorted = [...rows].sort((a, b) => statusSortRank(a) - statusSortRank(b));
  return take ? sorted.slice(0, take) : sorted;
}

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
    // The status sort is a severity ranking that Prisma cannot express, so it
    // is applied in JS after the query (sortByStatusSeverity) — the query then
    // must not cap the rows, or the urgent ones could be cut before ranking.
    const byStatus = sort === "status";
    const orderBy: Prisma.ProjectOrderByWithRelationInput =
      sort === "alphabetical" ? { name: "asc" } : { updatedAt: "desc" };
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
        // One search box over everything the firm types in to find a job:
        // the name, the TT number, the client and the numbers the city asks
        // for. Folio/permit numbers match AS TYPED (no normalized column).
        query
          ? {
              OR: (
                [
                  "name",
                  "projectNumber",
                  "clientName",
                  "jurisdiction",
                  "folioNumber",
                  "permitNumber",
                  "caseNumber",
                ] as const
              ).map(
                (field): Prisma.ProjectWhereInput => ({
                  [field]: { contains: query, mode: "insensitive" },
                })
              ),
            }
          : {},
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
          // When a human last CHOSE that status. `Project.status` defaults to
          // ON_TRACK, so a summary row without this cannot tell a judgement
          // from a default and every card claimed "On track".
          statusSetAt: true,
          // What the cockpit's deadline panel needs to decide whether a
          // regulatory deadline is still live (src/lib/regulatory.ts).
          type: true,
          stage: true,
          isArchived: true,
          projectNumber: true,
          jurisdiction: true,
          regulatoryDeadline: true,
          // Counted with the caller's own visibility, not a bare
          // `tasks: true`. A relation count ignores privacy, so the card
          // said "3 tasks" to someone who could open one of them — the
          // number disagreed with every list that renders it.
          _count: {
            select: {
              tasks: { where: rootTaskCountClause(userId) },
            },
          },
        },
        orderBy,
        ...(take && !byStatus ? { take } : {}),
      });
      return NextResponse.json(
        byStatus ? sortByStatusSeverity(projects, take) : projects
      );
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
            tasks: { where: rootTaskCountClause(userId) },
            sections: true,
          },
        },
      },
      orderBy,
      // Safety bound on the fully-hydrated shape (owner + every member +
      // every root task, per project). Without a cap one call could pull the
      // entire workspace; 500 is far above any realistic project count, and
      // ?limit still narrows it further for widgets.
      take: byStatus ? 500 : take ?? 500,
    });

    return NextResponse.json(
      byStatus ? sortByStatusSeverity(projects, take) : projects
    );
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
      startDate,
      endDate,
      type,
      location,
      latitude,
      longitude,
      budget,
      currency,
      clientName,
      jurisdiction,
      folioNumber,
      permitNumber,
      caseNumber,
      regulatoryDeadline,
      clientContactName,
      clientContactEmail,
      clientContactPhone,
      sections: explicitSections,
      tasks: explicitTasks,
      customFields: explicitCustomFields,
    } = createProjectSchema.parse(body);

    // Get or create default workspace
    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId) {
      // The SAME workspace the rest of the app resolves to (PRIMARY pin,
      // then the firm heuristic). A private "oldest workspace I belong to"
      // rule here could file a job made from a firm template into a personal
      // workspace the firm never sees.
      const primary = await getPrimaryWorkspaceMembership(userId);

      if (primary) {
        targetWorkspaceId = primary.workspaceId;
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

    // GUEST/CLIENT seats are view-only; creating a project would make them
    // its owner, with full control.
    if (isNonContributorRole(workspaceMember.role)) {
      return NextResponse.json(
        { error: "Your role is view-only and can't create projects" },
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

    // Without an explicit start the job starts on the firm's calendar day,
    // stored at UTC midnight like every other date-only value. `new Date()`
    // stamped the instant, which after 20:00 in Miami is already tomorrow.
    const projectStartDate = startDate ? new Date(startDate) : firmTodayDateOnly();

    // Determine sections — explicit `sections` from a project-template
    // gallery pick, else the default "To do / In progress / Done".
    const requestedSections: { name: string; stage?: string | null }[] =
      explicitSections && explicitSections.length > 0
        ? explicitSections.map((entry) =>
            typeof entry === "string" ? { name: entry } : entry
          )
        : [{ name: "To do" }, { name: "In progress" }, { name: "Done" }];

    // ── The board column ↔ stage join ───────────────────────────────
    // A recert board column IS a pipeline stage. The template gallery sends
    // column NAMES only, and those names are generated from pipelines.ts, so
    // resolveSectionStage() reads each one back to its key — while a caller
    // that can state the key outright is taken at its word, and refused if
    // the key belongs to another pipeline. Without this the board and the
    // stage strip stay two vocabularies for one question, which is the thing
    // the owner said he did not trust.
    const sectionsToCreate: {
      name: string;
      position: number;
      stage: string | null;
    }[] = [];
    for (const [index, entry] of requestedSections.entries()) {
      const sectionName = entry.name.trim();
      const resolved = resolveSectionStage(
        type ?? null,
        sectionName,
        entry.stage
      );
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      sectionsToCreate.push({
        name: sectionName,
        position: index,
        stage: resolved.stage,
      });
    }

    const viewsToCreate = [
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
        // Allocated inside the transaction, under a per-workspace lock — see
        // allocateProjectNumber (TT-YYYY-NNN, one counter per workspace/year).
        const projectNumber = await allocateProjectNumber(tx, targetWorkspaceId);

        const created = await tx.project.create({
          data: {
            name,
            description: description || undefined,
            color: color || "#c9a84c",
            icon: icon || undefined,
            workspaceId: targetWorkspaceId,
            teamId: teamId || null,
            ownerId: userId,
            startDate: projectStartDate,
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
            jurisdiction: jurisdiction ?? null,
            folioNumber: folioNumber ?? null,
            permitNumber: permitNumber ?? null,
            caseNumber: caseNumber ?? null,
            regulatoryDeadline: toDeadline(regulatoryDeadline) ?? null,
            clientContactName: clientContactName ?? null,
            clientContactEmail: clientContactEmail ?? null,
            clientContactPhone: clientContactPhone ?? null,
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
        // Definitions are workspace-level. Creating a fresh one per project
        // left the workspace with dozens of identical "Responsible" fields
        // (and orphans once the projects were deleted), so a definition with
        // the same name and type is reused — but only when it already offers
        // every option id the template's values refer to; otherwise those
        // values would point at options the field does not have. Only
        // definitions some project already links are candidates: a definition
        // with no project link is someone's personal My Tasks field (see
        // /api/my-tasks/custom-fields), and linking it here would publish it.
        const existingDefs =
          explicitCustomFields && explicitCustomFields.length > 0
            ? await tx.customFieldDefinition.findMany({
                where: {
                  workspaceId: targetWorkspaceId,
                  projectFields: { some: {} },
                  OR: explicitCustomFields.map((cf) => ({
                    name: cf.name,
                    type: cf.type,
                  })),
                },
                select: { id: true, name: true, type: true, options: true },
                orderBy: { id: "asc" },
              })
            : [];
        const optionIdsOf = (options: unknown): Set<string> =>
          new Set(
            Array.isArray(options)
              ? options
                  .map((o) =>
                    o && typeof o === "object" && "id" in o
                      ? String((o as { id: unknown }).id)
                      : null
                  )
                  .filter((id): id is string => id !== null)
              : []
          );
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
            // The same template field listed twice must not link twice.
            if (customFieldDefByName.has(cf.name)) continue;
            const wanted = needsOptions ? (cf.options ?? []).map((o) => o.id) : [];
            const reusable = existingDefs.find((d) => {
              if (d.name !== cf.name || d.type !== cf.type) return false;
              const have = optionIdsOf(d.options);
              return wanted.every((id) => have.has(id));
            });
            const def =
              reusable ??
              (await tx.customFieldDefinition.create({
                data: {
                  name: cf.name,
                  type: cf.type,
                  options: needsOptions && cf.options
                    ? JSON.parse(JSON.stringify(cf.options))
                    : null,
                  workspaceId: targetWorkspaceId,
                },
              }));
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
              new Date(created.startDate ?? projectStartDate),
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
            tasks: { where: rootTaskCountClause(userId) },
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
