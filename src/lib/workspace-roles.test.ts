import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  pickPrimaryMembership,
  primaryWorkspacePin,
  type PickableMembership,
} from "./workspace-roles";

/**
 * WHICH WORKSPACE IS "THE USER'S"? — the pick behind every scoped read and
 * write.
 *
 * `pickPrimaryMembership` is the single copy of a rule that used to exist five
 * times (getUserWorkspaceId, getEffectiveAccess, pickPrimaryWorkspaceRole,
 * resolveCallerWorkspace, plus a family of bare `findFirst` routes). Every
 * caller in auth-guards.ts, auth-utils.ts and /api/workspace/invitations feeds
 * it the same query — `orderBy: [{ joinedAt: "asc" }, { id: "asc" }]` — and
 * then scopes the request to whatever it returns. Pick the wrong row and a
 * user LISTS from one workspace and WRITES to another; that is exactly the
 * /api/workspace/knowledge bug ("an entry you had just written could not be
 * edited").
 *
 * Two people, one firm, and the gap between them:
 *   • OWNER signed up first, so he holds a personal singleton workspace AND
 *     the firm workspace. The heuristic must land him on the firm.
 *   • MEMBER was invited, and may sit in a side workspace with two members
 *     that is NOT the firm. The heuristic lands him in the WRONG place, and
 *     only the PRIMARY_WORKSPACE_ID pin rescues it. That is the real
 *     production scenario: two of the firm's three accounts were resolving to
 *     a side workspace.
 *
 * Both functions are pure (the pin only reads process.env), so these tests
 * touch no database and open no connection — DATABASE_URL points at
 * PRODUCTION; see vitest.config.ts.
 */

const PERSONAL_WS = "ws_personal_owner";
const FIRM_WS = "ws_firm";
const SIDE_WS = "ws_side_project";
const FOREIGN_WS = "ws_not_mine";

/** The row shape every caller selects: workspaceId + members count + role. */
interface Membership extends PickableMembership {
  id: string;
  role: string;
  joinedAt: Date;
}

function membership(
  workspaceId: string,
  opts: { members?: number; role?: string; joinedAt?: string; id?: string } = {}
): Membership {
  return {
    id: opts.id ?? `wm_${workspaceId}`,
    workspaceId,
    role: opts.role ?? "MEMBER",
    joinedAt: new Date(opts.joinedAt ?? "2026-01-01T00:00:00.000Z"),
    workspace: { _count: { members: opts.members ?? 1 } },
  };
}

/**
 * Replicates the callers' `orderBy: [{ joinedAt: "asc" }, { id: "asc" }]`.
 *
 * pickPrimaryMembership deliberately does NOT sort — it trusts the query's
 * order — so tests that hand it rows in arbitrary order would be testing a
 * contract nothing upholds. Feeding fixtures through this keeps the tests
 * honest about what production actually passes in.
 */
function asPrismaOrdered(rows: Membership[]): Membership[] {
  return [...rows].sort(
    (a, b) =>
      a.joinedAt.getTime() - b.joinedAt.getTime() || a.id.localeCompare(b.id)
  );
}

/** The env pin is process-global; save and restore it around every test. */
let savedPin: string | undefined;
beforeEach(() => {
  savedPin = process.env.PRIMARY_WORKSPACE_ID;
  delete process.env.PRIMARY_WORKSPACE_ID;
});
afterEach(() => {
  if (savedPin === undefined) delete process.env.PRIMARY_WORKSPACE_ID;
  else process.env.PRIMARY_WORKSPACE_ID = savedPin;
});

describe("pickPrimaryMembership — a user with a single workspace", () => {
  it("puts a one-workspace colleague in that workspace", () => {
    const only = membership(FIRM_WS, { members: 4, role: "MEMBER" });
    expect(pickPrimaryMembership([only])).toBe(only);
  });

  it("still picks it when it is a lonely singleton (nobody else joined yet)", () => {
    // The multi-member preference must not fail closed on the very first
    // account of a brand-new firm, or the owner has no workspace at all.
    const only = membership(PERSONAL_WS, { members: 1, role: "OWNER" });
    expect(pickPrimaryMembership([only])).toBe(only);
  });

  it("returns the whole row, so the caller reads the role of THIS workspace", () => {
    // getPrimaryWorkspaceMembership and pickPrimaryWorkspaceRole both read
    // .role off the returned row. Returning a bare id (or the wrong row's
    // role) is how an OWNER gets served a MEMBER's permissions.
    const only = membership(FIRM_WS, { members: 3, role: "OWNER" });
    expect(pickPrimaryMembership([only])?.role).toBe("OWNER");
  });
});

describe("pickPrimaryMembership — the personal singleton plus the firm", () => {
  // The OWNER's real shape: signup minted him a private workspace, then he
  // created/joined the firm one where everyone actually works.
  const personal = membership(PERSONAL_WS, {
    members: 1,
    role: "OWNER",
    joinedAt: "2026-01-01T00:00:00.000Z",
  });
  const firm = membership(FIRM_WS, {
    members: 3,
    role: "OWNER",
    joinedAt: "2026-02-01T00:00:00.000Z",
  });

  it("lands the owner in the firm workspace, not his empty personal one", () => {
    expect(pickPrimaryMembership(asPrismaOrdered([personal, firm]))).toBe(firm);
  });

  it("does so even though the personal workspace is the OLDER membership", () => {
    // Oldest-wins is only the last-resort tiebreak. If it ever became the
    // primary rule, the owner would read and write his private workspace and
    // see an empty app.
    const ordered = asPrismaOrdered([personal, firm]);
    expect(ordered[0]).toBe(personal);
    expect(pickPrimaryMembership(ordered)?.workspaceId).toBe(FIRM_WS);
  });

  it("falls back to the oldest when the user has only singletons", () => {
    const second = membership(SIDE_WS, {
      members: 1,
      joinedAt: "2026-03-01T00:00:00.000Z",
    });
    expect(pickPrimaryMembership(asPrismaOrdered([personal, second]))).toBe(
      personal
    );
  });
});

describe("pickPrimaryMembership — three workspaces: where the heuristic is wrong", () => {
  /**
   * The production failure. A colleague holds:
   *   1. his personal singleton (oldest),
   *   2. a two-person side workspace (a stray invite / an old test workspace),
   *   3. the firm workspace with everybody in it (newest).
   * "First workspace with more than one member" stops at the SIDE workspace,
   * so he opens BuildSync and sees none of the firm's projects. Two of the
   * three real accounts were resolving exactly like this.
   */
  const personal = membership(PERSONAL_WS, {
    members: 1,
    role: "OWNER",
    joinedAt: "2026-01-01T00:00:00.000Z",
  });
  const side = membership(SIDE_WS, {
    members: 2,
    role: "ADMIN",
    joinedAt: "2026-02-01T00:00:00.000Z",
  });
  const firm = membership(FIRM_WS, {
    members: 5,
    role: "MEMBER",
    joinedAt: "2026-03-01T00:00:00.000Z",
  });
  const ordered = () => asPrismaOrdered([personal, side, firm]);

  it("without the pin, sends the colleague to the side workspace (the bug)", () => {
    // Pinned as documentation of the heuristic's real limit, not as an
    // endorsement: it takes the FIRST multi-member workspace, not the
    // BIGGEST. Change that and this test tells you the pin is no longer the
    // only fix.
    expect(pickPrimaryMembership(ordered())?.workspaceId).toBe(SIDE_WS);
  });

  it("with PRIMARY_WORKSPACE_ID set, he lands in the firm workspace", () => {
    process.env.PRIMARY_WORKSPACE_ID = FIRM_WS;
    expect(
      pickPrimaryMembership(ordered(), primaryWorkspacePin())?.workspaceId
    ).toBe(FIRM_WS);
  });

  it("and he is served the role he holds THERE, not in the side workspace", () => {
    // He is ADMIN of the side workspace and only MEMBER of the firm. Picking
    // the row (not just the id) is what stops the JWT carrying ADMIN into the
    // firm's routes.
    process.env.PRIMARY_WORKSPACE_ID = FIRM_WS;
    expect(pickPrimaryMembership(ordered(), primaryWorkspacePin())?.role).toBe(
      "MEMBER"
    );
  });

  it("beats the heuristic even when the pinned workspace is a singleton", () => {
    // Order matters: pin FIRST, heuristic second. A firm that says "this one"
    // must be obeyed, otherwise the pin is decorative.
    process.env.PRIMARY_WORKSPACE_ID = PERSONAL_WS;
    expect(
      pickPrimaryMembership(ordered(), primaryWorkspacePin())?.workspaceId
    ).toBe(PERSONAL_WS);
  });

  it("keeps the same answer no matter which of his rows arrives first", () => {
    process.env.PRIMARY_WORKSPACE_ID = FIRM_WS;
    const pin = primaryWorkspacePin();
    for (const arrival of [
      [personal, side, firm],
      [firm, side, personal],
      [side, firm, personal],
    ]) {
      expect(pickPrimaryMembership(arrival, pin)?.workspaceId).toBe(FIRM_WS);
    }
  });
});

describe("pickPrimaryMembership — a pin the user does not belong to", () => {
  /**
   * PRIMARY_WORKSPACE_ID is firm-wide config, but not every account is in the
   * pinned workspace — a brand-new hire mid-onboarding, or a stale id left
   * over from a renamed workspace. The pin must never conjure a membership:
   * returning a workspaceId the user has no row for would scope his reads and
   * writes into a workspace he was never granted.
   */
  const personal = membership(PERSONAL_WS, {
    members: 1,
    joinedAt: "2026-01-01T00:00:00.000Z",
  });
  const side = membership(SIDE_WS, {
    members: 2,
    joinedAt: "2026-02-01T00:00:00.000Z",
  });

  it("never grants a workspace the user has no membership row for", () => {
    process.env.PRIMARY_WORKSPACE_ID = FOREIGN_WS;
    const picked = pickPrimaryMembership(
      asPrismaOrdered([personal, side]),
      primaryWorkspacePin()
    );
    expect(picked?.workspaceId).not.toBe(FOREIGN_WS);
  });

  it("falls back to the ordinary heuristic instead of failing the request", () => {
    process.env.PRIMARY_WORKSPACE_ID = FOREIGN_WS;
    expect(
      pickPrimaryMembership(
        asPrismaOrdered([personal, side]),
        primaryWorkspacePin()
      )?.workspaceId
    ).toBe(SIDE_WS);
  });

  it("returns a row the user actually holds, whatever the pin says", () => {
    process.env.PRIMARY_WORKSPACE_ID = FOREIGN_WS;
    const rows = asPrismaOrdered([personal, side]);
    expect(rows).toContain(
      pickPrimaryMembership(rows, primaryWorkspacePin())
    );
  });

  it("does not match a workspace id by prefix or by case", () => {
    // A near-miss id is a typo in Vercel's env, not an instruction to guess.
    for (const wrong of [FIRM_WS.toUpperCase(), `${FIRM_WS}x`, "ws_"]) {
      process.env.PRIMARY_WORKSPACE_ID = wrong;
      const firm = membership(FIRM_WS, {
        members: 5,
        joinedAt: "2026-03-01T00:00:00.000Z",
      });
      expect(
        pickPrimaryMembership(
          asPrismaOrdered([personal, side, firm]),
          primaryWorkspacePin()
        )?.workspaceId
      ).toBe(SIDE_WS);
    }
  });
});

describe("pickPrimaryMembership — a user with no memberships", () => {
  it("says 'no workspace' rather than inventing one", () => {
    // getUserWorkspaceId turns this null into an AuthorizationError and
    // getPrimaryWorkspaceMembership returns null; both depend on it never
    // reaching for memberships[0] of an empty array.
    expect(pickPrimaryMembership([])).toBeNull();
  });

  it("still says 'no workspace' when a pin is configured", () => {
    process.env.PRIMARY_WORKSPACE_ID = FIRM_WS;
    expect(pickPrimaryMembership([], primaryWorkspacePin())).toBeNull();
  });

  it.each([null, undefined])(
    "treats an absent pin (%s) as no pin at all",
    (pin) => {
      expect(pickPrimaryMembership([], pin)).toBeNull();
    }
  );
});

describe("pickPrimaryMembership — the joinedAt + id tiebreak is deterministic", () => {
  /**
   * Two memberships written in the same transaction share a joinedAt to the
   * millisecond. Without the `id: "asc"` half of the orderBy the database
   * returns them in whatever order it likes, so the pick flaps between
   * requests: read resolves to one workspace, the write that follows resolves
   * to the other.
   */
  const stamp = "2026-04-01T12:00:00.000Z";
  const alpha = membership("ws_alpha", { id: "wm_aaa", joinedAt: stamp });
  const beta = membership("ws_beta", { id: "wm_bbb", joinedAt: stamp });

  it("picks the same workspace on every request when timestamps are equal", () => {
    const first = pickPrimaryMembership(asPrismaOrdered([alpha, beta]));
    const second = pickPrimaryMembership(asPrismaOrdered([beta, alpha]));
    expect(first?.workspaceId).toBe("ws_alpha");
    expect(second?.workspaceId).toBe("ws_alpha");
  });

  it("breaks an equal-timestamp tie by id, not by insertion order", () => {
    const ordered = asPrismaOrdered([beta, alpha]);
    expect(ordered.map((m) => m.id)).toEqual(["wm_aaa", "wm_bbb"]);
    expect(pickPrimaryMembership(ordered)).toBe(alpha);
  });

  it("prefers the older membership when timestamps differ", () => {
    const older = membership("ws_older", {
      id: "wm_zzz",
      joinedAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = membership("ws_newer", {
      id: "wm_aaa",
      joinedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(pickPrimaryMembership(asPrismaOrdered([newer, older]))).toBe(older);
  });

  it("keeps the multi-member preference ahead of the tiebreak", () => {
    // Same joinedAt, and the singleton sorts first by id — the multi-member
    // workspace must still win, or the tiebreak quietly becomes the rule.
    const singleton = membership("ws_alone", {
      id: "wm_aaa",
      members: 1,
      joinedAt: stamp,
    });
    const shared = membership(FIRM_WS, {
      id: "wm_bbb",
      members: 4,
      joinedAt: stamp,
    });
    expect(pickPrimaryMembership(asPrismaOrdered([shared, singleton]))).toBe(
      shared
    );
  });
});

describe("primaryWorkspacePin — reading the firm's configured workspace", () => {
  it("is unset when the env var is absent, so the heuristic runs", () => {
    expect(primaryWorkspacePin()).toBeNull();
  });

  it.each(["", " ", "   ", "\t", "\n"])(
    "treats a blank value (%o) as unset instead of pinning to nothing",
    (raw) => {
      // An empty Vercel env var is the common shape of "someone added the key
      // but not the value". Returning "" would make the pin falsy anyway, but
      // returning it as a *string* would make a caller's `if (pin)` guard
      // read as configured. Null is the honest answer.
      process.env.PRIMARY_WORKSPACE_ID = raw;
      expect(primaryWorkspacePin()).toBeNull();
    }
  );

  it("returns the configured id", () => {
    process.env.PRIMARY_WORKSPACE_ID = FIRM_WS;
    expect(primaryWorkspacePin()).toBe(FIRM_WS);
  });

  it("trims whitespace pasted in with the id", () => {
    // Copying an id out of the Prisma studio or a dashboard drags spaces and
    // newlines along; an untrimmed value matches no workspaceId and silently
    // disables the pin.
    process.env.PRIMARY_WORKSPACE_ID = `  ${FIRM_WS}\n`;
    expect(primaryWorkspacePin()).toBe(FIRM_WS);
  });

  it("a pasted-with-whitespace id still resolves the right workspace", () => {
    // End to end: the two functions are only ever used together.
    process.env.PRIMARY_WORKSPACE_ID = ` ${FIRM_WS} `;
    const rows = asPrismaOrdered([
      membership(PERSONAL_WS, { members: 1, joinedAt: "2026-01-01T00:00:00.000Z" }),
      membership(SIDE_WS, { members: 2, joinedAt: "2026-02-01T00:00:00.000Z" }),
      membership(FIRM_WS, { members: 5, joinedAt: "2026-03-01T00:00:00.000Z" }),
    ]);
    expect(pickPrimaryMembership(rows, primaryWorkspacePin())?.workspaceId).toBe(
      FIRM_WS
    );
  });
});
