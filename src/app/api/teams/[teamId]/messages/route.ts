import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createMessageSchema = z.object({
  content: z.string().min(1),
});

// GET /api/teams/:teamId/messages - Get team messages
export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const messages = await prisma.teamMessage.findMany({
      where: { teamId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching team messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/teams/:teamId/messages - Create a new message
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content } = createMessageSchema.parse(body);

    // Verify user is team member
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be a team member to post messages" },
        { status: 403 }
      );
    }

    const message = await prisma.teamMessage.create({
      data: {
        content,
        teamId,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
