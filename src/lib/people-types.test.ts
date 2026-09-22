import { describe, expect, it } from "vitest";
import {
  canChangeWorkspaceRole,
  canRemoveWorkspaceMember,
} from "@/lib/people-types";

describe("canChangeWorkspaceRole", () => {
  it("lets only an owner change someone else's non-owner role", () => {
    expect(canChangeWorkspaceRole("OWNER", "ADMIN", false)).toBe(true);
    expect(canChangeWorkspaceRole("OWNER", "MEMBER", false)).toBe(true);
    expect(canChangeWorkspaceRole("ADMIN", "MEMBER", false)).toBe(false);
    expect(canChangeWorkspaceRole("ADMIN", "ADMIN", false)).toBe(false);
    expect(canChangeWorkspaceRole("MEMBER", "GUEST", false)).toBe(false);
    expect(canChangeWorkspaceRole(null, "GUEST", false)).toBe(false);
  });

  it("never re-roles an owner or yourself", () => {
    expect(canChangeWorkspaceRole("OWNER", "OWNER", false)).toBe(false);
    expect(canChangeWorkspaceRole("OWNER", "OWNER", true)).toBe(false);
  });
});

describe("canRemoveWorkspaceMember", () => {
  it("lets anyone leave", () => {
    expect(canRemoveWorkspaceMember("GUEST", "GUEST", true)).toBe(true);
    expect(canRemoveWorkspaceMember("ADMIN", "ADMIN", true)).toBe(true);
  });

  it("lets an owner remove anyone", () => {
    for (const role of ["OWNER", "ADMIN", "MEMBER", "WORKER", "GUEST"]) {
      expect(canRemoveWorkspaceMember("OWNER", role, false)).toBe(true);
    }
  });

  it("keeps an admin to regular members", () => {
    expect(canRemoveWorkspaceMember("ADMIN", "MEMBER", false)).toBe(true);
    expect(canRemoveWorkspaceMember("ADMIN", "WORKER", false)).toBe(true);
    expect(canRemoveWorkspaceMember("ADMIN", "GUEST", false)).toBe(true);
    expect(canRemoveWorkspaceMember("ADMIN", "ADMIN", false)).toBe(false);
    expect(canRemoveWorkspaceMember("ADMIN", "OWNER", false)).toBe(false);
  });

  it("refuses everyone else", () => {
    expect(canRemoveWorkspaceMember("MEMBER", "GUEST", false)).toBe(false);
    expect(canRemoveWorkspaceMember(undefined, "GUEST", false)).toBe(false);
  });
});
