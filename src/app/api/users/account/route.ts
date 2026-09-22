import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { isNonContributorRole } from "@/lib/workspace-roles";

// Portfolio panel widgets live on a hidden Report named with this prefix
// (see api/portfolios/[portfolioId]/widgets). It is firm data, unlike the
// caller's own Reporting dashboards, which are private to their owner.
const PORTFOLIO_REPORT_PREFIX = "__portfolio:";

type Db = Prisma.TransactionClient | typeof prisma;

interface WorkspacePlan {
  workspaceId: string;
  workspaceName: string;
  /** Who inherits the firm rows the leaving user created in this workspace. */
  heirId: string;
  heirName: string;
  /**
   * The OWNER or ADMIN heir, when there is one. Owning a goal or portfolio
   * gets past its private flag, so only leadership may inherit those; with
   * nobody here they go ownerless, as in members DELETE.
   */
  leaderId: string | null;
  /** Another OWNER to take Workspace.ownerId, when the leaving user holds it. */
  ownerHeirId: string | null;
  counts: {
    projects: number;
    uploads: number;
    templates: number;
    goals: number;
    portfolios: number;
  };
}

interface DeletionPlan {
  requiresPassword: boolean;
  /**
   * Workspaces the user cannot leave yet: they are the only OWNER while other
   * people remain ("sole-owner"), or nobody there may take over what they own
   * ("no-heir").
   */
  blockers: {
    workspaceId: string;
    workspaceName: string;
    reason: "sole-owner" | "no-heir";
  }[];
  transfers: WorkspacePlan[];
  /** Workspaces with nobody else in them: their content goes with the user. */
  soloWorkspaces: { workspaceId: string; workspaceName: string }[];
}

class BlockedError extends Error {}

// Deleting a User row cascades (schema.prisma) through File.uploader,
// Attachment.uploader, ProjectTemplate.creator, Report.owner,
// KeyResultUpdate/ObjectiveStatusUpdate/PortfolioStatusUpdate.author and
// WorkspaceInvitation.inviter, and nulls Project.owner and Workspace.owner.
// Those rows belong to the firm, not the person, so every workspace that
// still has other people in it names an heir first: another OWNER, then an
// ADMIN. Only leadership may inherit projects, because project ownership
// grants read and write on its own; other firm rows may fall back to the
// longest-standing contributor. A guest or client seat never inherits.
async function buildPlan(db: Db, userId: string): Promise<DeletionPlan> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  const [memberships, ownedWorkspaces] = await Promise.all([
    db.workspaceMember.findMany({
      where: { userId },
      select: {
        role: true,
        workspace: { select: { id: true, name: true } },
      },
    }),
    // Workspace.ownerId can point at someone without a member row.
    db.workspace.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true },
    }),
  ]);

  const workspaces = new Map<string, { name: string; isOwner: boolean }>();
  for (const m of memberships) {
    workspaces.set(m.workspace.id, {
      name: m.workspace.name,
      isOwner: m.role === "OWNER",
    });
  }
  for (const w of ownedWorkspaces) {
    if (!workspaces.has(w.id)) {
      workspaces.set(w.id, { name: w.name, isOwner: false });
    }
  }

  const plan: DeletionPlan = {
    requiresPassword: !!user?.password,
    blockers: [],
    transfers: [],
    soloWorkspaces: [],
  };

  for (const [workspaceId, { name, isOwner }] of workspaces) {
    const others = await db.workspaceMember.findMany({
      where: { workspaceId, userId: { not: userId } },
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      select: {
        userId: true,
        role: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (others.length === 0) {
      plan.soloWorkspaces.push({ workspaceId, workspaceName: name });
      continue;
    }
    const owner = others.find((m) => m.role === "OWNER") ?? null;
    // Same rule as removing a member: the workspace is never left without an
    // OWNER while people still work in it.
    if (isOwner && !owner) {
      plan.blockers.push({ workspaceId, workspaceName: name, reason: "sole-owner" });
      continue;
    }
    const leader = owner ?? others.find((m) => m.role === "ADMIN") ?? null;
    const heir =
      leader ?? others.find((m) => !isNonContributorRole(m.role)) ?? null;

    const [projects, files, attachments, templates, goals, portfolios] =
      await Promise.all([
      db.project.count({ where: { workspaceId, ownerId: userId } }),
      db.file.count({
        where: { uploaderId: userId, project: { workspaceId } },
      }),
      db.attachment.count({
        where: { uploaderId: userId, ...attachmentInWorkspace(workspaceId) },
      }),
      db.projectTemplate.count({
        where: { workspaceId, creatorId: userId },
      }),
      db.objective.count({ where: { workspaceId, ownerId: userId } }),
      db.portfolio.count({ where: { workspaceId, ownerId: userId } }),
    ]);

    // Same rule as removing a member: refusing beats handing a project to a
    // seat that could not otherwise open it, or cascading firm rows away.
    if (!heir || (!leader && projects > 0)) {
      plan.blockers.push({ workspaceId, workspaceName: name, reason: "no-heir" });
      continue;
    }

    plan.transfers.push({
      workspaceId,
      workspaceName: name,
      heirId: heir.userId,
      heirName: heir.user.name || heir.user.email || "another member",
      leaderId: leader?.userId ?? null,
      ownerHeirId: owner?.userId ?? null,
      counts: {
        projects,
        uploads: files + attachments,
        templates,
        // Only what actually moves: without a leader these go ownerless.
        goals: leader ? goals : 0,
        portfolios: leader ? portfolios : 0,
      },
    });
  }

  return plan;
}

function attachmentInWorkspace(workspaceId: string): Prisma.AttachmentWhereInput {
  return {
    OR: [
      { task: { project: { workspaceId } } },
      { comment: { task: { project: { workspaceId } } } },
    ],
  };
}

function publicPlan(plan: DeletionPlan) {
  return {
    requiresPassword: plan.requiresPassword,
    blockers: plan.blockers,
    transfers: plan.transfers.map((t) => ({
      workspaceId: t.workspaceId,
      workspaceName: t.workspaceName,
      heirName: t.heirName,
      counts: t.counts,
    })),
    soloWorkspaces: plan.soloWorkspaces,
  };
}

function blockedMessage(blockers: DeletionPlan["blockers"]) {
  const names = (reason: DeletionPlan["blockers"][number]["reason"]) =>
    blockers
      .filter((b) => b.reason === reason)
      .map((b) => `"${b.workspaceName}"`)
      .join(", ");
  const parts: string[] = [];
  const soleOwner = names("sole-owner");
  if (soleOwner) {
    parts.push(
      `You are the only owner of ${soleOwner}, which still has other members. Ownership can't be transferred in the app, so remove the other members from it before deleting your account.`
    );
  }
  const noHeir = names("no-heir");
  if (noHeir) {
    parts.push(
      `Nobody in ${noHeir} can take over what you own there: it has no other owner or admin, and only an owner can change roles. Ask your firm's administrator to add an owner or admin to it before deleting your account.`
    );
  }
  return parts.join(" ");
}

// GET /api/users/account — what deleting the account would do, so the
// confirmation dialog can say it before anything happens.
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const plan = await buildPlan(prisma, userId);
    return NextResponse.json(publicPlan(plan));
  } catch (error) {
    console.error("Error previewing account deletion:", error);
    return NextResponse.json(
      { error: "Failed to load account deletion details" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/account
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { confirmation, password } = body as {
      confirmation?: unknown;
      password?: unknown;
    };

    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Please type DELETE to confirm" },
        { status: 400 }
      );
    }

    // A typed word proves nothing about who is at the keyboard; an unlocked
    // laptop was enough to wipe the account. Password accounts re-enter it.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (user.password) {
      if (typeof password !== "string" || !password) {
        return NextResponse.json(
          { error: "Enter your password to confirm" },
          { status: 400 }
        );
      }
      if (!(await compare(password, user.password))) {
        return NextResponse.json(
          { error: "Password is incorrect" },
          { status: 400 }
        );
      }
    }

    // One transaction: the plan is re-read inside it, and a half-done
    // hand-over followed by a failed delete is worse than no change at all.
    await prisma.$transaction(
      async (tx) => {
        const plan = await buildPlan(tx, userId);
        if (plan.blockers.length > 0) {
          throw new BlockedError(blockedMessage(plan.blockers));
        }

        for (const t of plan.transfers) {
          const { workspaceId, heirId } = t;
          // project-access grants the owner read and write on its own, so a
          // project keeps a named owner rather than going to NULL.
          await tx.project.updateMany({
            where: { workspaceId, ownerId: userId },
            data: { ownerId: heirId },
          });
          // As in members DELETE: an ownerless goal or portfolio is still
          // reachable, but nobody would be answering for it. Only leadership
          // inherits them, because ownership opens a private goal or
          // portfolio to someone it was never shared with.
          if (t.leaderId) {
            await tx.objective.updateMany({
              where: { workspaceId, ownerId: userId },
              data: { ownerId: t.leaderId },
            });
            await tx.portfolio.updateMany({
              where: { workspaceId, ownerId: userId },
              data: { ownerId: t.leaderId },
            });
          }
          await tx.file.updateMany({
            where: { uploaderId: userId, project: { workspaceId } },
            data: { uploaderId: heirId },
          });
          await tx.attachment.updateMany({
            where: { uploaderId: userId, ...attachmentInWorkspace(workspaceId) },
            data: { uploaderId: heirId },
          });
          await tx.projectTemplate.updateMany({
            where: { workspaceId, creatorId: userId },
            data: { creatorId: heirId },
          });
          await tx.report.updateMany({
            where: {
              workspaceId,
              ownerId: userId,
              name: { startsWith: PORTFOLIO_REPORT_PREFIX },
            },
            data: { ownerId: heirId },
          });
          // The author column is required, so goal and portfolio history can
          // only survive under someone else's name.
          await tx.keyResultUpdate.updateMany({
            where: { authorId: userId, keyResult: { objective: { workspaceId } } },
            data: { authorId: heirId },
          });
          await tx.objectiveStatusUpdate.updateMany({
            where: { authorId: userId, objective: { workspaceId } },
            data: { authorId: heirId },
          });
          await tx.portfolioStatusUpdate.updateMany({
            where: { authorId: userId, portfolio: { workspaceId } },
            data: { authorId: heirId },
          });
          // Pending invitations stay valid for the people they were sent to.
          await tx.workspaceInvitation.updateMany({
            where: { workspaceId, inviterId: userId },
            data: { inviterId: heirId },
          });
          if (t.ownerHeirId) {
            await tx.workspace.updateMany({
              where: { id: workspaceId, ownerId: userId },
              data: { ownerId: t.ownerHeirId },
            });
          }
        }

        // Attachments left over sit on personal (project-less) tasks. When
        // someone else is assigned to or created that task, the file is theirs
        // to keep; otherwise it was the user's alone and goes with them.
        const leftover = await tx.attachment.findMany({
          where: { uploaderId: userId },
          select: {
            id: true,
            task: { select: { assigneeId: true, creatorId: true } },
            comment: {
              select: { task: { select: { assigneeId: true, creatorId: true } } },
            },
          },
        });
        const byKeeper = new Map<string, string[]>();
        for (const a of leftover) {
          const task = a.task ?? a.comment?.task ?? null;
          const keeper = [task?.assigneeId, task?.creatorId].find(
            (id): id is string => !!id && id !== userId
          );
          if (keeper) byKeeper.set(keeper, [...(byKeeper.get(keeper) ?? []), a.id]);
        }
        for (const [keeper, ids] of byKeeper) {
          await tx.attachment.updateMany({
            where: { id: { in: ids } },
            data: { uploaderId: keeper },
          });
        }

        // createdBy has no onDelete (RESTRICT), so any leftover share link
        // made the user delete fail outright. Client links are retired.
        await tx.projectShareLink.deleteMany({ where: { createdById: userId } });

        // Remaining cascades are personal: sessions, memberships, likes,
        // notifications, private dashboards, direct messages.
        await tx.user.delete({ where: { id: userId } });
      },
      { timeout: 30000 }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BlockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
