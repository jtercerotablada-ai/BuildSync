import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  getUserWorkspaceId,
  getErrorStatus,
  requireWorkspaceContributor,
} from "@/lib/auth-guards";
import {
  assertWorkspaceContributors,
  teamArchiveWhere,
} from "@/lib/team-access";
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
    //
    // requireWorkspaceContributor rather than getUserWorkspaceId: it resolves
    // the SAME workspace by the same heuristic and additionally refuses a
    // read-only GUEST/CLIENT, who must not be able to create a container that
    // grants Editor access to every project attached to it.
    let workspaceId: string;
    try {
      ({ workspaceId } = await requireWorkspaceContributor(userId));
    } catch (err) {
      const { status, message } = getErrorStatus(err);
      // Only the guard's own refusals ("No workspace found", "Your role is
      // view-only…") are answered here. A real failure — the database being
      // down — must not be reported to the owner as a workspace problem, so
      // it goes to the outer catch and is logged as the 500 it is.
      if (status === 500) throw err;
      return NextResponse.json({ error: message }, { status });
    }

    // Seed members must ALREADY hold a contributor seat in this workspace.
    // This route used to createMany WorkspaceMember rows for whatever ids the
    // body carried, so "create a team" was an unaudited way to hand out seats
    // in the firm's workspace — the same hole the by-email team invite had.
    // Refusing loudly (403) beats silently dropping the ids: a member the
    // creator asked for and never saw appear is its own kind of lie.
    const seedMemberIds = (data.memberIds || []).filter((id) => id !== userId);
    await assertWorkspaceContributors(seedMemberIds, workspaceId);

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
            // Add additional members if provided — all verified above to
            // already belong to this workspace.
            ...seedMemberIds.map((memberId) => ({
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

    // NO WorkspaceMember rows are created here any more. A team is a grouping
    // INSIDE a workspace, never a side door into one; seats are granted by an
    // invitation the invitee accepts, or on the workspace People screen.

    // Let the added members know via their Inbox that they're now on the team
    // (they didn't request it). Parity with the invite endpoint and with the
    // project/portfolio member-add flows — without this, members seeded at
    // creation time were added silently. Best-effort: notifyMembershipGranted
    // never throws, so a failed notification can't roll back the team.
    await Promise.all(
      seedMemberIds.map((id) =>
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

    // AuthorizationError from assertWorkspaceContributors is a 403, not a
    // generic failure — without this it surfaced as "Failed to create team".
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }

    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}

// GET /api/teams - Get all teams in the workspace
//
// Archived teams are OUT by default. Archiving is the reversible alternative
// to deleting a team, so the row is still there — it just stops being offered
// as somewhere to put work. `?archived=true` returns the archive on its own,
// `?archived=all` returns both (see teamArchiveWhere).
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);

    // Get all teams the user can see
    const teams = await prisma.team.findMany({
      where: {
        workspaceId,
        ...teamArchiveWhere(searchParams.get("archived")),
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
