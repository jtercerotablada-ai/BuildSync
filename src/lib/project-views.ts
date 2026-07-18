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
