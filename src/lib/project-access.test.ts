import { describe, expect, it } from "vitest";
import { canReadProject, type ProjectReadDecisionInput } from "./project-access";

/**
 * canReadProject is the whole read decision for a project — the resolver
 * (resolveProjectAccess), the dashboard project page and GET /api/projects/:id
 * all route through it. It is pure on purpose: no Prisma, no session, so these
 * tests touch no database (DATABASE_URL points at PRODUCTION; see
 * vitest.config.ts).
 *
 * The case these tests exist for: `visibility === "PUBLIC"` used to grant read
 * on its own, in three separate hand-rolled copies of the rule. PUBLIC means
 * "everyone in THIS workspace", never "everyone with an account", so a signed
 * in MEMBER of a DIFFERENT workspace could open any PUBLIC project by id — a
 * cross-tenant read. If someone deletes the workspace comparison from the
 * PUBLIC branch, "denies a viewer from a different workspace" below fails.
 */

const WS_OWNING = "ws_owning";
const WS_OTHER = "ws_other";

/** A stranger: no ownership, no membership, no team, no manager rights. */
function outsider(
  overrides: Partial<ProjectReadDecisionInput> = {}
): ProjectReadDecisionInput {
  return {
    visibility: "PRIVATE",
    projectWorkspaceId: WS_OWNING,
    viewerWorkspaceIds: [],
    isOwner: false,
    isMember: false,
    isWorkspaceManager: false,
    isTeamMember: false,
    ...overrides,
  };
}

describe("canReadProject — PUBLIC is scoped to the owning workspace", () => {
  it("allows a viewer who belongs to the project's workspace", () => {
    expect(
      canReadProject(
        outsider({
          visibility: "PUBLIC",
          viewerWorkspaceIds: [WS_OWNING],
        })
      )
    ).toBe(true);
  });

  it("denies a viewer from a DIFFERENT workspace (the cross-tenant read)", () => {
    expect(
      canReadProject(
        outsider({
          visibility: "PUBLIC",
          viewerWorkspaceIds: [WS_OTHER],
        })
      )
    ).toBe(false);
  });

  it("denies a viewer with no workspace memberships at all", () => {
    expect(
      canReadProject(outsider({ visibility: "PUBLIC", viewerWorkspaceIds: [] }))
    ).toBe(false);
  });

  it("allows a multi-workspace viewer when one of theirs owns the project", () => {
    expect(
      canReadProject(
        outsider({
          visibility: "PUBLIC",
          viewerWorkspaceIds: [WS_OTHER, WS_OWNING],
        })
      )
    ).toBe(true);
  });

  it("still denies a multi-workspace viewer when none of theirs owns it", () => {
    expect(
      canReadProject(
        outsider({
          visibility: "PUBLIC",
          viewerWorkspaceIds: [WS_OTHER, "ws_third"],
        })
      )
    ).toBe(false);
  });

  it("grants PUBLIC read only — the caller derives canWrite separately", () => {
    // canReadProject answers READ and nothing else; write capability comes
    // from ownership/memberRole/team in resolveProjectAccess, none of which
    // this input has. Pinned so a future "PUBLIC implies write" is a visible
    // change, not a silent one.
    const input = outsider({
      visibility: "PUBLIC",
      viewerWorkspaceIds: [WS_OWNING],
    });
    expect(canReadProject(input)).toBe(true);
    expect(input.isOwner || input.isMember || input.isTeamMember).toBe(false);
  });
});

describe("canReadProject — WORKSPACE is not an auto-grant", () => {
  it("denies an ordinary workspace member (deliberate: matches the page rule)", () => {
    expect(
      canReadProject(
        outsider({
          visibility: "WORKSPACE",
          viewerWorkspaceIds: [WS_OWNING],
        })
      )
    ).toBe(false);
  });
});

describe("canReadProject — PRIVATE", () => {
  it("denies a non-member who is in the same workspace", () => {
    expect(
      canReadProject(
        outsider({
          visibility: "PRIVATE",
          viewerWorkspaceIds: [WS_OWNING],
        })
      )
    ).toBe(false);
  });

  it("denies a non-member from a different workspace", () => {
    expect(
      canReadProject(
        outsider({
          visibility: "PRIVATE",
          viewerWorkspaceIds: [WS_OTHER],
        })
      )
    ).toBe(false);
  });
});

describe("canReadProject — membership beats visibility", () => {
  it.each(["PRIVATE", "WORKSPACE", "PUBLIC"])(
    "allows the project OWNER of a %s project",
    (visibility) => {
      expect(
        canReadProject(outsider({ visibility, isOwner: true }))
      ).toBe(true);
    }
  );

  it.each(["PRIVATE", "WORKSPACE", "PUBLIC"])(
    "allows a project MEMBER of a %s project",
    (visibility) => {
      expect(
        canReadProject(outsider({ visibility, isMember: true }))
      ).toBe(true);
    }
  );

  it.each(["PRIVATE", "WORKSPACE", "PUBLIC"])(
    "allows a TEAM member of a %s project",
    (visibility) => {
      expect(
        canReadProject(outsider({ visibility, isTeamMember: true }))
      ).toBe(true);
    }
  );

  it.each(["PRIVATE", "WORKSPACE", "PUBLIC"])(
    "allows a workspace manager of a %s project",
    (visibility) => {
      // isWorkspaceManager is only ever computed from a membership in the
      // PROJECT's workspace, so it cannot cross the tenant boundary.
      expect(
        canReadProject(outsider({ visibility, isWorkspaceManager: true }))
      ).toBe(true);
    }
  );
});

describe("canReadProject — unknown visibility values fail closed", () => {
  it.each(["", "public", "Public", "ARCHIVED", "OPEN"])(
    "denies %o even inside the owning workspace",
    (visibility) => {
      expect(
        canReadProject(
          outsider({ visibility, viewerWorkspaceIds: [WS_OWNING] })
        )
      ).toBe(false);
    }
  );
});
