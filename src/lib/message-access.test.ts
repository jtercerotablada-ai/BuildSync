import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
 * `resolveProjectAccess`, which is DB-free for exactly the callers that matter
 * most: the project OWNER and anyone holding an explicit ProjectMember row.
 * No test below opens a connection (DATABASE_URL points at PRODUCTION and is
 * blanked by vitest.config.ts; a stray query would fail loudly, not quietly
 * succeed against live data).
 *
 * Two personas run through all of it:
 *   OWNER  — runs the firm's workspace, is NOT a member of every project.
 *   MEMBER — a colleague carrying an explicit project role.
 * Every recent bug lived in the gap between them.
 */

const WS_FIRM = "ws_firm";
const OWNER = "user_owner";
const MEMBER = "user_member";

type ProjectFixture = Parameters<typeof resolveProjectAccess>[0];

/**
 * A project inside the firm's workspace. Members are given explicitly so that
 * every caller in these tests is either the owner or a member — the two paths
 * `resolveProjectAccess` resolves without touching the database.
 */
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

  it("an explicit VIEWER row silences even the person who owns the workspace", async () => {
    // Real, deliberate behaviour worth pinning: an explicit ProjectMember row
    // short-circuits the workspace-role lookup entirely, so the OWNER persona
    // who was deliberately restricted to VIEWER on one project does NOT get
    // their leadership override back. Restricting someone means restricting
    // them. If this ever flips, workspace leadership silently outranks an
    // explicit restriction.
    const access = await resolveProjectAccess(
      project([{ userId: OWNER, role: "VIEWER" }], { ownerId: "user_other" }),
      OWNER
    );
    expect(access.isWorkspaceManager).toBe(false);
    expect(canPostInProject(access)).toBe(false);
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
    expect(route).toMatch(/canComment\s*\|\|\s*access\.access\.isWorkspaceManager/);
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
