import { describe, expect, it } from "vitest";

import {
  blockedCellParts,
  blockedCellTitle,
  cascadeToastNames,
  cascadeToastTitle,
  daysFrom,
  deadlineMarkerLabel,
  deadlineMarkerTitle,
  dependencyMeaning,
  dueRangeText,
  gridColumnsNeeded,
  MAX_GRID_COLUMNS,
  resolveBlockedBy,
  sectionStageChip,
  UNNAMEABLE_BLOCKER_LABEL,
  type DependencyRow,
} from "./gantt-view";

// Dates arrive from the API as UTC-midnight instants; these strings are
// exactly what the client receives.
const utc = (day: string) => `${day}T00:00:00.000Z`;
// "Today" as the hook hands it over: local midnight of the viewer's day.
const localDay = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("daysFrom", () => {
  it("counts whole calendar days forward", () => {
    expect(daysFrom(localDay(2026, 8, 28), utc("2026-09-04"))).toBe(7);
  });

  it("returns 0 for a task due today", () => {
    expect(daysFrom(localDay(2026, 8, 28), utc("2026-08-28"))).toBe(0);
  });

  it("goes negative for an overdue task", () => {
    expect(daysFrom(localDay(2026, 8, 28), utc("2026-08-18"))).toBe(-10);
  });

  it("counts by the calendar, not by 24h blocks, across a DST change", () => {
    // Nov 1 2026 is the US fall-back: the Nov 1 → Nov 2 "day" is 25 hours.
    // A wall-clock difference truncates that to 0 extra days.
    expect(daysFrom(localDay(2026, 10, 31), utc("2026-11-03"))).toBe(3);
  });

  it("measures from the DAY it is given, never from the clock", () => {
    // The bug this exists for: at 20:00 Miami the server's own day is
    // already tomorrow, so a task due today counted as -1 (overdue).
    const dueToday = utc("2026-08-28");
    expect(daysFrom(localDay(2026, 8, 28), dueToday)).toBe(0);
    expect(daysFrom(localDay(2026, 8, 29), dueToday)).toBe(-1);
  });
});

describe("dueRangeText", () => {
  it("says Today for a task due on the given day", () => {
    expect(
      dueRangeText({ startDate: null, dueDate: utc("2026-08-28") }, localDay(2026, 8, 28))
    ).toBe("Today");
  });

  it("collapses a same-day range to the single label", () => {
    expect(
      dueRangeText(
        { startDate: utc("2026-09-14"), dueDate: utc("2026-09-14") },
        localDay(2026, 8, 28)
      )
    ).toBe("Sep 14");
  });

  it("keeps the month off the second date inside one month", () => {
    expect(
      dueRangeText(
        { startDate: utc("2026-09-14"), dueDate: utc("2026-09-18") },
        localDay(2026, 8, 28)
      )
    ).toBe("Sep 14 – 18");
  });

  it("ends a range with Today when it closes on the given day", () => {
    expect(
      dueRangeText(
        { startDate: utc("2026-08-24"), dueDate: utc("2026-08-28") },
        localDay(2026, 8, 28)
      )
    ).toBe("Aug 24 – Today");
  });

  it("never says Today before today is known", () => {
    // useToday() is null on the server render and the first client render.
    // The plain date is right in every timezone; "Today" would be a guess
    // made from the server's UTC clock.
    expect(dueRangeText({ startDate: null, dueDate: utc("2026-08-28") }, null)).toBe(
      "Aug 28"
    );
    expect(
      dueRangeText({ startDate: utc("2026-08-24"), dueDate: utc("2026-08-28") }, null)
    ).toBe("Aug 24 – 28");
  });

  it("names the start of a task that has no end date yet", () => {
    // "the field survey starts the 14th, we do not know yet when it
    // closes" — the em dash this printed said "no date" about the one
    // date the task does carry.
    expect(
      dueRangeText({ startDate: utc("2026-09-14"), dueDate: null }, localDay(2026, 8, 28))
    ).toBe("Starts Sep 14");
  });

  it("has no range to show for a task with no dates at all", () => {
    expect(dueRangeText({ startDate: null, dueDate: null }, localDay(2026, 8, 28))).toBe(
      "—"
    );
  });
});

// ============================================
// "Blocked by" resolution
// ============================================

const dep = (
  id: string,
  blockingTaskId: string,
  dependentTaskId = "t-report"
): DependencyRow => ({
  id,
  type: "FINISH_TO_START",
  dependentTaskId,
  blockingTaskId,
});

const names = (pairs: [string, string][]) => new Map(pairs);

describe("resolveBlockedBy", () => {
  it("marks a blocker that is on screen as visible", () => {
    const out = resolveBlockedBy(
      [dep("d1", "t-field")],
      names([["t-field", "Field inspection complete"]]),
      new Set(["t-field", "t-report"])
    );
    expect(out.get("t-report")).toEqual([
      {
        dep: dep("d1", "t-field"),
        name: "Field inspection complete",
        visibility: "visible",
      },
    ]);
  });

  it("keeps the NAME of a blocker the filter removed from the rows", () => {
    // The live bug: completing "Field inspection complete" and ticking
    // Filter → Incomplete tasks dropped it from `sections`, the name lookup
    // lost it, and the cell fell back to "—" — the same thing a task with no
    // blocker at all shows.
    const out = resolveBlockedBy(
      [dep("d1", "t-field")],
      names([["t-field", "Field inspection complete"]]),
      new Set(["t-report"])
    );
    expect(out.get("t-report")).toEqual([
      {
        dep: dep("d1", "t-field"),
        name: "Field inspection complete",
        visibility: "hidden",
      },
    ]);
  });

  it("admits a blocker it cannot name instead of dropping the row", () => {
    // /api/projects/:id/dependencies applies no privacy filter; the project
    // page applies taskPrivacyClause. So the edge can arrive with no task
    // behind it, and the old `if (!name) continue` deleted the whole row.
    const out = resolveBlockedBy([dep("d1", "t-private")], names([]), new Set());
    expect(out.get("t-report")).toEqual([
      { dep: dep("d1", "t-private"), name: null, visibility: "unnameable" },
    ]);
  });

  it("groups every blocker under its dependent task", () => {
    const out = resolveBlockedBy(
      [dep("d1", "t-field"), dep("d2", "t-permit"), dep("d3", "t-field", "t-seal")],
      names([
        ["t-field", "Field inspection complete"],
        ["t-permit", "Permit issued"],
      ]),
      new Set(["t-field"])
    );
    expect(out.get("t-report")?.map((b) => b.name)).toEqual([
      "Field inspection complete",
      "Permit issued",
    ]);
    expect(out.get("t-seal")?.map((b) => b.visibility)).toEqual(["visible"]);
  });
});

describe("blockedCellParts", () => {
  it("folds every unnameable blocker into one placeholder", () => {
    // Rendering one per row would publish how many private tasks are
    // blocking this one — the count the placeholder exists not to say.
    const blockers = resolveBlockedBy(
      [dep("d1", "t-private-a"), dep("d2", "t-private-b")],
      names([]),
      new Set()
    ).get("t-report")!;
    expect(blockedCellParts(blockers)).toEqual([
      { key: "d1", label: UNNAMEABLE_BLOCKER_LABEL, visibility: "unnameable" },
    ]);
  });

  it("keeps a hidden blocker's own name, marked hidden", () => {
    const blockers = resolveBlockedBy(
      [dep("d1", "t-field"), dep("d2", "t-permit")],
      names([
        ["t-field", "Field inspection complete"],
        ["t-permit", "Permit issued"],
      ]),
      new Set(["t-permit"])
    ).get("t-report")!;
    expect(blockedCellParts(blockers)).toEqual([
      {
        key: "d1",
        label: "Field inspection complete",
        visibility: "hidden",
      },
      { key: "d2", label: "Permit issued", visibility: "visible" },
    ]);
  });

  it("has nothing to render for a task with no blockers", () => {
    expect(blockedCellParts([])).toEqual([]);
  });
});

describe("blockedCellTitle", () => {
  it("says why a muted name is muted, so it is not read as deleted", () => {
    const blockers = resolveBlockedBy(
      [dep("d1", "t-field"), dep("d2", "t-private")],
      names([["t-field", "Field inspection complete"]]),
      new Set()
    ).get("t-report")!;
    expect(blockedCellTitle(blockers)).toBe(
      "Field inspection complete (hidden by the current filter), " +
        `${UNNAMEABLE_BLOCKER_LABEL} (blocking this task, but not visible to you)`
    );
  });

  it("leaves a visible blocker's name alone", () => {
    const blockers = resolveBlockedBy(
      [dep("d1", "t-field")],
      names([["t-field", "Field inspection complete"]]),
      new Set(["t-field"])
    ).get("t-report")!;
    expect(blockedCellTitle(blockers)).toBe("Field inspection complete");
  });
});

describe("dependencyMeaning", () => {
  // The wording has to match `edgeAnchor()` in lib/dependency-cascade: the
  // server pushes one field of the dependent to be no earlier than one date
  // of the blocker, and never pulls a task in. "Starts when the blocker
  // finishes" would promise something the cascade does not do.
  it("names the constrained field and the anchor for each type", () => {
    expect(dependencyMeaning("FINISH_TO_START")).toBe(
      "starts no earlier than the blocker finishes"
    );
    expect(dependencyMeaning("START_TO_START")).toBe(
      "starts no earlier than the blocker starts"
    );
    expect(dependencyMeaning("FINISH_TO_FINISH")).toBe(
      "finishes no earlier than the blocker finishes"
    );
    expect(dependencyMeaning("START_TO_FINISH")).toBe(
      "finishes no earlier than the blocker starts"
    );
  });
});

describe("cascadeToastTitle / cascadeToastNames", () => {
  const shift = (taskName: string) => ({ taskId: taskName, taskName });

  it("says nothing when nothing downstream moved", () => {
    expect(cascadeToastTitle([])).toBeNull();
    expect(cascadeToastTitle(undefined)).toBeNull();
    expect(cascadeToastNames([])).toBeNull();
  });

  it("names the one task that moved, exactly as the task panel does", () => {
    // Same sentence as task-detail-panel's date picker: a drag here and a
    // date typed there run the identical server cascade.
    expect(cascadeToastTitle([shift("Submit BSIP package")])).toBe(
      'Shifted dependent "Submit BSIP package"'
    );
    // One task is already named in the title — no second line.
    expect(cascadeToastNames([shift("Submit BSIP package")])).toBeNull();
  });

  it("counts several and lists their names underneath", () => {
    const shifts = [shift("Draft report"), shift("PE seal"), shift("File")];
    expect(cascadeToastTitle(shifts)).toBe("Shifted 3 dependent tasks");
    expect(cascadeToastNames(shifts)).toBe("Draft report, PE seal, File");
  });

  it("counts the tail rather than overflowing the toast", () => {
    const shifts = Array.from({ length: 9 }, (_, i) => shift(`T${i}`));
    expect(cascadeToastNames(shifts)).toBe("T0, T1, T2, T3 +5 more");
  });
});

describe("deadlineMarkerLabel", () => {
  const deadline = new Date(2026, 8, 30); // Sep 30 2026, local midnight

  it("states the date and claims nothing before the browser has a clock", () => {
    // useToday() is null on the server render and the first client render.
    // The only clock available then is the server's UTC one, which west of
    // UTC is already tomorrow.
    expect(deadlineMarkerLabel(deadline, null)).toBe("Deadline · Sep 30");
  });

  it("says the deadline is today", () => {
    expect(deadlineMarkerLabel(deadline, new Date(2026, 8, 30))).toBe(
      "Deadline today"
    );
  });

  it("says a past deadline has passed", () => {
    expect(deadlineMarkerLabel(deadline, new Date(2026, 9, 5))).toBe(
      "Deadline passed · Sep 30"
    );
  });

  it("states a future deadline plainly", () => {
    expect(deadlineMarkerLabel(deadline, new Date(2026, 7, 29))).toBe(
      "Deadline · Sep 30"
    );
  });
});

describe("deadlineMarkerTitle", () => {
  const deadline = new Date(2026, 8, 30);

  it("names the project so the line cannot be read as a task", () => {
    expect(
      deadlineMarkerTitle(deadline, new Date(2026, 7, 29), "1200 Ocean Recert")
    ).toBe("1200 Ocean Recert — deadline Sep 30, 2026 · 32 days left");
  });

  it("works without a project name", () => {
    expect(deadlineMarkerTitle(deadline, null)).toBe("deadline Sep 30, 2026");
  });

  it("counts the days past due", () => {
    expect(deadlineMarkerTitle(deadline, new Date(2026, 9, 1))).toBe(
      "deadline Sep 30, 2026 · 1 day past due"
    );
    expect(deadlineMarkerTitle(deadline, new Date(2026, 9, 10))).toBe(
      "deadline Sep 30, 2026 · 10 days past due"
    );
  });

  it("says due today on the day", () => {
    expect(deadlineMarkerTitle(deadline, new Date(2026, 8, 30))).toBe(
      "deadline Sep 30, 2026 · due today"
    );
  });

  it("singularises one day left", () => {
    expect(deadlineMarkerTitle(deadline, new Date(2026, 8, 29))).toBe(
      "deadline Sep 30, 2026 · 1 day left"
    );
  });
});

describe("sectionStageChip", () => {
  it("reports the desk, and the label only as hover text", () => {
    // A section HAS a stage because it was named as one, so the label is
    // the section's own heading — printing it in the chip beside that
    // heading says the same words twice. `desk` is the fact the header did
    // not already carry.
    expect(sectionStageChip("recert.submitted_to_city")).toEqual({
      label: "Submitted to City",
      desk: "With the city",
    });
    // The other half of the recert question: not the county, us.
    expect(sectionStageChip("recert.field_work")).toEqual({
      label: "Field Work",
      desk: "On our desk",
    });
  });

  it("degrades silently for a section with no stage", () => {
    // Most projects, and every synthetic `group:*` bucket. The header has to
    // look exactly as it did before the chip existed.
    expect(sectionStageChip(null)).toBeNull();
    expect(sectionStageChip(undefined)).toBeNull();
    expect(sectionStageChip("")).toBeNull();
  });

  it("degrades silently for a key no pipeline defines", () => {
    expect(sectionStageChip("recert.deleted_stage")).toBeNull();
  });
});

describe("gridColumnsNeeded", () => {
  const sep1 = new Date(2026, 8, 1);
  const day = (n: number) => new Date(2026, 8, 1 + n);

  it("counts one column per day, plus the trailing pad", () => {
    expect(gridColumnsNeeded("day", sep1, day(120))).toBe(134);
  });

  it("divides by the unit the zoom draws in", () => {
    expect(gridColumnsNeeded("week", sep1, day(70))).toBe(14);
    expect(gridColumnsNeeded("month", sep1, day(280))).toBe(12);
    expect(gridColumnsNeeded("quarter", sep1, day(336))).toBe(5);
  });

  it("prices a far-off deadline past the cap, which is what stops it", () => {
    // The bug: Project.endDate was folded into the window unconditionally and
    // the column count was then clamped, so the grid stopped BEFORE the work
    // and the chart rendered no bars, no brackets and no today line. The
    // window may only be widened while this stays inside the cap.
    const countyDateTwoYearsBack = new Date(2024, 5, 1);
    expect(
      gridColumnsNeeded("day", countyDateTwoYearsBack, day(60))
    ).toBeGreaterThan(MAX_GRID_COLUMNS);
    // The same deadline at Quarters comfortably fits — the cap is a budget
    // in COLUMNS, not a rule about how far away a date may be.
    expect(
      gridColumnsNeeded("quarter", countyDateTwoYearsBack, day(60))
    ).toBeLessThanOrEqual(MAX_GRID_COLUMNS);
  });

  it("a deadline inside the plan costs nothing extra", () => {
    // 500 days of work at Days zoom is already over budget with no deadline
    // involved; the widening test must not be what reports that.
    expect(gridColumnsNeeded("day", sep1, day(400))).toBeLessThanOrEqual(
      MAX_GRID_COLUMNS
    );
  });
});

describe("cascadeToastTitle / cascadeToastNames — no-op shifts", () => {
  // The server folds a diamond re-visit into ONE shift entry and rewrites its
  // new* fields, so a shift can come back ending where it began. The Activity
  // feed skips those (cascade-activity.ts), and the toast has to agree or the
  // drag says "3 tasks moved" over a history holding two rows.
  const shift = (
    taskName: string,
    oldEnd: string | null,
    newEnd: string | null
  ) => ({
    taskId: taskName,
    taskName,
    oldStart: null,
    newStart: null,
    oldEnd,
    newEnd,
  });

  it("does not count a shift that ended where it started", () => {
    expect(
      cascadeToastTitle([
        shift("Draft report", utc("2026-09-18"), utc("2026-09-25")),
        shift("PE seal", utc("2026-09-18"), utc("2026-09-18")),
      ])
    ).toBe('Shifted dependent "Draft report"');
  });

  it("says nothing at all when every shift is a no-op", () => {
    expect(
      cascadeToastTitle([shift("PE seal", utc("2026-09-18"), utc("2026-09-18"))])
    ).toBeNull();
  });

  it("names only the tasks that moved", () => {
    expect(
      cascadeToastNames([
        shift("Draft report", utc("2026-09-18"), utc("2026-09-25")),
        shift("PE seal", utc("2026-09-18"), utc("2026-09-18")),
        shift("File with the county", utc("2026-09-20"), utc("2026-09-27")),
      ])
    ).toBe("Draft report, File with the county");
  });

  it("still counts a shift that carries no dates at all", () => {
    // Nothing to disprove the move with — the caller was told it happened.
    expect(
      cascadeToastTitle([{ taskId: "t1", taskName: "Draft report" }])
    ).toBe('Shifted dependent "Draft report"');
  });
});
