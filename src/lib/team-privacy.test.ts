import { describe, it, expect } from "vitest";
import {
  TEAM_PRIVACY_META,
  teamJoinMode,
  teamInviteLinkCaption,
  teamPrivacyMeta,
} from "./team-privacy";

/**
 * These three functions decide what a team screen OFFERS. The bugs they
 * exist to prevent are all the same shape: a control that renders for
 * someone the route will refuse, or a caption that promises more than the
 * route allows.
 */

describe("teamPrivacyMeta", () => {
  it("labels all three privacy values distinctly", () => {
    const labels = (["PUBLIC", "REQUEST_TO_JOIN", "PRIVATE"] as const).map(
      (p) => teamPrivacyMeta(p).label
    );
    expect(new Set(labels).size).toBe(3);
  });

  it("never calls REQUEST_TO_JOIN public", () => {
    // The Private/Public ternary this replaced told the firm that a
    // "membership by request" team was open to anyone.
    expect(teamPrivacyMeta("REQUEST_TO_JOIN").label).not.toBe(
      TEAM_PRIVACY_META.PUBLIC.label
    );
  });

  it("falls back to a real badge for a value the schema grows later", () => {
    expect(teamPrivacyMeta("SOMETHING_NEW").label).toBe(
      TEAM_PRIVACY_META.PUBLIC.label
    );
  });
});

describe("teamJoinMode", () => {
  it("only PUBLIC joins instantly", () => {
    expect(teamJoinMode("PUBLIC")).toBe("INSTANT");
    expect(teamJoinMode("REQUEST_TO_JOIN")).toBe("REQUEST");
    expect(teamJoinMode("PRIVATE")).toBe("INVITE_ONLY");
  });

  it("treats an unknown privacy as invite-only", () => {
    // Unreachable while Team.privacy is a Prisma enum, and the reason this
    // has to fail closed anyway: POST /join branches on PRIVATE and
    // REQUEST_TO_JOIN and then falls through to a self-join, so a value it
    // does not recognise would let anyone in. The UI must not be the thing
    // that offers that button.
    expect(teamJoinMode("")).toBe("INVITE_ONLY");
    expect(teamJoinMode("SOMETHING_NEW")).toBe("INVITE_ONLY");
  });
});

describe("teamInviteLinkCaption", () => {
  it("never claims anyone with the link can join", () => {
    // The old copy said exactly that. /api/teams/:id/join requires
    // workspace membership before it even looks at privacy.
    for (const p of ["PUBLIC", "REQUEST_TO_JOIN", "PRIVATE", undefined]) {
      expect(teamInviteLinkCaption(p).toLowerCase()).not.toContain("anyone");
    }
  });

  it("says a lead approves on a request-to-join team", () => {
    expect(teamInviteLinkCaption("REQUEST_TO_JOIN")).toMatch(/lead/i);
    expect(teamInviteLinkCaption("REQUEST_TO_JOIN")).toMatch(/request/i);
  });

  it("does not promise a join on a private team", () => {
    expect(teamInviteLinkCaption("PRIVATE")).toMatch(/private/i);
  });

  it("gives unknown privacy the narrowest wording, not the widest", () => {
    expect(teamInviteLinkCaption(undefined)).toBe(
      teamInviteLinkCaption("PRIVATE")
    );
  });
});
