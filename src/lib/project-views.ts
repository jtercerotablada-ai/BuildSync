// Catalog of the built-in project view tabs, shared by the server (default-
// view resolution, API validation) and the client (tab bar). No JSX here so
// it can be imported from route handlers and server components; the tab icons
// live in the client component keyed by `baseView`.

export interface BuiltinViewDef {
  /** URL key (`?view=<key>`) and tab identity. */
  key: string;
  /** Default tab label (overridable per-project via a rename). */
  label: string;
  /** Whether the tab is visible on mobile (icon-only) or md+ only. */
  mobile: boolean;
}

// Order matches Asana's default tab strip.
export const BUILTIN_VIEWS: BuiltinViewDef[] = [
  { key: "overview", label: "Overview", mobile: true },
  { key: "list", label: "List", mobile: true },
  { key: "board", label: "Board", mobile: true },
  { key: "timeline", label: "Timeline", mobile: true },
  { key: "dashboard", label: "Dashboard", mobile: true },
  { key: "calendar", label: "Calendar", mobile: true },
  { key: "gantt", label: "Gantt", mobile: true },
  { key: "workflow", label: "Workflow", mobile: false },
  { key: "messages", label: "Messages", mobile: false },
  { key: "files", label: "Files", mobile: false },
  { key: "notes", label: "Notes", mobile: false },
  { key: "workload", label: "Workload", mobile: false },
];

export const BUILTIN_VIEW_KEYS = new Set(BUILTIN_VIEWS.map((v) => v.key));

/**
 * The tabs a NEW project opens with. The catalog has twelve; a job that has
 * just been created has nothing to put in a Gantt, a Workload or a Dashboard,
 * so showing all twelve makes the ones that matter harder to find on the day
 * the project is busiest.
 *
 * Everything else is one click away under "+", which un-hides it — this seeds
 * a starting point, it does not remove anything. Existing projects are
 * untouched: the seed is written at creation, so a project that already shows
 * a tab keeps showing it.
 */
export const DEFAULT_VISIBLE_VIEWS = [
  "overview",
  "list",
  "board",
  "messages",
  "files",
] as const;

/** Built-ins a new project starts with hidden — the catalog minus the above. */
export const INITIALLY_HIDDEN_VIEWS = BUILTIN_VIEWS.filter(
  (v) => !(DEFAULT_VISIBLE_VIEWS as readonly string[]).includes(v.key)
).map((v) => v.key);


const BUILTIN_LABEL: Record<string, string> = Object.fromEntries(
  BUILTIN_VIEWS.map((v) => [v.key, v.label])
);

const BUILTIN_INDEX: Record<string, number> = Object.fromEntries(
  BUILTIN_VIEWS.map((v, i) => [v.key, i])
);

export function isBuiltinViewKey(key: string): boolean {
  return BUILTIN_VIEW_KEYS.has(key);
}

/** Default catalog label for a built-in view (falls back for unknown keys). */
export function baseLabelFor(baseView: string): string {
  return BUILTIN_LABEL[baseView] ?? "View";
}

/** Catalog position of a built-in view (used to order copies after it). */
export function baseIndexFor(baseView: string): number {
  return BUILTIN_INDEX[baseView] ?? BUILTIN_VIEWS.length;
}

// Every view key ProjectContent can actually render. Includes "team", which
// has no tab (Asana assigns teams at the team level) but still resolves for
// old deep links.
export const RENDERABLE_VIEWS = new Set<string>([...BUILTIN_VIEW_KEYS, "team"]);

// ── The tab strip: what it contains, and the order one user sees it in ──────
//
// Two decisions, deliberately kept apart:
//
//   WHAT the strip contains is a PROJECT decision, shared by the whole firm —
//   the `hidden` flag "+" toggles, renames, "Make a copy", "Delete". It lives
//   in ProjectViewPref, which is keyed @@unique([projectId, viewKey]) with no
//   userId, so every colleague sees the same set of tabs.
//
//   The ORDER is a PERSONAL decision — "por persona, cada quien acomoda sus
//   taps". It cannot live in ProjectViewPref for the same reason: there is no
//   userId on that row, so one person's drag would rearrange everybody's
//   strip. It is stored per user in UserPreferences.uiState instead (see
//   PROJECT_TAB_ORDER_KEY below), and it is only ever a list of view keys —
//   never a second copy of the labels or the hidden flags.
//
// Everything here is pure so it can be tested without a DOM: the tab strip is
// a client component and the suite is node-only.

/**
 * One ProjectViewPref row as the tab strip reads it. Structurally a subset of
 * the Prisma row (and of ProjectContent's serialized `viewPrefs`), so either
 * can be passed straight in.
 */
export interface ProjectViewPrefRow {
  viewKey: string;
  baseView: string;
  label: string | null;
  hidden: boolean;
  isDefault: boolean;
  position: number;
}

/** A resolved tab in the strip: a built-in view, or a "Make a copy" of one. */
export interface ProjectViewTab {
  viewKey: string;
  baseView: string;
  label: string;
  mobile: boolean;
  isCopy: boolean;
  isDefault: boolean;
}

/**
 * The tabs to render, in the order this user arranged them.
 *
 * WHAT is visible comes from the project (catalog minus hidden built-ins, plus
 * non-hidden copies) exactly as it did when this logic was inline in
 * ProjectContent. `savedOrder` only PERMUTES that list; it can never add a tab
 * the project has hidden, and never removes one it forgot to mention.
 *
 * The rule:
 *   1. the visible tabs named in `savedOrder`, in that order;
 *   2. then every other visible tab, in catalog order (copies last).
 *
 * A key in `savedOrder` that is hidden, deleted or simply unknown is skipped,
 * and a repeated key is honoured once — a stale or corrupt saved order must
 * never blank the strip, drop a tab, or render one twice.
 *
 * No saved order (undefined, null, or an empty array) renders EXACTLY today's
 * order. That is a hard requirement: nobody who has never dragged a tab may
 * see anything move.
 */
export function resolveProjectTabs(input: {
  prefs: readonly ProjectViewPrefRow[];
  /** This user's arrangement for this project, if they have ever made one. */
  savedOrder?: readonly string[] | null;
  /** Defaults to the built-in catalog; injectable for tests. */
  catalog?: readonly BuiltinViewDef[];
}): ProjectViewTab[] {
  const catalog = input.catalog ?? BUILTIN_VIEWS;
  const catalogKeys = new Set(catalog.map((v) => v.key));
  const catalogLabels = new Map(catalog.map((v) => [v.key, v.label]));
  const prefByKey = new Map(input.prefs.map((p) => [p.viewKey, p]));

  // Built-ins in catalog order, minus "deleted" (hidden) ones, renames applied.
  const natural: ProjectViewTab[] = [];
  for (const b of catalog) {
    const pref = prefByKey.get(b.key);
    if (pref?.hidden) continue;
    natural.push({
      viewKey: b.key,
      baseView: b.key,
      label: pref?.label?.trim() || b.label,
      mobile: b.mobile,
      isCopy: false,
      isDefault: !!pref?.isDefault,
    });
  }

  // "Make a copy" tabs, appended after the built-ins (Asana order). `position`
  // orders these and only these — it is the copies' column and this feature
  // must not borrow it, since it is shared by the whole firm. viewKey breaks
  // ties so two copies written in the same millisecond still render stably.
  const copies = input.prefs
    .filter((p) => !catalogKeys.has(p.viewKey) && !p.hidden)
    .sort(
      (a, b) => a.position - b.position || a.viewKey.localeCompare(b.viewKey)
    );
  for (const c of copies) {
    natural.push({
      viewKey: c.viewKey,
      baseView: c.baseView,
      // A copy inherits its base view's label; an un-renamed copy of a base
      // that is not in the catalog falls back to "View copy".
      label:
        c.label?.trim() ||
        `${catalogLabels.get(c.baseView) ?? baseLabelFor(c.baseView)} copy`,
      // Copies are always shown on mobile: the user asked for this one by
      // hand, so it outranks the catalog's md+-only defaults.
      mobile: true,
      isCopy: true,
      isDefault: c.isDefault,
    });
  }

  const saved = input.savedOrder;
  if (!saved || saved.length === 0) return natural;

  const byKey = new Map(natural.map((t) => [t.viewKey, t]));
  const placed = new Set<string>();
  const ordered: ProjectViewTab[] = [];
  for (const key of saved) {
    if (placed.has(key)) continue; // duplicate key: first mention wins
    const tab = byKey.get(key);
    if (!tab) continue; // hidden since, deleted, or never existed
    placed.add(key);
    ordered.push(tab);
  }
  // Anything the saved order does not mention — a tab a colleague re-added, or
  // a built-in shipped into the catalog after this order was written — goes to
  // the END. Landing it at the front would silently rearrange the strip of
  // someone who never asked for it.
  for (const tab of natural) {
    if (!placed.has(tab.viewKey)) ordered.push(tab);
  }
  return ordered;
}

/** The keys of a rendered strip — the value a saved order is written from. */
export function tabOrderKeys(
  strip: readonly (ProjectViewTab | string)[]
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of strip) {
    const key = typeof item === "string" ? item : item.viewKey;
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/** A drag that landed, or a tab just added from "+". */
export type TabOrderChange =
  | { type: "move"; from: number; to: number }
  | { type: "append"; viewKey: string };

/**
 * The saved order to WRITE after a change, given the strip as it is rendered
 * right now.
 *
 * It always returns the WHOLE strip, not a delta. That is what makes "+"
 * append correctly for a user who has never dragged anything: the strip he is
 * looking at gets materialised, then the new key is added at the end, so the
 * new tab lands last instead of dropping back into its catalog slot between
 * Timeline and Dashboard. His colleagues' strips are untouched — this write
 * goes to his own uiState, not to the project.
 *
 * `move` is remove-then-insert (dnd-kit's arrayMove): dropping index 2 onto
 * index 0 puts it first and pushes the rest right. An out-of-range `from` is a
 * no-op rather than an exception — a drag that races a re-render must not
 * corrupt the order — and `to` is clamped into the strip.
 */
export function nextTabOrder(
  strip: readonly (ProjectViewTab | string)[],
  change: TabOrderChange
): string[] {
  const keys = tabOrderKeys(strip);
  if (change.type === "append") {
    // Re-adding a key already in the strip moves it last rather than
    // duplicating it: "+" un-hides, and a race could un-hide something visible.
    return [...keys.filter((k) => k !== change.viewKey), change.viewKey];
  }
  const { from } = change;
  if (from < 0 || from >= keys.length) return keys;
  const to = Math.min(Math.max(change.to, 0), keys.length - 1);
  if (to === from) return keys; // dropped onto itself
  const next = keys.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// ── Where the per-user order is stored ─────────────────────────────────────

/**
 * uiState sub-key. The shape is intentionally exactly one level of nesting —
 * `{ [projectId]: viewKey[] }` — because PATCH /api/users/preferences
 * deep-merges objects ONE level and REPLACES arrays: at this depth each
 * project merges independently and each order array overwrites cleanly, so
 * dragging a tab out of an order actually sticks. Nest it deeper and a stale
 * key could never be dropped.
 */
export const PROJECT_TAB_ORDER_KEY = "projectTabOrder";

/**
 * How many projects one user's arrangement is remembered for. The merged
 * uiState payload is capped at 32KB server-side and the PATCH FAILS when the
 * cap is exceeded — a bloated map would take every other UI preference down
 * with it. 25 projects x (a cuid + up to a dozen short keys) is roughly 4KB, a
 * modest share of that budget, and far more projects than anyone arranges.
 */
export const MAX_REMEMBERED_TAB_ORDERS = 25;

/**
 * `uiState.projectTabOrder`. `null` is a tombstone for a pruned project: the
 * server's merge can add and overwrite keys but never delete them, so an
 * evicted entry is overwritten with null (a few bytes) instead of being
 * dropped from the payload, where the merge would just resurrect the old array
 * from the row.
 */
export type ProjectTabOrderMap = Record<string, string[] | null | undefined>;

/**
 * This user's arrangement for one project, or undefined if there is none.
 *
 * A tombstone, an empty array and a missing key all read as "never arranged"
 * and render today's order. They differ only in whether a record exists (see
 * hasSavedTabOrder) — an order that names no tab must never blank the strip.
 */
export function savedTabOrderFor(
  map: ProjectTabOrderMap | null | undefined,
  projectId: string
): string[] | undefined {
  const entry = map?.[projectId];
  if (!Array.isArray(entry) || entry.length === 0) return undefined;
  return entry;
}

/** Whether this user has ever arranged this project's strip. */
export function hasSavedTabOrder(
  map: ProjectTabOrderMap | null | undefined,
  projectId: string
): boolean {
  return savedTabOrderFor(map, projectId) !== undefined;
}

/**
 * The whole `projectTabOrder` map to write after one project's order changed.
 *
 * The project being written is never evicted — it is dropped from the carried
 * entries and re-added last. Which of the OTHERS goes when the cap is reached
 * is only least-recently-written within a single session: `current` comes back
 * from a Postgres `jsonb` column (UserPreferences.uiState), and jsonb does not
 * preserve object key order, so after a reload the entries arrive sorted by
 * key and the eviction is effectively arbitrary. Recording a real recency
 * stamp would mean a value shape other than `string[]`, which is fixed here.
 * Nobody loses the arrangement they are working on; someone with more than
 * MAX_REMEMBERED_TAB_ORDERS arranged projects can lose an older one that is
 * not the oldest.
 *
 * Evicted and already-dead entries are emitted as null rather than omitted,
 * because the server merges rather than replaces (see ProjectTabOrderMap).
 *
 * `liveProjectIds`, when given, prunes projects the user can no longer see —
 * deleted, or left. Omit it and nothing is pruned on that basis; the cap alone
 * keeps the payload bounded.
 */
export function nextProjectTabOrderMap(
  current: ProjectTabOrderMap | null | undefined,
  projectId: string,
  order: readonly string[],
  options?: { liveProjectIds?: Iterable<string>; limit?: number }
): ProjectTabOrderMap {
  const limit = Math.max(1, options?.limit ?? MAX_REMEMBERED_TAB_ORDERS);
  const live = options?.liveProjectIds ? new Set(options.liveProjectIds) : null;

  const kept: [string, string[]][] = [];
  const tombstoned: string[] = [];
  for (const [pid, value] of Object.entries(current ?? {})) {
    if (pid === projectId) continue; // re-added below as the newest entry
    if (!Array.isArray(value) || value.length === 0) {
      // Already null/empty on the server. Re-sending the tombstone is a no-op
      // there, and keeping it makes this function's output stable across
      // repeated writes.
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

  const next: ProjectTabOrderMap = {};
  for (const pid of tombstoned) next[pid] = null;
  for (const [pid] of evicted) next[pid] = null;
  for (const [pid, value] of survivors) next[pid] = value;
  next[projectId] = [...order];
  return next;
}
