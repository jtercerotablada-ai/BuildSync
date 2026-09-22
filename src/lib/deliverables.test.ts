import { describe, expect, it, vi } from "vitest";

// storage.ts imports the blob SDK; nothing here touches the network.
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  head: vi.fn(),
}));

import {
  DELIVERABLE_KINDS,
  DELIVERABLE_STATUSES,
  DISPOSITIONS,
  compareDeliverableRows,
  decideDeliverableAction,
  decideSealAuthority,
  defaultDueDate,
  derivedStatus,
  hasPdf,
  holderFor,
  initialStatus,
  isOpen,
  manualStatuses,
  nextDeliverableNumber,
  nextRevisionLabel,
  normalizeCode,
  parseDateOnly,
  statusAfterReview,
  statusAfterRevisionDelete,
  statusAfterSealRequiredChange,
  type ActionPerms,
  type ActionRevisionState,
  type ActionState,
  type DeliverableActionInput,
  type DeliverableKind,
} from "./deliverables";
import {
  deliverableStageOffer,
  deliverableStageOfferPrompt,
  type DeliverableStageOfferInput,
} from "./stage-advance";
import { isStageValidForType, type StageHolder } from "./pipelines";
import { isDirectUploadPath, uploadFolderFor } from "./storage";
import { canMoveStage, decideProjectCapabilities } from "./project-access";

const VALID_HOLDERS: readonly StageHolder[] = [
  "FIRM",
  "PE",
  "CLIENT",
  "ARCHITECT",
  "CONTRACTOR",
  "CITY",
  "NONE",
];

// ─── 1. Registry integrity ─────────────────────────────────────────────────

describe("registry", () => {
  it("has exactly one initial status per kind", () => {
    for (const kind of DELIVERABLE_KINDS) {
      expect(DELIVERABLE_STATUSES[kind].filter((s) => s.initial)).toHaveLength(1);
    }
    expect(initialStatus("DOCUMENT")).toBe("IN_PROGRESS");
    expect(initialStatus("RFI")).toBe("OPEN");
    expect(initialStatus("SUBMITTAL")).toBe("UNDER_REVIEW");
  });

  it("has unique keys and valid holders", () => {
    for (const kind of DELIVERABLE_KINDS) {
      const keys = DELIVERABLE_STATUSES[kind].map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const s of DELIVERABLE_STATUSES[kind]) {
        if (s.holder === null) {
          // Only DOCUMENT ISSUED derives its holder from the party.
          expect([kind, s.key]).toEqual(["DOCUMENT", "ISSUED"]);
        } else {
          expect(VALID_HOLDERS).toContain(s.holder);
        }
      }
    }
  });

  it("is closed exactly for FINAL / VOID / ANSWERED / CLOSED", () => {
    const closed = new Set(["FINAL", "VOID", "ANSWERED", "CLOSED"]);
    for (const kind of DELIVERABLE_KINDS) {
      for (const s of DELIVERABLE_STATUSES[kind]) {
        expect(s.open).toBe(!closed.has(s.key));
        expect(isOpen(kind, s.key)).toBe(s.open);
      }
    }
  });
});

// ─── 2. manualStatuses ─────────────────────────────────────────────────────

describe("manualStatuses", () => {
  const allTargets = (kind: DeliverableKind) =>
    DELIVERABLE_STATUSES[kind].map((s) => ({
      from: s.key,
      to: manualStatuses(kind, s.key, { latestRevision: null }),
    }));

  it("never offers action-owned statuses except the specified exceptions", () => {
    for (const { from, to } of allTargets("DOCUMENT")) {
      for (const t of to) {
        if (from === "VOID") continue; // restore: derivedStatus
        expect(["SEALED", "AWAITING_SEAL"]).not.toContain(t);
        if (t === "ISSUED") expect(["COMMENTS", "FINAL"]).toContain(from);
      }
    }
    for (const { from, to } of allTargets("RFI")) {
      expect(to).not.toContain("ANSWERED");
      if (from === "ANSWERED") expect(to).toEqual(["OPEN"]);
    }
    for (const { from, to } of allTargets("SUBMITTAL")) {
      if (from === "VOID") continue;
      expect(to).not.toContain("RESUBMIT_REQUIRED");
      expect(to).not.toContain("CLOSED");
    }
  });

  it("offers COMMENTS only from ISSUED", () => {
    for (const { from, to } of allTargets("DOCUMENT")) {
      expect(to.includes("COMMENTS")).toBe(from === "ISSUED");
    }
  });

  it("offers FINAL only from ISSUED or COMMENTS", () => {
    for (const { from, to } of allTargets("DOCUMENT")) {
      expect(to.includes("FINAL")).toBe(from === "ISSUED" || from === "COMMENTS");
    }
    expect(manualStatuses("DOCUMENT", "IN_PROGRESS")).not.toContain("FINAL");
    expect(manualStatuses("DOCUMENT", "SEALED")).not.toContain("FINAL");
    expect(manualStatuses("DOCUMENT", "AWAITING_SEAL")).not.toContain("FINAL");
  });

  it("restores VOID to the derived status", () => {
    const issued = { issuedAt: new Date(), sealedAt: new Date() };
    expect(manualStatuses("DOCUMENT", "VOID", { latestRevision: issued })).toEqual(["ISSUED"]);
    expect(manualStatuses("DOCUMENT", "VOID", { latestRevision: { sealedAt: new Date() } })).toEqual(["SEALED"]);
    expect(manualStatuses("DOCUMENT", "VOID", { latestRevision: null })).toEqual(["IN_PROGRESS"]);
    expect(
      manualStatuses("SUBMITTAL", "VOID", { latestRevision: { disposition: "APPROVED" } })
    ).toEqual(["CLOSED"]);
    expect(manualStatuses("RFI", "VOID")).toEqual(["OPEN"]);
    expect(manualStatuses("DOCUMENT", "AWAITING_SEAL")).toEqual(["IN_PROGRESS", "VOID"]);
  });
});

// ─── 3. holderFor ──────────────────────────────────────────────────────────

describe("holderFor", () => {
  it("derives ISSUED from the party", () => {
    expect(holderFor("DOCUMENT", "ISSUED", "CITY")).toBe("CITY");
    expect(holderFor("DOCUMENT", "ISSUED", "CLIENT")).toBe("CLIENT");
    expect(holderFor("DOCUMENT", "ISSUED", "OTHER")).toBe("NONE");
    expect(holderFor("DOCUMENT", "ISSUED", null)).toBe("NONE");
  });
  it("reads fixed holders", () => {
    expect(holderFor("DOCUMENT", "AWAITING_SEAL")).toBe("PE");
    expect(holderFor("RFI", "AWAITING_INFO")).toBe("CONTRACTOR");
    expect(holderFor("SUBMITTAL", "RESUBMIT_REQUIRED")).toBe("CONTRACTOR");
    expect(holderFor("DOCUMENT", "bogus")).toBe("NONE");
  });
});

// ─── 4–7. Codes, numbers, dates ────────────────────────────────────────────

describe("nextRevisionLabel", () => {
  it.each([
    [null, "0"],
    ["0", "1"],
    ["9", "10"],
    ["A", "B"],
    ["Z", "AA"],
    ["AZ", "BA"],
    ["P1", "P2"],
    ["p9", "P10"],
    ["IFC", null],
    ["1.1", null],
  ])("%s → %s", (prev, next) => {
    expect(nextRevisionLabel(prev)).toBe(next);
  });
});

describe("nextDeliverableNumber", () => {
  it("starts at 001", () => {
    expect(nextDeliverableNumber("RFI", [])).toBe("RFI-001");
    expect(nextDeliverableNumber("DOCUMENT", [])).toBe("D-001");
    expect(nextDeliverableNumber("SUBMITTAL", [])).toBe("SUB-001");
  });
  it("goes one past the highest of its prefix, ignoring other shapes", () => {
    expect(nextDeliverableNumber("RFI", ["RFI-001", "RFI-007", "S-101"])).toBe("RFI-008");
  });
  it("is case-insensitive", () => {
    expect(nextDeliverableNumber("RFI", ["rfi-004", " Rfi-002 "])).toBe("RFI-005");
    expect(nextDeliverableNumber("DOCUMENT", ["d-009"])).toBe("D-010");
  });
});

describe("normalizeCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeCode(" s-101 ")).toBe("S-101");
    expect(normalizeCode("p1")).toBe("P1");
  });
});

describe("defaultDueDate", () => {
  const d = (s: string) => parseDateOnly(s)!;
  it("adds 7 / 14 / nothing", () => {
    expect(defaultDueDate("RFI", d("2026-09-21"))!.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(defaultDueDate("SUBMITTAL", d("2026-09-21"))!.toISOString()).toBe(
      "2026-10-05T00:00:00.000Z"
    );
    expect(defaultDueDate("DOCUMENT", d("2026-09-21"))).toBeNull();
  });
  it("rolls over the year", () => {
    expect(defaultDueDate("RFI", d("2026-12-28"))!.toISOString()).toBe("2027-01-04T00:00:00.000Z");
  });
  it("parses only real calendar days", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026-9-1")).toBeNull();
  });
});

// ─── 8–10. Derivation ──────────────────────────────────────────────────────

describe("statusAfterReview", () => {
  it("routes each disposition", () => {
    expect(statusAfterReview("APPROVED")).toBe("CLOSED");
    expect(statusAfterReview("APPROVED_AS_NOTED")).toBe("CLOSED");
    expect(statusAfterReview("REVISE_RESUBMIT")).toBe("RESUBMIT_REQUIRED");
    expect(statusAfterReview("REJECTED")).toBe("RESUBMIT_REQUIRED");
  });
});

describe("derivedStatus / statusAfterRevisionDelete", () => {
  it("derives documents", () => {
    const now = new Date();
    expect(derivedStatus("DOCUMENT", { issuedAt: now, sealedAt: now })).toBe("ISSUED");
    expect(derivedStatus("DOCUMENT", { sealedAt: now })).toBe("SEALED");
    expect(derivedStatus("DOCUMENT", {})).toBe("IN_PROGRESS");
    expect(derivedStatus("DOCUMENT", null)).toBe("IN_PROGRESS");
  });
  it("derives submittals and RFIs", () => {
    expect(statusAfterRevisionDelete("SUBMITTAL", { disposition: "REVISE_RESUBMIT" })).toBe(
      "RESUBMIT_REQUIRED"
    );
    expect(statusAfterRevisionDelete("SUBMITTAL", { disposition: "APPROVED" })).toBe("CLOSED");
    expect(statusAfterRevisionDelete("SUBMITTAL", { disposition: null })).toBe("UNDER_REVIEW");
    expect(statusAfterRevisionDelete("RFI", null)).toBe("OPEN");
  });
});

describe("statusAfterSealRequiredChange", () => {
  it("withdraws only a pending seal request", () => {
    expect(statusAfterSealRequiredChange("AWAITING_SEAL", true, false)).toBe("IN_PROGRESS");
    expect(statusAfterSealRequiredChange("SEALED", false, true)).toBe("SEALED");
    expect(statusAfterSealRequiredChange("ISSUED", false, true)).toBe("ISSUED");
    expect(statusAfterSealRequiredChange("IN_PROGRESS", true, false)).toBe("IN_PROGRESS");
  });
});

// ─── 11. Seal authority ────────────────────────────────────────────────────

describe("decideSealAuthority", () => {
  it("implicit for the OWNER", () => {
    expect(decideSealAuthority({ role: "OWNER", isContributor: true, sealAuthorizedAt: null })).toBe(true);
  });
  it("not for an ADMIN without authorization", () => {
    expect(decideSealAuthority({ role: "ADMIN", isContributor: true, sealAuthorizedAt: null })).toBe(false);
  });
  it("ignores Position: an ADMIN who set himself PROJECT_ENGINEER still cannot seal", () => {
    // The function takes no position input at all — a CAN_STAMP Position on
    // User.position (self-assignable by an OWNER/ADMIN) grants nothing.
    const input = {
      role: "ADMIN",
      isContributor: true,
      sealAuthorizedAt: null,
      position: "PROJECT_ENGINEER",
    } as unknown as Parameters<typeof decideSealAuthority>[0];
    expect(decideSealAuthority(input)).toBe(false);
  });
  it("granted to an authorized MEMBER", () => {
    expect(
      decideSealAuthority({ role: "MEMBER", isContributor: true, sealAuthorizedAt: new Date() })
    ).toBe(true);
  });
  it("never for a non-contributor, authorized or not", () => {
    for (const role of ["GUEST", "CLIENT"]) {
      expect(decideSealAuthority({ role, isContributor: false, sealAuthorizedAt: new Date() })).toBe(false);
    }
  });
});

// ─── 12. decideDeliverableAction ───────────────────────────────────────────

const NOW = new Date("2026-09-21T15:00:00.000Z");
const TODAY = new Date("2026-09-21T00:00:00.000Z");
const clock = { now: NOW, today: TODAY };

function rev(over: Partial<ActionRevisionState> = {}): ActionRevisionState {
  return {
    id: "r1",
    label: "0",
    fileCount: 1,
    hasPdf: true,
    sealedAt: null,
    sealedById: null,
    sealedByName: null,
    issuedAt: null,
    issuedById: null,
    issuedToParty: null,
    issuedTo: null,
    transmittalNote: null,
    disposition: null,
    reviewedAt: null,
    reviewedById: null,
    ...over,
  };
}

function state(over: Partial<ActionState> = {}): ActionState {
  return {
    kind: "DOCUMENT",
    status: "IN_PROGRESS",
    sealRequired: true,
    party: null,
    response: null,
    respondedAt: null,
    currentRevision: rev(),
    ...over,
  };
}

function perms(over: Partial<ActionPerms> = {}): ActionPerms {
  return {
    userId: "u1",
    actorName: "Juan Tercero",
    canWrite: true,
    canSeal: true,
    isWorkspaceOwner: true,
    isWorkspaceManager: true,
    peLicenseNo: "PE 12345",
    ...over,
  };
}

const decide = (s: ActionState, i: DeliverableActionInput, p: ActionPerms = perms()) =>
  decideDeliverableAction(s, i, p, clock);

function expectFail(r: ReturnType<typeof decide>, status: number, code?: string) {
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.status).toBe(status);
    if (code) expect(r.code).toBe(code);
  }
}
function expectOk(r: ReturnType<typeof decide>) {
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("decideDeliverableAction — shared rules", () => {
  const inputs: DeliverableActionInput[] = [
    { action: "REQUEST_SEAL", revisionId: "r1" },
    { action: "SEAL", revisionId: "r1" },
    { action: "REVOKE_SEAL", revisionId: "r1", reason: "x" },
    { action: "ISSUE", revisionId: "r1", issuedToParty: "CLIENT" },
    { action: "UNDO_ISSUE", revisionId: "r1" },
    { action: "REVIEW", revisionId: "r1", disposition: "APPROVED" },
    { action: "UNDO_REVIEW", revisionId: "r1" },
    { action: "ANSWER", response: "Use #5 bars." },
  ];
  const kindOf: Record<string, DeliverableKind> = {
    REQUEST_SEAL: "DOCUMENT",
    SEAL: "DOCUMENT",
    REVOKE_SEAL: "DOCUMENT",
    ISSUE: "DOCUMENT",
    UNDO_ISSUE: "DOCUMENT",
    REVIEW: "SUBMITTAL",
    UNDO_REVIEW: "SUBMITTAL",
    ANSWER: "RFI",
  };

  it("refuses every action × wrong kind with 400", () => {
    for (const input of inputs) {
      for (const kind of DELIVERABLE_KINDS) {
        if (kind === kindOf[input.action]) continue;
        expectFail(decide(state({ kind }), input), 400);
      }
    }
  });

  it("refuses every action without canWrite with 403", () => {
    for (const input of inputs) {
      const kind = kindOf[input.action];
      expectFail(decide(state({ kind }), input, perms({ canWrite: false })), 403);
    }
  });

  it("refuses a non-current revision with 409 for every revision-scoped action", () => {
    for (const input of inputs) {
      if (input.action === "ANSWER") continue;
      const kind = kindOf[input.action];
      expectFail(decide(state({ kind }), { ...input, revisionId: "old" } as DeliverableActionInput), 409);
    }
  });
});

describe("REQUEST_SEAL", () => {
  it("moves to AWAITING_SEAL and offers the stage", () => {
    const r = expectOk(decide(state(), { action: "REQUEST_SEAL", revisionId: "r1" }));
    expect(r.toStatus).toBe("AWAITING_SEAL");
    expect(r.event.type).toBe("SEAL_REQUESTED");
    expect(r.stageEvent).toEqual({ event: "SEAL_REQUESTED" });
  });
  it("needs a file", () => {
    expectFail(
      decide(state({ currentRevision: rev({ fileCount: 0, hasPdf: false }) }), {
        action: "REQUEST_SEAL",
        revisionId: "r1",
      }),
      409
    );
  });
  it("needs sealRequired", () => {
    expectFail(decide(state({ sealRequired: false }), { action: "REQUEST_SEAL", revisionId: "r1" }), 400);
  });
  it("is refused from SEALED", () => {
    expectFail(
      decide(state({ status: "SEALED", currentRevision: rev({ sealedAt: NOW }) }), {
        action: "REQUEST_SEAL",
        revisionId: "r1",
      }),
      409
    );
  });
});

describe("SEAL", () => {
  it("seals and snapshots name + license", () => {
    const r = expectOk(decide(state({ status: "AWAITING_SEAL" }), { action: "SEAL", revisionId: "r1" }));
    expect(r.toStatus).toBe("SEALED");
    expect(r.event.type).toBe("SEALED");
    expect(r.revisionPatch).toMatchObject({
      sealedAt: NOW,
      sealedById: "u1",
      sealedByName: "Juan Tercero",
      sealLicenseNo: "PE 12345",
    });
    expect(r.revisionGuard).toEqual({ sealedAt: null, issuedAt: null });
  });
  it("needs canSeal", () => {
    expectFail(decide(state(), { action: "SEAL", revisionId: "r1" }, perms({ canSeal: false })), 403);
  });
  it("needs a PDF", () => {
    expectFail(decide(state({ currentRevision: rev({ hasPdf: false }) }), { action: "SEAL", revisionId: "r1" }), 409);
  });
  it("refuses an already sealed revision", () => {
    expectFail(decide(state({ currentRevision: rev({ sealedAt: NOW }) }), { action: "SEAL", revisionId: "r1" }), 409);
  });
  it("refuses a revision issued unsealed", () => {
    expectFail(
      decide(state({ status: "COMMENTS", currentRevision: rev({ issuedAt: TODAY }) }), {
        action: "SEAL",
        revisionId: "r1",
      }),
      409
    );
  });
});

describe("REVOKE_SEAL", () => {
  const sealed = state({
    status: "SEALED",
    currentRevision: rev({ sealedAt: NOW, sealedById: "u1", sealedByName: "Juan Tercero" }),
  });
  it("revokes back to IN_PROGRESS and keeps the reason + who sealed", () => {
    const r = expectOk(decide(sealed, { action: "REVOKE_SEAL", revisionId: "r1", reason: "wrong sheet set" }));
    expect(r.toStatus).toBe("IN_PROGRESS");
    expect(r.event.type).toBe("SEAL_REVOKED");
    expect(r.event.note).toContain("wrong sheet set");
    expect(r.event.note).toContain("Juan Tercero");
    expect(r.revisionPatch).toMatchObject({ sealedAt: null, sealedByName: null });
  });
  it("refuses a non-sealer non-owner", () => {
    expectFail(
      decide(
        sealed,
        { action: "REVOKE_SEAL", revisionId: "r1", reason: "x" },
        perms({ userId: "u2", isWorkspaceOwner: false })
      ),
      403
    );
  });
  it("lets the OWNER revoke someone else's seal", () => {
    expectOk(
      decide(sealed, { action: "REVOKE_SEAL", revisionId: "r1", reason: "x" }, perms({ userId: "u9" }))
    );
  });
  it("refuses after issue", () => {
    expectFail(
      decide(
        state({
          status: "ISSUED",
          currentRevision: rev({ sealedAt: NOW, sealedById: "u1", issuedAt: TODAY }),
        }),
        { action: "REVOKE_SEAL", revisionId: "r1", reason: "x" }
      ),
      409
    );
  });
  it("needs a reason", () => {
    expectFail(decide(sealed, { action: "REVOKE_SEAL", revisionId: "r1", reason: "  " }), 400);
  });
});

describe("ISSUE", () => {
  it("asks before issuing an unsealed seal-required revision", () => {
    expectFail(
      decide(state(), { action: "ISSUE", revisionId: "r1", issuedToParty: "CLIENT" }),
      409,
      "UNSEALED"
    );
  });
  it("issues as preliminary with confirmation", () => {
    const r = expectOk(
      decide(state(), {
        action: "ISSUE",
        revisionId: "r1",
        issuedToParty: "CLIENT",
        issuedTo: "Bayview Condo Assn.",
        confirmUnsealed: true,
      })
    );
    expect(r.toStatus).toBe("ISSUED");
    expect(r.event.type).toBe("ISSUED");
    expect(r.event.note).toContain("preliminary");
    expect(r.event.note).toContain("Client: Bayview Condo Assn.");
    expect(r.revisionPatch).toMatchObject({ issuedAt: TODAY, issuedToParty: "CLIENT", issuedById: "u1" });
    expect(r.stageEvent).toEqual({ event: "ISSUED", issuedToParty: "CLIENT" });
  });
  it("issues a sealed revision without a preliminary note", () => {
    const r = expectOk(
      decide(state({ status: "SEALED", currentRevision: rev({ sealedAt: NOW }) }), {
        action: "ISSUE",
        revisionId: "r1",
        issuedToParty: "CITY",
      })
    );
    expect(r.event.note).not.toContain("preliminary");
  });
  it("needs files", () => {
    expectFail(
      decide(state({ currentRevision: rev({ fileCount: 0, hasPdf: false }) }), {
        action: "ISSUE",
        revisionId: "r1",
        issuedToParty: "CLIENT",
        confirmUnsealed: true,
      }),
      409
    );
  });
});

describe("UNDO_ISSUE", () => {
  const issued = (status: string, sealed = true) =>
    state({
      status,
      currentRevision: rev({
        sealedAt: sealed ? NOW : null,
        issuedAt: TODAY,
        issuedById: "u1",
        issuedToParty: "CITY",
      }),
    });
  it("returns to SEALED or IN_PROGRESS", () => {
    const a = expectOk(decide(issued("ISSUED"), { action: "UNDO_ISSUE", revisionId: "r1" }));
    expect(a.toStatus).toBe("SEALED");
    expect(a.event.type).toBe("ISSUE_UNDONE");
    const b = expectOk(decide(issued("ISSUED", false), { action: "UNDO_ISSUE", revisionId: "r1" }));
    expect(b.toStatus).toBe("IN_PROGRESS");
  });
  it("refuses after COMMENTS or FINAL", () => {
    expectFail(decide(issued("COMMENTS"), { action: "UNDO_ISSUE", revisionId: "r1" }), 409);
    expectFail(decide(issued("FINAL"), { action: "UNDO_ISSUE", revisionId: "r1" }), 409);
  });
  it("refuses a non-issuer MEMBER, allows an ADMIN", () => {
    expectFail(
      decide(
        issued("ISSUED"),
        { action: "UNDO_ISSUE", revisionId: "r1" },
        perms({ userId: "u2", isWorkspaceOwner: false, isWorkspaceManager: false })
      ),
      403
    );
    expectOk(
      decide(
        issued("ISSUED"),
        { action: "UNDO_ISSUE", revisionId: "r1" },
        perms({ userId: "u3", isWorkspaceOwner: false, isWorkspaceManager: true })
      )
    );
  });
});

describe("REVIEW / UNDO_REVIEW", () => {
  const sub = (over: Partial<ActionState> = {}) =>
    state({ kind: "SUBMITTAL", status: "UNDER_REVIEW", sealRequired: false, party: "ACME Steel", ...over });

  it("routes each disposition and returns it to the contractor", () => {
    for (const d of DISPOSITIONS) {
      const r = expectOk(decide(sub(), { action: "REVIEW", revisionId: "r1", disposition: d.key }));
      expect(r.toStatus).toBe(statusAfterReview(d.key));
      expect(r.event.type).toBe("REVIEWED");
      expect(r.event.note).toContain(d.label);
      expect(r.revisionPatch).toMatchObject({
        disposition: d.key,
        issuedToParty: "CONTRACTOR",
        issuedTo: "ACME Steel",
        issuedAt: TODAY,
      });
    }
  });
  it("refuses a second review", () => {
    expectFail(
      decide(sub({ status: "CLOSED", currentRevision: rev({ disposition: "APPROVED", reviewedAt: NOW }) }), {
        action: "REVIEW",
        revisionId: "r1",
        disposition: "APPROVED",
      }),
      409
    );
  });
  it("undoes the current cycle for the reviewer, not an older one", () => {
    const reviewed = sub({
      status: "RESUBMIT_REQUIRED",
      currentRevision: rev({ disposition: "REVISE_RESUBMIT", reviewedAt: NOW, reviewedById: "u2" }),
    });
    const r = expectOk(
      decide(
        reviewed,
        { action: "UNDO_REVIEW", revisionId: "r1" },
        perms({ userId: "u2", isWorkspaceManager: false, isWorkspaceOwner: false })
      )
    );
    expect(r.toStatus).toBe("UNDER_REVIEW");
    expect(r.event.type).toBe("REVIEW_UNDONE");
    expectFail(decide(reviewed, { action: "UNDO_REVIEW", revisionId: "older-cycle" }), 409);
  });
});

describe("ANSWER", () => {
  const rfi = (over: Partial<ActionState> = {}) =>
    state({ kind: "RFI", status: "OPEN", sealRequired: false, currentRevision: null, ...over });
  it("answers an open RFI", () => {
    const r = expectOk(decide(rfi(), { action: "ANSWER", response: "Use #5 @ 12\" o.c." }));
    expect(r.toStatus).toBe("ANSWERED");
    expect(r.event.type).toBe("ANSWERED");
    expect(r.itemPatch).toMatchObject({ respondedAt: TODAY, respondedById: "u1" });
  });
  it("edits an answer in place, keeping the previous text", () => {
    const r = expectOk(
      decide(rfi({ status: "ANSWERED", response: "old answer", respondedAt: TODAY }), {
        action: "ANSWER",
        response: "new answer",
      })
    );
    expect(r.toStatus).toBe("ANSWERED");
    expect(r.statusChanged).toBe(false);
    expect(r.event.type).toBe("ANSWER_EDITED");
    expect(r.event.note).toBe("old answer");
  });
  it("needs text", () => {
    expectFail(decide(rfi(), { action: "ANSWER", response: " " }), 400);
  });
});

// ─── 13. deliverableStageOffer ─────────────────────────────────────────────

describe("deliverableStageOffer", () => {
  const offer = (over: Partial<DeliverableStageOfferInput>) =>
    deliverableStageOffer({
      type: "RECERTIFICATION",
      stage: "recert.report_drafting",
      event: "SEAL_REQUESTED",
      canMoveStage: true,
      ...over,
    });

  it("recert", () => {
    expect(offer({})?.to.key).toBe("recert.awaiting_pe");
    expect(offer({ stage: "recert.awaiting_pe", event: "ISSUED", issuedToParty: "CLIENT" })?.to.key).toBe(
      "recert.submitted_to_client"
    );
    const jump = offer({ event: "ISSUED", issuedToParty: "CITY" });
    expect(jump?.to.key).toBe("recert.submitted_to_city");
    expect(deliverableStageOfferPrompt(jump!)).toBe("Move from Report Drafting to Submitted to City?");
    // backward: already past Awaiting PE
    expect(offer({ stage: "recert.city_comments" })).toBeNull();
    // same stage is not forward
    expect(offer({ stage: "recert.awaiting_pe" })).toBeNull();
    // terminal
    expect(offer({ stage: "recert.recertified", event: "ISSUED", issuedToParty: "CITY" })).toBeNull();
  });

  it("BSIP runs the recert pipeline", () => {
    expect(offer({ type: "BSIP" })?.to.key).toBe("recert.awaiting_pe");
  });

  it("design", () => {
    expect(offer({ type: "DESIGN", stage: "design.design_work" })?.to.key).toBe("design.awaiting_pe");
    expect(
      offer({ type: "DESIGN", stage: "design.awaiting_pe", event: "ISSUED", issuedToParty: "CLIENT" })?.to.key
    ).toBe("design.submitted_to_client");
    expect(
      offer({ type: "DESIGN", stage: "design.awaiting_pe", event: "ISSUED", issuedToParty: "CITY" })?.to.key
    ).toBe("design.submitted_to_city");
  });

  it("permit", () => {
    expect(offer({ type: "PERMIT", stage: "permit.preparing_submittal" })).toBeNull();
    expect(
      offer({ type: "PERMIT", stage: "permit.preparing_submittal", event: "ISSUED", issuedToParty: "CITY" })?.to.key
    ).toBe("permit.submitted_to_city");
  });

  it("construction", () => {
    const base = { type: "CONSTRUCTION" as const, stage: "construction.closeout_letters", event: "ISSUED" as const };
    expect(offer({ ...base, issuedToParty: "CITY" })?.to.key).toBe("construction.submitted_to_city");
    expect(offer({ ...base, issuedToParty: "CLIENT" })).toBeNull();
  });

  it("nulls", () => {
    expect(offer({ stage: "design.design_work" })).toBeNull(); // cross-pipeline
    expect(offer({ stage: null })).toBeNull();
    expect(offer({ type: null })).toBeNull();
    expect(offer({ canMoveStage: false })).toBeNull();
    expect(offer({ event: "ISSUED", issuedToParty: "OTHER" })).toBeNull();
  });

  it("every returned key is valid for the type", () => {
    const types = ["RECERTIFICATION", "BSIP", "DESIGN", "PERMIT", "CONSTRUCTION"] as const;
    const stages = [
      "recert.draft", "recert.field_work", "recert.report_drafting", "recert.awaiting_pe",
      "design.draft", "design.design_work", "design.awaiting_client_approval",
      "permit.preparing_submittal", "permit.awaiting_client_docs",
      "construction.draft", "construction.closeout_letters",
    ];
    for (const type of types) {
      for (const stage of stages) {
        for (const input of [
          { event: "SEAL_REQUESTED" as const },
          { event: "ISSUED" as const, issuedToParty: "CLIENT" },
          { event: "ISSUED" as const, issuedToParty: "CITY" },
        ]) {
          const o = deliverableStageOffer({ type, stage, canMoveStage: true, ...input });
          if (o) expect(isStageValidForType(type, o.to.key)).toBe(true);
        }
      }
    }
  });
});

// ─── 14. hasPdf ────────────────────────────────────────────────────────────

describe("hasPdf", () => {
  it("by mime, by extension, not for .dwg", () => {
    expect(hasPdf([{ name: "sealed", mimeType: "application/pdf" }])).toBe(true);
    expect(hasPdf([{ name: "S-101 SEALED.PDF", mimeType: "application/octet-stream" }])).toBe(true);
    expect(hasPdf([{ name: "S-101.dwg", mimeType: "application/octet-stream" }])).toBe(false);
    expect(hasPdf([])).toBe(false);
  });
});

// ─── 15. Upload path ───────────────────────────────────────────────────────

describe("deliverable upload path", () => {
  const UUID = "123e4567-e89b-42d3-a456-426614174000";
  it("pins the deliverable's folder", () => {
    expect(uploadFolderFor({ kind: "deliverable-file", deliverableId: "d1" })).toBe("deliverables/d1/");
    expect(isDirectUploadPath(`deliverables/d1/${UUID}/Report.pdf`, "deliverables/d1/")).toBe(true);
    expect(isDirectUploadPath("deliverables/d1/Report.pdf", "deliverables/d1/")).toBe(false);
    expect(isDirectUploadPath(`deliverables/d2/${UUID}/Report.pdf`, "deliverables/d1/")).toBe(false);
  });
});

// ─── 16. canMoveStage ──────────────────────────────────────────────────────

describe("canMoveStage", () => {
  const base = {
    visibility: "PRIVATE",
    projectWorkspaceId: "w1",
    viewerWorkspaceIds: ["w1"],
    isOwner: false,
    isMember: false,
    memberRole: null,
    isWorkspaceManager: false,
    isTeamMember: false,
  };
  it("is true for a workspace manager who isn't a project member", () => {
    expect(canMoveStage(decideProjectCapabilities({ ...base, isWorkspaceManager: true }))).toBe(true);
  });
  it("is true for a WORKSPACE-shared contributor", () => {
    expect(canMoveStage(decideProjectCapabilities({ ...base, visibility: "WORKSPACE" }))).toBe(true);
  });
  it("is false for a VIEWER member", () => {
    expect(
      canMoveStage(
        decideProjectCapabilities({ ...base, visibility: "WORKSPACE", isMember: true, memberRole: "VIEWER" })
      )
    ).toBe(false);
  });
});

// ─── List order ────────────────────────────────────────────────────────────

describe("compareDeliverableRows", () => {
  it("open first by due date (nulls last) then number; closed by updatedAt desc", () => {
    const rows = [
      { number: "D-010", open: true, dueDate: null, updatedAt: "2026-09-01" },
      { number: "D-002", open: false, dueDate: null, updatedAt: "2026-09-01" },
      { number: "D-9", open: true, dueDate: null, updatedAt: "2026-09-01" },
      { number: "D-003", open: true, dueDate: "2026-09-30", updatedAt: "2026-09-01" },
      { number: "D-004", open: false, dueDate: null, updatedAt: "2026-09-10" },
    ];
    expect([...rows].sort(compareDeliverableRows).map((r) => r.number)).toEqual([
      "D-003",
      "D-9",
      "D-010",
      "D-004",
      "D-002",
    ]);
  });
});
