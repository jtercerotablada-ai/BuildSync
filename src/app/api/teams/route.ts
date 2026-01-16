import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
  privacy: z.enum(["PUBLIC", "REQUEST_TO_JOIN", "PRIVATE"]).default("PUBLIC"),
  memberIds: z.array(z.string()).optional(),
});

// POST /api/teams - Create a new team
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createTeamSchema.parse(body);

    // Get user's workspace
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMembers: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!user || user.workspaceMembers.length === 0) {
      return NextResponse.json(
        { error: "User has no workspace" },
        { status: 400 }
      );
    }

    const workspaceId = user.workspaceMembers[0].workspaceId;

    // Generate a random color for the team
    const colors = [
      "#EF4444", "#F97316", "#F59E0B", "#84CC16",
      "#22C55E", "#14B8A6", "#06B6D4", "#0EA5E9",
      "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7",
      "#D946EF", "#EC4899", "#F43F5E",
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Create the team with the creator as LEAD
    const team = await prisma.team.create({
      data: {
        name: data.name,
        description: data.description,
        privacy: data.privacy,
        color: randomColor,
        workspaceId,
        members: {
          create: [
            {
              userId,
              role: "LEAD",
            },
            // Add additional members if provided
            ...(data.memberIds || [])
              .filter((memberId) => memberId !== userId)
              .map((memberId) => ({
                userId: memberId,
                role: "MEMBER" as const,
              })),
          ],
        },
      },
      include: {
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
            projects: true,
            members: true,
          },
        },
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}

// GET /api/teams - Get all teams in the workspace
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's workspace
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMembers: {
          select: { workspaceId: true },
        },
      },
    });

    if (!user || user.workspaceMembers.length === 0) {
      return NextResponse.json([]);
    }

    const workspaceId = user.workspaceMembers[0].workspaceId;

    // Get all teams the user can see
    const teams = await prisma.team.findMany({
      where: {
        workspaceId,
        OR: [
          { privacy: "PUBLIC" },
          { privacy: "REQUEST_TO_JOIN" },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      include: {
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
          take: 5,
        },
        _count: {
          select: {
            projects: true,
            members: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}
