import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import { evalExpr, orderChildrenFirst } from "./formula-eval";

describe("orderChildrenFirst", () => {
  it("returns deeper levels before their parents", () => {
    const levels = orderChildrenFirst([
      { id: "a", parentTaskId: null },
      { id: "b", parentTaskId: "a" },
      { id: "c", parentTaskId: "b" },
      { id: "d", parentTaskId: null },
    ]);
    expect(levels).toEqual([["c"], ["b"], ["a", "d"]]);
  });

  it("treats a parent outside the project as a root and survives a cycle", () => {
    const levels = orderChildrenFirst([
      { id: "x", parentTaskId: "elsewhere" },
      { id: "p", parentTaskId: "q" },
      { id: "q", parentTaskId: "p" },
    ]);
    expect(levels.flat().sort()).toEqual(["p", "q", "x"]);
  });
});

describe("evalExpr", () => {
  it("applies × before +", () => {
    const values = new Map<string, unknown>([["h", 10], ["r", 150]]);
    expect(
      evalExpr(
        [
          { t: "field", id: "h" },
          { t: "op", op: "*" },
          { t: "field", id: "r" },
          { t: "op", op: "+" },
          { t: "num", n: 50 },
        ],
        values
      )
    ).toEqual({ result: 1550 });
  });
});
