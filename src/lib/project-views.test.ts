import { describe, expect, it } from "vitest";
import {
  BUILTIN_VIEWS,
  INITIALLY_HIDDEN_VIEWS,
  MAX_REMEMBERED_TAB_ORDERS,
  hasSavedTabOrder,
  nextProjectTabOrderMap,
  nextTabOrder,
  resolveProjectTabs,
  savedTabOrderFor,
  tabOrderKeys,
  type BuiltinViewDef,
  type ProjectViewPrefRow,
  type ProjectViewTab,
} from "./project-views";

/**
 * THE TAB STRIP.
 *
 * resolveProjectTabs decides what the owner sees every single time he opens a
 * project, and it merges two sources that belong to different people: the
 * project's ProjectViewPref rows (shared by the whole firm) and one user's
 * saved arrangement (his alone). Two failure modes are unacceptable and both
 * are silent, so they are pinned here rather than left to a code review:
 *
 *   1. a strip that MOVES for someone who never dragged anything — the whole
 *      point of "no saved order renders today's order";
 *   2. a stale or corrupt saved order that blanks the strip, drops a tab, or
 *      renders one twice.
 *
 * The expectations below are written out by hand, not derived from
 * BUILTIN_VIEWS, on purpose: deriving them would make a reordered catalog
 * "pass" while every existing user's strip silently rearranged on deploy.
 */

// The catalog as of today. Copied, not imported — see the note above.
const CATALOG_ORDER = [
  "overview",
  "list",
  "board",
  "timeline",
  "dashboard",
  "calendar",
  "gantt",
  "workflow",
  "messages",
  "files",
  "notes",
  "workload",
];

const MOBILE_ONLY_MD_UP = ["workflow", "messages", "files", "notes", "workload"];

function keysOf(tabs: ProjectViewTab[]): string[] {
  return tabs.map((t) => t.viewKey);
}

/** A ProjectViewPref row, with the columns this feature never sets defaulted. */
function pref(row: Partial<ProjectViewPrefRow> & { viewKey: string }): ProjectViewPrefRow {
  return {
    baseView: row.viewKey,
    label: null,
    hidden: false,
    isDefault: false,
    position: 0,
    ...row,
  };
}

describe("resolveProjectTabs — no saved order", () => {
  it("renders the exact catalog strip when the project has no prefs at all", () => {
    // The no-visible-change-on-deploy guarantee. Asserted as the whole array,
    // field by field, because "contains the right keys" would not have caught
    // a lost label or a flipped `mobile`.
    expect(resolveProjectTabs({ prefs: [] })).toEqual([
      { viewKey: "overview", baseView: "overview", label: "Overview", mobile: true, isCopy: false, isDefault: false },
      { viewKey: "list", baseView: "list", label: "List", mobile: true, isCopy: false, isDefault: false },
      { viewKey: "board", baseView: "board", label: "Board", mobile: true, isCopy: false, isDefault: false },
      { viewKey: "timeline", baseView: "timeline", label: "Timeline", mobile: true, isCopy: false, isDefault: false },
      { viewKey: "dashboard", baseView: "dashboard", label: "Dashboard", mobile: true, isCopy: false, isDefault: false },
      { viewKey: "calendar", baseView: "calendar", label: "Calendar", mobile: true, isCopy: false, isDefault: false },
      { viewKey: "gantt", baseView: "gantt", label: "Gantt", mobile: true, isCopy: false, isDefault: false },
      { viewKey: "workflow", baseView: "workflow", label: "Workflow", mobile: false, isCopy: false, isDefault: false },
      { viewKey: "messages", baseView: "messages", label: "Messages", mobile: false, isCopy: false, isDefault: false },
      { viewKey: "files", baseView: "files", label: "Files", mobile: false, isCopy: false, isDefault: false },
      { viewKey: "notes", baseView: "notes", label: "Notes", mobile: false, isCopy: false, isDefault: false },
      { viewKey: "workload", baseView: "workload", label: "Workload", mobile: false, isCopy: false, isDefault: false },
    ]);
  });

  it("is the same strip the catalog declares, in the catalog's own order", () => {
    // Guards the copy above against drifting from the source it mirrors.
    expect(keysOf(resolveProjectTabs({ prefs: [] }))).toEqual(CATALOG_ORDER);
    expect(BUILTIN_VIEWS.map((v) => v.key)).toEqual(CATALOG_ORDER);
    for (const v of BUILTIN_VIEWS) {
      expect(v.mobile).toBe(!MOBILE_ONLY_MD_UP.includes(v.key));
    }
  });

  it("renders the five seeded tabs for the 7-hidden-rows shape in production", () => {
    // Every project created since DEFAULT_VISIBLE_VIEWS shipped carries exactly
    // these seven hidden rows. This is the shape the owner is actually looking
    // at, so it is the one that must not move.
    const prefs = INITIALLY_HIDDEN_VIEWS.map((viewKey) =>
      pref({ viewKey, hidden: true })
    );
    expect(prefs).toHaveLength(7);
    expect(keysOf(resolveProjectTabs({ prefs }))).toEqual([
      "overview",
      "list",
      "board",
      "messages",
      "files",
    ]);
  });

  it("applies renames and isDefault, and skips hidden built-ins", () => {
    const tabs = resolveProjectTabs({
      prefs: [
        pref({ viewKey: "list", label: "  Punch list  " }),
        pref({ viewKey: "board", hidden: true }),
        pref({ viewKey: "timeline", isDefault: true }),
        // A blank rename is not a rename: the catalog label must win, or the
        // tab renders with no text on it.
        pref({ viewKey: "files", label: "   " }),
      ],
    });
    expect(keysOf(tabs)).toEqual(CATALOG_ORDER.filter((k) => k !== "board"));
    expect(tabs.find((t) => t.viewKey === "list")?.label).toBe("Punch list");
    expect(tabs.find((t) => t.viewKey === "files")?.label).toBe("Files");
    expect(tabs.find((t) => t.viewKey === "timeline")?.isDefault).toBe(true);
    expect(tabs.filter((t) => t.isDefault)).toHaveLength(1);
  });

  it("puts copies after the built-ins, ordered by position then key", () => {
    const tabs = resolveProjectTabs({
      prefs: [
        pref({ viewKey: "list-copy-b", baseView: "list", position: 2 }),
        pref({ viewKey: "list-copy-a", baseView: "list", position: 1 }),
        // Same position: the viewKey tie-break keeps the strip stable.
        pref({ viewKey: "board-copy-z", baseView: "board", position: 1 }),
        pref({ viewKey: "gone-copy", baseView: "list", hidden: true }),
        pref({ viewKey: "named-copy", baseView: "gantt", position: 9, label: "Gantt (client)" }),
      ],
    });
    expect(keysOf(tabs)).toEqual([
      ...CATALOG_ORDER,
      "board-copy-z",
      "list-copy-a",
      "list-copy-b",
      "named-copy",
    ]);
    const copy = tabs.find((t) => t.viewKey === "list-copy-a")!;
    expect(copy).toEqual({
      viewKey: "list-copy-a",
      baseView: "list",
      label: "List copy",
      mobile: true,
      isCopy: true,
      isDefault: false,
    });
    expect(tabs.find((t) => t.viewKey === "named-copy")?.label).toBe("Gantt (client)");
    // A copy of a base view that no longer exists still gets a label.
    const orphan = resolveProjectTabs({
      prefs: [pref({ viewKey: "x-copy", baseView: "nope" })],
    });
    expect(orphan.at(-1)?.label).toBe("View copy");
  });

  it("treats an empty saved order the same as no saved order", () => {
    // Different meanings — undefined is "never arranged", [] is a record that
    // names nothing (a pruned/evicted entry) — but the SAME render. An order
    // that names no tab must never blank the strip.
    const natural = resolveProjectTabs({ prefs: [] });
    expect(resolveProjectTabs({ prefs: [], savedOrder: [] })).toEqual(natural);
    expect(resolveProjectTabs({ prefs: [], savedOrder: null })).toEqual(natural);
    expect(resolveProjectTabs({ prefs: [], savedOrder: undefined })).toEqual(natural);
  });
});

describe("resolveProjectTabs — with a saved order", () => {
  const seeded: ProjectViewPrefRow[] = INITIALLY_HIDDEN_VIEWS.map((viewKey) =>
    pref({ viewKey, hidden: true })
  );

  it("honours a full saved order", () => {
    const savedOrder = ["files", "messages", "board", "list", "overview"];
    expect(keysOf(resolveProjectTabs({ prefs: seeded, savedOrder }))).toEqual(savedOrder);
  });

  it("appends the tabs a partial order does not name, in catalog order", () => {
    // He dragged Files to the front and never touched anything else.
    expect(
      keysOf(resolveProjectTabs({ prefs: seeded, savedOrder: ["files"] }))
    ).toEqual(["files", "overview", "list", "board", "messages"]);
  });

  it("skips a key whose tab has since been hidden by a colleague", () => {
    const prefs = [...seeded.filter((p) => p.viewKey !== "gantt"), pref({ viewKey: "gantt" }), pref({ viewKey: "board", hidden: true })];
    const savedOrder = ["gantt", "board", "overview", "list", "messages", "files"];
    // Board is gone from the project, so it is simply absent — the rest of his
    // arrangement survives intact.
    expect(keysOf(resolveProjectTabs({ prefs, savedOrder }))).toEqual([
      "gantt",
      "overview",
      "list",
      "messages",
      "files",
    ]);
  });

  it("ignores a key that no longer exists at all", () => {
    const savedOrder = ["files", "list-copy-deleted", "sunset-view", "overview"];
    expect(keysOf(resolveProjectTabs({ prefs: seeded, savedOrder }))).toEqual([
      "files",
      "overview",
      "list",
      "board",
      "messages",
    ]);
  });

  it("sends a built-in added to the catalog later to the END, not the front", () => {
    // His order predates the new tab. It must land last, where a new tab
    // belongs, instead of jumping to position zero.
    const catalog: BuiltinViewDef[] = [
      ...BUILTIN_VIEWS,
      { key: "budget", label: "Budget", mobile: false },
    ];
    const savedOrder = ["files", "overview", "list", "board", "messages"];
    expect(
      keysOf(resolveProjectTabs({ prefs: seeded, savedOrder, catalog }))
    ).toEqual([...savedOrder, "budget"]);
  });

  it("lets a copy be dragged in between built-ins", () => {
    const prefs = [
      ...seeded,
      pref({ viewKey: "list-copy-a", baseView: "list", position: 1 }),
      pref({ viewKey: "list-copy-b", baseView: "list", position: 2 }),
    ];
    const savedOrder = ["overview", "list-copy-b", "list", "list-copy-a", "board"];
    const tabs = resolveProjectTabs({ prefs, savedOrder });
    expect(keysOf(tabs)).toEqual([
      "overview",
      "list-copy-b",
      "list",
      "list-copy-a",
      "board",
      "messages",
      "files",
    ]);
    expect(tabs.find((t) => t.viewKey === "list-copy-b")?.isCopy).toBe(true);
  });

  it("renders a duplicated key exactly once, at its first mention", () => {
    // Two tabs with the same key would collide on React's key and on the
    // ?view= URL. First mention wins so the result is deterministic.
    const savedOrder = ["files", "list", "files", "overview", "list"];
    const tabs = resolveProjectTabs({ prefs: seeded, savedOrder });
    expect(keysOf(tabs)).toEqual(["files", "list", "overview", "board", "messages"]);
    expect(new Set(keysOf(tabs)).size).toBe(tabs.length);
  });

  it("never invents a tab the project has hidden", () => {
    // The saved order is per user; visibility is per project. A stale personal
    // order must not resurrect a tab the firm deleted.
    const savedOrder = [...CATALOG_ORDER].reverse();
    expect(keysOf(resolveProjectTabs({ prefs: seeded, savedOrder }))).toEqual([
      "files",
      "messages",
      "board",
      "list",
      "overview",
    ]);
  });

  it("does not mutate its inputs", () => {
    const prefs = [
      pref({ viewKey: "b-copy", baseView: "list", position: 5 }),
      pref({ viewKey: "a-copy", baseView: "list", position: 1 }),
    ];
    const savedOrder = ["files", "overview"];
    resolveProjectTabs({ prefs, savedOrder });
    expect(prefs.map((p) => p.viewKey)).toEqual(["b-copy", "a-copy"]);
    expect(savedOrder).toEqual(["files", "overview"]);
  });
});

describe("nextTabOrder", () => {
  const strip = ["overview", "list", "board", "messages", "files"];

  it("moves the first tab to last", () => {
    expect(nextTabOrder(strip, { type: "move", from: 0, to: 4 })).toEqual([
      "list",
      "board",
      "messages",
      "files",
      "overview",
    ]);
  });

  it("moves the last tab to first", () => {
    expect(nextTabOrder(strip, { type: "move", from: 4, to: 0 })).toEqual([
      "files",
      "overview",
      "list",
      "board",
      "messages",
    ]);
  });

  it("is a no-op when a tab is dropped onto itself", () => {
    expect(nextTabOrder(strip, { type: "move", from: 2, to: 2 })).toEqual(strip);
  });

  it("shifts a tab one slot without disturbing the rest", () => {
    expect(nextTabOrder(strip, { type: "move", from: 1, to: 2 })).toEqual([
      "overview",
      "board",
      "list",
      "messages",
      "files",
    ]);
  });

  it("clamps a drop past the end and ignores an impossible drag", () => {
    // A drag that races a re-render must not throw or produce holes.
    expect(nextTabOrder(strip, { type: "move", from: 0, to: 99 })).toEqual([
      "list",
      "board",
      "messages",
      "files",
      "overview",
    ]);
    expect(nextTabOrder(strip, { type: "move", from: -1, to: 0 })).toEqual(strip);
    expect(nextTabOrder(strip, { type: "move", from: 9, to: 0 })).toEqual(strip);
    expect(nextTabOrder([], { type: "move", from: 0, to: 0 })).toEqual([]);
  });

  it("appends a newly added view LAST — the whole point of ask #1", () => {
    expect(nextTabOrder(strip, { type: "append", viewKey: "gantt" })).toEqual([
      ...strip,
      "gantt",
    ]);
  });

  it("materialises the strip so a first-ever append still lands last", () => {
    // The user has never dragged anything, so there is no saved order yet.
    // Writing the strip he is looking at + the new key is what stops Gantt
    // from dropping back between Timeline and Dashboard.
    const rendered = resolveProjectTabs({
      prefs: INITIALLY_HIDDEN_VIEWS.map((viewKey) => pref({ viewKey, hidden: true })),
    });
    const written = nextTabOrder(rendered, { type: "append", viewKey: "gantt" });
    expect(written).toEqual(["overview", "list", "board", "messages", "files", "gantt"]);
    // And the next render honours it.
    const prefs = INITIALLY_HIDDEN_VIEWS.filter((k) => k !== "gantt").map((viewKey) =>
      pref({ viewKey, hidden: true })
    );
    expect(keysOf(resolveProjectTabs({ prefs, savedOrder: written }))).toEqual(written);
  });

  it("moves an already-present key to the end instead of duplicating it", () => {
    expect(nextTabOrder(strip, { type: "append", viewKey: "list" })).toEqual([
      "overview",
      "board",
      "messages",
      "files",
      "list",
    ]);
  });

  it("accepts either tab objects or plain keys, and de-dupes", () => {
    const tabs = resolveProjectTabs({ prefs: [] });
    expect(tabOrderKeys(tabs)).toEqual(CATALOG_ORDER);
    expect(tabOrderKeys(["a", "b", "a"])).toEqual(["a", "b"]);
  });
});

describe("projectTabOrder map", () => {
  it("reads a real order and rejects the empty shapes", () => {
    const map = { p1: ["files", "list"], p2: [], p3: null };
    expect(savedTabOrderFor(map, "p1")).toEqual(["files", "list"]);
    expect(savedTabOrderFor(map, "p2")).toBeUndefined();
    expect(savedTabOrderFor(map, "p3")).toBeUndefined();
    expect(savedTabOrderFor(map, "p4")).toBeUndefined();
    expect(savedTabOrderFor(undefined, "p1")).toBeUndefined();
    expect(hasSavedTabOrder(map, "p1")).toBe(true);
    expect(hasSavedTabOrder(map, "p2")).toBe(false);
    expect(hasSavedTabOrder(map, "p4")).toBe(false);
  });

  it("writes one project without touching the others", () => {
    const current = { p1: ["files"], p2: ["list"] };
    const next = nextProjectTabOrderMap(current, "p2", ["board", "list"]);
    expect(next).toEqual({ p1: ["files"], p2: ["board", "list"] });
    expect(current.p2).toEqual(["list"]); // input untouched
  });

  it("caps the map and never evicts the project being written", () => {
    // The PATCH merge FAILS once the whole uiState payload passes 32KB, taking
    // every other preference down with it, so the map is bounded.
    //
    // Eviction follows the key order of `current`, which is the order it was
    // built in HERE but not the order Postgres hands it back — uiState is a
    // jsonb column and jsonb re-sorts keys. So this pins the cap and the
    // "written project always survives" rule; it deliberately does not claim
    // the discarded entry is the least recently used in production.
    const current: Record<string, string[]> = {};
    for (let i = 0; i < MAX_REMEMBERED_TAB_ORDERS; i++) current[`p${i}`] = ["list"];
    const next = nextProjectTabOrderMap(current, "new", ["board"]);
    const live = Object.keys(next).filter((k) => Array.isArray(next[k]));
    expect(live).toHaveLength(MAX_REMEMBERED_TAB_ORDERS);
    expect(live).toContain("new");
    // Exactly one entry made room, and it was not the one just written.
    expect(Object.keys(next).filter((k) => next[k] === null)).toHaveLength(1);
    expect(next.p0).toBeNull();
    expect(next.p1).toEqual(["list"]);
  });

  it("tombstones an evicted entry instead of dropping it from the payload", () => {
    // The server MERGES uiState one level deep — it can overwrite a key but
    // never delete one. Omitting an evicted project would just resurrect its
    // old array from the row on the next read.
    const next = nextProjectTabOrderMap({ p1: ["files"], p2: ["list"] }, "p3", ["board"], {
      limit: 2,
    });
    expect(next).toEqual({ p1: null, p2: ["list"], p3: ["board"] });
    expect("p1" in next).toBe(true);
  });

  it("prunes projects the user can no longer see, when told which are live", () => {
    const next = nextProjectTabOrderMap({ gone: ["files"], p2: ["list"] }, "p2", ["board"], {
      liveProjectIds: ["p2", "p9"],
    });
    expect(next).toEqual({ gone: null, p2: ["board"] });
  });

  it("carries existing tombstones through unchanged", () => {
    const next = nextProjectTabOrderMap({ dead: null, p1: ["files"] }, "p1", ["list"]);
    expect(next).toEqual({ dead: null, p1: ["list"] });
  });

  it("is stable when the same write repeats", () => {
    const once = nextProjectTabOrderMap({ p1: ["files"] }, "p1", ["list"]);
    const twice = nextProjectTabOrderMap(once, "p1", ["list"]);
    expect(twice).toEqual(once);
  });
});
