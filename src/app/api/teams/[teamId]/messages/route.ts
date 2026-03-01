import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

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

    // Verify user is a team member
    await verifyTeamAccess(userId, teamId);

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
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
        attachments: {
          select: {
            id: true,
            name: true,
            url: true,
            size: true,
            mimeType: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Group reactions by emoji per message
    const formatted = messages.map((msg) => {
      const grouped: Record<string, { count: number; hasReacted: boolean }> = {};
      for (const r of msg.reactions) {
        if (!grouped[r.emoji]) {
          grouped[r.emoji] = { count: 0, hasReacted: false };
        }
        grouped[r.emoji].count++;
        if (r.userId === userId) {
          grouped[r.emoji].hasReacted = true;
        }
      }

      return {
        ...msg,
        reactions: Object.entries(grouped).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          hasReacted: data.hasReacted,
        })),
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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

    return NextResponse.json({ ...message, reactions: [] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
