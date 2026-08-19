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
  ArrowUpDown,
  Layers,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GanttTimeline } from "@/components/projects/gantt-timeline";
import { computePmiSnapshot, healthStatus } from "@/lib/pmi-metrics";
import { Status } from "@/components/ui/status";

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
  | "COMPLETED";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  type: ProjectType | null;
  gate: ProjectGate | null;
  status: ProjectStatus;
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
  archivedAt: string | null;
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
  COMPLETED: "#c9a84c",
};

type View = "grid" | "list" | "gantt";
const VIEW_STORAGE_KEY = "projects.view";

// Labels for the Sort/Group dropdown chips. Kept here (file-scope)
// so the JSX inline text stays terse and translations later can
// swap these without touching the toolbar markup. PA-2 (May 22 2026).
const SORT_LABEL: Record<"none" | "name" | "created" | "endDate" | "progress", string> = {
  none: "None",
  name: "Name",
  created: "Created",
  endDate: "Deadline",
  progress: "Progress",
};
const GROUP_LABEL: Record<"none" | "type" | "gate" | "owner" | "status", string> = {
  none: "None",
  type: "Type",
  gate: "Gate",
  owner: "Owner",
  status: "Health",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProjectType | "ALL">("ALL");
  const [gateFilter, setGateFilter] = useState<ProjectGate | "ALL">("ALL");
  // Archive visibility — hidden by default. Toggling shows archived
  // projects mixed in (matches Asana's "Show archived" checkbox in
  // the project picker). QC Fase 2 P1.1, May 23 2026.
  const [showArchived, setShowArchived] = useState(false);
  // Sort + Group controls — Asana-parity for the project browser.
  // QC Fase 1 bug PA-2 (May 22 2026): /projects/all previously had
  // only Type/Gate chips and a view switcher. Users couldn't sort
  // by recency or name, nor visually group by type/gate/owner.
  type SortField = "none" | "name" | "created" | "endDate" | "progress";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("none");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  type GroupField = "none" | "type" | "gate" | "owner" | "status";
  const [groupField, setGroupField] = useState<GroupField>("none");
  // Default to list view — matches Asana's project browser and is
  // denser for AEC users who want to scan many projects fast.
  // Grid and Gantt are still one click away.
  const [view, setView] = useState<View>("list");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    if (stored === "grid" || stored === "list" || stored === "gantt") setView(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    fetch(`/api/projects${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (canceled) return;
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch(() => !canceled && setProjects([]))
      .finally(() => !canceled && setLoading(false));
    return () => {
      canceled = true;
    };
  }, [search]);

  const filtered = useMemo(() => {
    const base = projects.filter(
      (p) =>
        (typeFilter === "ALL" || p.type === typeFilter) &&
        (gateFilter === "ALL" || p.gate === gateFilter) &&
        (showArchived || !p.archivedAt)
    );
    if (sortField === "none") return base;
    // Stable-sort with the chosen field. We compare value-by-value
    // and respect the asc/desc switch.
    const sorted = [...base].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortField) {
        case "name":
          av = a.name?.toLowerCase() ?? "";
          bv = b.name?.toLowerCase() ?? "";
          break;
        case "created":
          // The /api/projects payload doesn't expose `createdAt`, so
          // we use `startDate` as the next-best proxy for "recently
          // created" (most projects backfill startDate at creation).
          // The cuid id is also time-monotonic if startDate is null.
          av = a.startDate ? new Date(a.startDate).getTime() : 0;
          bv = b.startDate ? new Date(b.startDate).getTime() : 0;
          if (!av && !bv) {
            av = a.id;
            bv = b.id;
          }
          break;
        case "endDate":
          av = a.endDate ? new Date(a.endDate).getTime() : Number.POSITIVE_INFINITY;
          bv = b.endDate ? new Date(b.endDate).getTime() : Number.POSITIVE_INFINITY;
          break;
        case "progress": {
          // Sort by % complete (tasks done / total). Projects with
          // no tasks land at 0.
          const aTotal = a._count?.tasks ?? 0;
          const aDone = (a.tasks || []).filter((t) => t.completed).length;
          const bTotal = b._count?.tasks ?? 0;
          const bDone = (b.tasks || []).filter((t) => t.completed).length;
          av = aTotal === 0 ? 0 : aDone / aTotal;
          bv = bTotal === 0 ? 0 : bDone / bTotal;
          break;
        }
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [projects, typeFilter, gateFilter, sortField, sortDir, showArchived]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header — title left, Create button right. Padding scales with
          viewport so on big monitors the title aligns with the table
          column gutter instead of hugging the rail. */}
      <div className="flex items-center justify-between px-4 md:px-8 xl:px-12 2xl:px-16 pt-6 md:pt-8 pb-4">
        <h1 className="text-[22px] md:text-[28px] font-semibold text-black tracking-tight">
          Browse projects
          {/* Count wrapped in parens for consistent format across the
              app (matches /teams "Teams (1)" pattern). Pre-fix the
              span said just "1" which read as "Browse projects1" to
              screen readers and felt glued to the title. QC Fase 1
              bug PA-1, May 22 2026. */}
          <span className="ml-2 text-sm font-normal text-gray-400 tabular-nums">
            ({filtered.length})
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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

          {/* Sort dropdown — Asana parity. Activates the sort
              applied by the `filtered` memo above. Shows the active
              field as a label suffix when set. PA-2 fix. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={
                  "inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-md border transition-colors " +
                  (sortField !== "none"
                    ? "border-[#c9a84c] bg-[#fdf7e8] text-[#8a7028]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50")
                }
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort
                {sortField !== "none" && (
                  <span className="text-[10px] text-[#a8893a] font-medium">
                    ·{" "}
                    {SORT_LABEL[sortField]}
                    {sortDir === "desc" ? " ↓" : " ↑"}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {(
                [
                  ["none", "None"],
                  ["name", "Name (A→Z)"],
                  ["created", "Recently created"],
                  ["endDate", "Closest deadline"],
                  ["progress", "% complete"],
                ] as const
              ).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => {
                    setSortField(value as SortField);
                    if (value === "none") setSortDir("asc");
                  }}
                  className="text-[13px]"
                >
                  <Check
                    className={
                      "w-3.5 h-3.5 mr-2 " +
                      (sortField === value ? "opacity-100" : "opacity-0")
                    }
                  />
                  {label}
                </DropdownMenuItem>
              ))}
              {sortField !== "none" && (
                <>
                  <div className="my-1 mx-2 border-t border-gray-200" />
                  <DropdownMenuItem
                    onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                    className="text-[13px]"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 mr-2" />
                    {sortDir === "asc" ? "Switch to descending ↓" : "Switch to ascending ↑"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group dropdown — applies to the rendered table only
              (groups are a visual layer). Pre-fix /projects/all
              showed a flat list with no way to organize by Type or
              Owner — losing Asana parity. PA-2 fix. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={
                  "inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-md border transition-colors " +
                  (groupField !== "none"
                    ? "border-[#c9a84c] bg-[#fdf7e8] text-[#8a7028]"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50")
                }
              >
                <Layers className="w-3.5 h-3.5" />
                Group
                {groupField !== "none" && (
                  <span className="text-[10px] text-[#a8893a] font-medium">
                    · {GROUP_LABEL[groupField]}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {(
                [
                  ["none", "No grouping"],
                  ["type", "By type"],
                  ["gate", "By gate"],
                  ["owner", "By owner"],
                  ["status", "By health"],
                ] as const
              ).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setGroupField(value as GroupField)}
                  className="text-[13px]"
                >
                  <Check
                    className={
                      "w-3.5 h-3.5 mr-2 " +
                      (groupField === value ? "opacity-100" : "opacity-0")
                    }
                  />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Show archived toggle — Asana parity. Default off so
              the picker stays light; on demand the user can pull
              completed-and-archived projects into the view. QC Fase
              2 P1.1, May 23 2026. */}
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={
              "inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] rounded-md border transition-colors " +
              (showArchived
                ? "border-[#c9a84c] bg-[#fdf7e8] text-[#8a7028]"
                : "border-gray-200 text-gray-600 hover:bg-gray-50")
            }
            title={showArchived ? "Hide archived projects" : "Show archived projects"}
          >
            <Folder className="w-3.5 h-3.5" />
            {showArchived ? "Showing archived" : "Show archived"}
          </button>

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
      <div className="flex-1 overflow-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-4">
            <div className="w-16 h-16 bg-white border border-black rounded-full flex items-center justify-center mb-4">
              <Folder className="h-8 w-8 text-black" />
            </div>
            <h3 className="text-lg font-medium text-black mb-2">
              {projects.length === 0
                ? "No projects yet"
                : "No projects match these filters"}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm text-center mb-4">
              {projects.length === 0
                ? "Create your first project to start tracking work, deadlines, and deliverables."
                : "Try adjusting the type or gate filters above."}
            </p>
            {projects.length === 0 && (
              <Button
                onClick={() => openCreateProjectGallery()}
                className="bg-black hover:bg-gray-900 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create first project
              </Button>
            )}
          </div>
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
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-[13px] transition-colors",
            isActive
              ? "bg-black text-white border-black"
              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
          )}
        >
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
        const totalTasks = p._count.tasks ?? taskList.length;
        const completedTasks = taskList.filter((t) => t.completed).length;
        const pmi = computePmiSnapshot({
          startDate: p.startDate,
          endDate: p.endDate,
          budget: p.budget,
          status: p.status,
          taskCount: totalTasks,
          completedTaskCount: completedTasks,
        });
        const isOverdue =
          p.endDate !== null &&
          new Date(p.endDate) < new Date() &&
          p.status !== "COMPLETED";

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
                <p className="text-[13px] font-medium text-black truncate group-hover:underline">
                  {p.name}
                </p>
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

            {/* Health pill — unified via <Status> so all status pills
                across project/portfolio/goal/reporting reads the same.
                `healthStatus` returns the semantic variant + canonical
                label; the prepended ▲ keeps the overdue affordance. */}
            <div className="px-3 py-2.5 border-l border-[#e6e9ef] flex items-center">
              {(() => {
                const hs = healthStatus(pmi.health);
                return (
                  <Status variant={hs.variant} size="sm">
                    {isOverdue && "▲ "}
                    {hs.label}
                  </Status>
                );
              })()}
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
          const totalTasks = p._count.tasks ?? taskList.length;
          const completedTasks = taskList.filter((t) => t.completed).length;
          const pmi = computePmiSnapshot({
            startDate: p.startDate,
            endDate: p.endDate,
            budget: p.budget,
            status: p.status,
            taskCount: totalTasks,
            completedTaskCount: completedTasks,
          });
          const hs = healthStatus(pmi.health);
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
                  <Status variant={hs.variant} size="sm">
                    {hs.label}
                  </Status>
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
