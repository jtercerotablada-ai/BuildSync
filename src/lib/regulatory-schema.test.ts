import { describe, expect, it } from "vitest";
import { z } from "zod";
import { regulatoryFields, toDeadline } from "@/lib/regulatory-schema";

const schema = z.object({ ...regulatoryFields });

function firstError(input: unknown): string | null {
  const r = schema.safeParse(input);
  return r.success ? null : (r.error.issues[0]?.message ?? "?");
}

describe("regulatoryFields", () => {
  it("'' becomes null and values are trimmed", () => {
    const r = schema.parse({
      jurisdiction: "",
      permitNumber: "  BD25-004512 ",
      clientContactName: "   ",
    });
    expect(r.jurisdiction).toBeNull();
    expect(r.permitNumber).toBe("BD25-004512");
    expect(r.clientContactName).toBeNull();
  });

  it("normalizes jurisdiction whitespace", () => {
    expect(schema.parse({ jurisdiction: " City   of Hialeah " }).jurisdiction).toBe(
      "City of Hialeah"
    );
  });

  it("omitted fields stay undefined", () => {
    const r = schema.parse({});
    expect(r.jurisdiction).toBeUndefined();
    expect(r.folioNumber).toBeUndefined();
    expect(r.regulatoryDeadline).toBeUndefined();
    expect(toDeadline(r.regulatoryDeadline)).toBeUndefined();
  });

  it("null clears", () => {
    expect(schema.parse({ caseNumber: null }).caseNumber).toBeNull();
    expect(schema.parse({ clientContactEmail: null }).clientContactEmail).toBeNull();
  });

  it("'' email and phone are allowed (clear)", () => {
    const r = schema.parse({ clientContactEmail: "", clientContactPhone: " " });
    expect(r.clientContactEmail).toBeNull();
    expect(r.clientContactPhone).toBeNull();
  });

  it("rejects a 121-char jurisdiction with an English message", () => {
    expect(firstError({ jurisdiction: "x".repeat(121) })).toBe(
      "Jurisdiction is too long (120 max)"
    );
  });

  it("rejects a bad email", () => {
    expect(firstError({ clientContactEmail: "ana@firm" })).toBe(
      "Enter a valid email"
    );
  });

  it("rejects a 6-digit phone", () => {
    expect(firstError({ clientContactPhone: "555-014" })).toBe(
      "Enter a valid phone number"
    );
  });

  it("rejects a folio with a slash", () => {
    expect(firstError({ folioNumber: "01/3131" })).toBe(
      "Folio number can only contain letters, digits, dots, dashes and spaces"
    );
    expect(firstError({ folioNumber: "01-3131-051-0010" })).toBeNull();
  });

  it.each([
    ["2026-12-15", null],
    ["", null],
    ["2026-12-15T00:00:00.000Z", null],
    ["12/15/2026", "Invalid date"],
    ["2026-12-15T14:00:00Z", "Invalid date"],
    ["2026-02-30", "Invalid date"],
    ["tomorrow", "Invalid date"],
  ] as const)("deadline %s -> %s", (v, err) => {
    expect(firstError({ regulatoryDeadline: v })).toBe(err);
  });
});

describe("toDeadline", () => {
  it("normalizes to UTC midnight", () => {
    expect(toDeadline("2026-12-15")?.toISOString()).toBe(
      "2026-12-15T00:00:00.000Z"
    );
    expect(toDeadline("2026-12-15T00:00:00.000Z")?.toISOString()).toBe(
      "2026-12-15T00:00:00.000Z"
    );
  });
  it("'' and null clear, undefined is no change", () => {
    expect(toDeadline("")).toBeNull();
    expect(toDeadline(null)).toBeNull();
    expect(toDeadline(undefined)).toBeUndefined();
  });
});
