import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getTemplateById } from "@/lib/templates-data";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().optional().default("#4573D2"),
  icon: z.string().optional(),
  workspaceId: z.string().optional(),
  teamId: z.string().optional(),
  templateId: z.string().optional(), // Template to use for project creation
  startDate: z.string().optional(), // For calculating relative due dates
});

// GET /api/projects - Get user's projects
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const query = searchParams.get("q") || "";

    const projects = await prisma.project.findMany({
      where: {
        AND: [
          workspaceId ? { workspaceId } : {},
          query ? { name: { contains: query, mode: "insensitive" } } : {},
          {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } },
              {
                workspace: {
                  members: { some: { userId } },
                },
                visibility: { in: ["WORKSPACE", "PUBLIC"] },
              },
            ],
          },
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
    const { name, description, color, icon, workspaceId, teamId, templateId, startDate } = createProjectSchema.parse(body);

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

    // Determine sections based on template or default
    const sectionsToCreate = template
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
        color: color || template?.color || "#4573D2",
        icon: icon || template?.icon,
        workspaceId: targetWorkspaceId,
        teamId: teamId || null,
        ownerId: userId,
        startDate: startDate ? new Date(startDate) : new Date(),
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
