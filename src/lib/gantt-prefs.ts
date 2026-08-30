/**
 * The Gantt's remembered view state, per user and per project.
 *
 * WHY THIS EXISTS. Zoom, collapsed sections, "Show dependencies" and
 * "Highlight due soon" were plain useState in gantt-view.tsx, and switching
 * tabs unmounts that component (the tab strip is a router.push on the same
 * route, so only the view swaps). Set Days, click List, come back — Months.
 * Reload — Months. On a 40-year recertification that is not a cosmetic
 * annoyance: at Months zoom a four-month plan stacks every bar into ~40px,
 * so the chart the owner actually reads had to be re-dialled several times a
 * day. The house rule is DB-first for anything a user chose, so this lives in
 * `uiState` and follows them to whichever machine they open next.
 *
 * The pure half lives here — the shape, the validation, the cap and the
 * eviction order — because a React hook is not testable in this suite
 * (vitest runs node, no jsdom).
 */

/** `uiState` sub-key. Dotted like "project.starred" / "calendar.showWeekends". */
export const GANTT_PREFS_KEY = "gantt.viewPrefs";

/**
 * How many projects' Gantt settings we carry.
 *
 * uiState is ONE JSON column shared by every remembered preference in the
 * product and the API rejects a merged payload over 32KB, so a map keyed by
 * project id has to be bounded or it eventually breaks every other write for
 * that user. Worst case here is 10 × (30 ids × ~27 chars) ≈ 9KB, which leaves
 * room for the rest; a three-person firm never approaches it.
 */
export const MAX_REMEMBERED_GANTT_PROJECTS = 10;

/** Collapsed section ids kept per project — see the arithmetic above. */
export const MAX_REMEMBERED_COLLAPSED_SECTIONS = 30;

export type GanttZoomLevel = "day" | "week" | "month" | "quarter";

const ZOOM_LEVELS: readonly GanttZoomLevel[] = [
  "day",
  "week",
  "month",
  "quarter",
];

export function isGanttZoomLevel(value: unknown): value is GanttZoomLevel {
  return (
    typeof value === "string" &&
    (ZOOM_LEVELS as readonly string[]).includes(value)
  );
}

export interface GanttProjectPrefs {
  zoom: GanttZoomLevel;
  /** Section ids the user has folded shut. Always written whole — see below. */
  collapsedSectionIds: string[];
  showDependencies: boolean;
  highlightDueSoon: boolean;
}

/**
 * What an unvisited project opens at.
 *
 * `zoom: "day"` is deliberate and is a CHANGE: this chart used to open at
 * "month" because Asana's does, but Asana is not drawing a recertification.
 * Four months at Months zoom is ~40px of bar for the whole engagement — every
 * task on top of every other one. The Timeline next door opens at day and is
 * readable; these two are the same chart in two files and now agree. A
 * remembered preference always wins over this.
 */
export const DEFAULT_GANTT_PREFS: Readonly<GanttProjectPrefs> = Object.freeze({
  zoom: "day" as GanttZoomLevel,
  collapsedSectionIds: [] as string[],
  showDependencies: true,
  highlightDueSoon: false,
});

/**
 * `uiState["gantt.viewPrefs"]`, keyed by project id.
 *
 * `null` is a tombstone for an evicted project: the server's uiState merge
 * (api/users/preferences PATCH) adds and overwrites keys but never deletes
 * them, so an entry we drop from the payload is simply resurrected from the
 * stored row on the next read. Overwriting it with null costs a few bytes and
 * actually removes it.
 */
export type GanttPrefsMap = Record<
  string,
  GanttProjectPrefs | null | undefined
>;

/** A stable empty map — useUiState holds its default in useState's
 *  initialiser, so a fresh object per render would be a lie to read. */
export const EMPTY_GANTT_PREFS_MAP: GanttPrefsMap = Object.freeze({});

/**
 * A synthetic group-by column, e.g. "group:d:week".
 *
 * project-content rebuilds the section list into these buckets when the List's
 * Group-by is on, and their ids encode the bucket, not a row in the database:
 * "group:d:week" means "due this week" and refers to a different set of tasks
 * every week. Remembering one collapsed is remembering nothing, and it would
 * sit in the map forever, so they are dropped on the way in.
 */
function isSyntheticSectionId(id: string): boolean {
  return id.startsWith("group:");
}

/**
 * This user's settings for one project, defaults filled in.
 *
 * Every field is validated rather than trusted. The value comes out of a JSON
 * column that older builds, another tab and a hand-edited row can all have
 * written, and a bad `zoom` here is not a wrong label — `zoomConfig[zoom]` is
 * an object lookup that would be undefined and take the whole chart down.
 */
export function ganttPrefsFor(
  map: GanttPrefsMap | null | undefined,
  projectId: string
): GanttProjectPrefs {
  const entry = map?.[projectId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return { ...DEFAULT_GANTT_PREFS, collapsedSectionIds: [] };
  }
  // Through `unknown`: the declared type is what we HOPE is stored, and every
  // read below exists because the JSON column can hold something else.
  const raw = entry as unknown as Record<string, unknown>;
  const collapsed = Array.isArray(raw.collapsedSectionIds)
    ? raw.collapsedSectionIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    : [];
  return {
    zoom: isGanttZoomLevel(raw.zoom) ? raw.zoom : DEFAULT_GANTT_PREFS.zoom,
    collapsedSectionIds: collapsed.filter((id) => !isSyntheticSectionId(id)),
    showDependencies:
      typeof raw.showDependencies === "boolean"
        ? raw.showDependencies
        : DEFAULT_GANTT_PREFS.showDependencies,
    highlightDueSoon:
      typeof raw.highlightDueSoon === "boolean"
        ? raw.highlightDueSoon
        : DEFAULT_GANTT_PREFS.highlightDueSoon,
  };
}

/**
 * The whole map to write after one project's settings changed.
 *
 * Mirrors `nextProjectTabOrderMap` in lib/project-views: the project being
 * written is never evicted, and evicted or already-dead entries are emitted
 * as null tombstones (the server merges, see GanttPrefsMap).
 *
 * WHICH of the others is evicted is deliberately unspecified. `Object.entries`
 * walks the order the stored object hands back, and uiState is a Postgres
 * `jsonb` column, which normalizes key order rather than preserving insertion
 * order — so "the oldest goes" would be a claim this cannot keep past a
 * reload. All the cap promises is that the map stays bounded and that the
 * project being written survives; the cost of losing a slot is one project
 * opening at the defaults.
 *
 * Always hand this a COMPLETE GanttProjectPrefs, never a patch: the server's
 * deep merge is one level deep — it merges project ids into the map but
 * REPLACES the object stored under one — so a partial write silently drops
 * the fields it left out.
 */
export function nextGanttPrefsMap(
  current: GanttPrefsMap | null | undefined,
  projectId: string,
  prefs: GanttProjectPrefs,
  options?: { liveProjectIds?: Iterable<string>; limit?: number }
): GanttPrefsMap {
  const limit = Math.max(
    1,
    options?.limit ?? MAX_REMEMBERED_GANTT_PROJECTS
  );
  const live = options?.liveProjectIds ? new Set(options.liveProjectIds) : null;

  const kept: [string, GanttProjectPrefs][] = [];
  const tombstoned: string[] = [];
  for (const [pid, value] of Object.entries(current ?? {})) {
    if (pid === projectId) continue; // re-added below as the newest entry
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      // Already null on the server. Re-sending the tombstone is a no-op there
      // and makes this function's output stable across repeated writes.
      tombstoned.push(pid);
      continue;
    }
    if (live && !live.has(pid)) {
      tombstoned.push(pid);
      continue;
    }
    kept.push([pid, value]);
  }

  // One slot is reserved for the project being written.
  const room = Math.max(0, limit - 1);
  const cut = Math.max(0, kept.length - room);
  const evicted = kept.slice(0, cut);
  const survivors = kept.slice(cut);

  const next: GanttPrefsMap = {};
  for (const pid of tombstoned) next[pid] = null;
  for (const [pid] of evicted) next[pid] = null;
  for (const [pid, value] of survivors) next[pid] = value;
  next[projectId] = {
    zoom: isGanttZoomLevel(prefs.zoom) ? prefs.zoom : DEFAULT_GANTT_PREFS.zoom,
    // Deduped, synthetic buckets dropped, oldest-first truncation: the ids
    // arrive in the order the user folded them, so the cap keeps the folds
    // they have been living with rather than the last thirty they touched.
    collapsedSectionIds: [
      ...new Set(prefs.collapsedSectionIds.filter((id) => !isSyntheticSectionId(id))),
    ].slice(0, MAX_REMEMBERED_COLLAPSED_SECTIONS),
    showDependencies: prefs.showDependencies === true,
    highlightDueSoon: prefs.highlightDueSoon === true,
  };
  return next;
}

/** Whether two settings objects say the same thing. The caller checks this
 *  BEFORE calling useUiState's setter — the hook writes its cache and
 *  schedules the PATCH around its updater, so a no-op decided inside the
 *  updater still costs a network write. */
export function sameGanttPrefs(
  a: GanttProjectPrefs,
  b: GanttProjectPrefs
): boolean {
  return (
    a.zoom === b.zoom &&
    a.showDependencies === b.showDependencies &&
    a.highlightDueSoon === b.highlightDueSoon &&
    a.collapsedSectionIds.length === b.collapsedSectionIds.length &&
    a.collapsedSectionIds.every((id, i) => id === b.collapsedSectionIds[i])
  );
}
