"use client";

/**
 * /projects/all — Dashboard all-projects listing.
 *
 * NOTE on the path: lives at `/projects/all` (not `/projects`).
 * `/projects` is owned by the public marketing portfolio at
 * (public)/projects/page.tsx. Putting both at the same path created
 * a Next.js parallel-route conflict that broke the production build
 * (commit b1a9dab and earlier). This file holds the logged-in
 * data-dense listing; the sidebar can link here when a "View all"
 * affordance is added.
 *
 * The page reads from /api/projects and offers:
 *   - Filter pills by type (Construction / Design / Recertification / Permit)
 *   - Filter pills by gate (Pre-design → Closeout)
 *   - Search input (name contains)
 *   - 2 views: Grid (default) and List (with gridlines like /goals + /my-tasks)
 *   - "New project" CTA that links to /projects/new
 *
 * Map view is intentionally NOT here — that's `/home` (cockpit). This
 * page is the data-dense overview.
 */

import { useEffect, useMemo, useState } from "react";
import { openCreateProjectGallery } from "@/lib/open-create-project";
import { useUiState } from "@/hooks/use-ui-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Loader2,
  Search,
  Folder,
  List,
  LayoutGrid,
  MapPin,
  Building2,
  GanttChart,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GanttTimeline } from "@/components/projects/gantt-timeline";
import { computePmiSnapshot, healthVisual } from "@/lib/pmi-metrics";

type ProjectType =
  | "CONSTRUCTION"
  | "DESIGN"
  | "RECERTIFICATION"
  | "PERMIT";

type ProjectGate =
  | "PRE_DESIGN"
  | "DESIGN"
  | "PERMITTING"
  | "CONSTRUCTION"
  | "CLOSEOUT";

type ProjectStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  type: ProjectType | null;
  gate: ProjectGate | null;
  status: ProjectStatus;
  isArchived: boolean;
  location: string | null;
  budget: number | string | null;
  currency: string | null;
  clientName: string | null;
  projectNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  owner: { id: string; name: string | null; image: string | null } | null;
  members: { user: { id: string; name: string | null; image: string | null } }[];
  tasks?: {
    id: string;
    completed: boolean;
    taskType?: string | null;
    dueDate?: string | null;
  }[];
  _count: { tasks: number; sections: number };
}

const TYPE_LABEL: Record<ProjectType, string> = {
  CONSTRUCTION: "Construction",
  DESIGN: "Design",
  RECERTIFICATION: "Recertification",
  PERMIT: "Permit",
};

const GATE_LABEL: Record<ProjectGate, string> = {
  PRE_DESIGN: "Pre-design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  ON_TRACK: "#c9a84c",
  AT_RISK: "#a8893a",
  OFF_TRACK: "#0a0a0a",
  ON_HOLD: "#666666",
  COMPLETE: "#c9a84c",
};

// Pill styling shared by the filter chips and the Active/Archived
// toggle so the two read as one control language in the same row.
const PILL_BASE =
  "inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-[13px] transition-colors";
const PILL_ON = "bg-black text-white border-black";
const PILL_OFF = "bg-white text-gray-700 border-gray-300 hover:border-gray-400";

type View = "grid" | "list" | "gantt";
type Scope = "active" | "archived";
const VIEW_UI_STATE_KEY = "projects.view";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  // `initialLoad` gates the full-page spinner. Refetches (a new search
  // term, a retry) keep the previous results on screen instead of
  // unmounting the whole table, which used to strobe on every keystroke.
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState("");
  // The server is queried on a debounced copy of the search box — the
  // raw value fired one request per character typed.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProjectType | "ALL">("ALL");
  const [gateFilter, setGateFilter] = useState<ProjectGate | "ALL">("ALL");
  // Archive scope stays plain useState on purpose: it's somewhere you
  // go to retrieve one old project, never how you want to browse
  // tomorrow, so it must not survive the session like `view` does.
  const [scope, setScope] = useState<Scope>("active");
  // The scope `projects` was actually fetched under. Flipping the toggle
  // re-renders with the previous scope's rows still in state, so nothing
  // may assert "this scope is empty" until the two agree.
  const [loadedScope, setLoadedScope] = useState<Scope>("active");
  // Default to list view — matches Asana's project browser and is
  // denser for AEC users who want to scan many projects fast.
  // Grid and Gantt are still one click away. Server-backed so the
  // choice follows the user across devices instead of dying with the
  // browser's localStorage.
  const { value: view, setValue: setView } = useUiState<View>(
    VIEW_UI_STATE_KEY,
    "list"
  );

  // One-shot carry-over of the choice this page used to keep in
  // localStorage under the same name. Without it, everyone who had
  // picked Grid or Gantt silently landed back on List after the move to
  // server-backed prefs. The preferences GET is read directly (rather
  // than trusting the hook's default) so a value already saved on
  // another device wins over this browser's stale copy; the legacy key
  // is dropped either way, so this runs at most once per browser.
  useEffect(() => {
    let legacy: string | null = null;
    try {
      legacy = localStorage.getItem(VIEW_UI_STATE_KEY);
      localStorage.removeItem(VIEW_UI_STATE_KEY);
    } catch {
      // Private mode / storage disabled — nothing to migrate.
    }
    if (legacy !== "grid" && legacy !== "list" && legacy !== "gantt") return;
    const carried = legacy as View;
    let canceled = false;
    fetch("/api/users/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (canceled || !data) return;
        if (data.uiState?.[VIEW_UI_STATE_KEY] === undefined) setView(carried);
      })
      .catch(() => {
        // Offline — the legacy key is gone, so the user just keeps the
        // default until they pick a view again.
      });
    return () => {
      canceled = true;
    };
  }, [setView]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    // The param only WIDENS the response to archived rows too — the
    // archived-only narrowing is `inScope` below, so both scopes go
    // through the same client-side funnel as the type/gate pills.
    if (scope === "archived") params.set("includeArchived", "true");
    const qs = params.toString();
    fetch(`/api/projects${qs ? `?${qs}` : ""}`, { signal: controller.signal })
      .then((r) => {
        // A 401/500 used to fall through to the "No projects yet" empty
        // state, telling the firm its whole project list was gone.
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        if (canceled) return;
        setProjects(Array.isArray(data) ? data : []);
        setLoadedScope(scope);
        setLoadError(false);
      })
      .catch((err) => {
        if (canceled || (err as Error)?.name === "AbortError") return;
        setProjects([]);
        setLoadError(true);
      })
      .finally(() => {
        if (canceled) return;
        setLoading(false);
        setInitialLoad(false);
      });
    return () => {
      canceled = true;
      controller.abort();
    };
  }, [debouncedSearch, scope, reloadToken]);

  // Scope is resolved before the pills so the empty state can tell
  // "this scope is empty" apart from "the filters hid everything".
  const inScope = useMemo(
    () => projects.filter((p) => p.isArchived === (scope === "archived")),
    [projects, scope]
  );

  const filtered = useMemo(() => {
    return inScope.filter(
      (p) =>
        (typeFilter === "ALL" || p.type === typeFilter) &&
        (gateFilter === "ALL" || p.gate === gateFilter)
    );
  }, [inScope, typeFilter, gateFilter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header — title left, Create button right. Padding scales with
          viewport so on big monitors the title aligns with the table
          column gutter instead of hugging the rail. */}
      <div className="flex items-center justify-between px-4 md:px-8 xl:px-12 2xl:px-16 pt-6 md:pt-8 pb-4">
        <h1 className="text-[22px] md:text-[28px] font-semibold text-black tracking-tight">
          Browse projects
          <span className="ml-2 text-sm font-normal text-gray-400 tabular-nums">
            {filtered.length}
          </span>
        </h1>
        <Button
          onClick={() => openCreateProjectGallery()}
          className="bg-black hover:bg-gray-900 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create project
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 md:px-8 xl:px-12 2xl:px-16 pb-3">
        <div className="relative">
          {loading && !initialLoad ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          )}
          <Input
            type="search"
            placeholder="Search for a project"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 w-full bg-gray-50 border-gray-200 focus-visible:bg-white"
          />
        </div>
      </div>

      {/* Filter chips + view switcher */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-8 xl:px-12 2xl:px-16 pb-4">
          <FilterChip
            label="Type"
            activeLabel={typeFilter === "ALL" ? null : TYPE_LABEL[typeFilter as ProjectType]}
            options={[
              { value: "ALL", label: "All types" },
              ...(["CONSTRUCTION", "DESIGN", "RECERTIFICATION", "PERMIT"] as const).map(
                (t) => ({ value: t, label: TYPE_LABEL[t] })
              ),
            ]}
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as ProjectType | "ALL")}
          />
          <FilterChip
            label="Gate"
            activeLabel={gateFilter === "ALL" ? null : GATE_LABEL[gateFilter as ProjectGate]}
            options={[
              { value: "ALL", label: "All gates" },
              ...(
                [
                  "PRE_DESIGN",
                  "DESIGN",
                  "PERMITTING",
                  "CONSTRUCTION",
                  "CLOSEOUT",
                ] as const
              ).map((g) => ({ value: g, label: GATE_LABEL[g] })),
            ]}
            value={gateFilter}
            onChange={(v) => setGateFilter(v as ProjectGate | "ALL")}
          />

          {/* Archive scope. Until this existed, archiving a project
              dropped it out of every list in the app with no way back
              to it. */}
          <div className="flex items-center gap-1">
            {(
              [
                { id: "active" as Scope, label: "Active" },
                { id: "archived" as Scope, label: "Archived" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setScope(opt.id)}
                aria-pressed={scope === opt.id}
                className={cn(PILL_BASE, scope === opt.id ? PILL_ON : PILL_OFF)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center bg-white border rounded-md overflow-hidden">
            {(
              [
                { id: "list" as View, icon: List, label: "List" },
                { id: "grid" as View, icon: LayoutGrid, label: "Grid" },
                { id: "gantt" as View, icon: GanttChart, label: "Gantt" },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setView(opt.id)}
                  aria-label={`${opt.label} view`}
                  title={`${opt.label} view`}
                  className={cn(
                    "p-1.5 transition-colors",
                    view === opt.id
                      ? "bg-black text-white"
                      : "text-gray-500 hover:text-black hover:bg-gray-50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

      {/* Content — edge-to-edge so the data-dense Grid/List/Gantt
          views get the full page width. Title alone is centered
          via text-center on the h1 above. */}
      <div
        className={cn(
          "flex-1 overflow-auto pb-8 transition-opacity",
          loading && !initialLoad && "opacity-60"
        )}
      >
        {initialLoad ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-md rounded-2xl border p-10 text-center">
              <p className="mb-4 text-sm text-gray-600">
                Couldn&apos;t load your projects.
              </p>
              <Button
                variant="outline"
                onClick={() => setReloadToken((t) => t + 1)}
                className="gap-1.5"
              >
                <Loader2 className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          loadedScope !== scope ? (
            // Between the toggle and the response for the new scope the
            // rows in state are the ones we just left, so there is
            // nothing honest to say yet — and rendering a view here
            // would strip the list down to a bare column header.
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4">
              <div className="w-16 h-16 bg-white border border-black rounded-full flex items-center justify-center mb-4">
                <Folder className="h-8 w-8 text-black" />
              </div>
              {/* Search is applied server-side, so a term that matches
                  nothing empties the scope too — saying "No archived
                  projects" there sends the user away from an archive
                  that isn't actually empty. */}
              <h3 className="text-lg font-medium text-black mb-2">
                {inScope.length > 0
                  ? "No projects match these filters"
                  : debouncedSearch
                    ? "No projects match your search"
                    : scope === "archived"
                      ? "No archived projects"
                      : "No projects yet"}
              </h3>
              <p className="text-sm text-gray-500 max-w-sm text-center mb-4">
                {inScope.length > 0
                  ? "Try adjusting the type or gate filters above."
                  : debouncedSearch
                    ? "Try a different term, or clear the search box to see everything here."
                    : scope === "archived"
                      ? "Projects you archive are kept here instead of deleted."
                      : "Create your first project to start tracking work, deadlines, and deliverables."}
              </p>
              {inScope.length === 0 && scope === "active" && !debouncedSearch && (
                <Button
                  onClick={() => openCreateProjectGallery()}
                  className="bg-black hover:bg-gray-900 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create first project
                </Button>
              )}
            </div>
          )
        ) : view === "gantt" ? (
          <GanttTimeline projects={filtered} />
        ) : (
          // Table fills the available viewport instead of locking at a
          // max width — on a 27" / 4K monitor the old max-w-7xl left a
          // skinny ribbon in the middle with empty space on both sides.
          // Padding tightens slightly at xl/2xl breakpoints so the
          // table reads comfortably without feeling pinned to the edges.
          <div className="w-full px-4 md:px-8 xl:px-12 2xl:px-16">
            {view === "list" ? (
              <ProjectsListView
                projects={filtered}
                onRowClick={(id) => router.push(`/projects/${id}`)}
              />
            ) : (
              <ProjectsGridView projects={filtered} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Asana-style dropdown chip filter. The trigger collapses to a
 * single rounded chip with the active label (or just the filter
 * label + chevron when nothing is selected), and clicking opens
 * a menu of options. Cleaner than rendering every option as its
 * own visible pill when there are many options (e.g. 5 gates).
 */
function FilterChip({
  label,
  activeLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  activeLabel: string | null;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const isActive = activeLabel !== null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(PILL_BASE, isActive ? PILL_ON : PILL_OFF)}>
          {isActive ? `${label}: ${activeLabel}` : label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "cursor-pointer",
              value === opt.value && "bg-gray-50 font-medium"
            )}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Muted marker so an archived project never reads as live work in a
 * list it shares with active ones (search results, a stale tab).
 */
function ArchivedBadge() {
  return (
    <span className="flex-shrink-0 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Archived
    </span>
  );
}

function ProjectsGridView({ projects }: { projects: Project[] }) {
  return (
    <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className="group block border rounded-xl p-4 bg-white hover:border-gray-400 hover:shadow-sm transition-all"
        >
          <div className="flex items-start gap-3 mb-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: p.color }}
            >
              <Building2 className="h-5 w-5 text-white/90" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-black truncate group-hover:underline">
                {p.name}
              </p>
              {p.projectNumber && (
                <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider tabular-nums">
                  {p.projectNumber}
                </p>
              )}
            </div>
          </div>

          {p.description && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-3">
              {p.description}
            </p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {p.isArchived && <ArchivedBadge />}
            {p.type && (
              <span className="text-[10px] font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                {TYPE_LABEL[p.type]}
              </span>
            )}
            {p.gate && (
              <span className="text-[10px] font-medium text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">
                {GATE_LABEL[p.gate]}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: STATUS_DOT[p.status] || "#a3a3a3" }}
              />
              <span>{p._count.tasks} tasks</span>
            </div>
            {p.location && (
              <span className="flex items-center gap-1 truncate max-w-[140px]">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{p.location}</span>
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Compact projects list view.
 *
 * Column anatomy (left to right):
 *   #         Project number (TT-YYYY-NNN, monospaced)
 *   PROJECT   Color bar + name + type/client subline
 *   GATE      Phase chip
 *   %COMP     Progress (actual vs planned mini bar)
 *   HEALTH    On track / Watch / At risk / Off track pill
 *   OWNER     Avatar
 *
 * The EVM/PMI columns (BAC, EV, PV, SPI, CPI, EAC, Float) that
 * used to live here were removed at the product owner's request —
 * they belong on a per-project "Finance" tab, not on the top-level
 * projects index where they overwhelmed the page.
 */
function ProjectsListView({
  projects,
  onRowClick,
}: {
  projects: Project[];
  onRowClick: (id: string) => void;
}) {
  // Same gridTemplate shared by header, rows, AND ghost-column
  // overlay so every divider lands on the same pixel boundary.
  const gridTemplate = "100px minmax(220px, 1fr) 110px 130px 100px 56px";
  return (
    <div className="font-sans">
      {/* Compact header — six columns. Per-cell `border-l` provides
          vertical dividers; same approach used on every row below
          for guaranteed alignment across browsers (no overlay
          stacking-context games). */}
      <div className="hidden md:grid items-stretch border-b border-[#e6e9ef] text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/60 sticky top-0 z-10"
           style={{ gridTemplateColumns: gridTemplate }}>
        <div className="px-3 py-2 border-l border-[#e6e9ef] first:border-l-0">#</div>
        <div className="px-3 py-2 border-l border-[#e6e9ef]">Project</div>
        <div className="px-3 py-2 border-l border-[#e6e9ef]">Gate</div>
        <div className="px-3 py-2 border-l border-[#e6e9ef]">% Comp</div>
        <div className="px-3 py-2 border-l border-[#e6e9ef]">Health</div>
        <div className="px-2 py-2 border-l border-[#e6e9ef] text-center">Owner</div>
      </div>

      {/* Rows */}
      {projects.map((p) => {
        const taskList = p.tasks || [];
        // Use the root-task array length as the denominator: the API's
        // `tasks` is filtered to root tasks (parentTaskId: null) but
        // _count.tasks counts subtasks too, so mixing them made "% Comp"
        // read e.g. 5/30 instead of 5/10.
        const totalTasks = taskList.length;
        const completedTasks = taskList.filter((t) => t.completed).length;
        const pmi = computePmiSnapshot({
          startDate: p.startDate,
          endDate: p.endDate,
          budget: p.budget,
          status: p.status,
          taskCount: totalTasks,
          completedTaskCount: completedTasks,
        });
        const hv = healthVisual(pmi.health);
        const isOverdue =
          p.endDate !== null &&
          new Date(p.endDate) < new Date() &&
          p.status !== "COMPLETE";

        return (
          <div
            key={p.id}
            onClick={() => onRowClick(p.id)}
            // Per-cell `border-l` restored on each column cell —
            // guaranteed vertical dividers, immune to stacking-
            // context bugs.
            className="hidden md:grid items-stretch hover:bg-gray-50 cursor-pointer border-b border-[#e6e9ef] text-[12px] group"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {/* # */}
            <div className="px-3 py-2.5 flex items-center font-mono tabular-nums text-[11px] text-gray-600">
              {p.projectNumber || "—"}
            </div>

            {/* Project (color bar + name + subline) */}
            <div className="px-3 py-2.5 border-l border-[#e6e9ef] flex items-center gap-2.5 min-w-0">
              <div
                className="h-7 w-1 rounded-sm flex-shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[13px] font-medium text-black truncate group-hover:underline">
                    {p.name}
                  </p>
                  {p.isArchived && <ArchivedBadge />}
                </div>
                <p className="text-[10px] text-gray-500 truncate uppercase tracking-wider">
                  {p.type ? TYPE_LABEL[p.type] : "—"}
                  {p.clientName ? ` · ${p.clientName}` : ""}
                </p>
              </div>
            </div>

            {/* Gate */}
            <div className="px-3 py-2.5 border-l border-[#e6e9ef] flex items-center">
              <span className="text-[10px] font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {p.gate ? GATE_LABEL[p.gate] : "—"}
              </span>
            </div>

            {/* % Complete with planned-vs-actual mini bars */}
            <div className="px-3 py-2.5 border-l border-[#e6e9ef] flex flex-col justify-center gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-[12px] font-mono font-semibold tabular-nums text-black">
                  {pmi.percentComplete}%
                </span>
                <span className="text-[9px] font-mono tabular-nums text-gray-400">
                  /{pmi.percentPlanned}%
                </span>
              </div>
              <div className="relative h-1 bg-gray-100 rounded-full">
                <div
                  className="absolute inset-y-0 left-0 bg-[#c9a84c] rounded-full"
                  style={{ width: `${pmi.percentComplete}%` }}
                />
                {/* Planned-tick line at planned % position */}
                {pmi.percentPlanned > 0 && pmi.percentPlanned < 100 && (
                  <div
                    className="absolute inset-y-0 w-px bg-black/70"
                    style={{ left: `${pmi.percentPlanned}%` }}
                    title={`Planned: ${pmi.percentPlanned}%`}
                  />
                )}
              </div>
            </div>

            {/* Health pill */}
            <div className="px-3 py-2.5 border-l border-[#e6e9ef] flex items-center">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium tabular-nums"
                style={{ backgroundColor: hv.hex, color: hv.textHex }}
              >
                {isOverdue && "▲ "}
                {hv.label}
              </span>
            </div>

            {/* Owner */}
            <div className="px-2 py-2.5 border-l border-[#e6e9ef] flex items-center justify-center">
              {p.owner ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={p.owner.image || undefined} />
                  <AvatarFallback className="bg-[#c9a84c] text-white text-[10px]">
                    {(p.owner.name || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="text-xs text-gray-300">—</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Mobile card-stack — same data, vertical layout */}
      <div className="md:hidden divide-y">
        {projects.map((p) => {
          const taskList = p.tasks || [];
          // Root-task count (see desktop rows above) — _count.tasks includes
          // subtasks and would deflate the completion %.
          const totalTasks = taskList.length;
          const completedTasks = taskList.filter((t) => t.completed).length;
          const pmi = computePmiSnapshot({
            startDate: p.startDate,
            endDate: p.endDate,
            budget: p.budget,
            status: p.status,
            taskCount: totalTasks,
            completedTaskCount: completedTasks,
          });
          const hv = healthVisual(pmi.health);
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
            >
              <div
                className="h-8 w-1.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-black truncate">
                    {p.name}
                  </p>
                  {p.isArchived && <ArchivedBadge />}
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-medium tabular-nums"
                    style={{ backgroundColor: hv.hex, color: hv.textHex }}
                  >
                    {hv.label}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 truncate font-mono">
                  {p.projectNumber || "—"} · {pmi.percentComplete}% complete
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// NumCell + IndexCell were removed when the EVM/PMI columns
// (BAC/EV/PV/SPI/CPI/EAC) were stripped from the projects table.
// If a per-project Finance tab needs them later, lift them from
// the git history at commit ab60cd6's parent.
