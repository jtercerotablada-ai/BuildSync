import { describe, expect, it } from "vitest";

import {
  DEFAULT_GANTT_PREFS,
  MAX_REMEMBERED_COLLAPSED_SECTIONS,
  MAX_REMEMBERED_GANTT_PROJECTS,
  ganttPrefsFor,
  nextGanttPrefsMap,
  sameGanttPrefs,
  type GanttPrefsMap,
  type GanttProjectPrefs,
} from "./gantt-prefs";

const prefs = (over: Partial<GanttProjectPrefs> = {}): GanttProjectPrefs => ({
  zoom: "day",
  collapsedSectionIds: [],
  showDependencies: true,
  highlightDueSoon: false,
  ...over,
});

describe("ganttPrefsFor", () => {
  it("returns the defaults for a project that was never opened", () => {
    expect(ganttPrefsFor({}, "p1")).toEqual(DEFAULT_GANTT_PREFS);
    expect(ganttPrefsFor(null, "p1")).toEqual(DEFAULT_GANTT_PREFS);
    expect(ganttPrefsFor(undefined, "p1")).toEqual(DEFAULT_GANTT_PREFS);
  });

  it("opens at Days, not Months", () => {
    // The whole point of item 5's default change: four months of a recert at
    // Months zoom is ~40px of bar for the entire engagement.
    expect(DEFAULT_GANTT_PREFS.zoom).toBe("day");
  });

  it("reads a stored entry back verbatim", () => {
    const map: GanttPrefsMap = {
      p1: prefs({
        zoom: "week",
        collapsedSectionIds: ["s1", "s2"],
        showDependencies: false,
        highlightDueSoon: true,
      }),
    };
    expect(ganttPrefsFor(map, "p1")).toEqual({
      zoom: "week",
      collapsedSectionIds: ["s1", "s2"],
      showDependencies: false,
      highlightDueSoon: true,
    });
  });

  it("does not let one project's settings answer for another", () => {
    const map: GanttPrefsMap = { p1: prefs({ zoom: "quarter" }) };
    expect(ganttPrefsFor(map, "p2").zoom).toBe("day");
  });

  it("reads a tombstone as never-visited", () => {
    expect(ganttPrefsFor({ p1: null }, "p1")).toEqual(DEFAULT_GANTT_PREFS);
  });

  it("falls back on a zoom the chart cannot draw", () => {
    // zoomConfig[zoom] is an object lookup: an unknown key is `undefined` and
    // takes the whole chart down, not just its label.
    const map = { p1: { ...prefs(), zoom: "decade" } } as unknown as GanttPrefsMap;
    expect(ganttPrefsFor(map, "p1").zoom).toBe("day");
  });

  it("survives a garbage entry from an older build", () => {
    const map = {
      p1: {
        zoom: 4,
        collapsedSectionIds: "s1",
        showDependencies: "yes",
        highlightDueSoon: null,
      },
    } as unknown as GanttPrefsMap;
    expect(ganttPrefsFor(map, "p1")).toEqual(DEFAULT_GANTT_PREFS);
  });

  it("drops non-string and empty section ids", () => {
    const map = {
      p1: { ...prefs(), collapsedSectionIds: ["s1", "", 7, null, "s2"] },
    } as unknown as GanttPrefsMap;
    expect(ganttPrefsFor(map, "p1").collapsedSectionIds).toEqual(["s1", "s2"]);
  });

  it("ignores a synthetic group bucket that an older build stored", () => {
    const map: GanttPrefsMap = {
      p1: prefs({ collapsedSectionIds: ["group:d:week", "s1"] }),
    };
    expect(ganttPrefsFor(map, "p1").collapsedSectionIds).toEqual(["s1"]);
  });
});

describe("nextGanttPrefsMap", () => {
  it("writes the project it was given and leaves the others alone", () => {
    const current: GanttPrefsMap = { p1: prefs({ zoom: "week" }) };
    const next = nextGanttPrefsMap(current, "p2", prefs({ zoom: "quarter" }));
    expect(next.p1).toEqual(prefs({ zoom: "week" }));
    expect(next.p2?.zoom).toBe("quarter");
  });

  it("overwrites the project's whole entry rather than merging into it", () => {
    // The server's uiState merge is one level deep — it merges project ids
    // into the map but REPLACES the object under one — so the writer has to
    // emit every field or the omitted ones are lost.
    const current: GanttPrefsMap = {
      p1: prefs({ collapsedSectionIds: ["s1"], highlightDueSoon: true }),
    };
    const next = nextGanttPrefsMap(current, "p1", prefs({ zoom: "month" }));
    expect(next.p1).toEqual({
      zoom: "month",
      collapsedSectionIds: [],
      showDependencies: true,
      highlightDueSoon: false,
    });
  });

  it("never persists a synthetic group bucket", () => {
    const next = nextGanttPrefsMap({}, "p1", {
      ...prefs(),
      collapsedSectionIds: ["group:d:week", "s1", "group:assignee:u2"],
    });
    expect(next.p1?.collapsedSectionIds).toEqual(["s1"]);
  });

  it("dedupes collapsed ids", () => {
    const next = nextGanttPrefsMap({}, "p1", {
      ...prefs(),
      collapsedSectionIds: ["s1", "s1", "s2"],
    });
    expect(next.p1?.collapsedSectionIds).toEqual(["s1", "s2"]);
  });

  it("caps the collapsed list, keeping the oldest folds", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `s${i}`);
    const next = nextGanttPrefsMap({}, "p1", {
      ...prefs(),
      collapsedSectionIds: ids,
    });
    expect(next.p1?.collapsedSectionIds).toHaveLength(
      MAX_REMEMBERED_COLLAPSED_SECTIONS
    );
    expect(next.p1?.collapsedSectionIds[0]).toBe("s0");
  });

  it("evicts the least-recently-written project as a tombstone, not a deletion", () => {
    // A dropped key would just be resurrected from the stored row on the next
    // read: the server merges, it never replaces the map.
    const current: GanttPrefsMap = {};
    for (let i = 0; i < MAX_REMEMBERED_GANTT_PROJECTS; i++) {
      current[`p${i}`] = prefs();
    }
    const next = nextGanttPrefsMap(current, "new", prefs());
    expect(next.p0).toBeNull();
    expect(next.p1).toEqual(prefs());
    expect(next.new).toBeTruthy();
    expect(
      Object.values(next).filter((v) => v !== null && v !== undefined)
    ).toHaveLength(MAX_REMEMBERED_GANTT_PROJECTS);
  });

  it("never evicts the project being written", () => {
    const current: GanttPrefsMap = {};
    for (let i = 0; i < MAX_REMEMBERED_GANTT_PROJECTS + 5; i++) {
      current[`p${i}`] = prefs();
    }
    const next = nextGanttPrefsMap(current, "p0", prefs({ zoom: "month" }));
    expect(next.p0).toEqual(prefs({ zoom: "month" }));
  });

  it("re-emits an existing tombstone instead of dropping it", () => {
    const next = nextGanttPrefsMap({ dead: null }, "p1", prefs());
    expect(next.dead).toBeNull();
  });

  it("prunes projects the user can no longer see", () => {
    const current: GanttPrefsMap = { gone: prefs(), alive: prefs() };
    const next = nextGanttPrefsMap(current, "p1", prefs(), {
      liveProjectIds: ["alive", "p1"],
    });
    expect(next.gone).toBeNull();
    expect(next.alive).toEqual(prefs());
  });

  it("coerces a bad zoom on the way out too", () => {
    const next = nextGanttPrefsMap({}, "p1", {
      ...prefs(),
      zoom: "century" as never,
    });
    expect(next.p1?.zoom).toBe("day");
  });

  it("is stable when the same settings are written twice", () => {
    const once = nextGanttPrefsMap({ old: prefs() }, "p1", prefs());
    const twice = nextGanttPrefsMap(once, "p1", prefs());
    expect(twice).toEqual(once);
  });
});

describe("sameGanttPrefs", () => {
  it("is true for identical settings", () => {
    expect(sameGanttPrefs(prefs(), prefs())).toBe(true);
  });

  it("notices each field", () => {
    expect(sameGanttPrefs(prefs(), prefs({ zoom: "week" }))).toBe(false);
    expect(sameGanttPrefs(prefs(), prefs({ showDependencies: false }))).toBe(
      false
    );
    expect(sameGanttPrefs(prefs(), prefs({ highlightDueSoon: true }))).toBe(
      false
    );
    expect(
      sameGanttPrefs(prefs(), prefs({ collapsedSectionIds: ["s1"] }))
    ).toBe(false);
  });

  it("compares collapsed ids in order", () => {
    expect(
      sameGanttPrefs(
        prefs({ collapsedSectionIds: ["s1", "s2"] }),
        prefs({ collapsedSectionIds: ["s2", "s1"] })
      )
    ).toBe(false);
  });
});
