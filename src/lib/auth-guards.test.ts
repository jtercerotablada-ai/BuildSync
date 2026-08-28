import { describe, expect, it } from "vitest";
import {
  contributorSeatSatisfied,
  decideTaskAccess,
  getErrorStatus,
  AuthorizationError,
  NotFoundError,
  type TaskAccessDecisionInput,
} from "./auth-guards";
import { resolveProjectAccess } from "./project-access";
import { NON_CONTRIBUTOR_ROLES } from "@/lib/workspace-roles";

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
const WS = "ws_firm";

type Role = "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";

/** A project whose owner is OWNER and where MEMBER holds `role`. */
function projectWithMember(role: Role, visibility = "PRIVATE") {
  return {
    id: "proj_1",
    ownerId: OWNER,
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

/**
 * resolveProjectAccess makes NO database call when the caller owns the
 * project or appears in `members` — both short-circuit before the
 * workspaceMember lookup. Every fixture below is therefore an owner or a
 * member on purpose; adding a non-member case here would reach for the
 * production database.
 */
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
    const access = await resolveProjectAccess(projectWithMember("VIEWER"), OWNER);
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

  it("marking the project PUBLIC does not promote a VIEWER to a writer", async () => {
    // Visibility answers "who may look", never "who may type".
    const access = await resolveProjectAccess(
      projectWithMember("VIEWER", "PUBLIC"),
      MEMBER
    );
    expect(access.ok).toBe(true);
    expect(access.canWrite).toBe(false);
    expect(access.canComment).toBe(false);
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

  it("needs no extra membership check — the project role already proves it", () => {
    // canComment came from a real ProjectMember row, which cannot exist
    // without a workspace seat. No second query, and nothing to fail later.
    expect(
      decideTaskAccess({ ...commenter, requireComment: true })
        .requiresContributorSeat
    ).toBe(false);
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
 * THE OWNER'S OWN DAILY CASE, and it was broken.
 *
 * The firm's workspace OWNER is not a ProjectMember of most projects — so
 * canWrite and canComment are both false for him. He could post in a
 * project's message channel (that route admits "workspace leadership"
 * explicitly) and be refused on a task inside the same project, in the same
 * minute. `projectIsWorkspaceManager` is the escape that fixes it.
 */
describe("the workspace OWNER can work in a project he never joined", () => {
  const wsOwner = stranger({
    projectCanRead: true,
    projectIsWorkspaceManager: true,
  });

  it("can open the task", () => {
    expect(allowed(wsOwner)).toBe(true);
  });

  it("can comment on it without being a project member", () => {
    expect(allowed({ ...wsOwner, requireComment: true })).toBe(true);
  });

  it("is not sent for a second membership check to comment", () => {
    // Being a workspace manager IS the workspace seat; re-querying for it
    // would be a wasted round trip on every comment the owner writes.
    expect(
      decideTaskAccess({ ...wsOwner, requireComment: true })
        .requiresContributorSeat
    ).toBe(false);
  });

  it("still cannot silently EDIT a task in a project he is not on", () => {
    // Deliberate asymmetry: leadership gets a voice, not an editor's hands.
    // Write comes from the project role, ownership, or a personal tie.
    expect(allowed({ ...wsOwner, requireWrite: true })).toBe(false);
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

  it("never asks for a workspace seat — there is no workspace to ask about", () => {
    for (const input of [
      personal({ isOwnTask: true, requireComment: true }),
      personal({ isCollaborator: true, requireComment: true }),
    ]) {
      expect(decideTaskAccess(input).requiresContributorSeat).toBe(false);
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
  it("a follower's comment must still be paid for with a workspace seat", () => {
    const decision = decideTaskAccess(
      stranger({ isCollaborator: true, requireComment: true })
    );
    expect(decision.denial).toBeNull();
    expect(decision.requiresContributorSeat).toBe(true);
  });

  it("so must the creator's, when the project grants them nothing", () => {
    expect(
      decideTaskAccess(stranger({ isOwnTask: true, requireComment: true }))
        .requiresContributorSeat
    ).toBe(true);
  });

  it("an offboarded collaborator is refused: no membership row, no seat", () => {
    // What the caller looks up is a WorkspaceMember row; the removed user has
    // none, so `undefined` arrives here and must NOT read as "fine".
    expect(contributorSeatSatisfied(undefined)).toBe(false);
    expect(contributorSeatSatisfied(null)).toBe(false);
    expect(contributorSeatSatisfied("")).toBe(false);
  });

  it("a read-only role is refused too, by the shared non-contributor list", () => {
    // Named from NON_CONTRIBUTOR_ROLES rather than as literals: the same set
    // the Edge gate and requireWorkspaceContributor consume. Add a role there
    // and this demands the task gate already refuses it.
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

  it("the seat check runs ONLY when a personal tie or leadership is carrying the comment", () => {
    // A real COMMENTER/EDITOR/ADMIN role already implies the seat, and a
    // workspace manager IS the seat. Asking again would add a query to every
    // comment the firm writes.
    expect(
      decideTaskAccess(
        stranger({ projectCanRead: true, projectCanComment: true, requireComment: true })
      ).requiresContributorSeat
    ).toBe(false);
    expect(
      decideTaskAccess(
        stranger({
          projectCanRead: true,
          projectIsWorkspaceManager: true,
          requireComment: true,
        })
      ).requiresContributorSeat
    ).toBe(false);
  });

  it("never runs on a read or a write — only on commenting", () => {
    for (const input of [
      stranger({ isCollaborator: true }),
      stranger({ isOwnTask: true, requireWrite: true }),
      stranger({ projectCanRead: true, projectCanWrite: true, requireWrite: true }),
    ]) {
      expect(decideTaskAccess(input).requiresContributorSeat).toBe(false);
    }
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

  it("the workspace OWNER keeps the key — nothing else can un-flag the task", () => {
    // The flag is only clearable from INSIDE the task's own panel. Without
    // this leg, a task privatised by someone who then leaves — no assignee, no
    // follower — is unreachable by anyone, permanently. Private goals grant
    // leadership the same escape (decideObjectiveAccess).
    const wsOwner = secret({
      projectCanRead: true,
      projectCanWrite: true,
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

  it("still charges a follower's comment to a live workspace seat", () => {
    // The offboarding re-check must survive the new branch: a private task is
    // exactly where a stale TaskCollaborator row is most valuable.
    const decision = decideTaskAccess(
      secret({ isCollaborator: true, requireComment: true })
    );
    expect(decision.denial).toBeNull();
    expect(decision.requiresContributorSeat).toBe(true);
  });

  it("never asks for a workspace seat while denying — the denial is final", () => {
    for (const input of [
      secret(),
      secret({ projectCanRead: true, requireComment: true }),
      secret({ projectCanRead: true, projectCanComment: true, requireComment: true }),
      secret({ hasProject: false, requireWrite: true }),
    ]) {
      const decision = decideTaskAccess(input);
      expect(decision.denial).not.toBeNull();
      expect(decision.requiresContributorSeat).toBe(false);
    }
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
  it("never asks for a seat while also denying — a denial is final", () => {
    // A denial plus requiresContributorSeat:true would tempt a caller into
    // reading the flag first and letting the request through.
    const inputs: TaskAccessDecisionInput[] = [
      stranger(),
      stranger({ requireWrite: true }),
      stranger({ requireComment: true }),
      stranger({ projectCanRead: true, requireComment: true }),
      stranger({ hasProject: false }),
      stranger({ hasProject: false, isCollaborator: true, requireWrite: true }),
    ];
    for (const input of inputs) {
      const decision = decideTaskAccess(input);
      if (decision.denial) {
        expect(decision.requiresContributorSeat).toBe(false);
      }
    }
  });

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
