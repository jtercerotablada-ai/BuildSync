import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  contributorSeatSatisfied,
  decidePositionChange,
  positionSensitiveWorkspaceIds,
  decideTaskAccess,
  getErrorStatus,
  AuthorizationError,
  NotFoundError,
  type TaskAccessDecisionInput,
} from "./auth-guards";
import { resolveProjectAccess } from "./project-access";
import { NON_CONTRIBUTOR_ROLES } from "@/lib/workspace-roles";

/**
 * resolveProjectAccess looks up the caller's seat in the project's workspace
 * on every call. DATABASE_URL is blanked for tests (it points at PRODUCTION),
 * so the Prisma client is replaced by this in-memory seat table.
 */
const db = vi.hoisted(() => ({
  seats: new Map<string, { role: string; position: string | null }>(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    workspaceMember: {
      findUnique: async ({
        where,
      }: {
        where: { userId_workspaceId: { userId: string; workspaceId: string } };
      }) => {
        const { userId, workspaceId } = where.userId_workspaceId;
        const seat = db.seats.get(`${userId}@${workspaceId}`);
        return seat
          ? { role: seat.role, user: { position: seat.position } }
          : null;
      },
    },
    project: { findUnique: async () => null },
    teamMember: { findFirst: async () => null },
  },
}));

/**
 * WHO MAY TOUCH A TASK — the /api/tasks/[taskId]/* chokepoint.
 *
 * `verifyTaskAccess` itself loads the task, so it cannot be called here:
 * DATABASE_URL points at PRODUCTION and vitest.config.ts blanks it precisely
 * so a test that reaches for the database fails loudly. What it *decides*,
 * once the rows are in hand, is `decideTaskAccess` — a pure lift of the
 * function's own if-chain — plus `resolveProjectAccess`, which does no I/O at
 * all for a caller who owns the project or holds a ProjectMember row.
 *
 * These tests are written around two people, because that is the question the
 * firm actually has:
 *
 *   OWNER  — owns the workspace, is NOT a member of every project in it.
 *   MEMBER — a colleague carrying a per-project role (VIEWER … ADMIN).
 *
 * Every bug fixed this session lived in the gap between them, so each test is
 * named after what the person can or cannot DO, not after the function.
 */

const OWNER = "user_owner";
const MEMBER = "user_member";
/** The staff member who created the project. */
const CREATOR = "user_creator";
const WS = "ws_firm";

function seat(userId: string, role: string, position: string | null = null) {
  db.seats.set(`${userId}@${WS}`, { role, position });
}

beforeEach(() => {
  db.seats.clear();
});

type Role = "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";

/** A project created by a colleague, where MEMBER holds `role`. */
function projectWithMember(role: Role, visibility = "PRIVATE") {
  return {
    id: "proj_1",
    ownerId: CREATOR,
    workspaceId: WS,
    visibility,
    teamId: null,
    members: [{ userId: MEMBER, role }],
  };
}

/**
 * The caller has no tie to the task and no capability on its project: the
 * baseline every test below deviates from by exactly one field.
 */
function stranger(
  overrides: Partial<TaskAccessDecisionInput> = {}
): TaskAccessDecisionInput {
  return {
    hasProject: true,
    isPrivate: false,
    isOwnTask: false,
    isCollaborator: false,
    requireWrite: false,
    requireComment: false,
    projectCanRead: false,
    projectCanWrite: false,
    projectCanComment: false,
    projectIsWorkspaceManager: false,
    // A colleague who still works here — the offboarding tests flip it.
    projectHasContributorSeat: true,
    ...overrides,
  };
}

/** Shorthand: was the verb allowed? */
function allowed(input: TaskAccessDecisionInput): boolean {
  return decideTaskAccess(input).denial === null;
}

// ───────────────────────────────────────────────────────────────────────────
// What a per-project role buys you
// ───────────────────────────────────────────────────────────────────────────

describe("a colleague's project role decides what they can do", () => {
  it("a VIEWER can open the project but cannot edit, archive or attach", async () => {
    const access = await resolveProjectAccess(
      projectWithMember("VIEWER"),
      MEMBER
    );
    expect(access.ok).toBe(true); // the project page opens
    expect(access.canWrite).toBe(false); // no archive, no attachment, no delete
    expect(access.canComment).toBe(false);
    expect(access.canManage).toBe(false);
    expect(access.memberRole).toBe("VIEWER");
  });

  it("a COMMENTER can post but still cannot edit project content", async () => {
    const access = await resolveProjectAccess(
      projectWithMember("COMMENTER"),
      MEMBER
    );
    expect(access.ok).toBe(true);
    expect(access.canComment).toBe(true);
    expect(access.canWrite).toBe(false);
    expect(access.canManage).toBe(false);
  });

  it("an EDITOR can edit content but cannot add or remove people", async () => {
    const access = await resolveProjectAccess(
      projectWithMember("EDITOR"),
      MEMBER
    );
    expect(access.canWrite).toBe(true);
    expect(access.canComment).toBe(true);
    expect(access.canManage).toBe(false);
  });

  it("a project ADMIN can manage members and settings", async () => {
    const access = await resolveProjectAccess(
      projectWithMember("ADMIN"),
      MEMBER
    );
    expect(access.canWrite).toBe(true);
    expect(access.canComment).toBe(true);
    expect(access.canManage).toBe(true);
  });

  it("the project's owner can do everything without a member row", async () => {
    const access = await resolveProjectAccess(projectWithMember("VIEWER"), CREATOR);
    expect(access.isOwner).toBe(true);
    expect(access.isMember).toBe(false);
    expect(access.canWrite).toBe(true);
    expect(access.canComment).toBe(true);
    expect(access.canManage).toBe(true);
  });

  it("commenting is a superset of writing for every role", async () => {
    // canComment must never be narrower than canWrite, or an EDITOR would be
    // able to edit a task and then be refused when explaining the edit.
    for (const role of ["ADMIN", "EDITOR", "COMMENTER", "VIEWER"] as Role[]) {
      const access = await resolveProjectAccess(projectWithMember(role), MEMBER);
      expect(access.canWrite && !access.canComment).toBe(false);
    }
  });

  it.each(["WORKSPACE", "PUBLIC"])(
    "an explicit VIEWER row is not upgraded by %s visibility",
    async (visibility) => {
      // The implicit firm-wide Editor grant is for people with NO row; a
      // colleague deliberately restricted to VIEWER stays restricted.
      seat(MEMBER, "MEMBER");
      const access = await resolveProjectAccess(
        projectWithMember("VIEWER", visibility),
        MEMBER
      );
      expect(access.ok).toBe(true);
      expect(access.canWrite).toBe(false);
      expect(access.canComment).toBe(false);
      expect(access.isWorkspaceShared).toBe(false);
    }
  );
});

// ───────────────────────────────────────────────────────────────────────────
// Visibility: what the firm gets without being invited
// ───────────────────────────────────────────────────────────────────────────

describe("a colleague with no member row", () => {
  const COLLEAGUE = "user_colleague";
  const noRow = (visibility: string) => ({
    ...projectWithMember("EDITOR", visibility),
    members: [],
  });

  it.each(["WORKSPACE", "PUBLIC"])(
    "can open, edit and comment on a %s project, but not manage it",
    async (visibility) => {
      seat(COLLEAGUE, "MEMBER");
      const access = await resolveProjectAccess(noRow(visibility), COLLEAGUE);
      expect(access.ok).toBe(true);
      expect(access.canWrite).toBe(true);
      expect(access.canComment).toBe(true);
      expect(access.canManage).toBe(false);
      expect(access.isWorkspaceShared).toBe(true);
    }
  );

  it("gets a 404 on a PRIVATE project", async () => {
    seat(COLLEAGUE, "WORKER");
    const access = await resolveProjectAccess(noRow("PRIVATE"), COLLEAGUE);
    expect(access.ok).toBe(false);
    expect(access.status).toBe(404);
    expect(access.canWrite).toBe(false);
  });

  it.each([...NON_CONTRIBUTOR_ROLES])(
    "gets nothing implicit as a %s",
    async (role) => {
      seat(COLLEAGUE, role);
      const access = await resolveProjectAccess(noRow("WORKSPACE"), COLLEAGUE);
      expect(access.ok).toBe(false);
      expect(access.canWrite).toBe(false);
    }
  );

  it("gets nothing once removed from the workspace (no seat)", async () => {
    const access = await resolveProjectAccess(noRow("WORKSPACE"), COLLEAGUE);
    expect(access.ok).toBe(false);
    expect(access.hasContributorSeat).toBe(false);
  });

  it("with a level 4+ Position reads a PRIVATE project but cannot edit it", async () => {
    seat(COLLEAGUE, "MEMBER", "PROJECT_MANAGER");
    const access = await resolveProjectAccess(noRow("PRIVATE"), COLLEAGUE);
    expect(access.ok).toBe(true);
    expect(access.hasSeniorRead).toBe(true);
    expect(access.isWorkspaceManager).toBe(false);
    expect(access.canWrite).toBe(false);
    expect(access.canManage).toBe(false);
  });
});

describe("the workspace OWNER/ADMIN runs every project in the workspace", () => {
  it.each(["OWNER", "ADMIN"])(
    "a workspace %s can edit and manage a PRIVATE project he never joined",
    async (role) => {
      seat(OWNER, role);
      const access = await resolveProjectAccess(
        { ...projectWithMember("EDITOR"), members: [] },
        OWNER
      );
      expect(access.ok).toBe(true);
      expect(access.isWorkspaceManager).toBe(true);
      expect(access.canWrite).toBe(true);
      expect(access.canComment).toBe(true);
      expect(access.canManage).toBe(true);
    }
  );

  it("keeps his powers when he is also added as a VIEWER", async () => {
    // Adding the owner to a project to get notifications must not strip his
    // leadership there.
    seat(MEMBER, "OWNER");
    const access = await resolveProjectAccess(projectWithMember("VIEWER"), MEMBER);
    expect(access.isWorkspaceManager).toBe(true);
    expect(access.canWrite).toBe(true);
    expect(access.canManage).toBe(true);
  });

  it("gets no manager standing from a role in a DIFFERENT workspace", async () => {
    db.seats.set(`${OWNER}@ws_other`, { role: "OWNER", position: null });
    const access = await resolveProjectAccess(
      { ...projectWithMember("EDITOR"), members: [] },
      OWNER
    );
    expect(access.ok).toBe(false);
    expect(access.isWorkspaceManager).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Tasks inside a project
// ───────────────────────────────────────────────────────────────────────────

describe("on a task in a project, a VIEWER may look and nothing more", () => {
  const viewer = stranger({ projectCanRead: true });

  it("can open the task", () => {
    expect(allowed(viewer)).toBe(true);
  });

  it("cannot archive, rename or delete it", () => {
    const { denial } = decideTaskAccess({ ...viewer, requireWrite: true });
    expect(denial).toEqual({
      kind: "forbidden",
      message: "You don't have permission to modify this task",
    });
  });

  it("cannot attach a file or delete one (same write gate)", () => {
    expect(allowed({ ...viewer, requireWrite: true })).toBe(false);
  });

  it("cannot post a comment", () => {
    const { denial } = decideTaskAccess({ ...viewer, requireComment: true });
    expect(denial).toEqual({
      kind: "forbidden",
      message: "You don't have permission to comment on this task",
    });
  });
});

describe("on a task in a project, a COMMENTER may reply but not edit", () => {
  const commenter = stranger({ projectCanRead: true, projectCanComment: true });

  it("can post a comment", () => {
    expect(allowed({ ...commenter, requireComment: true })).toBe(true);
  });

  it("still cannot edit or delete the task", () => {
    expect(allowed({ ...commenter, requireWrite: true })).toBe(false);
  });

});

describe("on a task in a project, an EDITOR may edit", () => {
  it("can modify the task", () => {
    expect(
      allowed(
        stranger({
          projectCanRead: true,
          projectCanWrite: true,
          projectCanComment: true,
          requireWrite: true,
        })
      )
    ).toBe(true);
  });
});

/**
 * THE OWNER'S OWN DAILY CASE. The firm's workspace OWNER is not a
 * ProjectMember of most projects; resolveProjectAccess gives him read, write,
 * comment and manage there anyway, and the task gate must honour it.
 */
describe("the workspace OWNER can work in a project he never joined", () => {
  const wsOwner = stranger({
    projectCanRead: true,
    projectCanWrite: true,
    projectCanComment: true,
    projectIsWorkspaceManager: true,
  });

  it("can open the task", () => {
    expect(allowed(wsOwner)).toBe(true);
  });

  it("can comment on it without being a project member", () => {
    expect(allowed({ ...wsOwner, requireComment: true })).toBe(true);
  });

  it("can edit, complete and reassign it", () => {
    expect(allowed({ ...wsOwner, requireWrite: true })).toBe(true);
  });
});

describe("a follower of a task can read and reply, but not edit", () => {
  // A TaskCollaborator is added workspace-wide and may hold no project role
  // at all — the project is invisible to them, the task is not.
  const follower = stranger({ isCollaborator: true, projectCanRead: false });

  it("can open a task in a project they cannot otherwise see", () => {
    expect(allowed(follower)).toBe(true);
  });

  it("can reply to the thread they are being notified about", () => {
    expect(allowed({ ...follower, requireComment: true })).toBe(true);
  });

  it("cannot edit or delete the task they merely follow", () => {
    expect(allowed({ ...follower, requireWrite: true })).toBe(false);
  });
});

describe("a task's assignee keeps their hands on it", () => {
  it("can edit a task assigned to them in a project they are not a member of", () => {
    expect(
      allowed(stranger({ isOwnTask: true, requireWrite: true }))
    ).toBe(true);
  });

  it("can comment on it", () => {
    expect(
      allowed(stranger({ isOwnTask: true, requireComment: true }))
    ).toBe(true);
  });
});

describe("a stranger is not even told the task exists", () => {
  it("gets 'not found', not 'forbidden', when the project is closed to them", () => {
    // 403 would confirm the id is real. The project page hides existence and
    // the task endpoints must agree with it.
    const { denial } = decideTaskAccess(stranger());
    expect(denial).toEqual({ kind: "notFound", message: "Task not found" });
    expect(getErrorStatus(new NotFoundError(denial!.message)).status).toBe(404);
  });

  it("is refused a write for the same reason, with the same 404", () => {
    expect(decideTaskAccess(stranger({ requireWrite: true })).denial).toEqual({
      kind: "notFound",
      message: "Task not found",
    });
  });

  it("is told 'forbidden' only once they can already see the task", () => {
    const { denial } = decideTaskAccess(
      stranger({ projectCanRead: true, requireWrite: true })
    );
    expect(denial!.kind).toBe("forbidden");
    expect(
      getErrorStatus(new AuthorizationError(denial!.message)).status
    ).toBe(403);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Tasks with NO project (My Tasks / personal)
// ───────────────────────────────────────────────────────────────────────────

/**
 * A personal task has no project, so there is no role to consult. The rule
 * is: the creator or assignee may write; a follower may only comment.
 *
 * This branch used to `return` the moment any personal tie existed, so a
 * follower could archive the task, delete its attachments, or delete the task
 * outright — while /api/tasks/bulk, which had the rule right, refused the
 * same act. The two endpoints disagreed about the same click.
 */
describe("on a personal task with no project", () => {
  const personal = (overrides: Partial<TaskAccessDecisionInput> = {}) =>
    stranger({ hasProject: false, ...overrides });

  it("the creator can edit and delete it", () => {
    expect(allowed(personal({ isOwnTask: true, requireWrite: true }))).toBe(true);
  });

  it("the creator can comment on it", () => {
    expect(allowed(personal({ isOwnTask: true, requireComment: true }))).toBe(
      true
    );
  });

  it("a follower can read it", () => {
    expect(allowed(personal({ isCollaborator: true }))).toBe(true);
  });

  it("a follower can reply — they are the intended audience", () => {
    expect(
      allowed(personal({ isCollaborator: true, requireComment: true }))
    ).toBe(true);
  });

  it("a follower can NOT archive it, delete it, or touch its attachments", () => {
    const { denial } = decideTaskAccess(
      personal({ isCollaborator: true, requireWrite: true })
    );
    expect(denial).toEqual({
      kind: "forbidden",
      message: "You don't have permission to modify this task",
    });
  });

  it("someone with no tie at all cannot even open it", () => {
    const { denial } = decideTaskAccess(personal());
    expect(denial).toEqual({
      kind: "forbidden",
      message: "You don't have access to this task",
    });
  });

  it("does not depend on a workspace seat — there is no workspace to ask about", () => {
    for (const input of [
      personal({ isOwnTask: true, requireWrite: true }),
      personal({ isCollaborator: true, requireComment: true }),
    ]) {
      expect(allowed({ ...input, projectHasContributorSeat: false })).toBe(true);
    }
  });

  it("agrees with /api/tasks/bulk: only creator or assignee may modify", () => {
    // verifyBulkTaskAccess allows a projectless task only on isOwnTask. Any
    // input where this branch permits a write but bulk would not is the exact
    // disagreement that shipped.
    for (const input of [
      personal({ isOwnTask: true, requireWrite: true }),
      personal({ isCollaborator: true, requireWrite: true }),
      personal({ requireWrite: true }),
    ]) {
      expect(allowed(input)).toBe(input.isOwnTask);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Offboarding: personal ties outlive the person's seat
// ───────────────────────────────────────────────────────────────────────────

/**
 * Removing someone from the workspace deletes their WorkspaceMember row and
 * NOTHING else. Their TaskCollaborator rows, the tasks they created and the
 * ones assigned to them all survive — so every escape that runs on a personal
 * tie must be re-checked against a live contributor seat before it is honoured.
 */
describe("a personal tie stops counting once the person leaves the firm", () => {
  const offboarded = (overrides: Partial<TaskAccessDecisionInput> = {}) =>
    stranger({ projectHasContributorSeat: false, ...overrides });

  it("a removed creator/assignee can no longer open the task", () => {
    expect(decideTaskAccess(offboarded({ isOwnTask: true })).denial).toEqual({
      kind: "notFound",
      message: "Task not found",
    });
  });

  it("nor edit or delete it", () => {
    expect(
      decideTaskAccess(offboarded({ isOwnTask: true, requireWrite: true }))
        .denial!.kind
    ).toBe("notFound");
  });

  it("a removed follower can neither read nor reply", () => {
    expect(allowed(offboarded({ isCollaborator: true }))).toBe(false);
    expect(
      allowed(offboarded({ isCollaborator: true, requireComment: true }))
    ).toBe(false);
  });

  it("a removed assignee loses a private task too", () => {
    expect(allowed(offboarded({ isOwnTask: true, isPrivate: true }))).toBe(
      false
    );
  });

  it("a colleague who still holds a seat keeps every tie", () => {
    expect(allowed(stranger({ isOwnTask: true, requireWrite: true }))).toBe(true);
    expect(
      allowed(stranger({ isCollaborator: true, requireComment: true }))
    ).toBe(true);
  });

  it("an offboarded collaborator is refused: no membership row, no seat", () => {
    // What resolveProjectAccess looks up is a WorkspaceMember row; the removed
    // user has none, so `undefined` arrives here and must NOT read as "fine".
    expect(contributorSeatSatisfied(undefined)).toBe(false);
    expect(contributorSeatSatisfied(null)).toBe(false);
    expect(contributorSeatSatisfied("")).toBe(false);
  });

  it("a read-only role is refused too, by the shared non-contributor list", () => {
    expect(NON_CONTRIBUTOR_ROLES.size).toBeGreaterThan(0);
    for (const role of NON_CONTRIBUTOR_ROLES) {
      expect(contributorSeatSatisfied(role)).toBe(false);
    }
  });

  it("a colleague who still holds a staff seat is allowed through", () => {
    for (const role of ["OWNER", "ADMIN", "MEMBER", "WORKER"]) {
      expect(contributorSeatSatisfied(role)).toBe(
        !NON_CONTRIBUTOR_ROLES.has(role)
      );
    }
  });

  it("resolveProjectAccess reports the missing seat the task gate reads", async () => {
    const access = await resolveProjectAccess(
      { ...projectWithMember("EDITOR"), members: [] },
      "user_gone"
    );
    expect(access.hasContributorSeat).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The private-task toggle
// ───────────────────────────────────────────────────────────────────────────

/**
 * "This task is private — only its collaborators can see it" is what the
 * detail panel says, and PATCH has always stored the flag. Nothing read it:
 * the task still opened by URL for anyone who could read its project, and
 * still rendered in every list and board. These tests pin the audience the
 * copy promises — assignee, creator, follower — plus the one escape that keeps
 * the flag recoverable (workspace OWNER/ADMIN), and, just as importantly, that
 * nobody else is quietly added to it.
 */
describe("a private task is visible only to the people its toggle names", () => {
  const secret = (overrides: Partial<TaskAccessDecisionInput> = {}) =>
    stranger({ isPrivate: true, ...overrides });

  it("its assignee or creator can still open it", () => {
    expect(allowed(secret({ isOwnTask: true }))).toBe(true);
  });

  it("a follower can open it — the toggle names them explicitly", () => {
    // And they get here with projectCanRead false: a follower is added
    // workspace-wide and may hold no role on the project at all.
    expect(allowed(secret({ isCollaborator: true }))).toBe(true);
  });

  it("a colleague who can read the whole project is told it does not exist", () => {
    const { denial } = decideTaskAccess(secret({ projectCanRead: true }));
    expect(denial).toEqual({ kind: "notFound", message: "Task not found" });
    expect(getErrorStatus(new NotFoundError(denial!.message)).status).toBe(404);
  });

  it("404, not 403 — a private task must not be probeable into existence", () => {
    // The one fact privacy exists to withhold is that the id is real. An
    // EDITOR who could open every other task in the project gets the same
    // answer as a stranger.
    for (const input of [
      secret({ projectCanRead: true, projectCanWrite: true }),
      secret({ projectCanRead: true, projectCanComment: true }),
      secret(),
    ]) {
      expect(decideTaskAccess(input).denial!.kind).toBe("notFound");
    }
  });

  it("a project ADMIN/EDITOR gets no override, however wide their role", () => {
    const editor = secret({ projectCanRead: true, projectCanWrite: true });
    expect(allowed(editor)).toBe(false);
    expect(allowed({ ...editor, requireWrite: true })).toBe(false);
  });

  it("a level 4+ Position does NOT open a private task", () => {
    // hasSeniorRead reads the project; it is not projectIsWorkspaceManager.
    expect(allowed(secret({ projectCanRead: true }))).toBe(false);
  });

  it("the workspace OWNER keeps the key — nothing else can un-flag the task", () => {
    // The flag is only clearable from INSIDE the task's own panel. Without
    // this leg, a task privatised by someone who then leaves — no assignee, no
    // follower — is unreachable by anyone, permanently. Private goals grant
    // leadership the same escape (decideObjectiveAccess).
    const wsOwner = secret({
      projectCanRead: true,
      projectCanWrite: true,
      projectCanComment: true,
      projectIsWorkspaceManager: true,
    });
    expect(allowed(wsOwner)).toBe(true);
    expect(allowed({ ...wsOwner, requireComment: true })).toBe(true);
    expect(allowed({ ...wsOwner, requireWrite: true })).toBe(true);
  });

  it("gives a projectless private task no leadership escape — it has no project to lead", () => {
    // `projectIsWorkspaceManager` is resolveProjectAccess output and means
    // nothing when there is no project. A My Tasks task is personal, full stop.
    const { denial } = decideTaskAccess(
      secret({ hasProject: false, projectIsWorkspaceManager: true })
    );
    expect(denial).toEqual({ kind: "notFound", message: "Task not found" });
  });

  it("hides a private personal task the same way, with 404 rather than 403", () => {
    // A projectless task normally answers "forbidden" to a stranger. Once it
    // is private it must answer like every other private task, or the two
    // messages together tell the caller which kind of row they just probed.
    const { denial } = decideTaskAccess(secret({ hasProject: false }));
    expect(denial).toEqual({ kind: "notFound", message: "Task not found" });
  });

  it("still applies the ordinary write and comment gates to the people it admits", () => {
    // Privacy narrows WHO, never widens WHAT. A follower who can now read a
    // private task must not gain an editor's hands with it.
    expect(allowed(secret({ isCollaborator: true, requireWrite: true }))).toBe(
      false
    );
    expect(
      allowed(secret({ isOwnTask: true, requireWrite: true }))
    ).toBe(true);
  });

  it("still charges a follower's access to a live workspace seat", () => {
    // A private task is exactly where a stale TaskCollaborator row is most
    // valuable.
    expect(
      allowed(secret({ isCollaborator: true, requireComment: true }))
    ).toBe(true);
    expect(
      allowed(
        secret({
          isCollaborator: true,
          requireComment: true,
          projectHasContributorSeat: false,
        })
      )
    ).toBe(false);
  });

  it("changes nothing for a task that is not private", () => {
    // The flag defaults to false on every existing row in the firm's database,
    // so this branch must be inert for all 267 of them.
    for (const opts of [
      { projectCanRead: true },
      { projectCanRead: true, projectCanWrite: true, requireWrite: true },
      { isCollaborator: true },
      { hasProject: false, isOwnTask: true, requireWrite: true },
    ]) {
      expect(allowed(stranger(opts))).toBe(
        allowed(stranger({ ...opts, isPrivate: false }))
      );
      expect(allowed(stranger(opts))).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Shape invariants
// ───────────────────────────────────────────────────────────────────────────

describe("the decision fails closed", () => {
  it("grants nothing to a caller with no tie, no role and no read", () => {
    for (const opts of [
      {},
      { requireWrite: true },
      { requireComment: true },
      { requireWrite: true, requireComment: true },
    ]) {
      expect(allowed(stranger(opts))).toBe(false);
      expect(allowed(stranger({ hasProject: false, ...opts }))).toBe(false);
    }
  });

  it("a denial always carries a message the API can return", () => {
    const { denial } = decideTaskAccess(stranger({ requireWrite: true }));
    expect(denial!.message.length).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Who may change a Position (it feeds access)
// ───────────────────────────────────────────────────────────────────────────

describe("only a workspace OWNER/ADMIN may change a Position", () => {
  it("an OWNER/ADMIN of every shared workspace may", () => {
    expect(
      decidePositionChange([WS], [{ workspaceId: WS, role: "OWNER" }])
    ).toBe(true);
    expect(
      decidePositionChange([WS], [{ workspaceId: WS, role: "ADMIN" }])
    ).toBe(true);
  });

  it.each(["MEMBER", "WORKER", "GUEST", "CLIENT"])(
    "a %s may not — not even their own",
    (role) => {
      expect(decidePositionChange([WS], [{ workspaceId: WS, role }])).toBe(
        false
      );
    }
  );

  it("owning a side workspace does not buy a Position in the firm", () => {
    // The target is in the firm AND in a side workspace the caller owns: the
    // Position would carry into the firm, so the side workspace is not enough.
    expect(
      decidePositionChange(
        [WS, "ws_side"],
        [
          { workspaceId: "ws_side", role: "OWNER" },
          { workspaceId: WS, role: "MEMBER" },
        ]
      )
    ).toBe(false);
  });

  it("refuses when there is no shared workspace at all", () => {
    expect(decidePositionChange([], [])).toBe(false);
  });

  it("ignores singleton workspaces and seats where the target is read-only", () => {
    // A GUEST/CLIENT seat gets nothing from a Position, so it must not veto
    // the firm owner's change; a contributor seat in a side workspace still does.
    expect(
      positionSensitiveWorkspaceIds([
        { workspaceId: WS, role: "MEMBER", memberCount: 3 },
        { workspaceId: "ws_solo", role: "OWNER", memberCount: 1 },
        { workspaceId: "ws_guest", role: "GUEST", memberCount: 2 },
        { workspaceId: "ws_client", role: "CLIENT", memberCount: 5 },
        { workspaceId: "ws_side", role: "WORKER", memberCount: 2 },
      ])
    ).toEqual([WS, "ws_side"]);
  });

  it("a target with no contributor seat is approved by their shared workspaces", () => {
    // A firm GUEST whose only seat is read-only: the firm owner must still be
    // able to set the Position (for example before promoting them).
    const shared = positionSensitiveWorkspaceIds([
      { workspaceId: WS, role: "GUEST", memberCount: 3 },
      { workspaceId: "ws_solo", role: "OWNER", memberCount: 1 },
    ]);
    expect(shared).toEqual([WS]);
    expect(
      decidePositionChange(shared, [{ workspaceId: WS, role: "OWNER" }])
    ).toBe(true);
    expect(
      decidePositionChange(shared, [{ workspaceId: WS, role: "MEMBER" }])
    ).toBe(false);
  });
});
