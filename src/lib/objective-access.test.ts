import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decideObjectiveAccess,
  objectiveAccessDenied,
  type ObjectiveAccessDecisionInput,
} from "./objective-access";
import { NON_CONTRIBUTOR_ROLES } from "@/lib/workspace-roles";

/**
 * WHO MAY SEE A PRIVATE GOAL.
 *
 * `Objective.isPrivate` was written by the UI and read by nothing: every
 * /api/objectives/[objectiveId]/* route asked only "is this goal in the
 * caller's workspace?", so a goal marked private was open — read AND write —
 * to the whole firm. These tests pin the gate that closed it, and just as
 * hard, they pin what it must NOT change: an ordinary goal stays editable by
 * every colleague, and the people who run the workspace never lose sight of
 * their own goals.
 *
 * `resolveObjectiveAccess` loads the Objective row, so it is not called here —
 * DATABASE_URL points at PRODUCTION and vitest.config.ts blanks it precisely
 * so a test that reaches for the database fails loudly. The whole rule lives
 * in `decideObjectiveAccess`, which is pure; the one thing it cannot see (that
 * the workspace role is fetched for the OBJECTIVE's workspace, not the
 * caller's primary one) is pinned against the source at the bottom.
 *
 * The people, as the firm actually has them:
 *   WS_OWNER   — owns the workspace; not named on every goal in it.
 *   WS_ADMIN   — runs the workspace alongside them.
 *   COLLEAGUE  — a plain MEMBER seat, no tie to the goal.
 *   OUTSIDER   — holds no seat in this workspace at all.
 */

/** A caller with a plain staff seat and no tie to a private goal: the
 *  baseline every test below deviates from by exactly one field. */
function colleague(
  overrides: Partial<ObjectiveAccessDecisionInput> = {}
): ObjectiveAccessDecisionInput {
  return {
    isPrivate: true,
    workspaceRole: "MEMBER",
    isOwner: false,
    isMember: false,
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// An ordinary goal behaves exactly as it did before the gate
// ───────────────────────────────────────────────────────────────────────────

describe("a goal that is not private is shared work", () => {
  it.each(["OWNER", "ADMIN", "MEMBER", "WORKER"])(
    "a %s can open it and update it, unchanged from before",
    (workspaceRole) => {
      // The deliberate non-change. Narrowing write on a normal goal is a
      // product decision; this gate is only about the private flag, and this
      // test fails the moment someone widens it into one.
      const access = decideObjectiveAccess(
        colleague({ isPrivate: false, workspaceRole })
      );
      expect(access.canRead).toBe(true);
      expect(access.canWrite).toBe(true);
    }
  );
});

// ───────────────────────────────────────────────────────────────────────────
// A private goal is private
// ───────────────────────────────────────────────────────────────────────────

describe("a private goal is visible only to the people on it", () => {
  it("its owner keeps full access after marking it private", () => {
    const access = decideObjectiveAccess(colleague({ isOwner: true }));
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(true);
  });

  it("a colleague who is not on it cannot find it — and cannot edit it", () => {
    // The hole itself: this caller could read the goal, its key results and
    // its check-ins, and write to all three.
    const access = decideObjectiveAccess(colleague());
    expect(access.canRead).toBe(false);
    expect(access.canWrite).toBe(false);
  });

  it("someone added to the goal can read and update it", () => {
    // An ObjectiveMember row is an explicit invitation from the owner.
    const access = decideObjectiveAccess(colleague({ isMember: true }));
    expect(access.canRead).toBe(true);
    expect(access.canWrite).toBe(true);
  });

  it.each(["OWNER", "ADMIN"])(
    "the workspace %s can still open every goal in the firm",
    (workspaceRole) => {
      // Locking the firm's own leadership out of the firm's goals would be
      // worse than the leak this closes.
      const access = decideObjectiveAccess(colleague({ workspaceRole }));
      expect(access.isWorkspaceManager).toBe(true);
      expect(access.canRead).toBe(true);
      expect(access.canWrite).toBe(true);
    }
  );

  it("a plain seat is not leadership, however senior the person", () => {
    // isWorkspaceManager is exactly OWNER/ADMIN of THIS workspace: nothing
    // else may be read as a way past the private flag.
    for (const workspaceRole of ["MEMBER", "WORKER"]) {
      expect(
        decideObjectiveAccess(colleague({ workspaceRole })).isWorkspaceManager
      ).toBe(false);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The floor: a contributor seat in the goal's own workspace
// ───────────────────────────────────────────────────────────────────────────

describe("no seat in the workspace, no goals", () => {
  it.each([...NON_CONTRIBUTOR_ROLES])(
    "a %s is refused even on a goal nobody made private",
    (workspaceRole) => {
      // Named from NON_CONTRIBUTOR_ROLES, the same set the Edge gate and
      // requireWorkspaceContributor consume: add a read-only role there and
      // this demands the goals gate already refuses it.
      const access = decideObjectiveAccess(
        colleague({ isPrivate: false, workspaceRole })
      );
      expect(access.canRead).toBe(false);
      expect(access.canWrite).toBe(false);
    }
  );

  it("a user with no membership in the goal's workspace gets nothing", () => {
    // No WorkspaceMember row → null role. Public or private, owner or not.
    for (const isPrivate of [false, true]) {
      const access = decideObjectiveAccess(
        colleague({ isPrivate, workspaceRole: null })
      );
      expect(access.canRead).toBe(false);
      expect(access.canWrite).toBe(false);
    }
  });

  it("an offboarded owner loses the goal with the seat", () => {
    // Removing someone from a workspace deletes their WorkspaceMember row and
    // nothing else — Objective.ownerId survives. The seat check is what stops
    // that stale pointer from still opening the firm's goals.
    const access = decideObjectiveAccess(
      colleague({ isOwner: true, isMember: true, workspaceRole: null })
    );
    expect(access.canRead).toBe(false);
    expect(access.canWrite).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Shape invariants
// ───────────────────────────────────────────────────────────────────────────

describe("the gate fails closed and stays quiet", () => {
  it("a refusal is 404, never 403 — a 403 would confirm the goal exists", () => {
    const denial = objectiveAccessDenied();
    expect(denial.ok).toBe(false);
    expect(denial.status).toBe(404);
    expect(denial.status).not.toBe(403);
    expect(denial.error.length).toBeGreaterThan(0);
  });

  it("write is never granted to someone who cannot read", () => {
    const inputs: ObjectiveAccessDecisionInput[] = [
      colleague(),
      colleague({ workspaceRole: null }),
      colleague({ workspaceRole: "GUEST", isOwner: true }),
      colleague({ isPrivate: false, workspaceRole: "CLIENT" }),
    ];
    for (const input of inputs) {
      const access = decideObjectiveAccess(input);
      expect(access.canRead).toBe(false);
      expect(access.canWrite).toBe(false);
    }
  });

  it("the workspace role is read from the GOAL's workspace, not the caller's primary one", () => {
    // Not reachable from the pure decision — the input already names the role
    // in the objective's workspace — so it is pinned where it is decided.
    // getUserWorkspaceId picks ONE workspace per user, so an owner of a
    // different workspace must not arrive here carrying "OWNER", and a member
    // of two workspaces must not be hidden from the goals in the second.
    const source = readFileSync(
      join(__dirname, "objective-access.ts"),
      "utf8"
    );
    expect(source).toMatch(
      /userId_workspaceId:\s*\{\s*userId,\s*workspaceId:\s*objective\.workspaceId\s*\}/
    );
    // The CALL, not the name: the module's own comment explains why the
    // primary-workspace heuristic is the wrong tool here.
    expect(source).not.toMatch(/getUserWorkspaceId\s*\(/);
  });
});
