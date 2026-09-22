import { describe, expect, it } from "vitest";
import { projectVisibilityClauseFor } from "./project-visibility";

/**
 * The LIST half of the project read rule. It must grant exactly what
 * canReadProject grants (@/lib/project-access): a project you can open but
 * never find in a list is as much a bug as one you can find but not open.
 * Pure — no database (DATABASE_URL points at PRODUCTION; see vitest.config.ts).
 */

const USER = "user_1";
const WS = "ws_firm";

function clause(role: string, position: string | null = null) {
  return projectVisibilityClauseFor(USER, {
    workspaceId: WS,
    role,
    position: position as Parameters<
      typeof projectVisibilityClauseFor
    >[1]["position"],
  });
}

describe("projectVisibilityClauseFor", () => {
  it.each(["OWNER", "ADMIN"])("a workspace %s sees every project", (role) => {
    expect(clause(role)).toEqual({ workspaceId: WS });
  });

  it("a level 4+ Position sees every project", () => {
    expect(clause("MEMBER", "PROJECT_MANAGER")).toEqual({ workspaceId: WS });
  });

  it.each(["MEMBER", "WORKER"])(
    "a %s sees own, member, team-shared and WORKSPACE/PUBLIC projects",
    (role) => {
      expect(clause(role)).toEqual({
        workspaceId: WS,
        OR: [
          { ownerId: USER },
          { members: { some: { userId: USER } } },
          { visibility: { in: ["WORKSPACE", "PUBLIC"] } },
          { team: { workspaceId: WS, members: { some: { userId: USER } } } },
        ],
      });
    }
  );

  it.each(["GUEST", "CLIENT"])(
    "a %s sees only projects they own or were explicitly added to",
    (role) => {
      // Not even with an executive Position: Position is independent of role.
      for (const position of [null, "CEO"]) {
        expect(clause(role, position)).toEqual({
          workspaceId: WS,
          OR: [{ ownerId: USER }, { members: { some: { userId: USER } } }],
        });
      }
    }
  );

  it("never widens past the membership's own workspace", () => {
    for (const role of ["OWNER", "MEMBER", "GUEST"]) {
      expect(clause(role).workspaceId).toBe(WS);
    }
  });
});
