import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { contributorSeatSatisfied, getErrorStatus } from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";
import { deleteFile, isVercelBlobUrl } from "@/lib/storage";

/** A cover the avatar route wrote for THIS team (see avatar/route.ts). */
function isOwnTeamCover(teamId: string, url: string): boolean {
  if (!isVercelBlobUrl(url)) return false;
  const path = new URL(url).pathname.replace(/^\/+/, "");
  return path.startsWith(`teams/${teamId}/`) && !path.includes("..");
}

const updateTeamSchema = z.object({
  // Trimmed before the length check: a whitespace-only name rendered as a
  // blank row in the sidebar and every team picker.
  name: z.string().trim().min(1, "Team name is required").max(100).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  // No `avatar` here on purpose. POST/DELETE /api/teams/:id/avatar are the
  // only writers of the cover: a free-form string would let a lead point the
  // cover at any url, which every colleague browsing teams then loads as an
  // <img>. zod strips the key, so an old client sending it is simply ignored.
  privacy: z.enum(["PUBLIC", "REQUEST_TO_JOIN", "PRIVATE"]).optional(),
  // Archive is the reversible alternative to DELETE below, which destroys the
  // team's messages and revokes the project access the team granted. The
  // Danger zone used to PATCH `{ archived: true }` — a key this schema never
  // had, so zod stripped it, the update ran with an empty object, 200 came
  // back and the modal toasted "Team archived" over an untouched row.
  isArchived: z.boolean().optional(),
});

/**
 * The team's goals, minus the ones this caller may not see.
 *
 * A goal marked private is not team-wide work: `decideObjectiveAccess` admits
 * it only to its owner, the people named on it and a workspace manager, and
 * answers 404 to everyone else. This include had no privacy clause at all, so
 * the team overview listed every private goal attached to the team by name,
 * status and progress — to every team member, and (because this GET only
 * requires a workspace seat plus a non-PRIVATE team) to every workspace member
 * for a PUBLIC or REQUEST_TO_JOIN team. Opening one 404s: the private-task
 * leak this audit closed, one entity over.
 *
 * It belongs in the WHERE and never in a filter over the result, because
 * `take: 5` is applied by the database — dropping rows afterwards would show
 * fewer goals than the caller is entitled to see. Same clause as the sibling
 * list query in /api/objectives.
 */
function visibleObjectivesInclude(userId: string) {
  return {
    where: {
      OR: [
        { isPrivate: false },
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      progress: true,
      status: true,
    },
    // Most recently touched first; without an order the five shown were
    // whatever the database returned first.
    orderBy: { updatedAt: "desc" as const },
    take: 5,
  };
}

// Counts the Danger zone quotes back to the user before a delete, so the
// warning names what is actually lost instead of a generic "cannot be undone".
const teamCountSelect = {
  projects: true,
  members: true,
  messages: true,
  knowledgeEntries: true,
  customFields: true,
} as const;

// GET /api/teams/:teamId - Get team details
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

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                jobTitle: true,
              },
            },
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
        objectives: visibleObjectivesInclude(userId),
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: teamCountSelect,
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Verify user belongs to the same workspace as the team
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: team.workspaceId,
        },
      },
      select: { role: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // For private teams, user must also be a team member. 404 rather than 403,
    // the same answer teamVisibilityClause, requireTeamStanding and the
    // join/requests routes all give: a 403 confirms the id names a real team,
    // which is the one fact team privacy exists to withhold. This route is the
    // one every team page calls, so leaving it on 403 kept the enumeration
    // oracle the rest of the surface was rewritten to remove.
    //
    // A workspace OWNER/ADMIN is admitted like requireTeamStanding admits him
    // on every sub-route: otherwise a PRIVATE team whose only lead left the
    // firm could still be administered through the API, but every team page
    // (they all load this route first) answered "Team not found".
    const isMember = team.members.some((m) => m.userId === userId);
    const isWorkspaceManager =
      workspaceMember.role === "OWNER" || workspaceMember.role === "ADMIN";
    if (!isMember && !isWorkspaceManager && team.privacy === "PRIVATE") {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // _count.projects includes archived projects, so a team whose only
    // project was archived still read as "has projects" to the setup banner.
    const activeProjectCount = await prisma.project.count({
      where: { teamId, isArchived: false },
    });

    return NextResponse.json({ ...team, activeProjectCount });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team" },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/:teamId - Update team
export async function PATCH(
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
    const data = updateTeamSchema.parse(body);

    // Three tiers below: description → any member, other settings → LEAD,
    // isArchived → LEAD or workspace OWNER/ADMIN.
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
      include: { team: { select: { workspaceId: true } } },
    });

    // The team's workspace has to be resolved even when the caller holds no
    // TeamMember row. Returning 404 here first was what made the
    // workspace-manager arm below unreachable: a workspace OWNER who wasn't on
    // the team got "Team not found" for an archive the route says they may
    // perform — the same PATCH-has-no-workspace-manager-arm split that already
    // bit the projects surface.
    const team =
      teamMember?.team ??
      (await prisma.team.findUnique({
        where: { id: teamId },
        select: { workspaceId: true },
      }));

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: team.workspaceId },
      },
      select: { role: true },
    });
    const isWorkspaceManager =
      workspaceMember?.role === "OWNER" || workspaceMember?.role === "ADMIN";

    // A live CONTRIBUTOR seat in the team's own workspace is the floor under
    // every branch below — a TeamMember row on its own is not evidence the
    // person still works here, and GUEST/CLIENT are read-only by design.
    // Then: on the team, or running the workspace. Anything else answers 404,
    // never 403 (see team-access.ts).
    if (
      !contributorSeatSatisfied(workspaceMember?.role) ||
      (!teamMember && !isWorkspaceManager)
    ) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const isLead = teamMember?.role === "LEAD";
    const { isArchived, ...contentFields } = data;

    // Any team member may edit the team description (Asana parity). All other
    // settings — name, color, privacy — need the team LEAD or a workspace
    // OWNER/ADMIN, the same set requireTeamMemberManagement trusts, so a team
    // whose only lead left the firm can still be renamed or re-privacied.
    const editedFields = Object.keys(contentFields);
    const descriptionOnly =
      editedFields.length > 0 &&
      editedFields.every((f) => f === "description");
    if (
      editedFields.length > 0 &&
      !descriptionOnly &&
      !isLead &&
      !isWorkspaceManager
    ) {
      return NextResponse.json(
        { error: "Only team leads or workspace admins can edit team settings" },
        { status: 403 }
      );
    }

    // Archiving is gated to the team LEAD or a workspace OWNER/ADMIN — the same
    // set /api/teams/:teamId/invite already trusts with this team's membership,
    // and the same set `requireTeamMemberManagement` admits. The check is
    // deliberately identical in BOTH directions: an archive that nobody still
    // around can reverse is a delete with extra steps.
    if (isArchived !== undefined && !isLead && !isWorkspaceManager) {
      return NextResponse.json(
        {
          error:
            "Only team leads or workspace admins can archive or restore a team",
        },
        { status: 403 }
      );
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...contentFields,
        // archivedAt is stamped and cleared alongside the flag so "Archived on
        // <date>" can never outlive the archive it describes.
        ...(isArchived === undefined
          ? {}
          : { isArchived, archivedAt: isArchived ? new Date() : null }),
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
                jobTitle: true,
              },
            },
          },
        },
        objectives: visibleObjectivesInclude(userId),
        _count: {
          select: teamCountSelect,
        },
      },
    });

    return NextResponse.json(updatedTeam);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating team:", error);
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId - Delete team
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Deleting stays LEAD-only (archiving is the reversible action, and that
    // one also admits a workspace OWNER/ADMIN). requireTeamStanding rather
    // than a bare TeamMember lookup so the lead of a team also has to still
    // hold a contributor seat in its workspace.
    const standing = await requireTeamStanding(userId, teamId);
    if (!standing.isLead) {
      return NextResponse.json(
        { error: "Only team leads can delete the team" },
        { status: 403 }
      );
    }

    // The delete cascades to every message and its attachment rows, which
    // would leave the files themselves in the store, still reachable by url.
    // Collect them first; the blobs go only after the rows are gone.
    const [attachments, team] = await Promise.all([
      prisma.messageAttachment.findMany({
        where: { teamMessage: { teamId } },
        select: { url: true },
      }),
      prisma.team.findUnique({ where: { id: teamId }, select: { avatar: true } }),
    ]);

    await prisma.team.delete({
      where: { id: teamId },
    });

    // Best effort: a stray blob is harmless, a failed request after the team
    // is already gone is not. deleteFile ignores urls outside our store, and
    // the cover is only removed when it is one the avatar route wrote for this
    // team (Team.avatar used to accept any string).
    const urls = attachments.map((a) => a.url);
    if (team?.avatar && isOwnTeamCover(teamId, team.avatar)) {
      urls.push(team.avatar);
    }
    await Promise.allSettled(urls.map((url) => deleteFile(url)));

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }

    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    );
  }
}
