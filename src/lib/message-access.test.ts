import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canPostInPortfolio,
  canPostInProject,
  canPostWorkspaceAnnouncement,
} from "./message-access";
import { resolveProjectAccess } from "./project-access";
import { NON_CONTRIBUTOR_ROLES } from "@/lib/workspace-roles";

/**
 * WHO MAY SPEAK IN A CHANNEL.
 *
 * `loadMessageWithAccess` answers two different questions about one message:
 * may the caller SEE it (`ok`), and may the caller ADD to it (`canPost` —
 * replies, reactions, pins, attachments). Conflating them is the bug this
 * suite exists for: the generic /api/messages/[id]/* routes checked only
 * `ok`, so a colleague deliberately added to a project as a read-only VIEWER
 * could open the channel *and then post unlimited replies inside it*. The
 * project page's own POST refused them; the reply route did not.
 *
 * `loadMessageWithAccess` itself is DB-bound (it loads the Message row), so it
 * is not called here. What IS reachable, and is where the whole decision
 * actually lives, are the three pure predicates it composes — one per parent a
 * Message can hang from (project / portfolio / workspace announcement) — plus
 * `resolveProjectAccess`, whose one lookup (the caller's seat in the project's
 * workspace) is served by the in-memory seat table below. No test opens a
 * connection (DATABASE_URL points at PRODUCTION and is blanked by
 * vitest.config.ts; a stray query would fail loudly, not quietly succeed
 * against live data).
 *
 * Two personas run through all of it:
 *   OWNER  — runs the firm's workspace, is NOT a member of every project.
 *   MEMBER — a colleague carrying an explicit project role.
 * Every recent bug lived in the gap between them.
 */

const WS_FIRM = "ws_firm";
const OWNER = "user_owner";
const MEMBER = "user_member";

const db = vi.hoisted(() => ({ seats: new Map<string, string>() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    workspaceMember: {
      findUnique: async ({
        where,
      }: {
        where: { userId_workspaceId: { userId: string; workspaceId: string } };
      }) => {
        const { userId, workspaceId } = where.userId_workspaceId;
        const role = db.seats.get(`${userId}@${workspaceId}`);
        return role ? { role, user: { position: null } } : null;
      },
    },
    project: { findUnique: async () => null },
    teamMember: { findFirst: async () => null },
  },
}));

beforeEach(() => {
  db.seats.clear();
});

type ProjectFixture = Parameters<typeof resolveProjectAccess>[0];

/** A project inside the firm's workspace, with explicit members. */
function project(
  members: { userId: string; role: string }[],
  overrides: Partial<ProjectFixture> = {}
): ProjectFixture {
  return {
    id: "proj_1",
    ownerId: OWNER,
    workspaceId: WS_FIRM,
    visibility: "PRIVATE",
    teamId: null,
    members,
    ...overrides,
  };
}

/** The predicate the message routes apply, fed by the real resolver. */
async function mayPost(
  fixture: ProjectFixture,
  userId: string
): Promise<boolean> {
  return canPostInProject(await resolveProjectAccess(fixture, userId));
}

describe("project channel — a read-only colleague cannot post", () => {
  it("a VIEWER can open the channel but cannot reply in it", async () => {
    // The exact hole: read was granted, so the reply route (which checked only
    // `ok`) accepted the post. Both halves are asserted together on purpose —
    // if a future change makes the VIEWER's read imply posting, this fails.
    const access = await resolveProjectAccess(
      project([{ userId: MEMBER, role: "VIEWER" }]),
      MEMBER
    );
    expect(access.ok).toBe(true);
    expect(canPostInProject(access)).toBe(false);
  });

  it("a COMMENTER can reply even though they cannot edit the project", async () => {
    const access = await resolveProjectAccess(
      project([{ userId: MEMBER, role: "COMMENTER" }]),
      MEMBER
    );
    expect(canPostInProject(access)).toBe(true);
    // The point of the COMMENTER role: talk, don't touch.
    expect(access.canWrite).toBe(false);
  });

  it.each(["ADMIN", "EDITOR", "COMMENTER"])(
    "a %s colleague can post in the project channel",
    async (role) => {
      expect(
        await mayPost(project([{ userId: MEMBER, role }]), MEMBER)
      ).toBe(true);
    }
  );

  it("the project owner can post in their own channel", async () => {
    expect(await mayPost(project([]), OWNER)).toBe(true);
  });

  it("an unrecognised project role is refused the microphone", async () => {
    // Fails closed: a role string the resolver does not know grants neither
    // canWrite nor canComment, so it cannot post.
    expect(
      await mayPost(project([{ userId: MEMBER, role: "GUEST" }]), MEMBER)
    ).toBe(false);
    expect(
      await mayPost(project([{ userId: MEMBER, role: "viewer" }]), MEMBER)
    ).toBe(false);
  });

  it.each(["PRIVATE", "WORKSPACE", "PUBLIC"])(
    "a VIEWER stays silent in a %s project — visibility never grants a voice",
    async (visibility) => {
      // Making a project PUBLIC opens it for READING to the workspace. It has
      // never meant "anyone may write in it", and must not start meaning that.
      expect(
        await mayPost(
          project([{ userId: MEMBER, role: "VIEWER" }], { visibility }),
          MEMBER
        )
      ).toBe(false);
    }
  );

  it("an explicit VIEWER row does not silence the person who owns the workspace", async () => {
    // Workspace OWNER/ADMIN read, write, comment and manage every project in
    // their workspace whether or not they also hold a member row (owner
    // decision, 2026-09-21): adding the owner to a project as a VIEWER to get
    // its notifications must not take his voice away there.
    db.seats.set(`${OWNER}@${WS_FIRM}`, "OWNER");
    const access = await resolveProjectAccess(
      project([{ userId: OWNER, role: "VIEWER" }], { ownerId: "user_other" }),
      OWNER
    );
    expect(access.isWorkspaceManager).toBe(true);
    expect(canPostInProject(access)).toBe(true);
  });

  it("a VIEWER who is an ordinary staff member stays silent", async () => {
    db.seats.set(`${MEMBER}@${WS_FIRM}`, "MEMBER");
    expect(
      await mayPost(
        project([{ userId: MEMBER, role: "VIEWER" }], { visibility: "WORKSPACE" }),
        MEMBER
      )
    ).toBe(false);
  });

  it("a staff member with no row may post in a WORKSPACE project", async () => {
    // WORKSPACE visibility is an Editor-level grant for every contributor.
    db.seats.set(`${MEMBER}@${WS_FIRM}`, "MEMBER");
    expect(
      await mayPost(project([], { visibility: "WORKSPACE" }), MEMBER)
    ).toBe(true);
  });
});

describe("canPostInProject — the composed rule", () => {
  it("lets workspace leadership post in a project they never joined", () => {
    // The OWNER persona: no ProjectMember row anywhere, so canComment is
    // false, but they run the workspace. This is the arm that keeps the boss
    // from being locked out of their own firm's channels.
    expect(
      canPostInProject({ canComment: false, isWorkspaceManager: true })
    ).toBe(true);
  });

  it("refuses someone who is neither a commenter nor leadership", () => {
    expect(
      canPostInProject({ canComment: false, isWorkspaceManager: false })
    ).toBe(false);
  });

  it("is decided by comment rights and leadership only — never by read access", () => {
    // The signature carries no `ok`/canRead field at all. That is the fix:
    // being able to see a channel is structurally incapable of granting a
    // voice in it.
    expect(
      canPostInProject({ canComment: true, isWorkspaceManager: false })
    ).toBe(true);
    expect(
      canPostInProject({ canComment: true, isWorkspaceManager: true })
    ).toBe(true);
  });

  it("matches the rule POST /api/projects/:id/messages applies", () => {
    // The two entry points into a project channel — posting a new message and
    // replying to an existing one — must agree, because they used to not.
    const route = readFileSync(
      join(
        __dirname,
        "..",
        "app",
        "api",
        "projects",
        "[projectId]",
        "messages",
        "route.ts"
      ),
      "utf8"
    );
    // Either the named predicate or its inline spelling, inside POST itself
    // (GET already calls canPostInProject for the composer flag).
    const post = route.slice(route.indexOf("export async function POST"));
    expect(post.length).toBeLessThan(route.length);
    expect(post).toMatch(
      /canPostInProject\(\s*access\.access\s*\)|canComment\s*\|\|\s*access\.access\.isWorkspaceManager/
    );
  });
});

describe("portfolio channel — a VIEWER reads, an EDITOR speaks", () => {
  it("a portfolio VIEWER cannot reply, react or pin", () => {
    expect(canPostInPortfolio({ isOwner: false, memberRole: "VIEWER" })).toBe(
      false
    );
  });

  it.each(["OWNER", "EDITOR"])(
    "a portfolio %s can post",
    (memberRole) => {
      expect(canPostInPortfolio({ isOwner: false, memberRole })).toBe(true);
    }
  );

  it("the portfolio owner can post without holding a member row", () => {
    expect(canPostInPortfolio({ isOwner: true, memberRole: null })).toBe(true);
    expect(canPostInPortfolio({ isOwner: true, memberRole: undefined })).toBe(
      true
    );
  });

  it("someone with no portfolio role at all cannot post", () => {
    // Reaching this predicate means the read gate already passed — which a
    // non-member does pass on a PUBLIC portfolio in their own workspace. Read
    // must not carry a voice with it.
    expect(canPostInPortfolio({ isOwner: false, memberRole: null })).toBe(false);
    expect(
      canPostInPortfolio({ isOwner: false, memberRole: undefined })
    ).toBe(false);
  });

  it("a workspace OWNER/ADMIN can post without a portfolio role", () => {
    expect(
      canPostInPortfolio({
        isOwner: false,
        memberRole: null,
        isWorkspaceManager: true,
      })
    ).toBe(true);
    expect(
      canPostInPortfolio({
        isOwner: false,
        memberRole: "VIEWER",
        isWorkspaceManager: false,
      })
    ).toBe(false);
  });

  it("a project role name pasted into a portfolio grants nothing", () => {
    // PortfolioRole has no COMMENTER. If one is ever added, the enum-coverage
    // test below fails first and forces a deliberate decision.
    expect(
      canPostInPortfolio({ isOwner: false, memberRole: "COMMENTER" })
    ).toBe(false);
    expect(canPostInPortfolio({ isOwner: false, memberRole: "ADMIN" })).toBe(
      false
    );
    expect(canPostInPortfolio({ isOwner: false, memberRole: "editor" })).toBe(
      false
    );
  });

  it("every PortfolioRole in the schema has been placed on one side", () => {
    // Derived from schema.prisma, not from a literal list, so adding a role to
    // the enum fails here until someone decides whether it may speak.
    const expected: Record<string, boolean> = {
      OWNER: true,
      EDITOR: true,
      VIEWER: false,
    };
    const roles = enumValues("PortfolioRole");
    expect([...roles].sort()).toEqual(Object.keys(expected).sort());
    for (const role of roles) {
      expect(canPostInPortfolio({ isOwner: false, memberRole: role })).toBe(
        expected[role]
      );
    }
  });
});

describe("workspace announcement — only contributors may reply", () => {
  it.each([...NON_CONTRIBUTOR_ROLES])(
    "a %s cannot reply to a workspace announcement",
    (role) => {
      expect(canPostWorkspaceAnnouncement(role)).toBe(false);
    }
  );

  it("every other workspace role in the schema may reply", () => {
    // Never names GUEST/CLIENT as literals: the expectation is derived from
    // NON_CONTRIBUTOR_ROLES, the same set the /api/ edge gate and
    // requireWorkspaceContributor consume. Re-hardcode a role here or there
    // and the two halves drift again.
    const contributors = enumValues("WorkspaceRole").filter(
      (role) => !NON_CONTRIBUTOR_ROLES.has(role)
    );
    expect(contributors.length).toBeGreaterThan(0);
    for (const role of contributors) {
      expect(canPostWorkspaceAnnouncement(role)).toBe(true);
    }
  });

  it("every WorkspaceRole is consciously on one side of the line", () => {
    const roles = enumValues("WorkspaceRole");
    for (const role of roles) {
      expect(canPostWorkspaceAnnouncement(role)).toBe(
        !NON_CONTRIBUTOR_ROLES.has(role)
      );
    }
  });

  it("an unknown or empty role string is treated as a contributor", () => {
    // Documented, not endorsed. The branch only reaches this predicate with a
    // role read straight off a real WorkspaceMember row, so an unknown string
    // is not reachable — but the predicate itself fails OPEN, so if a caller
    // ever passes an unvalidated string this test says what happens.
    expect(canPostWorkspaceAnnouncement("")).toBe(true);
    expect(canPostWorkspaceAnnouncement("guest")).toBe(true);
  });
});

/** Parse an enum's values straight out of schema.prisma. */
function enumValues(name: string): string[] {
  const schema = readFileSync(
    join(__dirname, "..", "..", "prisma", "schema.prisma"),
    "utf8"
  );
  const block = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`).exec(schema);
  if (!block) throw new Error(`${name} enum not found in schema.prisma`);
  const values = block[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z_]+$/.test(line));
  if (values.length === 0) throw new Error(`${name} enum parsed empty`);
  return values;
}
