import { describe, expect, it } from "vitest";
import { stableStringify } from "./workflow-types";

describe("stableStringify", () => {
  it("ignores object key order, as jsonb reorders keys", () => {
    expect(
      stableStringify({
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionId: "s1" },
        actions: [{ type: "ADD_COMMENT", content: "Hi" }],
      })
    ).toBe(
      stableStringify({
        actions: [{ content: "Hi", type: "ADD_COMMENT" }],
        trigger: { sectionId: "s1", type: "TASK_MOVED_TO_SECTION" },
      })
    );
  });

  it("keeps array order significant", () => {
    expect(stableStringify([{ type: "A" }, { type: "B" }])).not.toBe(
      stableStringify([{ type: "B" }, { type: "A" }])
    );
  });

  it("distinguishes different values and keeps null", () => {
    expect(stableStringify({ type: "SET_ASSIGNEE", userId: null })).toBe(
      '{"type":"SET_ASSIGNEE","userId":null}'
    );
    expect(stableStringify({ type: "ADD_SUBTASK", name: "a" })).not.toBe(
      stableStringify({ type: "ADD_SUBTASK", name: "b" })
    );
  });

  it("drops undefined keys like JSON does", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(
      stableStringify({ a: 1 })
    );
  });
});
