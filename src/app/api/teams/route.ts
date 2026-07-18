import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";
import { notifyMembershipGranted } from "@/lib/membership-notifications";

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

    // Resolve the workspace the user actually works in (their firm workspace,
    // not the auto-generated personal singleton from signup). Creating the
    // team under the wrong workspace would hide it from every teammate's
    // Teams list, which is workspace-scoped. Mirrors getEffectiveAccess and
    // the rest of the app (audit SEC-06) instead of a bare workspaceMembers[0].
    let workspaceId: string;
    try {
      workspaceId = await getUserWorkspaceId(userId);
    } catch {
      return NextResponse.json(
        { error: "User has no workspace" },
        { status: 400 }
      );
    }

    // Generate a random color for the team
    const colors = [
      "#0a0a0a", "#F97316", "#a8893a", "#84CC16",
      "#22C55E", "#14B8A6", "#a8893a", "#0EA5E9",
      "#c9a84c", "#6366F1", "#a8893a", "#A855F7",
      "#D946EF", "#c9a84c", "#F43F5E",
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

    // Ensure all added members are also workspace members
    const addedMemberIds = (data.memberIds || []).filter((id) => id !== userId);
    if (addedMemberIds.length > 0) {
      const existingWorkspaceMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          userId: { in: addedMemberIds },
        },
        select: { userId: true },
      });

      const existingIds = new Set(existingWorkspaceMembers.map((m) => m.userId));
      const missingIds = addedMemberIds.filter((id) => !existingIds.has(id));

      if (missingIds.length > 0) {
        await prisma.workspaceMember.createMany({
          data: missingIds.map((id) => ({
            userId: id,
            workspaceId,
            role: "MEMBER" as const,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Let the added members know via their Inbox that they're now on the team
    // (they didn't request it). Parity with the invite endpoint and with the
    // project/portfolio member-add flows — without this, members seeded at
    // creation time were added silently. Best-effort: notifyMembershipGranted
    // never throws, so a failed notification can't roll back the team.
    await Promise.all(
      addedMemberIds.map((id) =>
        notifyMembershipGranted({
          userId: id,
          type: "TEAM_INVITATION",
          title: `You were added to ${team.name}`,
          data: { teamId: team.id },
        })
      )
    );

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

    // Scope to the user's real (firm) workspace — not an auto-generated
    // personal singleton whose index-0 position would hide the firm's teams
    // (audit SEC-06).
    let workspaceId: string;
    try {
      workspaceId = await getUserWorkspaceId(userId);
    } catch {
      return NextResponse.json([]);
    }

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
