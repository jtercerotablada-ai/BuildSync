import prisma from "@/lib/prisma";
import {
  AuthorizationError,
  NotFoundError,
  contributorSeatSatisfied,
} from "@/lib/auth-guards";

/**
 * objective-access.ts — the one answer to "may this user open, and may this
 * user change, this goal?", for every /api/objectives/[objectiveId]/* route.
 *
 * WHY THIS EXISTS
 * `Objective.isPrivate` has been in the schema since goals shipped and no
 * endpoint has ever read it. Ten routes gate on the same weak pair of lines —
 * resolve the caller's workspace, compare it to the objective's, 404 on a
 * mismatch — so a goal its owner marked private is readable AND writable by
 * every colleague in the workspace, key results, check-ins, comments and
 * project connections included. The flag is a promise the API never kept.
 * This module is where that decision now lives, in the shape
 * project-access.ts established for projects.
 *
 * SCOPE — read this before widening anything here. This gate changes exactly
 * one thing: who may touch a PRIVATE objective. For a NON-private objective
 * any workspace contributor still reads and still writes, which is precisely
 * the behaviour that shipped. Who may edit an ordinary goal is a product
 * decision, not a security one, and it is not made here.
 *
 * WORKSPACE RESOLUTION — the membership consulted is the caller's row in the
 * OBJECTIVE's workspace, looked up by the composite key, never the "primary
 * workspace" heuristic the old checks reached through getUserWorkspaceId. A
 * user holding several memberships has exactly one primary workspace, so
 * comparing a goal's workspace against it hides every goal that lives in any
 * of their others. Same lookup project-access.ts makes, for the same reason.
 *
 * PER-MEMBER ROLE — ObjectiveMemberRole (EDITOR | VIEWER) is deliberately not
 * consulted. The flags below answer "is this person on the goal at all"; the
 * route that cares about the finer role (objective PATCH, which requires
 * EDITOR) keeps its own check on top of these.
 */

/** The objective fields the decision needs, and the ones routes re-read most. */
export interface ObjectiveAccessSubject {
  id: string;
  workspaceId: string;
  ownerId: string | null;
  teamId: string | null;
  isPrivate: boolean;
}

export interface ObjectiveAccessFailure {
  ok: false;
  /** Always 404 — see objectiveAccessDenied(). */
  status: number;
  error: string;
}

export interface ObjectiveAccessDecision {
  canRead: boolean;
  canWrite: boolean;
  isOwner: boolean;
  /** The caller holds an ObjectiveMember row on this objective. */
  isMember: boolean;
  /** OWNER or ADMIN of the OBJECTIVE's workspace. */
  isWorkspaceManager: boolean;
}

export interface ObjectiveAccessGranted extends ObjectiveAccessDecision {
  ok: true;
  objective: ObjectiveAccessSubject;
}

export type ObjectiveAccessResult =
  | ObjectiveAccessFailure
  | ObjectiveAccessGranted;

/** Everything the decision depends on, and nothing else. */
export interface ObjectiveAccessDecisionInput {
  isPrivate: boolean;
  /**
   * The caller's WorkspaceRole in the OBJECTIVE's own workspace; null when
   * they hold no row there. Never a role carried over from another
   * workspace — resolveObjectiveAccess keys the lookup on the objective's
   * workspaceId, so owning a different workspace cannot arrive here.
   */
  workspaceRole: string | null;
  isOwner: boolean;
  isMember: boolean;
}

/**
 * The answer for a caller who may not read this objective — and for one where
 * it does not exist. Both must be indistinguishable: a 403 tells someone
 * walking ids that the goal is real and merely hidden, which is the one fact a
 * private goal exists to withhold. Mirrors how project-access.ts masks a
 * project's existence.
 */
export function objectiveAccessDenied(): ObjectiveAccessFailure {
  return { ok: false, status: 404, error: "Objective not found" };
}

/**
 * THE decision, as a pure function — no Prisma, no session, no I/O, so the
 * whole rule is exercisable without a database (DATABASE_URL points at
 * PRODUCTION; see vitest.config.ts).
 */
export function decideObjectiveAccess(
  input: ObjectiveAccessDecisionInput
): ObjectiveAccessDecision {
  const isWorkspaceManager =
    input.workspaceRole === "OWNER" || input.workspaceRole === "ADMIN";

  // A contributor seat in the goal's OWN workspace is the floor under
  // everything below. GUEST and CLIENT are read-only by design and have no
  // goals surface at all, and a null role is someone offboarded or never
  // invited — both fail closed here instead of falling through to the
  // privacy branch.
  const isContributor = contributorSeatSatisfied(input.workspaceRole);

  // Owning the goal, being named on it, or running the workspace: the three
  // ways past the private flag. Every other colleague gets a 404, exactly as
  // if the goal were not there.
  const passesPrivacy =
    !input.isPrivate ||
    input.isOwner ||
    input.isMember ||
    isWorkspaceManager;

  const canRead = isContributor && passesPrivacy;

  // Spelled out rather than aliased to canRead. The two sets coincide only
  // because the people allowed to SEE a private goal are exactly the people
  // allowed to change it; narrowing one of them later must not silently move
  // the other. For a non-private goal this stays true for every contributor,
  // unchanged from before this gate existed.
  const canWrite = canRead && passesPrivacy;

  return {
    canRead,
    canWrite,
    isOwner: input.isOwner,
    isMember: input.isMember,
    isWorkspaceManager,
  };
}

/**
 * Load the objective and resolve the caller's access to it. Returns
 * `ok:false, status:404` when the objective doesn't exist OR the caller may
 * not read it — never 403, so a private goal cannot be probed into existence.
 */
export async function resolveObjectiveAccess(
  objectiveId: string,
  userId: string
): Promise<ObjectiveAccessResult> {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    select: {
      id: true,
      workspaceId: true,
      ownerId: true,
      teamId: true,
      isPrivate: true,
    },
  });

  if (!objective) {
    return objectiveAccessDenied();
  }

  const [membership, member] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: objective.workspaceId },
      },
      select: { role: true },
    }),
    prisma.objectiveMember.findUnique({
      where: { objectiveId_userId: { objectiveId, userId } },
      select: { userId: true },
    }),
  ]);

  const decision = decideObjectiveAccess({
    isPrivate: objective.isPrivate,
    workspaceRole: membership?.role ?? null,
    isOwner: !!objective.ownerId && objective.ownerId === userId,
    isMember: !!member,
  });

  if (!decision.canRead) {
    return objectiveAccessDenied();
  }

  return { ok: true, ...decision, objective };
}

/**
 * The one-line guard for the /api/objectives/[objectiveId]/* handlers, in the
 * same shape as verifyProjectAccess: throws NotFoundError (→ 404) when the
 * objective is unknown or unreadable, AuthorizationError (→ 403) when the
 * caller may read it but not change it, and otherwise hands back the resolved
 * access so the handler doesn't pay for a second lookup.
 */
export async function verifyObjectiveAccess(
  userId: string,
  objectiveId: string,
  opts: { requireWrite?: boolean } = {}
): Promise<ObjectiveAccessGranted> {
  const access = await resolveObjectiveAccess(objectiveId, userId);
  if (!access.ok) {
    throw new NotFoundError(access.error);
  }
  if (opts.requireWrite && !access.canWrite) {
    throw new AuthorizationError(
      "You don't have permission to modify this objective"
    );
  }
  return access;
}
