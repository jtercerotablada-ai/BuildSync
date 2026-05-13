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
import {
  computePmiSnapshot,
  formatCompactCurrency,
  formatIndex,
  healthVisual,
} from "@/lib/pmi-metrics";

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

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProjectType | "ALL">("ALL");
  const [gateFilter, setGateFilter] = useState<ProjectGate | "ALL">("ALL");
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
    return projects.filter(
      (p) =>
        (typeFilter === "ALL" || p.type === typeFilter) &&
        (gateFilter === "ALL" || p.gate === gateFilter)
    );
  }, [projects, typeFilter, gateFilter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header — large title left, primary Create button right.
          Matches the Asana "Buscar proyectos" pattern: big page
          title in dedicated row, blue CTA on the far right. */}
      <div className="flex items-center justify-between px-4 md:px-8 pt-6 md:pt-8 pb-4">
        <h1 className="text-[22px] md:text-[28px] font-semibold text-black tracking-tight">
          Browse projects
          <span className="ml-2 text-sm font-normal text-gray-400 tabular-nums">
            {filtered.length}
          </span>
        </h1>
        <Button
          onClick={() => router.push("/projects/new")}
          className="bg-black hover:bg-gray-900 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create project
        </Button>
      </div>

      {/* Search — full-width, prominent. */}
      <div className="px-4 md:px-8 pb-3">
        <div className="relative max-w-full">
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

      {/* Filter chips row — each filter is a dropdown chip Asana-
          style. Cleaner than the previous inline button group when
          the gate axis has 5 options. The view switcher sits on the
          right of the same row. */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-8 pb-4">
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

        {/* View switcher — Grid / List / Gantt. The timeline view
            is the differentiator vs Asana. */}
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
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
                onClick={() => router.push("/projects/new")}
                className="bg-black hover:bg-gray-900 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create first project
              </Button>
            )}
          </div>
        ) : view === "gantt" ? (
          <GanttTimeline projects={filtered} />
        ) : view === "list" ? (
          <ProjectsListView
            projects={filtered}
            onRowClick={(id) => router.push(`/projects/${id}`)}
          />
        ) : (
          <ProjectsGridView projects={filtered} />
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
 * PMI / EVM dense list view — what a PMP would expect to open.
 *
 * Column anatomy (left to right, all left-aligned except numerics):
 *   #         Project number (TT-YYYY-NNN, monospaced)
 *   PROJECT   Color bar + name (and gate sub-label) — fills.
 *   GATE      Phase chip
 *   %COMP     Earned-value-based progress, with planned dashed bar
 *   BAC       Budget at Completion ($ compact)
 *   EV        Earned Value ($ compact)
 *   PV        Planned Value ($ compact)
 *   SPI       Schedule Performance Index (color-coded)
 *   CPI       Cost Performance Index (color-coded)
 *   EAC       Estimate At Completion ($ compact, red when EAC > BAC)
 *   FLOAT     Days until planned end; "Slip Xd" when overdue
 *   HEALTH    Color chip: On track / Watch / At risk / Off track
 *   OWNER     Avatar
 *
 * Every number is `tabular-nums font-mono` so columns align vertically
 * the way PMs expect from MS Project / Primavera.
 */
function ProjectsListView({
  projects,
  onRowClick,
}: {
  projects: Project[];
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="font-sans">
      {/* PMBOK-style header. Numeric columns get a right-aligned
          tabular-nums treatment; categorical columns stay left. */}
      <div className="hidden md:grid items-stretch border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/60 sticky top-0 z-10"
           style={{ gridTemplateColumns: "100px minmax(220px, 1fr) 110px 130px 80px 80px 80px 60px 60px 80px 80px 100px 56px" }}>
        <div className="px-3 py-2 border-l border-gray-200 first:border-l-0">#</div>
        <div className="px-3 py-2 border-l border-gray-200">Project</div>
        <div className="px-3 py-2 border-l border-gray-200">Gate</div>
        <div className="px-3 py-2 border-l border-gray-200">% Comp</div>
        <div className="px-3 py-2 border-l border-gray-200 text-right">BAC</div>
        <div className="px-3 py-2 border-l border-gray-200 text-right">EV</div>
        <div className="px-3 py-2 border-l border-gray-200 text-right">PV</div>
        <div className="px-2 py-2 border-l border-gray-200 text-right">SPI</div>
        <div className="px-2 py-2 border-l border-gray-200 text-right">CPI</div>
        <div className="px-3 py-2 border-l border-gray-200 text-right">EAC</div>
        <div className="px-3 py-2 border-l border-gray-200 text-right">Float</div>
        <div className="px-3 py-2 border-l border-gray-200">Health</div>
        <div className="px-2 py-2 border-l border-gray-200 text-center">Owner</div>
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
        const hv = healthVisual(pmi.health);
        const isOverdue =
          pmi.floatDays !== null &&
          pmi.floatDays < 0 &&
          p.status !== "COMPLETED";

        return (
          <div
            key={p.id}
            onClick={() => onRowClick(p.id)}
            className="hidden md:grid items-stretch hover:bg-gray-50 cursor-pointer border-b border-gray-100 text-[12px] group"
            style={{ gridTemplateColumns: "100px minmax(220px, 1fr) 110px 130px 80px 80px 80px 60px 60px 80px 80px 100px 56px" }}
          >
            {/* # */}
            <div className="px-3 py-2.5 flex items-center font-mono tabular-nums text-[11px] text-gray-600">
              {p.projectNumber || "—"}
            </div>

            {/* Project (color bar + name + subline) */}
            <div className="px-3 py-2.5 border-l border-gray-100 flex items-center gap-2.5 min-w-0">
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
            <div className="px-3 py-2.5 border-l border-gray-100 flex items-center">
              <span className="text-[10px] font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {p.gate ? GATE_LABEL[p.gate] : "—"}
              </span>
            </div>

            {/* % Complete with planned-vs-actual mini bars */}
            <div className="px-3 py-2.5 border-l border-gray-100 flex flex-col justify-center gap-1">
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

            {/* BAC */}
            <NumCell value={formatCompactCurrency(pmi.bac, p.currency || "USD")} />
            {/* EV */}
            <NumCell value={formatCompactCurrency(pmi.ev, p.currency || "USD")} />
            {/* PV */}
            <NumCell value={formatCompactCurrency(pmi.pv, p.currency || "USD")} />
            {/* SPI */}
            <IndexCell value={pmi.spi} />
            {/* CPI */}
            <IndexCell value={pmi.cpi} />
            {/* EAC */}
            <div className="px-3 py-2.5 border-l border-gray-100 flex items-center justify-end font-mono tabular-nums text-[11px]">
              <span
                className={cn(
                  pmi.eac > pmi.bac * 1.05 && "text-black font-semibold",
                  pmi.eac <= pmi.bac && pmi.eac > 0 && "text-gray-700"
                )}
              >
                {formatCompactCurrency(pmi.eac, p.currency || "USD")}
              </span>
            </div>

            {/* Float / Slip */}
            <div className="px-3 py-2.5 border-l border-gray-100 flex items-center justify-end">
              {pmi.floatDays === null ? (
                <span className="text-[11px] text-gray-300">—</span>
              ) : pmi.floatDays < 0 ? (
                <span className="text-[11px] font-mono tabular-nums font-semibold text-black">
                  -{Math.abs(pmi.floatDays)}d
                </span>
              ) : (
                <span className="text-[11px] font-mono tabular-nums text-gray-700">
                  {pmi.floatDays}d
                </span>
              )}
            </div>

            {/* Health pill */}
            <div className="px-3 py-2.5 border-l border-gray-100 flex items-center">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium tabular-nums"
                style={{ backgroundColor: hv.hex, color: hv.textHex }}
              >
                {isOverdue && "▲ "}
                {hv.label}
              </span>
            </div>

            {/* Owner */}
            <div className="px-2 py-2.5 border-l border-gray-100 flex items-center justify-center">
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
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-medium tabular-nums"
                    style={{ backgroundColor: hv.hex, color: hv.textHex }}
                  >
                    {hv.label}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 truncate font-mono">
                  {p.projectNumber || "—"} · {pmi.percentComplete}% · SPI{" "}
                  {formatIndex(pmi.spi)} · CPI {formatIndex(pmi.cpi)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function NumCell({ value }: { value: string }) {
  return (
    <div className="px-3 py-2.5 border-l border-gray-100 flex items-center justify-end font-mono tabular-nums text-[11px] text-gray-700">
      {value}
    </div>
  );
}

function IndexCell({ value }: { value: number }) {
  const formatted = formatIndex(value);
  // Color-code by PMBOK conventions:
  //   ≥ 1.00 → gold (over-performing or on plan)
  //   0.95-0.99 → muted gold
  //   0.85-0.94 → bold black (watch)
  //   < 0.85 → black on gold ring (at-risk)
  let color = "text-gray-400";
  let weight = "font-mono";
  if (value > 0) {
    if (value >= 1) {
      color = "text-[#a8893a]";
      weight = "font-mono font-semibold";
    } else if (value >= 0.95) {
      color = "text-gray-700";
      weight = "font-mono";
    } else if (value >= 0.85) {
      color = "text-black";
      weight = "font-mono font-semibold";
    } else {
      color = "text-black";
      weight = "font-mono font-bold";
    }
  }
  return (
    <div
      className={cn(
        "px-2 py-2.5 border-l border-gray-100 flex items-center justify-end text-[11px] tabular-nums",
        color,
        weight
      )}
    >
      {formatted}
    </div>
  );
}
