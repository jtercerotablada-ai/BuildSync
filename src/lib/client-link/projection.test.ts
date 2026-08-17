/**
 * The projection is the whole security boundary of the client link, and the
 * part of it that can be tested without a database is the SHAPE: which
 * columns the select names. That is exactly the part that rots — someone adds
 * a field to `CLIENT_PROJECT_SELECT` while chasing a UI bug and a budget ends
 * up on an unauthenticated page.
 *
 * These tests import only the constants, so nothing here touches Prisma
 * (DATABASE_URL is blanked for the test run and points at production).
 */

import { describe, it, expect } from "vitest";
import { CLIENT_PROJECT_SELECT, WITHHELD_FIELDS } from "./projection";

describe("CLIENT_PROJECT_SELECT", () => {
  it("contains none of the withheld fields", () => {
    const selected = Object.keys(CLIENT_PROJECT_SELECT);
    for (const forbidden of WITHHELD_FIELDS) {
      expect(
        selected,
        `${forbidden} must never be selectable on a client link`
      ).not.toContain(forbidden);
    }
  });

  it("is exactly the agreed field set — no more, no less", () => {
    // An exact match, not a subset check: a subset check would let a new
    // field in silently as long as it wasn't on the withheld list. Adding a
    // column to a client-visible page should require editing this line.
    expect(Object.keys(CLIENT_PROJECT_SELECT).sort()).toEqual(
      [
        "endDate",
        "gate",
        "id",
        "location",
        "name",
        "projectNumber",
        "startDate",
        "type",
      ].sort()
    );
  });

  it("selects every named column (no `false` entries)", () => {
    for (const [key, value] of Object.entries(CLIENT_PROJECT_SELECT)) {
      expect(value, `${key} should be selected with true`).toBe(true);
    }
  });

  it("never names the internal status label", () => {
    // Called out on its own because it is the one the owner decided
    // personally: a client sees dates and a written note, never
    // ON_TRACK / AT_RISK / OFF_TRACK.
    expect(Object.keys(CLIENT_PROJECT_SELECT)).not.toContain("status");
    expect(WITHHELD_FIELDS).toContain("status");
  });

  it("is frozen, so a caller cannot widen the shared select", () => {
    expect(Object.isFrozen(CLIENT_PROJECT_SELECT)).toBe(true);
    expect(Object.isFrozen(WITHHELD_FIELDS)).toBe(true);
  });

  it("withholds the commercial and tenancy columns by name", () => {
    for (const f of [
      "budget",
      "currency",
      "status",
      "notes",
      "workspaceId",
      "visibility",
      "clientName",
    ]) {
      expect(WITHHELD_FIELDS).toContain(f);
    }
  });
});
