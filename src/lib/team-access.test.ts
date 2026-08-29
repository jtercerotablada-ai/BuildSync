import { describe, it, expect } from "vitest";
import {
  teamArchiveWhere,
  requireTeamMemberManagement,
  assertTeamAcceptsNewMembers,
  type TeamStanding,
} from "@/lib/team-access";

/**
 * The DB-free half of the team rule. `requireTeamStanding` and
 * `assertWorkspaceContributors` both do I/O and are exercised against the
 * live database; everything below decides an outcome from a plain object, so
 * it can and must be pinned here — the whole point of moving these rules out
 * of four route files was that a silent change of mind in one of them stops
 * being possible.
 */

function standing(over: Partial<TeamStanding> = {}): TeamStanding {
  return {
    teamId: "t1",
    teamName: "Recertification",
    workspaceId: "w1",
    isArchived: false,
    privacy: "PUBLIC",
    isMember: true,
    teamRole: "MEMBER",
    isLead: false,
    workspaceRole: "MEMBER",
    isWorkspaceManager: false,
    canRead: true,
    canManageMembers: false,
    canInviteOutsiders: false,
    ...over,
  };
}

describe("teamArchiveWhere", () => {
  it("hides archived teams by default", () => {
    expect(teamArchiveWhere(null)).toEqual({ isArchived: false });
  });

  it("returns only the archive for ?archived=true", () => {
    expect(teamArchiveWhere("true")).toEqual({ isArchived: true });
    expect(teamArchiveWhere("1")).toEqual({ isArchived: true });
  });

  it("returns both for ?archived=all", () => {
    expect(teamArchiveWhere("all")).toEqual({});
  });

  it("fails closed on anything it does not recognise", () => {
    // A typo must never widen the list back to including archived teams —
    // that is the bug the flag exists to fix.
    for (const junk of ["", "yes", "TRUE", "0", "false", "undefined", "["]) {
      expect(teamArchiveWhere(junk)).toEqual({ isArchived: false });
    }
  });
});

describe("requireTeamMemberManagement", () => {
  it("admits a team lead", () => {
    expect(() =>
      requireTeamMemberManagement(
        standing({ teamRole: "LEAD", isLead: true, canManageMembers: true })
      )
    ).not.toThrow();
  });

  it("admits a workspace OWNER/ADMIN who is not a lead", () => {
    expect(() =>
      requireTeamMemberManagement(
        standing({
          workspaceRole: "ADMIN",
          isWorkspaceManager: true,
          canManageMembers: true,
        })
      )
    ).not.toThrow();
  });

  it("refuses an ordinary member", () => {
    expect(() => requireTeamMemberManagement(standing())).toThrow(
      /Only team leads or workspace admins/
    );
  });
});

describe("assertTeamAcceptsNewMembers", () => {
  it("allows an active team", () => {
    expect(() => assertTeamAcceptsNewMembers(standing())).not.toThrow();
  });

  it("refuses an archived team, matching POST /api/teams/:id/join", () => {
    expect(() =>
      assertTeamAcceptsNewMembers(standing({ isArchived: true }))
    ).toThrow(/archived/);
  });
});
