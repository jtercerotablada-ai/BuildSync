"use client";

/**
 * portfolio-panel-view.tsx — the Portfolio "Panel" (Asana "Panel"/Dashboard).
 *
 * This is a REAL custom-chart dashboard, not a fixed set of recharts. It reuses
 * the shared reporting engine + components end-to-end:
 *   • The "Add widget" menu offers Template chart | Custom chart | Text (Asana
 *     parity with the Reporting dashboards).
 *   • Custom charts open the shared <ChartBuilder/> with its scope PRESET +
 *     LOCKED to this portfolio ({ kind:'portfolio', portfolioId }). Every chart
 *     therefore aggregates across the portfolio's projects.
 *   • Each widget queries POST /api/reports/query and renders via the shared
 *     <ReportChart/> (the same renderer the builder preview + Reporting grid
 *     use), so nothing can drift.
 *   • Widgets persist as SHARED, durable ReportWidget rows via
 *     /api/portfolios/{portfolioId}/widgets (a portfolio is multi-member, so
 *     the Panel is a shared dashboard — NOT per-user uiState). dnd-kit reorder,
 *     per-widget edit / expand / duplicate / resize / remove, and a "View all"
 *     drilldown are all wired to that API.
 *
 * The KPI number row at the top is preserved from the portfolio aggregates the
 * detail page already computes (this component's prop signature is UNCHANGED so
 * the detail page needs no edit — portfolioId comes from useParams()).
 */

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Filter,
  Loader2,
  BarChart3,
  LayoutTemplate,
  PenLine,
  Type as TypeIcon,
  Pencil,
  Maximize2,
  Copy,
  Trash2,
  Columns2,
  Square,
  GripVertical,
  ExternalLink,
  MoreHorizontal,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChartBuilder, type ChartBuilderResult } from "@/components/reporting/chart-builder";
import { ReportChart } from "@/components/reporting/report-chart";
import type {
  ChartConfig,
  ChartQueryResponse,
  ChartScope,
  ChartType,
} from "@/lib/report-config";

// ─── Props (UNCHANGED — the detail page passes these verbatim) ──────

type ProjectStatus =
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

interface PanelProject {
  id: string;
  name: string;
  color: string;
  status: ProjectStatus;
  type: ProjectType | null;
  gate: ProjectGate | null;
  budget: number | null;
  stats: { total: number; completed: number; overdue: number; progress: number };
}

interface Props {
  projects: { id: string; project: PanelProject }[];
  totalBudget: number;
  currency: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  atRiskCount: number;
  avgProgress: number;
  activeProjects: number;
  projectCount: number;
  byType: Record<ProjectType, number>;
  byGate: Record<ProjectGate, number>;
}

// ─── Widget model ───────────────────────────────────────────────────
// A portfolio-panel widget is one of:
//   custom — a builder-configured chart (queries POST /api/reports/query with
//            the LOCKED portfolio scope)
//   text   — a free-text card
// All widgets are ReportWidget rows (real ids) via the portfolio widgets API.

type WidgetKind = "custom" | "text";

interface PanelWidget {
  /** ReportWidget.id (stable, server-assigned). */
  id: string;
  kind: WidgetKind;
  title: string;
  width: 1 | 2;
  // custom
  chartConfig?: ChartConfig;
  showDataLabels?: boolean;
  benchmark?: number;
  // text
  text?: string;
}

interface ReportWidgetRow {
  id: string;
  title: string;
  width: number;
  position: number;
  config: unknown;
}

/** Map ReportWidget rows → PanelWidget[]. Only custom + text are expected;
 *  a stray catalog row (shouldn't occur here) is skipped defensively. */
function rowsToWidgets(rows: ReportWidgetRow[]): PanelWidget[] {
  return rows
    .map((row): PanelWidget | null => {
      const cfg = row.config as Record<string, unknown> | null;
      const width = (row.width === 2 ? 2 : 1) as 1 | 2;
      if (cfg && cfg.kind === "text") {
        return { id: row.id, kind: "text", title: row.title, width, text: String(cfg.text ?? "") };
      }
      if (cfg && cfg.kind === "custom" && cfg.chartConfig) {
        return {
          id: row.id,
          kind: "custom",
          title: row.title,
          width,
          chartConfig: cfg.chartConfig as ChartConfig,
          showDataLabels: cfg.showDataLabels as boolean | undefined,
          benchmark: cfg.benchmark as number | undefined,
        };
      }
      return null;
    })
    .filter((w): w is PanelWidget => w != null);
}

// ─── Template chart presets (portfolio-scoped) ──────────────────────
// Asana's "Template chart" gallery. Because the Panel is portfolio-scoped, we
// seed the BUILDER with portfolio-scoped ChartConfigs rather than the
// workspace-wide precomputed catalog (which would ignore the portfolio). The
// user tweaks + confirms in the same builder, so scope stays locked.

interface PanelTemplate {
  id: string;
  name: string;
  icon: ChartType;
  /** Produce a full portfolio-scoped ChartConfig to seed the builder with. */
  build: (scope: ChartScope) => ChartConfig;
}

const PANEL_TEMPLATES: PanelTemplate[] = [
  {
    id: "projects-by-status",
    name: "Projects by status",
    icon: "donut",
    build: (scope) => ({
      entity: "projects",
      scope,
      chartType: "donut",
      dimension: { field: "status" },
      measures: [{ field: "project", aggregation: "count" }],
      filters: [],
      options: { showDataLabels: true, limit: 12 },
    }),
  },
  {
    id: "incomplete-by-project",
    name: "Incomplete tasks by project",
    icon: "bar",
    build: (scope) => ({
      entity: "tasks",
      scope,
      chartType: "bar",
      dimension: { field: "project" },
      measures: [{ field: "task", aggregation: "count" }],
      filters: [{ field: "completionStatus", operator: "is", value: "Incomplete" }],
      options: { showDataLabels: true, limit: 12 },
    }),
  },
  {
    id: "tasks-by-status",
    name: "Tasks by completion status",
    icon: "donut",
    build: (scope) => ({
      entity: "tasks",
      scope,
      chartType: "donut",
      dimension: { field: "completionStatus" },
      measures: [{ field: "task", aggregation: "count" }],
      filters: [],
      options: { showDataLabels: true, limit: 12 },
    }),
  },
  {
    id: "tasks-by-assignee",
    name: "Tasks by assignee",
    icon: "column",
    build: (scope) => ({
      entity: "tasks",
      scope,
      chartType: "column",
      dimension: { field: "assignee" },
      measures: [{ field: "task", aggregation: "count" }],
      filters: [],
      options: { showDataLabels: true, limit: 12 },
    }),
  },
  {
    id: "tasks-by-assignee-status",
    name: "Tasks by assignee and status",
    icon: "stackedBar",
    build: (scope) => ({
      entity: "tasks",
      scope,
      chartType: "stackedBar",
      dimension: { field: "assignee" },
      breakdown: { field: "completionStatus" },
      measures: [{ field: "task", aggregation: "count" }],
      filters: [],
      options: { showDataLabels: true, limit: 12 },
    }),
  },
  {
    id: "overdue-by-project",
    name: "Overdue tasks by project",
    icon: "bar",
    build: (scope) => ({
      entity: "tasks",
      scope,
      chartType: "bar",
      dimension: { field: "project" },
      measures: [{ field: "task", aggregation: "count" }],
      filters: [{ field: "dueStatus", operator: "is", value: "Overdue" }],
      options: { showDataLabels: true, limit: 12 },
    }),
  },
  {
    id: "tasks-by-project",
    name: "Tasks by project",
    icon: "column",
    build: (scope) => ({
      entity: "tasks",
      scope,
      chartType: "column",
      dimension: { field: "project" },
      measures: [{ field: "task", aggregation: "count" }],
      filters: [],
      options: { showDataLabels: true, limit: 12 },
    }),
  },
  {
    id: "tasks-completed-over-time",
    name: "Tasks completed over time",
    icon: "line",
    build: (scope) => ({
      entity: "tasks",
      scope,
      chartType: "line",
      dimension: { field: "date", dateGrain: "month" },
      measures: [{ field: "task", aggregation: "count" }],
      filters: [{ field: "completionStatus", operator: "is", value: "Completed" }],
      options: { showDataLabels: true, limit: 12 },
    }),
  },
  {
    id: "total-tasks",
    name: "Total tasks",
    icon: "number",
    build: (scope) => ({
      entity: "tasks",
      scope,
      chartType: "number",
      measures: [{ field: "task", aggregation: "count" }],
      filters: [],
      options: { showDataLabels: true },
    }),
  },
];

// ── Template gallery SVG icons ──
function TIconColumn() {
  return (
    <svg width="56" height="42" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="20" width="12" height="24" rx="2" fill="#888888" />
      <rect x="20" y="12" width="12" height="32" rx="2" fill="#94A3B8" />
      <rect x="36" y="8" width="12" height="36" rx="2" fill="#888888" />
      <rect x="52" y="16" width="8" height="28" rx="2" fill="#CBD5E1" />
    </svg>
  );
}
function TIconBar() {
  return (
    <svg width="56" height="42" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="4" width="40" height="8" rx="2" fill="#888888" />
      <rect x="4" y="16" width="28" height="8" rx="2" fill="#94A3B8" />
      <rect x="4" y="28" width="52" height="8" rx="2" fill="#888888" />
      <rect x="4" y="40" width="20" height="6" rx="2" fill="#CBD5E1" />
    </svg>
  );
}
function TIconDonut() {
  return (
    <svg width="56" height="42" viewBox="0 0 64 48" fill="none">
      <path d="M32 4C18.7 4 8 14.7 8 28s10.7 24 24 24 24-10.7 24-24S45.3 4 32 4zm0 36c-6.6 0-12-5.4-12-12s5.4-12 12-12 12 5.4 12 12-5.4 12-12 12z" fill="#CBD5E1" />
      <path d="M32 4v12c6.6 0 12 5.4 12 12h12c0-13.3-10.7-24-24-24z" fill="#888888" />
      <path d="M44 28c0-6.6-5.4-12-12-12V4c13.3 0 24 10.7 24 24h-12z" fill="#94A3B8" />
    </svg>
  );
}
function TIconLine() {
  return (
    <svg width="56" height="42" viewBox="0 0 64 48" fill="none">
      <path d="M4 40L16 28L28 32L40 16L56 8" stroke="#888888" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="28" r="3" fill="#888888" />
      <circle cx="40" cy="16" r="3" fill="#888888" />
      <circle cx="56" cy="8" r="3" fill="#888888" />
    </svg>
  );
}
function TIconStacked() {
  return (
    <svg width="56" height="42" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="28" width="12" height="16" rx="2" fill="#888888" />
      <rect x="4" y="16" width="12" height="12" rx="2" fill="#94A3B8" />
      <rect x="20" y="20" width="12" height="24" rx="2" fill="#888888" />
      <rect x="20" y="8" width="12" height="12" rx="2" fill="#CBD5E1" />
      <rect x="36" y="24" width="12" height="20" rx="2" fill="#888888" />
      <rect x="36" y="12" width="12" height="12" rx="2" fill="#94A3B8" />
    </svg>
  );
}
function TIconNumber() {
  return (
    <svg width="56" height="42" viewBox="0 0 64 48" fill="none">
      <rect x="8" y="8" width="48" height="32" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
      <text x="32" y="32" textAnchor="middle" fontSize="20" fontWeight="600" fill="#888888">42</text>
    </svg>
  );
}

const TEMPLATE_ICON: Record<ChartType, () => React.ReactElement> = {
  column: TIconColumn,
  bar: TIconBar,
  stackedBar: TIconStacked,
  groupedBar: TIconStacked,
  line: TIconLine,
  burnup: TIconLine,
  burndown: TIconLine,
  donut: TIconDonut,
  number: TIconNumber,
  lollipop: TIconBar,
};

// ══════════════════════════════════════════════════════════════════
//  Component
// ══════════════════════════════════════════════════════════════════

export function PortfolioPanelView({
  projects,
  totalTasks,
  completedTasks,
  overdueTasks,
}: Props) {
  const params = useParams();
  const portfolioId = params.portfolioId as string;

  // The scope every chart in this Panel is locked to.
  const lockedScope: ChartScope = { kind: "portfolio", portfolioId };

  const incompleteTasks = Math.max(totalTasks - completedTasks, 0);

  // ── Widgets (shared ReportWidget rows) ──
  const [widgets, setWidgets] = useState<PanelWidget[]>([]);
  const [widgetsLoaded, setWidgetsLoaded] = useState(false);

  // Modals
  const [templateOpen, setTemplateOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderInitial, setBuilderInitial] = useState<
    { title: string; chartConfig: ChartConfig; showDataLabels?: boolean; benchmark?: number } | null
  >(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [textDraft, setTextDraft] = useState({ id: "", title: "", text: "" });
  const [expandWidget, setExpandWidget] = useState<PanelWidget | null>(null);

  // Guard concurrent loads (portfolio switch).
  const loadTokenRef = useRef(0);

  // Load widgets for this portfolio.
  useEffect(() => {
    if (!portfolioId) return;
    const token = ++loadTokenRef.current;
    setWidgetsLoaded(false);
    (async () => {
      try {
        const res = await fetch(`/api/portfolios/${portfolioId}/widgets`);
        if (token !== loadTokenRef.current) return;
        if (res.ok) {
          const rows = await res.json();
          setWidgets(rowsToWidgets(rows));
        } else {
          setWidgets([]);
        }
      } catch {
        if (token === loadTokenRef.current) setWidgets([]);
      } finally {
        if (token === loadTokenRef.current) setWidgetsLoaded(true);
      }
    })();
  }, [portfolioId]);

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWidgets((prev) => {
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const newIndex = prev.findIndex((w) => w.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      // Persist the new positions (best-effort; local order already applied).
      fetch(`/api/portfolios/${portfolioId}/widgets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((w, i) => ({ id: w.id, position: i })) }),
      }).catch(() => {});
      return next;
    });
  }

  // ── Add: template chart (seed the locked builder) ──
  const handlePickTemplate = (template: PanelTemplate) => {
    setTemplateOpen(false);
    setEditingWidgetId(null);
    setBuilderInitial({
      title: template.name,
      chartConfig: template.build(lockedScope),
    });
    setBuilderOpen(true);
  };

  // ── Add / edit: custom chart ──
  const openCustomBuilder = () => {
    setEditingWidgetId(null);
    setBuilderInitial(null);
    setBuilderOpen(true);
  };

  const openEditBuilder = (w: PanelWidget) => {
    if (!w.chartConfig) return;
    setEditingWidgetId(w.id);
    setBuilderInitial({
      title: w.title,
      chartConfig: w.chartConfig,
      showDataLabels: w.showDataLabels,
      benchmark: w.benchmark,
    });
    setBuilderOpen(true);
  };

  const handleBuilderSubmit = async (result: ChartBuilderResult) => {
    // Force the persisted config onto the locked portfolio scope (the builder
    // already locks it; belt-and-suspenders so the server 400 never fires).
    const chartConfig: ChartConfig = { ...result.chartConfig, scope: lockedScope };
    const configObj = {
      kind: "custom" as const,
      chartType: result.chartType,
      chartConfig,
      showDataLabels: result.showDataLabels,
      benchmark: result.benchmark,
    };

    // EDIT
    if (editingWidgetId) {
      const targetId = editingWidgetId;
      setEditingWidgetId(null);
      try {
        const res = await fetch(`/api/portfolios/${portfolioId}/widgets`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widgetId: targetId, title: result.title, config: configObj }),
        });
        if (!res.ok) throw new Error();
      } catch {
        toast.error("Failed to save chart");
        return;
      }
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                title: result.title,
                chartConfig,
                showDataLabels: result.showDataLabels,
                benchmark: result.benchmark,
              }
            : w
        )
      );
      toast.success("Chart updated");
      return;
    }

    // ADD
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: result.title, width: 1, config: configObj }),
      });
      if (!res.ok) throw new Error();
      const row = await res.json();
      setWidgets((prev) => [...prev, ...rowsToWidgets([row])]);
      toast.success(`"${result.title}" added`);
    } catch {
      toast.error("Failed to add chart");
    }
  };

  // ── Add / edit: text widget ──
  const openTextNew = () => {
    setTextDraft({ id: "", title: "Text", text: "" });
    setTextOpen(true);
  };
  const openTextEdit = (w: PanelWidget) => {
    setTextDraft({ id: w.id, title: w.title, text: w.text || "" });
    setTextOpen(true);
  };
  const handleTextSave = async () => {
    const text = textDraft.text.trim();
    const title = textDraft.title.trim() || "Text";
    setTextOpen(false);
    const configObj = { kind: "text" as const, text };

    // EDIT
    if (textDraft.id) {
      const targetId = textDraft.id;
      try {
        const res = await fetch(`/api/portfolios/${portfolioId}/widgets`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widgetId: targetId, title, config: configObj }),
        });
        if (!res.ok) throw new Error();
      } catch {
        toast.error("Failed to save text");
        return;
      }
      setWidgets((prev) => prev.map((w) => (w.id === targetId ? { ...w, title, text } : w)));
      return;
    }

    // ADD
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, width: 2, config: configObj }),
      });
      if (!res.ok) throw new Error();
      const row = await res.json();
      setWidgets((prev) => [...prev, ...rowsToWidgets([row])]);
    } catch {
      toast.error("Failed to add text");
    }
  };

  // ── Remove / duplicate / resize ──
  const handleRemove = async (id: string) => {
    // Optimistic; restore on failure.
    const snapshot = widgets;
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/widgets?widgetId=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Widget removed");
    } catch {
      setWidgets(snapshot);
      toast.error("Failed to remove widget");
    }
  };

  const handleDuplicate = async (id: string) => {
    const original = widgets.find((w) => w.id === id);
    if (!original) return;
    const copyTitle = `${original.title} (copy)`;
    const configObj =
      original.kind === "text"
        ? { kind: "text" as const, text: original.text || "" }
        : {
            kind: "custom" as const,
            chartType: original.chartConfig!.chartType,
            chartConfig: { ...original.chartConfig!, scope: lockedScope },
            showDataLabels: original.showDataLabels,
            benchmark: original.benchmark,
          };
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: copyTitle, width: original.width, config: configObj }),
      });
      if (!res.ok) throw new Error();
      const row = await res.json();
      setWidgets((prev) => [...prev, ...rowsToWidgets([row])]);
      toast.success("Widget duplicated");
    } catch {
      toast.error("Failed to duplicate");
    }
  };

  const handleSetWidth = async (id: string, width: 1 | 2) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, width } : w)));
    fetch(`/api/portfolios/${portfolioId}/widgets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetId: id, width }),
    }).catch(() => {});
  };

  // ── Empty portfolio: keep the KPI strip, invite adding projects ──
  const noProjects = projects.length === 0;

  return (
    <div className="space-y-4">
      {/* Toolbar — Add widget menu (Template / Custom / Text) */}
      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Add widget</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate className="w-4 h-4 mr-2" />
              <div className="flex flex-col">
                <span>Template chart</span>
                <span className="text-[11px] text-slate-400">Prebuilt, portfolio-scoped</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openCustomBuilder}>
              <PenLine className="w-4 h-4 mr-2" />
              <div className="flex flex-col">
                <span>Custom chart</span>
                <span className="text-[11px] text-slate-400">Full builder</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openTextNew}>
              <TypeIcon className="w-4 h-4 mr-2" />
              <div className="flex flex-col">
                <span>Text</span>
                <span className="text-[11px] text-slate-400">A note or heading</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <a
          href="mailto:feedback@ttcivilstructural.com?subject=Panel%20Feedback"
          className="text-xs text-[#a8893a] hover:underline inline-flex items-center gap-1"
        >
          <MessageSquare className="h-3 w-3" />
          Send feedback
        </a>
      </div>

      {/* KPI number row (from portfolio aggregates) */}
      <SummaryStrip
        totalTasks={totalTasks}
        completedTasks={completedTasks}
        incompleteTasks={incompleteTasks}
        overdueTasks={overdueTasks}
      />

      {/* Widget grid */}
      {noProjects ? (
        <div className="bg-white rounded-lg border p-12 text-center text-sm text-gray-500">
          Add projects to this portfolio to build a panel dashboard.
        </div>
      ) : !widgetsLoaded ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : widgets.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl py-12 px-4 text-center">
          <BarChart3 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-700 mb-1">No charts yet</p>
          <p className="text-xs text-slate-500 mb-4">
            Add a chart to visualize this portfolio&apos;s work.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Template chart
            </Button>
            <Button variant="outline" size="sm" onClick={openCustomBuilder}>
              <Plus className="w-4 h-4 mr-2" />
              Custom chart
            </Button>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {widgets.map((w) => (
                <SortableWidget
                  key={w.id}
                  widget={w}
                  onEdit={() => (w.kind === "text" ? openTextEdit(w) : openEditBuilder(w))}
                  onExpand={() => setExpandWidget(w)}
                  onDuplicate={() => handleDuplicate(w.id)}
                  onRemove={() => handleRemove(w.id)}
                  onSetWidth={(width) => handleSetWidth(w.id, width)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Template chart gallery */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[760px] max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b">
            <DialogTitle>Template chart</DialogTitle>
          </DialogHeader>
          <div className="p-4 md:p-6 overflow-auto">
            <p className="text-xs text-slate-500 mb-4">
              Prebuilt charts scoped to this portfolio. Pick one to open the builder and fine-tune it.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {PANEL_TEMPLATES.map((template) => {
                const Icon = TEMPLATE_ICON[template.icon];
                return (
                  <button
                    key={template.id}
                    onClick={() => handlePickTemplate(template)}
                    className="border rounded-xl p-3 md:p-4 hover:border-black hover:shadow-lg transition-all text-left bg-white group"
                  >
                    <div className="flex items-center justify-center mb-3 md:mb-4 p-2 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
                      {Icon && <Icon />}
                    </div>
                    <span className="text-xs md:text-sm font-medium text-slate-700 leading-tight line-clamp-2 break-words">
                      {template.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom chart builder — scope LOCKED to this portfolio */}
      <ChartBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initial={builderInitial}
        onSubmit={handleBuilderSubmit}
        lockedScope={lockedScope}
        lockedScopeLabel="This portfolio"
      />

      {/* Text widget editor */}
      <Dialog open={textOpen} onOpenChange={setTextOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{textDraft.id ? "Edit text" : "Add text"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Input
              value={textDraft.title}
              onChange={(e) => setTextDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title"
            />
            <Textarea
              value={textDraft.text}
              onChange={(e) => setTextDraft((d) => ({ ...d, text: e.target.value }))}
              placeholder="Write a note, heading, or context for this panel…"
              rows={5}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTextOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={handleTextSave}>
                {textDraft.id ? "Save" : "Add text"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expand (fullscreen) dialog */}
      <Dialog open={!!expandWidget} onOpenChange={(o) => !o && setExpandWidget(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[1000px] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{expandWidget?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-auto">
            {expandWidget && <WidgetBody widget={expandWidget} height={460} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Sortable widget wrapper
// ══════════════════════════════════════════════════════════════════

interface SortableWidgetProps {
  widget: PanelWidget;
  onEdit: () => void;
  onExpand: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSetWidth: (width: 1 | 2) => void;
}

function SortableWidget({
  widget,
  onEdit,
  onExpand,
  onDuplicate,
  onRemove,
  onSetWidth,
}: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-lg border p-3 md:p-4 group relative",
        widget.width === 2 ? "lg:col-span-2" : "lg:col-span-1"
      )}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            className="opacity-40 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-medium text-slate-900 break-words min-w-0">
            {widget.title}
          </h3>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {widget.kind !== "text" && (
            <button
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5"
              onClick={onExpand}
              aria-label="Expand"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          <button
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5"
            onClick={onEdit}
            aria-label="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label="More"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              {widget.width === 2 ? (
                <DropdownMenuItem onClick={() => onSetWidth(1)}>
                  <Columns2 className="w-4 h-4 mr-2" />
                  Make half width
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onSetWidth(2)}>
                  <Square className="w-4 h-4 mr-2" />
                  Make full width
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-black" onClick={onRemove}>
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <WidgetBody widget={widget} height={200} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Widget body — renders custom (engine query) / text
// ══════════════════════════════════════════════════════════════════

function WidgetBody({ widget, height }: { widget: PanelWidget; height: number }) {
  if (widget.kind === "text") {
    return (
      <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed min-h-[60px]">
        {widget.text || <span className="text-slate-400">Empty text widget.</span>}
      </div>
    );
  }
  if (widget.chartConfig) {
    return <CustomChartWidget widget={widget} height={height} />;
  }
  return (
    <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
      No data available
    </div>
  );
}

// ── Custom chart widget: queries the engine, renders ReportChart ──

function CustomChartWidget({ widget, height }: { widget: PanelWidget; height: number }) {
  const [resp, setResp] = useState<ChartQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const config = widget.chartConfig!;
  const configKey = JSON.stringify(config);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/reports/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: configKey,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Query failed (${res.status})`);
        }
        const data: ChartQueryResponse = await res.json();
        if (!cancelled) {
          setResp(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Query failed");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }
  if (error || !resp) {
    return (
      <div className="flex items-center justify-center text-center text-sm text-[#a8893a] px-4" style={{ height }}>
        {error || "No data"}
      </div>
    );
  }

  return (
    <>
      <ReportChart
        chartType={config.chartType}
        data={resp.data}
        seriesKeys={resp.seriesKeys}
        total={resp.total}
        showDataLabels={widget.showDataLabels ?? true}
        benchmark={widget.benchmark}
        height={height}
      />
      <WidgetFooter filterSummary={resp.meta.filterSummary} drilldownBase={resp.meta.drilldownBase} />
    </>
  );
}

// ── Shared widget footer: filter summary + View all drilldown ──

function WidgetFooter({
  filterSummary,
  drilldownBase,
}: {
  filterSummary: string;
  drilldownBase?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t text-[10px] md:text-xs text-slate-400 gap-2">
      <div className="flex items-center gap-1 min-w-0">
        <Filter className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{filterSummary}</span>
      </div>
      {drilldownBase && (
        <Link
          href={`/my-tasks?${drilldownBase}`}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-900 flex-shrink-0"
        >
          <span>View all</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  KPI summary strip (preserved)
// ══════════════════════════════════════════════════════════════════

function SummaryStrip({
  totalTasks,
  completedTasks,
  incompleteTasks,
  overdueTasks,
}: {
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  overdueTasks: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricTile label="Total tasks" value={totalTasks} hint="No filters" />
      <MetricTile label="Completed tasks" value={completedTasks} hint="1 filter" />
      <MetricTile label="Incomplete tasks" value={incompleteTasks} hint="1 filter" />
      <MetricTile
        label="Overdue tasks"
        value={overdueTasks}
        hint="1 filter"
        accent={overdueTasks > 0}
      />
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-4 md:p-5",
        accent && "border-[#a8893a]/40 bg-[#a8893a]/5"
      )}
    >
      <div className="text-sm text-gray-700">{label}</div>
      <div className="text-3xl md:text-4xl font-semibold text-black mt-2 tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded-sm bg-gray-200" />
        {hint}
      </div>
    </div>
  );
}

export default PortfolioPanelView;
