import { describe, expect, it } from "vitest";
import {
  daysSince,
  eventText,
  formatBytes,
  formatDay,
  formatDayCount,
  holderCounts,
  initialsOf,
  issueNameFor,
  lastOutcome,
  matchesSearch,
  overdueDays,
  partyFieldLabel,
  statusTone,
  toDateInput,
  todayInput,
} from "./deliverable-format";

// Local midnight, as useToday() returns it.
const today = new Date(2026, 8, 21); // Sep 21, 2026

describe("formatDay (date-only fields)", () => {
  it("reads the UTC calendar day, never the local one", () => {
    // Stored at UTC midnight; in Miami this instant is Sep 27 at 8pm.
    expect(formatDay("2026-09-28T00:00:00.000Z", today)).toBe("Sep 28");
  });
  it("adds the year outside today's year", () => {
    expect(formatDay("2025-12-31T00:00:00.000Z", today)).toBe("Dec 31, 2025");
  });
  it("dashes a missing or bad value", () => {
    expect(formatDay(null)).toBe("—");
    expect(formatDay("nope")).toBe("—");
  });
});

describe("date inputs", () => {
  it("round-trips a UTC-midnight value to YYYY-MM-DD", () => {
    expect(toDateInput("2026-09-28T00:00:00.000Z")).toBe("2026-09-28");
    expect(toDateInput(null)).toBe("");
  });
  it("sends the viewer's local day", () => {
    expect(todayInput(today)).toBe("2026-09-21");
  });
});

describe("day counts", () => {
  it("counts calendar days since a timestamp", () => {
    expect(daysSince(new Date(2026, 8, 18, 23, 59).toISOString(), today)).toBe(3);
    expect(daysSince(new Date(2026, 8, 21, 9).toISOString(), today)).toBe(0);
  });
  it("is overdue only after the due day", () => {
    expect(overdueDays("2026-09-21T00:00:00.000Z", today)).toBe(0);
    expect(overdueDays("2026-09-18T00:00:00.000Z", today)).toBe(3);
    expect(overdueDays("2026-09-30T00:00:00.000Z", today)).toBe(0);
    expect(overdueDays(null, today)).toBe(0);
  });
  it("formats counts", () => {
    expect(formatDayCount(0)).toBe("today");
    expect(formatDayCount(4)).toBe("4d");
  });
});

describe("statusTone", () => {
  it("is gold on our or the PE's desk, slate elsewhere, faded closed", () => {
    expect(statusTone(true, "FIRM")).toBe("ours");
    expect(statusTone(true, "PE")).toBe("ours");
    expect(statusTone(true, "CITY")).toBe("theirs");
    expect(statusTone(false, "NONE")).toBe("closed");
  });
});

describe("lastOutcome", () => {
  it("documents show the issue", () => {
    expect(
      lastOutcome(
        {
          kind: "DOCUMENT",
          status: "ISSUED",
          respondedAt: null,
          currentRevision: {
            issuedAt: "2026-09-22T00:00:00.000Z",
            issuedToParty: "CLIENT",
            disposition: null,
          },
        },
        today
      )
    ).toBe("Sep 22 → Client");
  });
  it("submittals show the disposition, RFIs the answer day", () => {
    expect(
      lastOutcome({
        kind: "SUBMITTAL",
        status: "CLOSED",
        respondedAt: null,
        currentRevision: { issuedAt: null, issuedToParty: null, disposition: "APPROVED_AS_NOTED" },
      })
    ).toBe("Approved as noted");
    expect(
      lastOutcome(
        { kind: "RFI", status: "ANSWERED", respondedAt: "2026-09-14T00:00:00.000Z", currentRevision: null },
        today
      )
    ).toBe("Answered Sep 14");
    expect(lastOutcome({ kind: "RFI", status: "OPEN", respondedAt: null, currentRevision: null })).toBeNull();
  });
  it("a reopened RFI does not show its old answer date", () => {
    expect(
      lastOutcome(
        { kind: "RFI", status: "OPEN", respondedAt: "2026-09-14T00:00:00.000Z", currentRevision: null },
        today
      )
    ).toBe("Reopened");
    expect(
      lastOutcome(
        { kind: "RFI", status: "VOID", respondedAt: "2026-09-14T00:00:00.000Z", currentRevision: null },
        today
      )
    ).toBeNull();
  });
});

describe("holderCounts", () => {
  it("counts open items per desk in a fixed order and drops zeros", () => {
    expect(
      holderCounts([
        { open: true, holder: "PE" },
        { open: true, holder: "FIRM" },
        { open: true, holder: "FIRM" },
        { open: false, holder: "NONE" },
        { open: true, holder: "CITY" },
      ])
    ).toEqual([
      { holder: "FIRM", count: 2 },
      { holder: "PE", count: 1 },
      { holder: "CITY", count: 1 },
    ]);
  });
});

describe("small helpers", () => {
  it("searches number and title case-insensitively", () => {
    expect(matchesSearch({ number: "S-101", title: "Framing plan" }, "s-1")).toBe(true);
    expect(matchesSearch({ number: "S-101", title: "Framing plan" }, "FRAMING")).toBe(true);
    expect(matchesSearch({ number: "S-101", title: "Framing plan" }, "roof")).toBe(false);
  });
  it("labels the party field per kind", () => {
    expect(partyFieldLabel("RFI")).toBe("Asked by");
    expect(partyFieldLabel("SUBMITTAL")).toBe("Submitted by");
    expect(partyFieldLabel("DOCUMENT")).toBe("Usual recipient");
  });
  it("formats bytes and initials", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(initialsOf("Juan Tercero")).toBe("JT");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("issueNameFor", () => {
  const project = { clientContactName: "Ana Ruiz", jurisdiction: "City of Hialeah", clientName: "Bayview Condo Assn." };
  it("prefers the project's own contact for the party", () => {
    expect(issueNameFor("CLIENT", project, "Board")).toBe("Ana Ruiz");
    expect(issueNameFor("CITY", project, "Board")).toBe("City of Hialeah");
  });
  it("falls back to the usual recipient, then the client name (client only)", () => {
    expect(issueNameFor("CLIENT", { clientName: "Bayview" }, null)).toBe("Bayview");
    expect(issueNameFor("CITY", { clientName: "Bayview" }, null)).toBe("");
    expect(issueNameFor("CITY", { clientName: "Bayview" }, "Miami-Dade")).toBe("Miami-Dade");
    expect(issueNameFor("CONTRACTOR", project, "ABC Builders")).toBe("ABC Builders");
  });
});

describe("eventText", () => {
  const labels = {
    eventLabel: (t: string) =>
      ({ SEALED: "Sealed", SEAL_REVOKED: "Seal revoked", ISSUED: "Issued", STATUS: "Changed status", CREATED: "Created", REVISION_DELETED: "Deleted revision", ANSWER_EDITED: "Edited answer" } as Record<string, string>)[t] ?? t,
    statusLabel: (s: string) => (s === "VOID" ? "Void" : s),
  };
  const ev = (type: string, note: string | null, revisionLabel: string | null = null, toStatus: string | null = null) =>
    eventText({ type, note, revisionLabel, toStatus }, labels);
  it("drops a repeated revision prefix from the note", () => {
    expect(ev("SEALED", "Rev 0 · PE 12345", "0")).toBe("Sealed Rev 0 — PE 12345");
    expect(ev("SEALED", "Rev 0", "0")).toBe("Sealed Rev 0");
    expect(ev("ISSUED", "Rev 0 → Client: Bayview", "0")).toBe("Issued Rev 0 → Client: Bayview");
  });
  it("words revocations, status changes and creations", () => {
    expect(ev("SEAL_REVOKED", "wrong sheet set (Rev 0 sealed by Juan on 2026-09-21)", "0")).toBe(
      "Seal revoked on Rev 0 — wrong sheet set (Rev 0 sealed by Juan on 2026-09-21)"
    );
    expect(ev("STATUS", null, null, "VOID")).toBe("Changed status to Void");
    expect(ev("CREATED", "D-001")).toBe("Created");
  });
  it("keeps a deleted revision's label from the note", () => {
    expect(ev("REVISION_DELETED", "Rev 1")).toBe("Deleted revision Rev 1");
    expect(ev("ANSWER_EDITED", "Old answer")).toBe("Edited answer — Old answer");
  });
});
