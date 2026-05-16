import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getLevel } from "@/lib/people-types";
import { getTemplateById } from "@/lib/templates-data";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().optional().default("#c9a84c"),
  icon: z.string().optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().optional(),
  templateId: z.string().optional(), // Template to use for project creation
  startDate: z.string().optional(), // For calculating relative due dates
  // Engineering firm extensions
  type: z.enum(["CONSTRUCTION", "DESIGN", "RECERTIFICATION", "PERMIT"]).optional(),
  gate: z.enum(["PRE_DESIGN", "DESIGN", "PERMITTING", "CONSTRUCTION", "CLOSEOUT"]).optional(),
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
        subtasks: z.array(z.string().min(1).max(200)).optional(),
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
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        user: { select: { position: true } },
      },
    });

    if (memberships.length === 0) {
      return NextResponse.json([]);
    }

    const visibilityClauses = memberships.map((m) => {
      const role = m.role;
      const level = getLevel(m.user.position);
      // L4+ rules vary by role: OWNER and ADMIN always see all
      // workspace projects; MEMBER/WORKER/GUEST need Position
      // level >= 4 OR explicit project membership.
      const isWorkspaceLeadership = role === "OWNER" || role === "ADMIN";
      const seesAllInWorkspace = isWorkspaceLeadership || level >= 4;

      if (seesAllInWorkspace) {
        return { workspaceId: m.workspaceId };
      }

      return {
        workspaceId: m.workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
          { visibility: "PUBLIC" as const },
        ],
      };
    });

    const projects = await prisma.project.findMany({
      where: {
        AND: [
          workspaceId ? { workspaceId } : {},
          query ? { name: { contains: query, mode: "insensitive" } } : {},
          { OR: visibilityClauses },
        ],
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
            tasks: true,
            sections: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
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

    const body = await req.json();
    const {
      name,
      description,
      color,
      icon,
      workspaceId,
      teamId,
      templateId,
      startDate,
      type,
      gate,
      location,
      latitude,
      longitude,
      budget,
      currency,
      clientName,
      sections: explicitSections,
      tasks: explicitTasks,
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

    // Create project with sections and views
    const project = await prisma.project.create({
      data: {
        name,
        description: description || template?.description,
        color: color || template?.color || "#c9a84c",
        icon: icon || template?.icon,
        workspaceId: targetWorkspaceId,
        teamId: teamId || null,
        ownerId: userId,
        startDate: startDate ? new Date(startDate) : new Date(),
        type: type ?? null,
        gate: gate ?? "PRE_DESIGN",
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

    // ── Pre-baked tasks from a project-template gallery pick ────
    // (explicitTasks) — matches tasks to the freshly-created sections
    // by name, then creates each parent task + any subtasks via
    // parentTaskId. We do this BEFORE the legacy template-tasks branch
    // so the two paths are independent: a gallery pick uses
    // explicitTasks, a legacy templateId uses template.tasks.
    if (explicitTasks && explicitTasks.length > 0) {
      const sectionByName = new Map(
        project.sections.map((s) => [s.name, s])
      );
      // Track position per section so tasks within the same column
      // render in the order they appear in the template.
      const positionBySection = new Map<string, number>();
      for (const t of explicitTasks) {
        const section = sectionByName.get(t.section);
        if (!section) continue;
        const parentPosition = positionBySection.get(section.id) ?? 0;
        positionBySection.set(section.id, parentPosition + 1);
        const parent = await prisma.task.create({
          data: {
            name: t.name,
            projectId: project.id,
            sectionId: section.id,
            creatorId: userId,
            position: parentPosition * 1000,
          },
          select: { id: true },
        });
        if (t.subtasks && t.subtasks.length > 0) {
          await prisma.task.createMany({
            data: t.subtasks.map((subName, i) => ({
              name: subName,
              projectId: project.id,
              sectionId: section.id,
              creatorId: userId,
              parentTaskId: parent.id,
              position: i * 1000,
            })),
          });
        }
      }
    }

    // If template has tasks, create them
    if (template && template.tasks.length > 0) {
      const projectStartDate = startDate ? new Date(startDate) : new Date();

      // Create tasks for each template task
      for (const templateTask of template.tasks) {
        const section = project.sections[templateTask.sectionIndex];
        if (!section) continue;

        // Calculate due date based on relative days
        let dueDate: Date | null = null;
        if (templateTask.relativeDueDate !== undefined) {
          dueDate = new Date(projectStartDate);
          dueDate.setDate(dueDate.getDate() + templateTask.relativeDueDate);
        }

        // Create the task
        const createdTask = await prisma.task.create({
          data: {
            name: templateTask.name,
            description: templateTask.description || null,
            projectId: project.id,
            sectionId: section.id,
            creatorId: userId,
            priority: templateTask.priority || "NONE",
            taskType: templateTask.taskType || "TASK",
            dueDate,
            position: 0,
          },
        });

        // Create subtasks if any
        if (templateTask.subtasks && templateTask.subtasks.length > 0) {
          for (let i = 0; i < templateTask.subtasks.length; i++) {
            const subtask = templateTask.subtasks[i];
            await prisma.task.create({
              data: {
                name: subtask.name,
                description: subtask.description || null,
                projectId: project.id,
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
            tasks: true,
          },
        },
      },
    });

    return NextResponse.json(completeProject, { status: 201 });
  } catch (error) {
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
