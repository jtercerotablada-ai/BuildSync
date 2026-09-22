import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  buildProjectVisibilityClauses,
  taskPrivacyClause,
} from "@/lib/project-visibility";
import { verifyWorkspaceAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { daysFromToday, startOfLocalDay } from "@/lib/date-only";
import { isNonContributorRole } from "@/lib/workspace-roles";
import {
  decideProjectCapabilities,
  type ProjectRole,
} from "@/lib/project-access";
import { getLevel } from "@/lib/people-types";

/**
 * Who may open / edit / manage a portfolio. The same rule is spelled out in
 * every /api/portfolios route (route files cannot share exports), so change
 * them together:
 *   view   owner | member | workspace OWNER/ADMIN | PUBLIC (anyone in the
 *          portfolio's workspace) | WORKSPACE (any contributor there)
 *   edit   owner | member OWNER/EDITOR | workspace OWNER/ADMIN
 *   manage owner | member OWNER | workspace OWNER/ADMIN  (members, privacy,
 *          delete); granting or revoking the member OWNER role and
 *          transferring ownership stay with the owner and workspace managers.
 * Edit and manage also need a contributor seat: GUEST/CLIENT are read-only.
 */
function decidePortfolioAccess(input: {
  ownerId: string | null;
  privacy: string;
  memberRole: string | null;
  workspaceRole: string;
  userId: string;
}) {
  const isOwner = input.ownerId === input.userId;
  const isContributor = !isNonContributorRole(input.workspaceRole);
  const isWorkspaceManager =
    input.workspaceRole === "OWNER" || input.workspaceRole === "ADMIN";
  const canView =
    isOwner ||
    input.memberRole != null ||
    isWorkspaceManager ||
    input.privacy === "PUBLIC" ||
    (input.privacy === "WORKSPACE" && isContributor);
  const canEdit =
    canView &&
    isContributor &&
    (isOwner ||
      isWorkspaceManager ||
      input.memberRole === "OWNER" ||
      input.memberRole === "EDITOR");
  const canManage =
    canEdit && (isOwner || isWorkspaceManager || input.memberRole === "OWNER");
  const canTransfer = canManage && (isOwner || isWorkspaceManager);
  return { isOwner, isWorkspaceManager, canView, canEdit, canManage, canTransfer };
}

/**
 * The ids (of `projectIds`) the viewer may write, by the canonical project
 * rule (decideProjectCapabilities — the same facts resolveProjectAccess
 * gathers), batched: one query each for the projects, the viewer's seats and
 * the viewer's team rows instead of one resolve per row.
 */
async function projectWriteAccess(
  userId: string,
  projectIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>();
  if (projectIds.length === 0) return out;
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: {
      id: true,
      ownerId: true,
      workspaceId: true,
      visibility: true,
      teamId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  const workspaceIds = [...new Set(projects.map((p) => p.workspaceId))];
  const teamIds = [
    ...new Set(projects.map((p) => p.teamId).filter((t): t is string => !!t)),
  ];
  const [seats, teamRows] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { userId, workspaceId: { in: workspaceIds } },
      select: {
        workspaceId: true,
        role: true,
        user: { select: { position: true } },
      },
    }),
    teamIds.length > 0
      ? prisma.teamMember.findMany({
          where: { userId, teamId: { in: teamIds } },
          select: { teamId: true, team: { select: { workspaceId: true } } },
        })
      : Promise.resolve([]),
  ]);
  const seatByWs = new Map(seats.map((s) => [s.workspaceId, s]));
  for (const p of projects) {
    const seat = seatByWs.get(p.workspaceId);
    const hasContributorSeat = !!seat && !isNonContributorRole(seat.role);
    const member = p.members[0];
    const isOwner = p.ownerId === userId;
    const isMember = !!member;
    const caps = decideProjectCapabilities({
      visibility: p.visibility,
      projectWorkspaceId: p.workspaceId,
      viewerWorkspaceIds: hasContributorSeat ? [p.workspaceId] : [],
      isOwner,
      isMember,
      memberRole: (member?.role as ProjectRole | undefined) ?? null,
      isWorkspaceManager:
        hasContributorSeat && (seat!.role === "OWNER" || seat!.role === "ADMIN"),
      // Same as resolveProjectAccess: team rows count only for a non-member
      // contributor, and only for a team in the project's own workspace.
      isTeamMember:
        !isOwner &&
        !isMember &&
        hasContributorSeat &&
        !!p.teamId &&
        teamRows.some(
          (t) => t.teamId === p.teamId && t.team.workspaceId === p.workspaceId
        ),
      hasSeniorRead: hasContributorSeat && getLevel(seat!.user.position) >= 4,
    });
    if (caps.canWrite) out.add(p.id);
  }
  return out;
}

/** A date the client may send: "YYYY-MM-DD" or a full ISO timestamp. */
const optionalDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
  .optional()
  .nullable();

const updatePortfolioSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  icon: z.string().min(1).optional(),
  status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD", "COMPLETE"]).optional(),
  privacy: z.enum(["PRIVATE", "WORKSPACE", "PUBLIC"]).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  // Transfer ownership to another contributor of the portfolio's workspace.
  ownerId: z.string().min(1).optional(),
});

// GET /api/portfolios/:portfolioId - Get portfolio details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Being in a portfolio is not read access to a project: a PRIVATE project
    // stays members-only, so rows the viewer cannot open never leave the
    // server — not their name, budget, owner or task counts. Same list rule
    // the dashboard uses (canReadProject's sibling).
    const projectClauses = (await buildProjectVisibilityClauses(userId)) ?? [];

    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        projects: {
          where: { project: { OR: projectClauses } },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
                status: true,
                // When a human last CHOSE that status. Without it the row
                // cannot tell "somebody said On track" from the ON_TRACK
                // default nobody ever looked at, so it painted a confident
                // gold pill on every project — while the status modal that
                // same pill opens fetches the project directly, reads the
                // stamp and says "No status". One click, two answers.
                statusSetAt: true,
                type: true,
                stage: true,
                gate: true,
                budget: true,
                currency: true,
                startDate: true,
                endDate: true,
                isArchived: true,
                owner: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
                _count: {
                  select: {
                    // Privacy, as everywhere else: a relation count would
                    // include tasks this viewer cannot open.
                    tasks: { where: taskPrivacyClause(userId) },
                  },
                },
                tasks: {
                  // Only top-level tasks, matching how goal roll-ups measure a
                  // project (src/lib/goal-progress.ts). Counting subtasks here
                  // made the same project read at a different percentage in the
                  // portfolio table than in a goal's related work.
                  // Same privacy rule as the count above, or the progress bar
                  // would be computed over tasks the viewer cannot open.
                  where: {
                    AND: [{ parentTaskId: null }, taskPrivacyClause(userId)],
                  },
                  select: {
                    id: true,
                    completed: true,
                    dueDate: true,
                  },
                },
              },
            },
          },
          orderBy: { position: "asc" },
        },
        members: true,
        statusUpdates: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    if (!portfolio) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }

    // Verify user belongs to portfolio's workspace
    const wsMember = await verifyWorkspaceAccess(userId, portfolio.workspaceId);

    // ── Privacy gate ─────────────────────────────────────────
    // Mask the portfolio as 404 unless the caller may view it (see
    // decidePortfolioAccess).
    const access = decidePortfolioAccess({
      ownerId: portfolio.ownerId,
      privacy: portfolio.privacy,
      memberRole:
        portfolio.members.find((m) => m.userId === userId)?.role ?? null,
      workspaceRole: wsMember.role,
      userId,
    });
    if (!access.canView) {
      return NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 }
      );
    }

    // An archived project is off the dashboard, the sidebar and every team
    // view; leaving it on this page's list, timeline and health rollup would
    // make the portfolio disagree with the dashboard beside it. Its OPEN work
    // is what stops counting — there is no surface left to work it down on.
    const activeProjects = portfolio.projects.filter(
      (pp) => !pp.project.isArchived
    );
    // Its FINISHED work still counts, though: archiving a delivered job must
    // not retroactively un-deliver it, so the tasks it completed stay in the
    // portfolio's totals (the same call the dashboard's completed counts
    // make). The client folds this into totalTasks AND completedTasks, so
    // progress can only rise toward the truth, never past 100%.
    const archivedCompletedTasks = portfolio.projects
      .filter((pp) => pp.project.isArchived)
      .reduce(
        (n, pp) => n + pp.project.tasks.filter((t) => t.completed).length,
        0
      );
    // The reorder endpoint renumbers the WHOLE join table and rejects a
    // partial list, so the page still has to name the rows it no longer
    // renders — otherwise dragging a row on a portfolio that contains an
    // archived project can only ever answer 400.
    const archivedProjectIds = portfolio.projects
      .filter((pp) => pp.project.isArchived)
      .map((pp) => pp.project.id);

    // Calculate stats for each project.
    //
    // One day for the whole response, named once instead of re-read per
    // task: this runs on the server, where the local day IS the UTC day —
    // the same convention due dates are stored in. `daysFromToday` no longer
    // reads the clock for us, so the day has to be said out loud.
    const today = startOfLocalDay();
    const writable = await projectWriteAccess(
      userId,
      activeProjects.map((pp) => pp.project.id)
    );
    const projectsWithStats = activeProjects.map((pp) => {
      const project = pp.project;
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((t) => t.completed).length;
      // date-only overdue: a task due TODAY is NEVER overdue. daysFromToday
      // buckets by the UTC calendar day, so viewers west of UTC don't see
      // today's tasks flip to overdue (see src/lib/date-only.ts).
      const overdueTasks = project.tasks.filter(
        (t) => !t.completed && t.dueDate && daysFromToday(t.dueDate, today) < 0
      ).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Strip raw tasks; serialize Decimal budget as number for JSON.
      const { tasks: _tasks, budget, ...rest } = project;
      void _tasks;
      return {
        ...pp,
        project: {
          ...rest,
          budget: budget ? Number(budget) : null,
          // Whether THIS viewer may edit the project itself (dates, status):
          // the portfolio edit right does not imply it.
          canWrite: writable.has(project.id),
          stats: {
            total: totalTasks,
            completed: completedTasks,
            overdue: overdueTasks,
            progress,
          },
        },
      };
    });

    return NextResponse.json({
      ...portfolio,
      projects: projectsWithStats,
      _count: { ...portfolio._count, projects: projectsWithStats.length },
      archivedCompletedTasks,
      archivedProjectIds,
      // The caller's standing, decided here so the page does not have to
      // re-derive it (workspace managers hold no member row).
      viewerAccess: {
        canEdit: access.canEdit,
        canManage: access.canManage,
        canTransfer: access.canTransfer,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching portfolio:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}

// PATCH /api/portfolios/:portfolioId - Update portfolio
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user belongs to portfolio's workspace
    const existingPortfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        workspaceId: true,
        ownerId: true,
        privacy: true,
        startDate: true,
        endDate: true,
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });
    if (!existingPortfolio) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    const wsMember = await verifyWorkspaceAccess(
      userId,
      existingPortfolio.workspaceId
    );

    // ── Edit gate ────────────────────────────────────────────
    // Owner, OWNER/EDITOR member or workspace manager may mutate content.
    // Someone who cannot even see the portfolio gets the GET's 404.
    const access = decidePortfolioAccess({
      ownerId: existingPortfolio.ownerId,
      privacy: existingPortfolio.privacy,
      memberRole: existingPortfolio.members[0]?.role ?? null,
      workspaceRole: wsMember.role,
      userId,
    });
    if (!access.canView) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    if (!access.canEdit) {
      return NextResponse.json(
        {
          error:
            "Only the portfolio owner or an Editor can update this portfolio",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const data = updatePortfolioSchema.parse(body);

    // Privacy decides who gets in, which is member management — an Editor
    // may change content but not the audience.
    if (
      data.privacy !== undefined &&
      data.privacy !== existingPortfolio.privacy &&
      !access.canManage
    ) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an admin can change who has access" },
        { status: 403 }
      );
    }

    const updateData: Prisma.PortfolioUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.privacy !== undefined) updateData.privacy = data.privacy;

    const nextStart =
      data.startDate === undefined
        ? existingPortfolio.startDate
        : data.startDate
          ? new Date(data.startDate)
          : null;
    const nextEnd =
      data.endDate === undefined
        ? existingPortfolio.endDate
        : data.endDate
          ? new Date(data.endDate)
          : null;
    // Only enforce the order when this request touches a date: older rows
    // may already be inverted, and a rename or status change must not be
    // refused over dates the user did not edit.
    const touchesDates =
      data.startDate !== undefined || data.endDate !== undefined;
    if (
      touchesDates &&
      nextStart &&
      nextEnd &&
      nextEnd.getTime() < nextStart.getTime()
    ) {
      return NextResponse.json(
        { error: "The end date can't be before the start date" },
        { status: 400 }
      );
    }
    if (data.startDate !== undefined) updateData.startDate = nextStart;
    if (data.endDate !== undefined) updateData.endDate = nextEnd;

    // ── Ownership transfer ───────────────────────────────────
    // The owner hands the portfolio on, or a workspace manager reassigns it
    // (e.g. after the owner left the firm). The new owner must hold a
    // contributor seat in the portfolio's workspace; their member row is
    // dropped because Portfolio.ownerId already grants everything, and the
    // previous owner stays on as an Editor rather than silently losing access.
    const newOwnerId =
      data.ownerId !== undefined && data.ownerId !== existingPortfolio.ownerId
        ? data.ownerId
        : null;
    if (newOwnerId) {
      if (!access.canTransfer) {
        return NextResponse.json(
          {
            error:
              "Only the portfolio owner or a workspace admin can transfer ownership",
          },
          { status: 403 }
        );
      }
      const target = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: newOwnerId,
            workspaceId: existingPortfolio.workspaceId,
          },
        },
        select: { role: true },
      });
      if (!target || isNonContributorRole(target.role)) {
        return NextResponse.json(
          { error: "The new owner must be a member of this workspace" },
          { status: 400 }
        );
      }
      updateData.owner = { connect: { id: newOwnerId } };
    }

    const previousOwnerId = existingPortfolio.ownerId;
    const projectClauses = (await buildProjectVisibilityClauses(userId)) ?? [];
    const portfolio = await prisma.$transaction(async (tx) => {
      if (newOwnerId) {
        await tx.portfolioMember.deleteMany({
          where: { portfolioId, userId: newOwnerId },
        });
        if (previousOwnerId) {
          await tx.portfolioMember.upsert({
            where: {
              portfolioId_userId: { portfolioId, userId: previousOwnerId },
            },
            create: { portfolioId, userId: previousOwnerId, role: "EDITOR" },
            update: {},
          });
        }
      }
      return tx.portfolio.update({
        where: { id: portfolioId },
        data: updateData,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          _count: {
            select: {
              // Same population the GET returns (active projects the caller
              // can read), so the page merging this response after a rename
              // doesn't change its "N projects" count.
              projects: {
                where: {
                  project: {
                    isArchived: false,
                    OR: projectClauses,
                  },
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(portfolio);
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
    console.error("Error updating portfolio:", error);
    return NextResponse.json(
      { error: "Failed to update portfolio" },
      { status: 500 }
    );
  }
}

// DELETE /api/portfolios/:portfolioId - Delete portfolio
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user belongs to portfolio's workspace
    const portToDelete = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        workspaceId: true,
        ownerId: true,
        privacy: true,
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });
    if (!portToDelete) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    const wsMember = await verifyWorkspaceAccess(userId, portToDelete.workspaceId);

    // ── Delete gate ──────────────────────────────────────────
    // The portfolio owner, a member with role OWNER or a workspace
    // manager can delete. EDITOR can mutate fields but not destroy the
    // whole portfolio.
    const access = decidePortfolioAccess({
      ownerId: portToDelete.ownerId,
      privacy: portToDelete.privacy,
      memberRole: portToDelete.members[0]?.role ?? null,
      workspaceRole: wsMember.role,
      userId,
    });
    if (!access.canView) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    if (!access.canManage) {
      return NextResponse.json(
        { error: "Only the portfolio owner can delete it" },
        { status: 403 }
      );
    }

    // The Panel's widgets live on a hidden Report linked to the portfolio by
    // its sentinel name, not a foreign key, so nothing cascades to it — it
    // goes in the same transaction (its widgets cascade from the Report).
    // Keep the name in step with portfolioReportName() in ./widgets/route.ts.
    await prisma.$transaction([
      prisma.report.deleteMany({
        where: {
          workspaceId: portToDelete.workspaceId,
          name: `__portfolio:${portfolioId}`,
        },
      }),
      prisma.portfolio.delete({
        where: { id: portfolioId },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting portfolio:", error);
    return NextResponse.json(
      { error: "Failed to delete portfolio" },
      { status: 500 }
    );
  }
}
