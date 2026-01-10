import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().optional().default("#4573D2"),
  workspaceId: z.string().optional(), // If not provided, use user's default workspace
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
    const { name, description, color, workspaceId } = createProjectSchema.parse(body);

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

    // Create project with default sections
    const project = await prisma.project.create({
      data: {
        name,
        description,
        color,
        workspaceId: targetWorkspaceId,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "ADMIN",
          },
        },
        sections: {
          createMany: {
            data: [
              { name: "To do", position: 0 },
              { name: "In progress", position: 1 },
              { name: "Done", position: 2 },
            ],
          },
        },
        views: {
          createMany: {
            data: [
              { name: "List", type: "LIST", isDefault: true },
              { name: "Board", type: "BOARD" },
              { name: "Timeline", type: "TIMELINE" },
              { name: "Calendar", type: "CALENDAR" },
            ],
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
        sections: true,
        views: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
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
