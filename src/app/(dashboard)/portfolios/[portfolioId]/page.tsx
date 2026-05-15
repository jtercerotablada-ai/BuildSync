"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Loader2,
  Folder,
  Calendar,
  Trash2,
  Wallet,
  Briefcase,
  AlertTriangle,
  TrendingUp,
  Clock,
  GripVertical,
  List as ListIcon,
  CalendarRange,
  LayoutDashboard,
  Activity,
  Users,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PortfolioTimelineView } from "@/components/portfolios/portfolio-timeline-view";
import { PortfolioPanelView } from "@/components/portfolios/portfolio-panel-view";
import { PortfolioProgressView } from "@/components/portfolios/portfolio-progress-view";
import { PortfolioWorkloadView } from "@/components/portfolios/portfolio-workload-view";
import { PortfolioMessagesView } from "@/components/portfolios/portfolio-messages-view";

// ── Types ───────────────────────────────────────────────────

type PortfolioStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

type ProjectType = "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT";

type ProjectGate =
  | "PRE_DESIGN"
  | "DESIGN"
  | "PERMITTING"
  | "CONSTRUCTION"
  | "CLOSEOUT";

interface Project {
  id: string;
  name: string;
  color: string;
  status: PortfolioStatus;
  type: ProjectType | null;
  gate: ProjectGate | null;
  budget: number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  stats: {
    total: number;
    completed: number;
    overdue: number;
    progress: number;
  };
}

interface PortfolioProject {
  id: string;
  position: number;
  project: Project;
}

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: PortfolioStatus;
  startDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  projects: PortfolioProject[];
  _count: {
    projects: number;
  };
}

interface AvailableProject {
  id: string;
  name: string;
  color: string;
}

interface StatusUpdate {
  id: string;
  status: PortfolioStatus;
  summary: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

// ── Constants ───────────────────────────────────────────────

const STATUS_OPTIONS: {
  value: PortfolioStatus;
  label: string;
  dot: string;
  chip: string;
}[] = [
  {
    value: "ON_TRACK",
    label: "On track",
    dot: "bg-[#c9a84c]",
    chip: "bg-[#c9a84c]/15 text-[#a8893a]",
  },
  {
    value: "AT_RISK",
    label: "At risk",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
  },
  {
    value: "OFF_TRACK",
    label: "Off track",
    dot: "bg-black",
    chip: "bg-gray-100 text-black",
  },
  {
    value: "ON_HOLD",
    label: "On hold",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-700",
  },
  {
    value: "COMPLETE",
    label: "Complete",
    dot: "bg-[#a8893a]",
    chip: "bg-[#a8893a]/15 text-[#a8893a]",
  },
];

const TYPE_META: Record<ProjectType, { label: string; short: string }> = {
  CONSTRUCTION: { label: "Construction", short: "CON" },
  DESIGN: { label: "Design", short: "DES" },
  RECERTIFICATION: { label: "Recertification", short: "REC" },
  PERMIT: { label: "Permit", short: "PRM" },
};

const GATE_META: Record<ProjectGate, { label: string }> = {
  PRE_DESIGN: { label: "Pre-design" },
  DESIGN: { label: "Design" },
  PERMITTING: { label: "Permitting" },
  CONSTRUCTION: { label: "Construction" },
  CLOSEOUT: { label: "Closeout" },
};

function statusMeta(s: PortfolioStatus) {
  return STATUS_OPTIONS.find((o) => o.value === s) || STATUS_OPTIONS[0];
}

function formatBudget(value: number, currency: string): string {
  if (value <= 0) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US")}`;
  }
}

// ── Page ────────────────────────────────────────────────────

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = params.portfolioId as string;

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [updates, setUpdates] = useState<StatusUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  useEffect(() => {
    fetchPortfolio();
    fetchUpdates();
  }, [portfolioId]);

  async function fetchPortfolio() {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
        setNameDraft(data.name || "");
        setDescriptionDraft(data.description || "");
      } else if (res.status !== 404) {
        toast.error("Failed to load portfolio");
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      toast.error("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUpdates() {
    setUpdatesLoading(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/status-updates`);
      if (res.ok) {
        const data = await res.json();
        setUpdates(data);
      }
    } catch (error) {
      console.error("Error fetching updates:", error);
    } finally {
      setUpdatesLoading(false);
    }
  }

  async function savePortfolio(patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      const updated = await res.json();
      setPortfolio((prev) => (prev ? { ...prev, ...updated } : prev));
      return true;
    } catch (error) {
      console.error("Error saving portfolio:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
      return false;
    }
  }

  async function handleNameSave() {
    if (!nameDraft.trim() || nameDraft === portfolio?.name) {
      setEditingName(false);
      setNameDraft(portfolio?.name || "");
      return;
    }
    const ok = await savePortfolio({ name: nameDraft.trim() });
    if (ok) {
      toast.success("Name updated");
      setEditingName(false);
    }
  }

  async function handleDescriptionSave() {
    if (descriptionDraft === (portfolio?.description || "")) return;
    const ok = await savePortfolio({
      description: descriptionDraft.trim() || null,
    });
    if (ok) toast.success("Description updated");
  }

  async function handleStatusChange(status: PortfolioStatus) {
    const ok = await savePortfolio({ status });
    if (ok) toast.success("Status updated");
  }

  async function handleDateChange(
    field: "startDate" | "endDate",
    value: string
  ) {
    const ok = await savePortfolio({ [field]: value || null });
    if (ok) toast.success("Date updated");
  }

  async function fetchAvailableProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const existingIds = new Set(
          portfolio?.projects.map((p) => p.project.id) || []
        );
        setAvailableProjects(
          data.filter((p: AvailableProject) => !existingIds.has(p.id))
        );
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }

  async function handleAddProject() {
    if (!selectedProjectId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      if (res.ok) {
        await fetchPortfolio();
        setAddProjectOpen(false);
        setSelectedProjectId("");
        toast.success("Project added");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to add project");
      }
    } catch (error) {
      console.error("Error adding project:", error);
      toast.error("Failed to add project");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveProject(projectId: string) {
    if (!confirm("Remove this project from the portfolio?")) return;
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/projects?projectId=${projectId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await fetchPortfolio();
        toast.success("Project removed");
      } else {
        toast.error("Failed to remove project");
      }
    } catch (error) {
      console.error("Error removing project:", error);
      toast.error("Failed to remove project");
    }
  }

  async function handleDeletePortfolio() {
    if (
      !confirm(
        "Are you sure you want to delete this portfolio? This action cannot be undone."
      )
    )
      return;
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Portfolio deleted");
        router.push("/portfolios");
      } else {
        toast.error("Failed to delete portfolio");
      }
    } catch (error) {
      console.error("Error deleting portfolio:", error);
      toast.error("Failed to delete portfolio");
    }
  }

  async function handlePostUpdate(
    status: PortfolioStatus,
    summary: string
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/status-updates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            summary,
            syncPortfolioStatus: true,
          }),
        }
      );
      if (res.ok) {
        const created = await res.json();
        setUpdates((prev) => [created, ...prev]);
        setPortfolio((prev) => (prev ? { ...prev, status } : prev));
        toast.success("Update posted");
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to post update");
        return false;
      }
    } catch (error) {
      console.error("Error posting update:", error);
      toast.error("Failed to post update");
      return false;
    }
  }

  // ── Drag & drop ────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !portfolio || active.id === over.id) return;

    const oldIndex = portfolio.projects.findIndex((p) => p.id === active.id);
    const newIndex = portfolio.projects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = portfolio.projects;
    const reordered = arrayMove(portfolio.projects, oldIndex, newIndex);
    setPortfolio({ ...portfolio, projects: reordered });

    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/projects/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectIds: reordered.map((p) => p.project.id),
          }),
        }
      );
      if (!res.ok) {
        setPortfolio({ ...portfolio, projects: previous });
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to reorder");
      }
    } catch (error) {
      console.error("Error reordering:", error);
      setPortfolio({ ...portfolio, projects: previous });
      toast.error("Failed to reorder");
    }
  }

  // ── Aggregate stats ───────────────────────────────────────
  const aggregates = useMemo(() => {
    if (!portfolio) return null;
    let totalBudget = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    let activeProjects = 0;
    let atRiskCount = 0;
    let offTrackCount = 0;
    let currency = "USD";

    const byType: Record<ProjectType, number> = {
      CONSTRUCTION: 0,
      DESIGN: 0,
      RECERTIFICATION: 0,
      PERMIT: 0,
    };
    const byGate: Record<ProjectGate, number> = {
      PRE_DESIGN: 0,
      DESIGN: 0,
      PERMITTING: 0,
      CONSTRUCTION: 0,
      CLOSEOUT: 0,
    };

    for (const pp of portfolio.projects) {
      const p = pp.project;
      if (p.budget) {
        totalBudget += p.budget;
        if (p.currency) currency = p.currency;
      }
      totalTasks += p.stats.total;
      completedTasks += p.stats.completed;
      overdueTasks += p.stats.overdue;
      if (p.status !== "COMPLETE" && p.status !== "ON_HOLD")
        activeProjects += 1;
      if (p.status === "AT_RISK") atRiskCount += 1;
      if (p.status === "OFF_TRACK") offTrackCount += 1;
      if (p.type) byType[p.type] += 1;
      if (p.gate) byGate[p.gate] += 1;
    }

    return {
      totalBudget,
      currency,
      totalTasks,
      completedTasks,
      overdueTasks,
      activeProjects,
      atRiskCount,
      offTrackCount,
      avgProgress:
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0,
      byType,
      byGate,
    };
  }, [portfolio]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!portfolio || !aggregates) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500">Portfolio not found</p>
        <Button variant="link" onClick={() => router.push("/portfolios")}>
          Go back to portfolios
        </Button>
      </div>
    );
  }

  const meta = statusMeta(portfolio.status);

  const dateInputValue = (date: string | null) =>
    date ? new Date(date).toISOString().split("T")[0] : "";

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b bg-white px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-start gap-2 md:gap-4 mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => router.push("/portfolios")}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (portfolio.color || "#a8893a") + "20" }}
          >
            <Folder
              className="h-5 w-5"
              style={{ color: portfolio.color || "#a8893a" }}
            />
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") {
                    setEditingName(false);
                    setNameDraft(portfolio.name);
                  }
                }}
                autoFocus
                className="h-8 text-lg md:text-xl font-semibold"
              />
            ) : (
              <h1
                className="text-lg md:text-xl font-semibold text-black truncate cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
                onClick={() => setEditingName(true)}
                title="Click to edit"
              >
                {portfolio.name}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex">
                    <Badge className={cn(meta.chip, "cursor-pointer")}>
                      <span
                        className={cn("w-2 h-2 rounded-full mr-1.5", meta.dot)}
                      />
                      {meta.label}
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                    >
                      <div className={cn("h-3 w-3 rounded-full mr-2", opt.dot)} />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs text-gray-500">
                {portfolio._count.projects}{" "}
                {portfolio._count.projects === 1 ? "project" : "projects"}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingName(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-black"
                onClick={handleDeletePortfolio}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete portfolio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Textarea
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={handleDescriptionSave}
          placeholder="Add a description..."
          rows={2}
          className="mb-3 text-sm resize-none border-dashed"
        />

        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600">
          <label className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Start:</span>
            <input
              type="date"
              value={dateInputValue(portfolio.startDate)}
              onChange={(e) => handleDateChange("startDate", e.target.value)}
              className="bg-transparent border-b border-dashed border-gray-300 focus:border-gray-600 outline-none px-1"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-gray-500">End:</span>
            <input
              type="date"
              value={dateInputValue(portfolio.endDate)}
              onChange={(e) => handleDateChange("endDate", e.target.value)}
              className="bg-transparent border-b border-dashed border-gray-300 focus:border-gray-600 outline-none px-1"
            />
          </label>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-gray-50/50">
        <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
          {/* KPI Strip (always visible) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiTile
              icon={<Briefcase className="h-4 w-4 text-[#a8893a]" />}
              label="Active projects"
              value={aggregates.activeProjects.toString()}
              sub={`${portfolio._count.projects} total`}
            />
            <KpiTile
              icon={<Wallet className="h-4 w-4 text-[#a8893a]" />}
              label="Total budget"
              value={formatBudget(aggregates.totalBudget, aggregates.currency)}
            />
            <KpiTile
              icon={<TrendingUp className="h-4 w-4 text-[#a8893a]" />}
              label="Avg progress"
              value={`${aggregates.avgProgress}%`}
              sub={`${aggregates.completedTasks}/${aggregates.totalTasks} tasks`}
            />
            <KpiTile
              icon={<AlertTriangle className="h-4 w-4 text-[#a8893a]" />}
              label="At risk"
              value={aggregates.atRiskCount.toString()}
              accent={aggregates.atRiskCount > 0}
            />
            <KpiTile
              icon={<Clock className="h-4 w-4 text-[#a8893a]" />}
              label="Overdue tasks"
              value={aggregates.overdueTasks.toString()}
              accent={aggregates.overdueTasks > 0}
            />
          </div>

          {/* Type & Gate breakdowns (always visible) */}
          {portfolio._count.projects > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <BreakdownCard
                title="By project type"
                items={(Object.keys(TYPE_META) as ProjectType[]).map((t) => ({
                  label: TYPE_META[t].label,
                  count: aggregates.byType[t],
                }))}
                total={portfolio._count.projects}
              />
              <BreakdownCard
                title="By lifecycle gate"
                items={(Object.keys(GATE_META) as ProjectGate[]).map((g) => ({
                  label: GATE_META[g].label,
                  count: aggregates.byGate[g],
                }))}
                total={portfolio._count.projects}
              />
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="list">
                <ListIcon className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">List</span>
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <CalendarRange className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="panel">
                <LayoutDashboard className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Panel</span>
              </TabsTrigger>
              <TabsTrigger value="progress">
                <Activity className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
              <TabsTrigger value="workload">
                <Users className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Workload</span>
              </TabsTrigger>
              <TabsTrigger value="messages">
                <MessageSquare className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4">
              <div className="bg-white rounded-lg border">
                <div className="flex items-center gap-2 px-3 md:px-4 py-3 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddProjectOpen(true);
                      fetchAvailableProjects();
                    }}
                  >
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add project</span>
                  </Button>
                  <span className="text-xs text-gray-500 ml-auto hidden md:block">
                    Drag rows to reorder.
                  </span>
                </div>

                {portfolio.projects.length === 0 ? (
                  <EmptyProjects
                    onAdd={() => {
                      setAddProjectOpen(true);
                      fetchAvailableProjects();
                    }}
                  />
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={portfolio.projects.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div>
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                          <div className="col-span-4">Name</div>
                          <div className="col-span-1">Type</div>
                          <div className="col-span-1">Gate</div>
                          <div className="col-span-2">Status</div>
                          <div className="col-span-2">Progress</div>
                          <div className="col-span-1">Owner</div>
                          <div className="col-span-1"></div>
                        </div>
                        {portfolio.projects.map((pp) => (
                          <SortableProjectRow
                            key={pp.id}
                            pp={pp}
                            onClick={() =>
                              router.push(`/projects/${pp.project.id}`)
                            }
                            onRemove={() => handleRemoveProject(pp.project.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              {portfolio.projects.length === 0 ? (
                <EmptyState
                  title="No projects to plot"
                  message="Add projects with start and end dates to see them on the timeline."
                  onAdd={() => {
                    setAddProjectOpen(true);
                    fetchAvailableProjects();
                  }}
                />
              ) : (
                <PortfolioTimelineView projects={portfolio.projects} />
              )}
            </TabsContent>

            <TabsContent value="panel" className="mt-4">
              <PortfolioPanelView
                projects={portfolio.projects}
                totalBudget={aggregates.totalBudget}
                currency={aggregates.currency}
                totalTasks={aggregates.totalTasks}
                completedTasks={aggregates.completedTasks}
                overdueTasks={aggregates.overdueTasks}
                atRiskCount={aggregates.atRiskCount}
                avgProgress={aggregates.avgProgress}
              />
            </TabsContent>

            <TabsContent value="progress" className="mt-4">
              <PortfolioProgressView
                inProgress={aggregates.activeProjects}
                atRisk={aggregates.atRiskCount}
                offTrack={aggregates.offTrackCount}
                total={portfolio._count.projects}
                updates={updates}
                updatesLoading={updatesLoading}
                onPost={handlePostUpdate}
              />
            </TabsContent>

            <TabsContent value="workload" className="mt-4">
              {portfolio.projects.length === 0 ? (
                <EmptyState
                  title="No workload to show"
                  message="Add projects to see assignee workload across this portfolio."
                  onAdd={() => {
                    setAddProjectOpen(true);
                    fetchAvailableProjects();
                  }}
                />
              ) : (
                <PortfolioWorkloadView
                  portfolioId={portfolioId}
                  projectCount={portfolio._count.projects}
                />
              )}
            </TabsContent>

            <TabsContent value="messages" className="mt-4">
              <PortfolioMessagesView portfolioId={portfolioId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Add Project Dialog */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add project to portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No available projects
                  </div>
                ) : (
                  availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              className="w-full bg-black hover:bg-gray-800"
              onClick={handleAddProject}
              disabled={adding || !selectedProjectId}
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add project"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────

function KpiTile({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 md:p-4",
        accent && "border-[#a8893a]/50 bg-[#a8893a]/5"
      )}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl md:text-2xl font-semibold text-black mt-1 tabular-nums">
        {value}
      </div>
      {sub && (
        <div className="text-xs text-gray-500 mt-0.5 tabular-nums">{sub}</div>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  items,
  total,
}: {
  title: string;
  items: { label: string; count: number }[];
  total: number;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        {title}
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const pct = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <span className="w-28 text-gray-700 truncate">{item.label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#c9a84c] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums text-black font-medium">
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyProjects({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Folder className="h-8 w-8 text-gray-400" />
      </div>
      <h2 className="text-base font-medium text-black mb-2">
        No projects in this portfolio
      </h2>
      <p className="text-sm text-gray-500 max-w-md mb-4">
        Add projects to track their progress, budget, and health together.
      </p>
      <Button onClick={onAdd} className="bg-black hover:bg-gray-800">
        <Plus className="h-4 w-4 mr-2" />
        Add project
      </Button>
    </div>
  );
}

function EmptyState({
  title,
  message,
  onAdd,
}: {
  title: string;
  message: string;
  onAdd: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border p-12 text-center">
      <h3 className="text-base font-medium text-black mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      <Button onClick={onAdd} className="bg-black hover:bg-gray-800" size="sm">
        <Plus className="h-4 w-4 mr-2" />
        Add project
      </Button>
    </div>
  );
}

function SortableProjectRow({
  pp,
  onClick,
  onRemove,
}: {
  pp: PortfolioProject;
  onClick: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pp.id });

  const p = pp.project;
  const m = statusMeta(p.status);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b last:border-0 hover:bg-gray-50 cursor-pointer group bg-white",
        isDragging && "shadow-lg"
      )}
      onClick={onClick}
    >
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 items-center">
        <div className="col-span-4 flex items-center gap-2 min-w-0">
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="touch-none cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-1 -ml-1 text-gray-400 hover:text-gray-700"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div
            className="w-3 h-3 rounded flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="font-medium text-black truncate">{p.name}</span>
        </div>
        <div className="col-span-1">
          {p.type ? (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">
              {TYPE_META[p.type].short}
            </span>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </div>
        <div className="col-span-1 text-xs text-gray-700 truncate">
          {p.gate ? GATE_META[p.gate].label : "—"}
        </div>
        <div className="col-span-2">
          <Badge className={cn(m.chip, "text-xs")}>{m.label}</Badge>
        </div>
        <div className="col-span-2">
          <div className="flex items-center gap-2">
            <Progress value={p.stats.progress} className="h-1.5 flex-1" />
            <span className="text-xs text-gray-600 w-9 tabular-nums">
              {p.stats.progress}%
            </span>
          </div>
        </div>
        <div className="col-span-1">
          <Avatar className="h-6 w-6">
            <AvatarImage src={p.owner.image || ""} />
            <AvatarFallback className="text-xs bg-gray-200">
              {p.owner.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="col-span-1 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-black"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove from portfolio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="md:hidden px-3 py-3 flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="touch-none cursor-grab text-gray-400"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="w-3 h-3 rounded flex-shrink-0"
          style={{ backgroundColor: p.color }}
        />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-black truncate text-sm block">
            {p.name}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Progress
              value={p.stats.progress}
              className="h-1.5 flex-1 max-w-[100px]"
            />
            <span className="text-[11px] text-gray-500 tabular-nums">
              {p.stats.progress}%
            </span>
            <Badge className={cn("text-[10px] px-1.5 py-0", m.chip)}>
              {m.label}
            </Badge>
          </div>
        </div>
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={p.owner.image || ""} />
          <AvatarFallback className="text-xs bg-gray-200">
            {p.owner.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-black"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from portfolio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
