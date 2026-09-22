import { describe, expect, it } from "vitest";
import {
  enumValuesForFilter,
  filterFieldsForEntity,
  filterOperatorLabel,
  invalidFilterReason,
  operatorsForFilterField,
} from "./report-config";

/**
 * The custom chart builder may only compose filters the engine implements,
 * and the query route refuses the rest. An operator the engine did not
 * understand used to be reinterpreted silently — "Due date is Sep 30" ran as
 * "on or after Sep 30" while the footer still said "1 filter".
 */
describe("which operators each filter field supports", () => {
  it("gives id fields membership tests only", () => {
    expect(operatorsForFilterField("assignee")).toEqual(["is", "isNot", "isSet", "isNotSet"]);
    expect(operatorsForFilterField("assignee")).not.toContain("contains");
  });

  it("gives dates whole-day comparisons and no 'contains'", () => {
    const ops = operatorsForFilterField("dueDate");
    expect(ops).toContain("is");
    expect(ops).toContain("inNextDays");
    expect(ops).not.toContain("contains");
    expect(filterOperatorLabel("dueDate", "lt")).toBe("is before");
  });

  it("never offers an emptiness test on the required createdAt", () => {
    expect(operatorsForFilterField("createdAt")).not.toContain("isSet");
    expect(operatorsForFilterField("createdAt")).not.toContain("isNotSet");
  });

  it("lets a name be matched, excluded or searched", () => {
    expect(operatorsForFilterField("name")).toEqual(["is", "isNot", "contains"]);
  });
});

describe("invalidFilterReason — what the query route refuses", () => {
  it("accepts every operator the builder offers, for every entity", () => {
    for (const entity of ["tasks", "projects", "goals"] as const) {
      for (const field of filterFieldsForEntity(entity)) {
        for (const operator of operatorsForFilterField(field.value)) {
          expect(
            invalidFilterReason(entity, [{ field: field.value, operator }])
          ).toBeNull();
        }
      }
    }
  });

  it("refuses 'due date contains'", () => {
    expect(
      invalidFilterReason("tasks", [{ field: "dueDate", operator: "contains" }])
    ).toMatch(/Due date/);
  });

  it("refuses a field the entity does not have", () => {
    expect(
      invalidFilterReason("goals", [{ field: "type", operator: "is" }])
    ).not.toBeNull();
  });

  it("allows custom-field filters on tasks only", () => {
    expect(invalidFilterReason("tasks", [{ field: "cf:abc", operator: "gt" }])).toBeNull();
    expect(invalidFilterReason("projects", [{ field: "cf:abc", operator: "gt" }])).not.toBeNull();
  });
});

describe("enum pickers use the stored values", () => {
  it("offers project and goal statuses as their enum values", () => {
    expect(enumValuesForFilter("projects", "status")?.map((o) => o.value)).toContain("ON_HOLD");
    expect(enumValuesForFilter("goals", "status")?.map((o) => o.value)).toContain("ACHIEVED");
  });

  it("keeps BSIP an acronym", () => {
    expect(enumValuesForFilter("projects", "type")?.find((o) => o.value === "BSIP")?.label).toBe(
      "BSIP"
    );
  });
});
