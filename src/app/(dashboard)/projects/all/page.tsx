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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

type View = "grid" | "list";
const VIEW_STORAGE_KEY = "projects.view";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProjectType | "ALL">("ALL");
  const [gateFilter, setGateFilter] = useState<ProjectGate | "ALL">("ALL");
  const [view, setView] = useState<View>("grid");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as View | null;
    if (stored === "grid" || stored === "list") setView(stored);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-b">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-semibold text-black">
            Projects
          </h1>
          <span className="text-xs text-gray-500 tabular-nums">
            ({filtered.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              type="search"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-full sm:w-64"
            />
          </div>
          <Button
            size="sm"
            onClick={() => router.push("/projects/new")}
            className="bg-black hover:bg-gray-900 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New project
          </Button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 border-b bg-white">
        {/* Type pills */}
        <FilterGroup
          label="Type"
          options={[
            { value: "ALL", label: "All types" },
            ...(["CONSTRUCTION", "DESIGN", "RECERTIFICATION", "PERMIT"] as const).map(
              (t) => ({ value: t, label: TYPE_LABEL[t] })
            ),
          ]}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as ProjectType | "ALL")}
        />
        {/* Gate pills */}
        <FilterGroup
          label="Gate"
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

        {/* View switcher */}
        <div className="ml-auto flex items-center bg-white border rounded-md overflow-hidden">
          <button
            onClick={() => setView("grid")}
            aria-label="Grid view"
            className={cn(
              "p-1.5 transition-colors",
              view === "grid"
                ? "bg-black text-white"
                : "text-gray-500 hover:text-black hover:bg-gray-50"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("list")}
            aria-label="List view"
            className={cn(
              "p-1.5 transition-colors",
              view === "list"
                ? "bg-black text-white"
                : "text-gray-500 hover:text-black hover:bg-gray-50"
            )}
          >
            <List className="w-4 h-4" />
          </button>
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
        ) : view === "list" ? (
          <ProjectsListView projects={filtered} onRowClick={(id) => router.push(`/projects/${id}`)} />
        ) : (
          <ProjectsGridView projects={filtered} />
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 text-xs rounded-full border transition-colors",
            value === opt.value
              ? "bg-black text-white border-black"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
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

function ProjectsListView({
  projects,
  onRowClick,
}: {
  projects: Project[];
  onRowClick: (id: string) => void;
}) {
  const columns: { id: string; label: string; className: string }[] = [
    { id: "name", label: "Name", className: "flex-1" },
    { id: "number", label: "Project #", className: "w-[110px]" },
    { id: "type", label: "Type", className: "w-[120px]" },
    { id: "gate", label: "Gate", className: "w-[120px]" },
    { id: "status", label: "Status", className: "w-[80px]" },
    { id: "client", label: "Client", className: "w-[160px]" },
    { id: "tasks", label: "Tasks", className: "w-[80px]" },
    { id: "owner", label: "Owner", className: "w-[80px]" },
  ];

  return (
    <div>
      {/* Header — same gridline pattern as /goals and /my-tasks */}
      <div className="hidden md:flex items-stretch border-b border-gray-200 text-xs font-medium text-black uppercase tracking-wide">
        {columns.map((col, i) => (
          <div
            key={col.id}
            className={cn(
              "py-2 px-3 flex items-center justify-center",
              col.className,
              i > 0 && "border-l border-gray-200"
            )}
          >
            {col.label}
          </div>
        ))}
        <div className="w-10 border-l border-gray-200" />
      </div>

      {/* Rows */}
      {projects.map((p) => (
        <div
          key={p.id}
          onClick={() => onRowClick(p.id)}
          className="hidden md:flex items-stretch hover:bg-gray-50 cursor-pointer border-b border-gray-200"
        >
          <div className="flex-1 px-3 py-3 flex items-center justify-center gap-2 min-w-0">
            <div
              className="h-5 w-1.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-sm text-black text-center truncate">
              {p.name}
            </span>
          </div>
          <div className="w-[110px] px-3 py-3 border-l border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-600 tabular-nums">
              {p.projectNumber || "—"}
            </span>
          </div>
          <div className="w-[120px] px-3 py-3 border-l border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-700 text-center">
              {p.type ? TYPE_LABEL[p.type] : "—"}
            </span>
          </div>
          <div className="w-[120px] px-3 py-3 border-l border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-600 text-center">
              {p.gate ? GATE_LABEL[p.gate] : "—"}
            </span>
          </div>
          <div className="w-[80px] px-3 py-3 border-l border-gray-200 flex items-center justify-center">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: STATUS_DOT[p.status] || "#a3a3a3" }}
            />
          </div>
          <div className="w-[160px] px-3 py-3 border-l border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-600 truncate text-center">
              {p.clientName || "—"}
            </span>
          </div>
          <div className="w-[80px] px-3 py-3 border-l border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-700 tabular-nums">
              {p._count.tasks}
            </span>
          </div>
          <div className="w-[80px] px-3 py-3 border-l border-gray-200 flex items-center justify-center">
            {p.owner ? (
              <Avatar className="h-6 w-6">
                <AvatarImage src={p.owner.image || undefined} />
                <AvatarFallback className="bg-[#c9a84c] text-white text-[10px]">
                  {(p.owner.name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-xs text-gray-400">—</span>
            )}
          </div>
          <div className="w-10 border-l border-gray-200" />
        </div>
      ))}

      {/* Mobile card-stack for the same rows */}
      <div className="md:hidden divide-y">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: p.color }}
            >
              <Building2 className="h-4 w-4 text-white/90" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black truncate">
                {p.name}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {[p.type && TYPE_LABEL[p.type], p.gate && GATE_LABEL[p.gate]]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
            <span className="text-xs text-gray-500 tabular-nums">
              {p._count.tasks}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
