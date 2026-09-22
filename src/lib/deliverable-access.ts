/**
 * deliverable-access.ts — who may read, edit and seal a project's deliverables.
 *
 * There is no separate deliverable ACL. Read = the project's read rule and
 * write = the project's `canWrite`, both from resolveProjectAccess
 * (@/lib/project-access), so the Deliverables tab can never disagree with the
 * rest of the project. Denial to read is always a 404 (a caller who may not
 * read the project must not learn the deliverable exists).
 *
 * The one new right is the PE SEAL. It lives only on
 * WorkspaceMember.sealAuthorizedAt, which only the workspace OWNER can set
 * (/api/workspace/seal-authority); the OWNER holds it implicitly. User.position
 * — and canStamp() — are deliberately NOT consulted: an OWNER/ADMIN can set
 * their own Position, so a job title cannot stand behind a legal attestation.
 */

import prisma from "@/lib/prisma";
import {
  canMoveStage,
  getProjectAccess,
  resolveProjectAccess,
  type ProjectAccessResult,
} from "@/lib/project-access";
import { isNonContributorRole } from "@/lib/workspace-roles";
import { decideSealAuthority } from "@/lib/deliverables";

export interface DeliverablePerms {
  canWrite: boolean;
  canSeal: boolean;
  canMoveStage: boolean;
  isWorkspaceOwner: boolean;
  isWorkspaceManager: boolean;
  peLicenseNo: string | null;
}

/** The caller's deliverable rights on a project they can already read. */
export async function resolveDeliverablePerms(
  access: ProjectAccessResult,
  userId: string
): Promise<DeliverablePerms> {
  const seat = access.workspaceId
    ? await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: access.workspaceId },
        },
        select: { role: true, sealAuthorizedAt: true, peLicenseNo: true },
      })
    : null;
  const isContributor = !!seat && !isNonContributorRole(seat.role);
  const canSeal =
    access.ok &&
    access.canWrite &&
    decideSealAuthority({
      role: seat?.role ?? null,
      isContributor,
      sealAuthorizedAt: seat?.sealAuthorizedAt ?? null,
    });
  return {
    canWrite: access.ok && access.canWrite,
    canSeal,
    canMoveStage: access.ok && canMoveStage(access),
    isWorkspaceOwner: isContributor && seat!.role === "OWNER",
    isWorkspaceManager: access.isWorkspaceManager,
    peLicenseNo: seat?.peLicenseNo ?? null,
  };
}

export type DeliverableAccessResult =
  | { ok: false; status: 404 }
  | ({
      ok: true;
      deliverable: {
        id: string;
        projectId: string;
        kind: string;
        status: string;
      };
      projectId: string;
      workspaceId: string;
      access: ProjectAccessResult;
    } & DeliverablePerms);

/**
 * Load a deliverable and resolve the caller against its project. Missing
 * deliverable, missing project and unreadable project are one 404.
 */
export async function getDeliverableAccess(
  deliverableId: string,
  userId: string
): Promise<DeliverableAccessResult> {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { id: true, projectId: true, kind: true, status: true },
  });
  if (!deliverable) return { ok: false, status: 404 };
  const access = await getProjectAccess(deliverable.projectId, userId);
  if (!access.ok || !access.workspaceId) return { ok: false, status: 404 };
  const perms = await resolveDeliverablePerms(access, userId);
  return {
    ok: true,
    deliverable,
    projectId: deliverable.projectId,
    workspaceId: access.workspaceId,
    access,
    ...perms,
  };
}

export interface UserLite {
  id: string;
  name: string | null;
  image: string | null;
}

async function loadProjectForAccess(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      workspaceId: true,
      visibility: true,
      teamId: true,
      members: { select: { userId: true, role: true } },
    },
  });
}

/**
 * Contributors of the project's workspace who can read the project — the
 * only people a deliverable may be assigned to. At this firm that is a
 * handful, so one resolveProjectAccess per member is cheap and keeps the rule
 * in exactly one place. (Not /api/projects/:id/members — explicit members
 * only — and not /api/users/search, which spans every workspace.)
 */
export async function listAssignableUsers(projectId: string): Promise<UserLite[]> {
  const project = await loadProjectForAccess(projectId);
  if (!project) return [];
  const seats = await prisma.workspaceMember.findMany({
    where: { workspaceId: project.workspaceId },
    select: {
      role: true,
      user: { select: { id: true, name: true, image: true } },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
  });
  const out: UserLite[] = [];
  for (const seat of seats) {
    if (isNonContributorRole(seat.role)) continue;
    const a = await resolveProjectAccess(project, seat.user.id);
    if (a.ok) out.push(seat.user);
  }
  return out;
}

/** Is `userId` in listAssignableUsers(projectId)? */
export async function isAssignableUser(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await loadProjectForAccess(projectId);
  if (!project) return false;
  const seat = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: project.workspaceId },
    },
    select: { role: true },
  });
  if (!seat || isNonContributorRole(seat.role)) return false;
  return (await resolveProjectAccess(project, userId)).ok;
}

/**
 * Who a seal request is addressed to: contributors of the project's workspace
 * who hold seal authority AND can edit this project, minus the requester. So
 * nobody learns of a project they cannot open.
 */
export async function listSealRequestRecipients(
  projectId: string,
  excludeUserId: string
): Promise<string[]> {
  const project = await loadProjectForAccess(projectId);
  if (!project) return [];
  const seats = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: project.workspaceId,
      userId: { not: excludeUserId },
    },
    select: { userId: true, role: true, sealAuthorizedAt: true },
  });
  const out: string[] = [];
  for (const seat of seats) {
    const isContributor = !isNonContributorRole(seat.role);
    if (
      !decideSealAuthority({
        role: seat.role,
        isContributor,
        sealAuthorizedAt: seat.sealAuthorizedAt,
      })
    ) {
      continue;
    }
    const a = await resolveProjectAccess(project, seat.userId);
    if (a.ok && a.canWrite) out.push(seat.userId);
  }
  return out;
}
