import { describe, expect, it } from "vitest";
import { keyResultPercent, objectiveReadClause } from "@/lib/goal-progress";
import { decideObjectiveAccess } from "@/lib/objective-access";

describe("keyResultPercent", () => {
  it("measures progress across the start-to-target range", () => {
    expect(keyResultPercent({ startValue: 0, targetValue: 200, currentValue: 50 })).toBe(25);
  });

  it("clamps to 0-100", () => {
    expect(keyResultPercent({ startValue: 0, targetValue: 10, currentValue: 15 })).toBe(100);
    expect(keyResultPercent({ startValue: 10, targetValue: 20, currentValue: 5 })).toBe(0);
  });

  it("handles a decreasing target (lower is better)", () => {
    expect(keyResultPercent({ startValue: 6, targetValue: 0, currentValue: 3 })).toBe(50);
  });

  it("reads a zero range as done once the target is reached", () => {
    expect(keyResultPercent({ startValue: 12, targetValue: 12, currentValue: 12 })).toBe(100);
    expect(keyResultPercent({ startValue: 12, targetValue: 12, currentValue: 11 })).toBe(0);
  });
});

describe("objectiveReadClause", () => {
  it("gives a workspace manager every goal in the workspace", () => {
    expect(objectiveReadClause("u1", "ws1", { isWorkspaceManager: true })).toEqual({
      workspaceId: "ws1",
    });
  });

  it("gives a contributor non-private goals plus the private ones they own or are on", () => {
    expect(objectiveReadClause("u1", "ws1", { isWorkspaceManager: false })).toEqual({
      workspaceId: "ws1",
      OR: [
        { isPrivate: false },
        { ownerId: "u1" },
        { members: { some: { userId: "u1" } } },
      ],
    });
  });

  // The list clause must grant exactly what the single-goal gate grants.
  // Evaluate the clause against an in-memory goal and compare with
  // decideObjectiveAccess for every combination a contributor can be in.
  it("agrees with decideObjectiveAccess for contributors", () => {
    const userId = "u1";
    for (const workspaceRole of ["OWNER", "ADMIN", "MEMBER"]) {
      for (const isPrivate of [false, true]) {
        for (const isOwner of [false, true]) {
          for (const isMember of [false, true]) {
            const isWorkspaceManager =
              workspaceRole === "OWNER" || workspaceRole === "ADMIN";
            const clause = objectiveReadClause(userId, "ws1", { isWorkspaceManager });
            const goal = {
              workspaceId: "ws1",
              isPrivate,
              ownerId: isOwner ? userId : "someone-else",
              memberIds: isMember ? [userId] : [],
            };
            const matches =
              clause.workspaceId === goal.workspaceId &&
              (!clause.OR ||
                (clause.OR as Array<Record<string, unknown>>).some((arm) => {
                  if ("isPrivate" in arm) return arm.isPrivate === goal.isPrivate;
                  if ("ownerId" in arm) return arm.ownerId === goal.ownerId;
                  return goal.memberIds.includes(userId);
                }));
            const decision = decideObjectiveAccess({
              isPrivate,
              workspaceRole,
              isOwner,
              isMember,
            });
            expect({ workspaceRole, isPrivate, isOwner, isMember, matches }).toEqual({
              workspaceRole,
              isPrivate,
              isOwner,
              isMember,
              matches: decision.canRead,
            });
          }
        }
      }
    }
  });
});
