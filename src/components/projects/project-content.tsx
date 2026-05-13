"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  List,
  LayoutGrid,
  Calendar,
  GanttChart,
  BarChart3,
  Plus,
  MoreHorizontal,
  Star,
  Settings,
  Trash2,
  Share2,
  Filter,
  SortAsc,
  SortDesc,
  FileText,
  GitBranch,
  MessageSquare,
  FolderOpen,
  ChevronDown,
  Rows3,
  Search,
  Edit2,
  Copy,
  Archive,
  Check,
  X,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isThisWeek, parseISO } from "date-fns";
import { ListView } from "@/components/views/list-view";
import { BoardView } from "@/components/views/board-view";
import { TimelineView } from "@/components/views/timeline-view";
import { DashboardView } from "@/components/views/dashboard-view";
import { CalendarView } from "@/components/views/calendar-view";
import { WorkflowView } from "@/components/views/workflow-view";
import { MessagesView } from "@/components/views/messages-view";
import { FilesView } from "@/components/views/files-view";
import { ProjectOverview } from "@/components/projects/project-overview";
import { ProjectMembersDialog } from "@/components/projects/project-members-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import {
  computePmiSnapshot,
  formatCompactCurrency,
  formatIndex,
  healthVisual,
} from "@/lib/pmi-metrics";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  // Engineering-firm task taxonomy: regular task, milestone (Diamond
  // icon), or approval gate (ThumbsUp). Optional so legacy rows that
  // never had the column populated keep deserializing.
  taskType?: "TASK" | "MILESTONE" | "APPROVAL" | null;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  subtasks: { id: string; completed: boolean }[];
  _count: {
    subtasks: number;
    comments: number;
    attachments: number;
  };
}

interface Section {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  sections: Section[];
  views: { id: string; name: string; type: string; isDefault: boolean }[];
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  members: {
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }[];
  portfolio?: {
    id: string;
    name: string;
  } | null;
  // Engineering metadata (any of these may be null on legacy rows)
  projectNumber?: string | null;
  type?: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT" | null;
  gate?: "PRE_DESIGN" | "DESIGN" | "PERMITTING" | "CONSTRUCTION" | "CLOSEOUT" | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  budget?: number | string | null;
  currency?: string | null;
  clientName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

const PROJECT_TYPE_LABEL: Record<string, string> = {
  CONSTRUCTION: "Construction",
  DESIGN: "Design",
  RECERTIFICATION: "Recertification",
  PERMIT: "Permit",
};
// Monochrome + gold palette — matches cockpit/types.ts TYPE_COLOR.
const PROJECT_TYPE_COLOR: Record<string, string> = {
  CONSTRUCTION: "#c9a84c", // gold
  DESIGN: "#d4b65a",       // bright gold
  RECERTIFICATION: "#a8893a", // deep gold / bronze
  PERMIT: "#1a1a1a",       // black (outlined badge treatment)
};
const GATES_ORDER = ["PRE_DESIGN", "DESIGN", "PERMITTING", "CONSTRUCTION", "CLOSEOUT"] as const;
const GATE_LABEL: Record<string, string> = {
  PRE_DESIGN: "Pre-Design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

interface ProjectContentProps {
  project: Project;
  currentView: string;
}

// Monochrome + gold palette for status badges. Gold = active/positive,
// black = severe, gray = neutral. No greens/reds/yellows/blues.
const STATUS_COLORS = {
  ON_TRACK: "bg-[#c9a84c]/15 text-[#a8893a]",
  AT_RISK: "bg-[#a8893a]/15 text-[#a8893a]",
  OFF_TRACK: "bg-black/90 text-white",
  ON_HOLD: "bg-gray-100 text-gray-700",
  COMPLETE: "bg-[#d4b65a]/15 text-[#a8893a]",
};

const STATUS_LABELS = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  ON_HOLD: "On hold",
  COMPLETE: "Complete",
};

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

export function ProjectContent({ project, currentView }: ProjectContentProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [isStarred, setIsStarred] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Filter/Sort state
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showCompleted, setShowCompleted] = useState(true);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        if (filter === "incomplete") next.delete("completed");
        if (filter === "completed") next.delete("incomplete");
        next.add(filter);
      }
      return next;
    });
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortBy(null);
        setSortDirection("asc");
      }
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  const clearAllFilters = () => {
    setActiveFilters(new Set());
    setSortBy(null);
    setSortDirection("asc");
    setSearchQuery("");
    setShowCompleted(true);
  };

  const hasActiveFilters = activeFilters.size > 0 || sortBy || searchQuery || !showCompleted;

  // Compute filtered & sorted sections
  const filteredSections = useMemo(() => {
    let sections = project.sections.map(section => ({
      ...section,
      tasks: [...section.tasks],
    }));

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      sections = sections.map(section => ({
        ...section,
        tasks: section.tasks.filter(task =>
          task.name.toLowerCase().includes(q)
        ),
      }));
    }

    // Active filters
    if (activeFilters.size > 0) {
      sections = sections.map(section => ({
        ...section,
        tasks: section.tasks.filter(task => {
          if (activeFilters.has("incomplete") && task.completed) return false;
          if (activeFilters.has("completed") && !task.completed) return false;
          if (activeFilters.has("due_this_week")) {
            if (!task.dueDate) return false;
            try {
              if (!isThisWeek(parseISO(task.dueDate), { weekStartsOn: 1 })) return false;
            } catch {
              return false;
            }
          }
          if (activeFilters.has("assigned_to_me")) {
            if (!task.assignee || task.assignee.email !== session?.user?.email) return false;
          }
          return true;
        }),
      }));
    }

    // Show/hide completed
    if (!showCompleted) {
      sections = sections.map(section => ({
        ...section,
        tasks: section.tasks.filter(task => !task.completed),
      }));
    }

    // Sorting
    if (sortBy) {
      sections = sections.map(section => ({
        ...section,
        tasks: [...section.tasks].sort((a, b) => {
          let cmp = 0;
          switch (sortBy) {
            case "due_date": {
              const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
              const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
              cmp = da - db;
              break;
            }
            case "alphabetical":
              cmp = a.name.localeCompare(b.name);
              break;
            case "priority":
              cmp = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
              break;
            case "created":
              cmp = a.id.localeCompare(b.id);
              break;
          }
          return sortDirection === "desc" ? -cmp : cmp;
        }),
      }));
    }

    return sections;
  }, [project.sections, searchQuery, activeFilters, sortBy, sortDirection, showCompleted, session?.user?.email]);

  const handleViewChange = (view: string) => {
    router.push(`/projects/${project.id}?view=${view}`);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleAddTask = (sectionId?: string) => {
    setSelectedSectionId(sectionId || null);
    setShowCreateTask(true);
  };

  // Monochrome + gold. Gold = positive/active, black = severe, gray = neutral.
  const statusConfig = {
    ON_TRACK: { bg: "bg-[#c9a84c]/10", text: "text-[#a8893a]", dot: "bg-[#c9a84c]" },
    AT_RISK: { bg: "bg-[#a8893a]/15", text: "text-[#a8893a]", dot: "bg-[#a8893a]" },
    OFF_TRACK: { bg: "bg-black", text: "text-white", dot: "bg-white" },
    ON_HOLD: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
    COMPLETE: { bg: "bg-[#d4b65a]/15", text: "text-[#a8893a]", dot: "bg-[#d4b65a]" },
  };

  const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.ON_TRACK;

  // Show toolbar only for task views (not calendar - it has its own)
  const showToolbar = ["list", "board", "timeline"].includes(currentView);

  return (
    <div className="h-full flex flex-col">
      {/* Portfolio Breadcrumb */}
      {project.portfolio && (
        <div className="px-4 md:px-6 py-1.5 text-xs text-slate-500 border-b bg-slate-50">
          <Link
            href={`/portfolios/${project.portfolio.id}`}
            className="hover:text-slate-700 hover:underline"
          >
            {project.portfolio.name}
          </Link>
        </div>
      )}

      {/* Project Header */}
      <div className="border-b bg-white px-4 md:px-6 py-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-1">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Project Icon */}
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: project.color }}
            >
              {project.name[0]}
            </div>

            {/* Project Name with Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-base font-semibold text-slate-900 hover:text-slate-700 max-w-[180px] md:max-w-none">
                  <span className="truncate">{project.name}</span>
                  <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  const newName = prompt('Project name:', project.name);
                  if (newName && newName !== project.name) {
                    fetch(`/api/projects/${project.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: newName }),
                    }).then(res => {
                      if (res.ok) { toast.success('Project renamed'); window.location.reload(); }
                    }).catch(() => toast.error("Operation failed"));
                  }
                }}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  fetch(`/api/projects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: `${project.name} (copy)`, color: project.color, description: project.description }),
                  }).then(async res => {
                    if (res.ok) { const data = await res.json(); toast.success('Project duplicated'); router.push(`/projects/${data.id}`); }
                  }).catch(() => toast.error("Operation failed"));
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  fetch(`/api/projects/${project.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'ARCHIVED' }),
                  }).then(res => {
                    if (res.ok) { toast.success('Project archived'); router.push('/home'); }
                  }).catch(() => toast.error("Operation failed"));
                }}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem className="text-black" onClick={() => {
                  if (confirm('Delete this project? This cannot be undone.')) {
                    fetch(`/api/projects/${project.id}`, { method: 'DELETE' }).then(res => {
                      if (res.ok) { toast.success('Project deleted'); router.push('/home'); }
                    }).catch(() => toast.error("Operation failed"));
                  }
                }}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Favorite */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isStarred && "text-[#a8893a]")}
              onClick={() => { setIsStarred(!isStarred); toast.success(isStarred ? 'Removed from favorites' : 'Added to favorites'); }}
            >
              <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
            </Button>

            {/* Status Badge - shown inline on desktop, below on mobile */}
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${status.bg} ${status.text}`}>
              <div className={`w-2 h-2 rounded-full ${status.dot}`} />
              {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
            </div>
          </div>

          {/* Mobile-only status badge row */}
          <div className={`md:hidden flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs w-fit ${status.bg} ${status.text}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Members (clickable — opens manage dialog) */}
            <button
              type="button"
              onClick={() => setMembersDialogOpen(true)}
              className="hidden md:flex items-center -space-x-2 mr-2 hover:opacity-80 transition-opacity"
              title="Manage members"
            >
              {project.members.slice(0, 3).map((member) => (
                <div
                  key={member.userId}
                  className="w-8 h-8 rounded-full bg-[#d4b65a] border-2 border-white flex items-center justify-center text-sm font-medium text-white"
                  title={member.user.name || member.user.email || ""}
                >
                  {member.user.name?.[0] || member.user.email?.[0] || "?"}
                </div>
              ))}
              {project.members.length === 0 && (
                <div className="w-8 h-8 rounded-full bg-[#d4b65a] border-2 border-white flex items-center justify-center text-sm font-medium text-white">
                  {project.owner?.name?.[0] || "?"}
                </div>
              )}
              <div className="w-8 h-8 rounded-full bg-white border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600">
                <Plus className="h-4 w-4" />
              </div>
            </button>

            {/* Share Button — hidden on mobile, lives in overflow menu */}
            <Button className="hidden md:inline-flex bg-black hover:bg-black text-white" size="sm" onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Project link copied to clipboard');
            }}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>

            {/* Mobile overflow menu for Share/Customize/Members */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Project link copied to clipboard');
                }}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Fields customization coming soon')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Customize
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setMembersDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Manage members ({project.members.length + 1})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Edit Details */}
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Edit details
            </Button>

            {/* Customize Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:inline-flex">
                  Customize
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => toast.info('Fields customization coming soon')}>
                  Fields
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Rules customization coming soon')}>
                  Rules
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Color & icon customization coming soon')}>
                  Color & Icon
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Engineering metadata strip — shows what was captured at create time.
            Renders only if any of the fields are populated so legacy projects
            stay clean. */}
        {(project.projectNumber || project.type || project.clientName || project.location || project.budget) && (
          <div className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-slate-600 mt-1 mb-1.5">
            {project.projectNumber && (
              <span className="font-mono text-slate-500 tracking-[0.5px]">
                {project.projectNumber}
              </span>
            )}
            {project.type && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-[1.5px] uppercase"
                style={{
                  color: PROJECT_TYPE_COLOR[project.type] ?? "#666",
                  background: `${PROJECT_TYPE_COLOR[project.type] ?? "#666"}15`,
                }}
              >
                {PROJECT_TYPE_LABEL[project.type] ?? project.type}
              </span>
            )}
            {project.clientName && (
              <span>
                <span className="text-slate-400">Client</span>{" "}
                <span className="text-slate-700">{project.clientName}</span>
              </span>
            )}
            {project.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span className="text-slate-700">{project.location}</span>
              </span>
            )}
            {project.budget != null && project.currency && (
              <span>
                <span className="text-slate-400">Budget</span>{" "}
                <span className="text-slate-700 font-medium">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: project.currency,
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(Number(project.budget))}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Gate progress bar — 5 segments representing the engineering
            lifecycle. Visible only when the project has a gate set. */}
        {project.gate && (
          <div className="hidden md:flex items-center gap-2 mt-1 mb-1.5">
            <div className="flex items-center gap-0.5 flex-1 max-w-[420px]">
              {GATES_ORDER.map((g, i) => {
                const activeIdx = GATES_ORDER.indexOf(project.gate as typeof GATES_ORDER[number]);
                const reached = i <= activeIdx;
                return (
                  <div
                    key={g}
                    className="flex-1 h-1.5 rounded-full transition-colors"
                    style={{
                      background: reached
                        ? PROJECT_TYPE_COLOR[project.type ?? "DESIGN"] ?? "#c9a84c"
                        : "#e5e7eb",
                    }}
                    title={GATE_LABEL[g]}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-slate-500 uppercase tracking-[1.5px] font-medium">
              {GATE_LABEL[project.gate] ?? project.gate}
            </span>
          </div>
        )}

        {/* PMI / EVM KPI strip — what a PMP/PgMP looks for first when
            opening a project: BAC, EV, PV, SPI, CPI, EAC, Float, Health.
            Numbers in monospaced tabular-nums; SPI/CPI color-coded per
            PMBOK conventions (≥1 healthy, <0.85 at risk). */}
        {(() => {
          const allTasks = project.sections.flatMap((s) => s.tasks);
          const totalTasks = allTasks.length;
          const completedTasks = allTasks.filter((t) => t.completed).length;
          const pmi = computePmiSnapshot({
            startDate: project.startDate ?? null,
            endDate: project.endDate ?? null,
            budget: project.budget ?? null,
            status: project.status,
            taskCount: totalTasks,
            completedTaskCount: completedTasks,
          });
          const hv = healthVisual(pmi.health);
          const currency = project.currency || "USD";
          return (
            <div className="hidden md:grid grid-cols-8 gap-2 mt-2 mb-3 border-y border-slate-200 bg-white py-2">
              <KpiCell label="% Comp" value={`${pmi.percentComplete}%`} sub={`/ ${pmi.percentPlanned}% planned`} />
              <KpiCell label="BAC" value={formatCompactCurrency(pmi.bac, currency)} sub="Budget" />
              <KpiCell label="EV" value={formatCompactCurrency(pmi.ev, currency)} sub="Earned" />
              <KpiCell label="PV" value={formatCompactCurrency(pmi.pv, currency)} sub="Planned" />
              <KpiCell
                label="SPI"
                value={formatIndex(pmi.spi)}
                sub={pmi.spi >= 1 ? "On schedule" : pmi.spi >= 0.85 ? "Watch" : "Behind"}
                emphasize={pmi.spi > 0 && pmi.spi < 0.95}
              />
              <KpiCell
                label="CPI"
                value={formatIndex(pmi.cpi)}
                sub={pmi.cpi >= 1 ? "Under budget" : pmi.cpi >= 0.85 ? "Watch" : "Over"}
                emphasize={pmi.cpi > 0 && pmi.cpi < 0.95}
              />
              <KpiCell
                label="EAC"
                value={formatCompactCurrency(pmi.eac, currency)}
                sub={
                  pmi.vac >= 0
                    ? `+${formatCompactCurrency(pmi.vac, currency)} VAC`
                    : `${formatCompactCurrency(pmi.vac, currency)} VAC`
                }
                emphasize={pmi.vac < 0}
              />
              <KpiCell
                label="Float"
                value={
                  pmi.floatDays === null
                    ? "—"
                    : pmi.floatDays < 0
                      ? `-${Math.abs(pmi.floatDays)}d`
                      : `${pmi.floatDays}d`
                }
                sub={
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wider"
                    style={{ backgroundColor: hv.hex, color: hv.textHex }}
                  >
                    {hv.label.toUpperCase()}
                  </span>
                }
                emphasize={pmi.floatDays !== null && pmi.floatDays < 0}
              />
            </div>
          );
        })()}

        {/* View Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
          <div className="flex items-center gap-0 md:gap-1 overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              onClick={() => handleViewChange("overview")}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "overview"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden md:inline">Overview</span>
            </button>
            <button
              onClick={() => handleViewChange("list")}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "list"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <List className="h-4 w-4" />
              <span className="hidden md:inline">List</span>
            </button>
            <button
              onClick={() => handleViewChange("board")}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "board"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden md:inline">Board</span>
            </button>
            <button
              onClick={() => handleViewChange("timeline")}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "timeline"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <GanttChart className="h-4 w-4" />
              <span className="hidden md:inline">Timeline</span>
            </button>
            <button
              onClick={() => handleViewChange("dashboard")}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "dashboard"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden md:inline">Dashboard</span>
            </button>
            <button
              onClick={() => handleViewChange("calendar")}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "calendar"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden md:inline">Calendar</span>
            </button>
            <button
              onClick={() => handleViewChange("workflow")}
              className={`hidden md:flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "workflow"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <GitBranch className="h-4 w-4" />
              <span className="hidden md:inline">Workflow</span>
            </button>
            <button
              onClick={() => handleViewChange("messages")}
              className={`hidden md:flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "messages"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden md:inline">Messages</span>
            </button>
            <button
              onClick={() => handleViewChange("files")}
              className={`hidden md:flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "files"
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden md:inline">Files</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 text-slate-400 hover:text-slate-600">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleViewChange("workflow")}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleViewChange("messages")}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Messages
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleViewChange("files")}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Toolbar - only show for task views */}
          {showToolbar && (
            <div className="flex items-center gap-1 overflow-x-auto flex-nowrap">
              {/* Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn(activeFilters.size > 0 && "text-[#a8893a] bg-[#c9a84c]/10")}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                    {activeFilters.size > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-xs bg-[#c9a84c]/15 text-[#a8893a]">
                        {activeFilters.size}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => toggleFilter("incomplete")}>
                    {activeFilters.has("incomplete") && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!activeFilters.has("incomplete") && "ml-6")}>Incomplete tasks</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleFilter("completed")}>
                    {activeFilters.has("completed") && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!activeFilters.has("completed") && "ml-6")}>Completed tasks</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleFilter("due_this_week")}>
                    {activeFilters.has("due_this_week") && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!activeFilters.has("due_this_week") && "ml-6")}>Due this week</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleFilter("assigned_to_me")}>
                    {activeFilters.has("assigned_to_me") && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!activeFilters.has("assigned_to_me") && "ml-6")}>Assigned to me</span>
                  </DropdownMenuItem>
                  {activeFilters.size > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setActiveFilters(new Set())} className="text-black">
                        <X className="mr-2 h-4 w-4" />
                        Clear filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn(sortBy && "text-[#a8893a] bg-[#c9a84c]/10")}>
                    {sortDirection === "desc" ? <SortDesc className="mr-2 h-4 w-4" /> : <SortAsc className="mr-2 h-4 w-4" />}
                    Sort
                    {sortBy && <span className="ml-1 text-xs text-[#a8893a]">({sortBy === "due_date" ? "date" : sortBy === "alphabetical" ? "A-Z" : sortBy})</span>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleSort("due_date")}>
                    {sortBy === "due_date" && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(sortBy !== "due_date" && "ml-6")}>Due date</span>
                    {sortBy === "due_date" && <span className="ml-auto text-xs text-slate-400">{sortDirection === "asc" ? "earliest" : "latest"}</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("created")}>
                    {sortBy === "created" && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(sortBy !== "created" && "ml-6")}>Created on</span>
                    {sortBy === "created" && <span className="ml-auto text-xs text-slate-400">{sortDirection === "asc" ? "oldest" : "newest"}</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("alphabetical")}>
                    {sortBy === "alphabetical" && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(sortBy !== "alphabetical" && "ml-6")}>Alphabetical</span>
                    {sortBy === "alphabetical" && <span className="ml-auto text-xs text-slate-400">{sortDirection === "asc" ? "A-Z" : "Z-A"}</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("priority")}>
                    {sortBy === "priority" && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(sortBy !== "priority" && "ml-6")}>Priority</span>
                    {sortBy === "priority" && <span className="ml-auto text-xs text-slate-400">{sortDirection === "asc" ? "high first" : "low first"}</span>}
                  </DropdownMenuItem>
                  {sortBy && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setSortBy(null); setSortDirection("asc"); }} className="text-black">
                        <X className="mr-2 h-4 w-4" />
                        Clear sort
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn(!showCompleted && "text-[#a8893a] bg-[#c9a84c]/10")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Options
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setShowCompleted(!showCompleted)}>
                    {showCompleted && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!showCompleted && "ml-6")}>Show completed</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Search */}
              {showSearch ? (
                <div className="relative">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-44 h-8 pr-7"
                    autoFocus
                    onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onMouseDown={(e) => { e.preventDefault(); setSearchQuery(""); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(true)}>
                  <Search className="h-4 w-4" />
                </Button>
              )}

              {/* Clear all indicator */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="text-black hover:text-black hover:bg-gray-100" onClick={clearAllFilters}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear all
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden flex">
        <div className={cn("flex-1 flex flex-col", currentView !== "calendar" && currentView !== "board" && "overflow-auto")}>
          {currentView === "overview" && (
            <ProjectOverview
              project={project}
              onManageMembers={() => setMembersDialogOpen(true)}
            />
          )}
          {currentView === "list" && (
            <ListView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              projectId={project.id}
            />
          )}
          {currentView === "board" && (
            <BoardView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              projectId={project.id}
            />
          )}
          {currentView === "timeline" && (
            <TimelineView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              projectId={project.id}
            />
          )}
          {currentView === "calendar" && (
            <CalendarView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              projectId={project.id}
            />
          )}
          {currentView === "dashboard" && (
            <DashboardView
              sections={filteredSections}
              projectId={project.id}
            />
          )}
          {currentView === "workflow" && (
            <WorkflowView
              sections={project.sections}
              projectId={project.id}
            />
          )}
          {currentView === "messages" && (
            <MessagesView
              sections={project.sections}
              projectId={project.id}
              projectName={project.name}
              projectColor={project.color}
              projectStatus={project.status}
              currentUser={
                session?.user
                  ? {
                      id: session.user.email || "",
                      name: session.user.name || null,
                      image: session.user.image || null,
                    }
                  : undefined
              }
            />
          )}
          {currentView === "files" && (
            <FilesView
              sections={project.sections}
              projectId={project.id}
            />
          )}
        </div>

        {/* Task Detail Panel */}
        {selectedTaskId && (
          <TaskDetailPanel
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projectId={project.id}
        sectionId={selectedSectionId || undefined}
      />

      {/* Project Members Dialog */}
      {project.owner && (
        <ProjectMembersDialog
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          projectId={project.id}
          owner={{
            id: project.owner.id,
            name: project.owner.name,
            email: project.owner.email || "",
            image: project.owner.image,
          }}
          onMembersChange={() => router.refresh()}
        />
      )}

      {/* Edit Project Dialog — reuses CreateProjectDialog in edit mode */}
      <CreateProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialProject={{
          id: project.id,
          projectNumber: project.projectNumber ?? null,
          name: project.name,
          type: project.type ?? null,
          gate: project.gate ?? null,
          color: project.color,
          clientName: project.clientName ?? null,
          location: project.location ?? null,
          latitude: project.latitude ?? null,
          longitude: project.longitude ?? null,
          startDate: project.startDate ?? null,
          endDate: project.endDate ?? null,
          budget: project.budget ?? null,
          currency: project.currency ?? null,
          description: project.description ?? null,
        }}
        onProjectUpdated={() => router.refresh()}
      />
    </div>
  );
}

/**
 * Single KPI cell used in the project-detail PMI strip. Dense, tabular,
 * monospaced number — looks like a Primavera / MS Project header.
 *
 * `emphasize` flips the value to bold black so under-performing metrics
 * (SPI/CPI < 0.95, negative VAC, overdue float) pull the eye.
 */
function KpiCell({
  label,
  value,
  sub,
  emphasize = false,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-col px-2 border-r border-slate-100 last:border-r-0">
      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-[1.5px]">
        {label}
      </span>
      <span
        className={
          "text-[15px] font-mono tabular-nums leading-tight " +
          (emphasize ? "font-bold text-black" : "font-semibold text-slate-800")
        }
      >
        {value}
      </span>
      {sub !== undefined && (
        <span className="text-[10px] text-slate-500 font-mono tabular-nums truncate">
          {sub}
        </span>
      )}
    </div>
  );
}
