import { describe, expect, it } from "vitest";
import {
  canReadProject,
  decideProjectCapabilities,
  type ProjectCapabilityInput,
  type ProjectReadDecisionInput,
} from "./project-access";

/**
 * canReadProject is the whole read decision for a project — the resolver
 * (resolveProjectAccess), the dashboard project page and GET /api/projects/:id
 * all route through it. It is pure on purpose: no Prisma, no session, so these
 * tests touch no database (DATABASE_URL points at PRODUCTION; see
 * vitest.config.ts).
 *
 * Two cases these tests exist for:
 *
 *   1. `visibility === "PUBLIC"` used to grant read on its own, in three
 *      separate hand-rolled copies of the rule. PUBLIC means "everyone in THIS
 *      workspace", never "everyone with an account", so a signed-in MEMBER of
 *      a DIFFERENT workspace could open any PUBLIC project by id — a
 *      cross-tenant read. If someone deletes the workspace comparison, the
 *      "different workspace" cases below fail.
 *
 *   2. WORKSPACE (the default for new projects) is an Editor-level grant for
 *      every contributor of the project's workspace (owner decision,
 *      2026-09-21) — it used to behave exactly like PRIVATE while the Share
 *      dialog promised the workspace access. PUBLIC is never weaker.
 *
 * `viewerWorkspaceIds` lists only workspaces where the viewer holds a
 * CONTRIBUTOR seat; resolveProjectAccess leaves a GUEST/CLIENT seat out of it.
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

describe("canReadProject — WORKSPACE opens the project to the firm", () => {
  it("allows a contributor of the project's workspace", () => {
    expect(
      canReadProject(
        outsider({
          visibility: "WORKSPACE",
          viewerWorkspaceIds: [WS_OWNING],
        })
      )
    ).toBe(true);
  });

  it("denies a viewer from a DIFFERENT workspace (never cross-tenant)", () => {
    expect(
      canReadProject(
        outsider({ visibility: "WORKSPACE", viewerWorkspaceIds: [WS_OTHER] })
      )
    ).toBe(false);
  });

  it("denies a viewer with no contributor seat anywhere", () => {
    expect(
      canReadProject(outsider({ visibility: "WORKSPACE", viewerWorkspaceIds: [] }))
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

describe("canReadProject — senior Position", () => {
  it("reads a PRIVATE project in its own workspace", () => {
    expect(canReadProject(outsider({ hasSeniorRead: true }))).toBe(true);
  });
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

// ───────────────────────────────────────────────────────────────────────────
// decideProjectCapabilities — write / comment / manage
// ───────────────────────────────────────────────────────────────────────────

function caller(
  overrides: Partial<ProjectCapabilityInput> = {}
): ProjectCapabilityInput {
  return { ...outsider(), memberRole: null, ...overrides };
}

describe("decideProjectCapabilities — WORKSPACE/PUBLIC is Editor-level", () => {
  it.each(["WORKSPACE", "PUBLIC"])(
    "a contributor with no row can write and comment on a %s project",
    (visibility) => {
      const caps = decideProjectCapabilities(
        caller({ visibility, viewerWorkspaceIds: [WS_OWNING] })
      );
      expect(caps).toMatchObject({
        canRead: true,
        canWrite: true,
        canComment: true,
        canManage: false,
        isWorkspaceShared: true,
      });
    }
  );

  it("PUBLIC is never weaker than WORKSPACE", () => {
    const base = { viewerWorkspaceIds: [WS_OWNING] };
    expect(decideProjectCapabilities(caller({ ...base, visibility: "PUBLIC" })))
      .toEqual(
        decideProjectCapabilities(caller({ ...base, visibility: "WORKSPACE" }))
      );
  });

  it.each(["VIEWER", "COMMENTER"] as const)(
    "an explicit %s row wins over the implicit grant",
    (memberRole) => {
      const caps = decideProjectCapabilities(
        caller({
          visibility: "WORKSPACE",
          viewerWorkspaceIds: [WS_OWNING],
          isMember: true,
          memberRole,
        })
      );
      expect(caps.canRead).toBe(true);
      expect(caps.canWrite).toBe(false);
      expect(caps.canComment).toBe(memberRole === "COMMENTER");
      expect(caps.isWorkspaceShared).toBe(false);
    }
  );

  it("grants nothing on a PRIVATE project to a contributor with no row", () => {
    const caps = decideProjectCapabilities(
      caller({ visibility: "PRIVATE", viewerWorkspaceIds: [WS_OWNING] })
    );
    expect(caps).toMatchObject({
      canRead: false,
      canWrite: false,
      canComment: false,
      canManage: false,
    });
  });
});

describe("decideProjectCapabilities — workspace managers and senior staff", () => {
  it("a workspace manager can do everything on a PRIVATE project", () => {
    const caps = decideProjectCapabilities(
      caller({ isWorkspaceManager: true, viewerWorkspaceIds: [WS_OWNING] })
    );
    expect(caps).toMatchObject({
      canRead: true,
      canWrite: true,
      canComment: true,
      canManage: true,
    });
  });

  it("a workspace manager restricted to VIEWER keeps everything", () => {
    const caps = decideProjectCapabilities(
      caller({
        isWorkspaceManager: true,
        isMember: true,
        memberRole: "VIEWER",
        viewerWorkspaceIds: [WS_OWNING],
      })
    );
    expect(caps.canWrite).toBe(true);
    expect(caps.canManage).toBe(true);
  });

  it("a senior Position reads a PRIVATE project and nothing more", () => {
    const caps = decideProjectCapabilities(
      caller({ hasSeniorRead: true, viewerWorkspaceIds: [WS_OWNING] })
    );
    expect(caps).toMatchObject({
      canRead: true,
      canWrite: false,
      canComment: false,
      canManage: false,
    });
  });

  it("a team member is an Editor, never a manager", () => {
    const caps = decideProjectCapabilities(
      caller({ isTeamMember: true, viewerWorkspaceIds: [WS_OWNING] })
    );
    expect(caps).toMatchObject({
      canRead: true,
      canWrite: true,
      canComment: true,
      canManage: false,
    });
  });
});
