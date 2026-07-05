"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import {
  Plus,
  Star,
  Share2,
  MoreHorizontal,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
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
import { ChartBuilder, type ChartBuilderResult } from "@/components/reporting/chart-builder";
import { ReportChart } from "@/components/reporting/report-chart";
import type { ChartConfig, ChartQueryResponse } from "@/lib/report-config";

// ─── Widget model (two-tier persistence) ──────────────────────────
// A dashboard widget is one of:
//   catalog — a predefined /api/reports bundle chart (legacy)
//   custom  — a builder-configured chart (queries POST /api/reports/query)
//   text    — a free-text card
// Custom-dashboard widgets are ReportWidget rows (real ids). Virtual
// default dashboards persist the same objects inside uiState.

type WidgetKind = "catalog" | "custom" | "text";

interface DashboardWidget {
  /** Stable id (ReportWidget.id for custom dashboards; local uid otherwise). */
  id: string;
  kind: WidgetKind;
  title: string;
  width: 1 | 2;
  // catalog
  catalogId?: string;
  // custom
  chartConfig?: ChartConfig;
  showDataLabels?: boolean;
  benchmark?: number;
  // text
  text?: string;
}

// Legacy uiState string entry: "catalogId-ts::title"
function widgetFromLegacyString(entry: string): DashboardWidget {
  const [catalogPart, title] = entry.split("::");
  const catalogId = catalogPart.split("-")[0];
  return {
    id: `w-${entry}`,
    kind: "catalog",
    title: title || catalogId,
    width: 2,
    catalogId,
  };
}

function uid(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Catalog (Template chart) definitions ─────────────────────────

type CatalogChartType =
  | "bar"
  | "horizontal-bar"
  | "donut"
  | "line"
  | "stacked"
  | "number"
  | "lollipop";

const widgetCategories = {
  recommended: {
    label: "Recommended",
    widgets: [
      { id: "incomplete-by-project", name: "Incomplete tasks by project", chartType: "horizontal-bar" as CatalogChartType },
      { id: "projects-by-status", name: "Projects by status", chartType: "donut" as CatalogChartType },
    ],
  },
  resources: {
    label: "Resources",
    widgets: [
      { id: "tasks-assignee-status", name: "Tasks by assignee and status", chartType: "stacked" as CatalogChartType, isNew: true },
      { id: "upcoming-by-assignee", name: "Upcoming tasks this week by assignee", chartType: "lollipop" as CatalogChartType },
      { id: "tasks-month-project", name: "Tasks this month by project", chartType: "bar" as CatalogChartType },
      { id: "custom-field-total", name: "Total tasks", chartType: "number" as CatalogChartType },
      { id: "projects-by-owner", name: "Projects by owner", chartType: "horizontal-bar" as CatalogChartType },
      { id: "projects-by-portfolio", name: "Projects by portfolio", chartType: "donut" as CatalogChartType },
      { id: "tasks-by-creator", name: "Tasks by creator", chartType: "bar" as CatalogChartType },
    ],
  },
  workStatus: {
    label: "Work status",
    widgets: [
      { id: "overdue-by-project", name: "Overdue tasks by project", chartType: "donut" as CatalogChartType },
      { id: "upcoming-by-project", name: "Upcoming tasks by project", chartType: "bar" as CatalogChartType },
      { id: "goals-by-status", name: "Goals by status", chartType: "donut" as CatalogChartType },
    ],
  },
  progress: {
    label: "Progress",
    widgets: [
      { id: "projects-most-completed", name: "Projects with most completed tasks", chartType: "horizontal-bar" as CatalogChartType },
      { id: "tasks-month-status", name: "Tasks this month by completion status", chartType: "donut" as CatalogChartType },
      { id: "tasks-completed-month", name: "Tasks completed by month", chartType: "line" as CatalogChartType },
    ],
  },
};

// ─── SVG catalog icons ────────────────────────────────────────────

function BarChartIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="20" width="12" height="24" rx="2" fill="#888888" />
      <rect x="20" y="12" width="12" height="32" rx="2" fill="#94A3B8" />
      <rect x="36" y="8" width="12" height="36" rx="2" fill="#888888" />
      <rect x="52" y="16" width="8" height="28" rx="2" fill="#CBD5E1" />
    </svg>
  );
}
function HorizontalBarIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="4" width="40" height="8" rx="2" fill="#888888" />
      <rect x="4" y="16" width="28" height="8" rx="2" fill="#94A3B8" />
      <rect x="4" y="28" width="52" height="8" rx="2" fill="#888888" />
      <rect x="4" y="40" width="20" height="6" rx="2" fill="#CBD5E1" />
    </svg>
  );
}
function DonutChartIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <path d="M32 4C18.7 4 8 14.7 8 28s10.7 24 24 24 24-10.7 24-24S45.3 4 32 4zm0 36c-6.6 0-12-5.4-12-12s5.4-12 12-12 12 5.4 12 12-5.4 12-12 12z" fill="#CBD5E1" />
      <path d="M32 4v12c6.6 0 12 5.4 12 12h12c0-13.3-10.7-24-24-24z" fill="#888888" />
      <path d="M44 28c0-6.6-5.4-12-12-12V4c13.3 0 24 10.7 24 24h-12z" fill="#94A3B8" />
    </svg>
  );
}
function LineChartIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <path d="M4 40L16 28L28 32L40 16L56 8" stroke="#888888" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="28" r="3" fill="#888888" />
      <circle cx="40" cy="16" r="3" fill="#888888" />
      <circle cx="56" cy="8" r="3" fill="#888888" />
    </svg>
  );
}
function StackedBarIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="28" width="12" height="16" rx="2" fill="#888888" />
      <rect x="4" y="16" width="12" height="12" rx="2" fill="#94A3B8" />
      <rect x="20" y="20" width="12" height="24" rx="2" fill="#888888" />
      <rect x="20" y="8" width="12" height="12" rx="2" fill="#CBD5E1" />
      <rect x="36" y="24" width="12" height="20" rx="2" fill="#888888" />
      <rect x="36" y="12" width="12" height="12" rx="2" fill="#94A3B8" />
    </svg>
  );
}
function NumberIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <rect x="8" y="8" width="48" height="32" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
      <text x="32" y="32" textAnchor="middle" fontSize="20" fontWeight="600" fill="#888888">42</text>
    </svg>
  );
}
function LollipopChartIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <circle cx="12" cy="16" r="6" fill="#888888" />
      <circle cx="28" cy="24" r="6" fill="#94A3B8" />
      <circle cx="44" cy="12" r="6" fill="#CBD5E1" />
      <line x1="12" y1="22" x2="12" y2="44" stroke="#888888" strokeWidth="2" />
      <line x1="28" y1="30" x2="28" y2="44" stroke="#94A3B8" strokeWidth="2" />
      <line x1="44" y1="18" x2="44" y2="44" stroke="#CBD5E1" strokeWidth="2" />
    </svg>
  );
}

const chartIconMap: Record<CatalogChartType, () => React.ReactElement> = {
  bar: BarChartIcon,
  "horizontal-bar": HorizontalBarIcon,
  donut: DonutChartIcon,
  line: LineChartIcon,
  stacked: StackedBarIcon,
  number: NumberIcon,
  lollipop: LollipopChartIcon,
};

// ─── Report bundle type (precomputed catalog data) ────────────────

interface ReportBundle {
  kpis: { completed: number; incomplete: number; overdue: number; total: number };
  tasksByProject: { name: string; value: number; color: string }[];
  tasksByStatus: { name: string; value: number; color: string }[];
  projectsByStatus: { name: string; value: number; color: string }[];
  upcomingByAssignee: { name: string; value: number; color: string }[];
  overdueByProject: { name: string; value: number; color: string }[];
  tasksByAssigneeAndStatus: { name: string; completed: number; incomplete: number }[];
  tasksByCreator: { name: string; value: number; color: string }[];
  projectsByOwner: { name: string; value: number; color: string }[];
  projectsByPortfolio: { name: string; value: number; color: string }[];
  goalsByStatus: { name: string; value: number; color: string }[];
  projectsMostCompleted: { name: string; value: number; color: string }[];
  tasksCompletedByMonth: { name: string; value: number }[];
  tasksThisMonthByProject: { name: string; value: number; color: string }[];
  upcomingByProject: { name: string; value: number; color: string }[];
}

const EMPTY_BUNDLE: ReportBundle = {
  kpis: { completed: 0, incomplete: 0, overdue: 0, total: 0 },
  tasksByProject: [],
  tasksByStatus: [],
  projectsByStatus: [],
  upcomingByAssignee: [],
  overdueByProject: [],
  tasksByAssigneeAndStatus: [],
  tasksByCreator: [],
  projectsByOwner: [],
  projectsByPortfolio: [],
  goalsByStatus: [],
  projectsMostCompleted: [],
  tasksCompletedByMonth: [],
  tasksThisMonthByProject: [],
  upcomingByProject: [],
};

// Resolve a catalog widget id to its precomputed data + render type.
function catalogWidgetData(
  catalogId: string,
  data: ReportBundle
): {
  type: "bar-chart" | "donut" | "line" | "stacked" | "number";
  data?: { name: string; value: number; color?: string }[];
  stackedData?: { name: string; completed: number; incomplete: number }[];
  value?: number;
} {
  switch (catalogId) {
    case "incomplete-by-project":
      return { type: "bar-chart", data: data.tasksByProject };
    case "projects-by-status":
      return { type: "donut", data: data.projectsByStatus };
    case "tasks-assignee-status":
      return { type: "stacked", stackedData: data.tasksByAssigneeAndStatus };
    case "upcoming-by-assignee":
      return { type: "bar-chart", data: data.upcomingByAssignee };
    case "tasks-month-project":
      return { type: "bar-chart", data: data.tasksThisMonthByProject };
    case "custom-field-total":
      return { type: "number", value: data.kpis.total };
    case "projects-by-owner":
      return { type: "bar-chart", data: data.projectsByOwner };
    case "projects-by-portfolio":
      return { type: "donut", data: data.projectsByPortfolio };
    case "tasks-by-creator":
      return { type: "bar-chart", data: data.tasksByCreator };
    case "overdue-by-project":
      return { type: "donut", data: data.overdueByProject };
    case "upcoming-by-project":
      return { type: "bar-chart", data: data.upcomingByProject };
    case "goals-by-status":
      return { type: "donut", data: data.goalsByStatus };
    case "projects-most-completed":
      return { type: "bar-chart", data: data.projectsMostCompleted };
    case "tasks-month-status":
      return { type: "donut", data: data.tasksByStatus };
    case "tasks-completed-month":
      return { type: "line", data: data.tasksCompletedByMonth?.map((d) => ({ ...d, color: "#3b82f6" })) };
    default:
      return { type: "bar-chart", data: [] };
  }
}

// ─── Dashboard configs (virtual defaults) ─────────────────────────

const dashboardConfigs: Record<string, { name: string; iconColor: string }> = {
  "my-organization": { name: "My organization", iconColor: "#000000" },
  "my-impact": { name: "My impact", iconColor: "#000000" },
};

// ══════════════════════════════════════════════════════════════════
//  PAGE
// ══════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const params = useParams();
  const { data: session } = useSession();
  const dashboardId = params.dashboardId as string;

  const isDefaultDashboard =
    dashboardId === "my-organization" || dashboardId === "my-impact";

  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [reportData, setReportData] = useState<ReportBundle | null>(null);
  const [customDashboard, setCustomDashboard] = useState<{ name: string; iconColor: string } | null>(null);

  // Modals
  const [templateOpen, setTemplateOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("recommended");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderInitial, setBuilderInitial] = useState<
    { title: string; chartConfig: ChartConfig; showDataLabels?: boolean; benchmark?: number } | null
  >(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [textDraft, setTextDraft] = useState({ id: "", title: "", text: "" });
  const [expandWidget, setExpandWidget] = useState<DashboardWidget | null>(null);

  const config =
    dashboardConfigs[dashboardId] ||
    (customDashboard
      ? { name: customDashboard.name, iconColor: customDashboard.iconColor }
      : { name: "Dashboard", iconColor: "#000000" });

  const kpiPrefix = dashboardId === "my-impact" ? "My " : "";

  // ── Fetch custom dashboard metadata ──
  useEffect(() => {
    if (isDefaultDashboard) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          setCustomDashboard({ name: d.name, iconColor: d.iconColor || "#000000" });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardId, isDefaultDashboard]);

  // ── Fetch precomputed report bundle (KPIs + catalog data) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const reportType = dashboardId === "my-impact" ? "my-impact" : "organization";
        const res = await fetch(`/api/reports?type=${reportType}`);
        if (res.ok && !cancelled) {
          setReportData(await res.json());
        } else if (!cancelled) {
          setFetchError(true);
        }
      } catch {
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardId]);

  const bundle = reportData || EMPTY_BUNDLE;

  // ── Widget list (two-tier) ──
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [widgetsLoaded, setWidgetsLoaded] = useState(false);
  const skipNextPersistRef = useRef(false);

  // Load widgets on mount — custom dashboards from the widgets API,
  // defaults from uiState (with legacy-string back-compat).
  useEffect(() => {
    let cancelled = false;
    setWidgetsLoaded(false);
    (async () => {
      if (!isDefaultDashboard) {
        // Custom dashboard: ReportWidget rows.
        try {
          const res = await fetch(`/api/dashboards/${dashboardId}/widgets`);
          if (res.ok && !cancelled) {
            const rows = await res.json();
            const mapped = rowsToWidgets(rows);
            skipNextPersistRef.current = true;
            setWidgets(mapped);
            setWidgetsLoaded(true);
            return;
          }
        } catch {
          /* fall through to empty */
        }
        if (!cancelled) {
          skipNextPersistRef.current = true;
          setWidgets([]);
          setWidgetsLoaded(true);
        }
        return;
      }

      // Virtual default dashboard: uiState.dashboardWidgets[id].
      try {
        const res = await fetch("/api/users/preferences");
        if (res.ok && !cancelled) {
          const prefs = await res.json();
          const dw = (prefs.uiState as { dashboardWidgets?: Record<string, unknown> } | null)?.dashboardWidgets;
          const saved = dw?.[dashboardId];
          skipNextPersistRef.current = true;
          setWidgets(parseSavedWidgets(saved));
          setWidgetsLoaded(true);
          return;
        }
      } catch {
        /* fall back to localStorage */
      }
      if (cancelled) return;
      try {
        const saved =
          typeof window !== "undefined"
            ? localStorage.getItem(`buildsync-widgets-${dashboardId}`)
            : null;
        skipNextPersistRef.current = true;
        setWidgets(saved ? parseSavedWidgets(JSON.parse(saved)) : []);
      } catch {
        skipNextPersistRef.current = true;
        setWidgets([]);
      }
      setWidgetsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardId, isDefaultDashboard]);

  // Persist default-dashboard widget objects to uiState + localStorage.
  useEffect(() => {
    if (!isDefaultDashboard || !widgetsLoaded) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    // Store lean objects (no computed data) to stay under the 32KB cap.
    const payload = widgets.map((w) => ({
      id: w.id,
      kind: w.kind,
      catalogId: w.catalogId,
      title: w.title,
      chartConfig: w.chartConfig,
      showDataLabels: w.showDataLabels,
      benchmark: w.benchmark,
      width: w.width,
      text: w.text,
    }));

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`buildsync-widgets-${dashboardId}`, JSON.stringify(payload));
      } catch {
        /* ignore quota */
      }
    }
    const t = setTimeout(() => {
      fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uiState: { dashboardWidgets: { [dashboardId]: payload } } }),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [widgets, dashboardId, isDefaultDashboard, widgetsLoaded]);

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
      if (!isDefaultDashboard) {
        // Persist new positions on the server.
        fetch(`/api/dashboards/${dashboardId}/widgets`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: next.map((w, i) => ({ id: w.id, position: i })) }),
        }).catch(() => {});
      }
      return next;
    });
  }

  // ── Add: catalog (Template chart) ──
  const handleAddCatalog = async (catalogId: string, name: string) => {
    setTemplateOpen(false);
    if (!isDefaultDashboard) {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: name, width: 2, config: { kind: "catalog", catalogId } }),
        });
        if (!res.ok) throw new Error();
        const row = await res.json();
        setWidgets((prev) => [...prev, ...rowsToWidgets([row])]);
        toast.success(`"${name}" added`);
      } catch {
        toast.error("Failed to add widget");
      }
      return;
    }
    setWidgets((prev) => [
      ...prev,
      { id: uid(), kind: "catalog", catalogId, title: name, width: 2 },
    ]);
    toast.success(`"${name}" added`);
  };

  // ── Add / edit: custom chart (builder) ──
  const openCustomBuilder = () => {
    setEditingWidgetId(null);
    setBuilderInitial(null);
    setBuilderOpen(true);
  };

  const openEditBuilder = (w: DashboardWidget) => {
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
    const configObj = {
      kind: "custom" as const,
      chartType: result.chartType,
      chartConfig: result.chartConfig,
      showDataLabels: result.showDataLabels,
      benchmark: result.benchmark,
    };

    // EDIT
    if (editingWidgetId) {
      const targetId = editingWidgetId;
      setEditingWidgetId(null);
      if (!isDefaultDashboard) {
        try {
          const res = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ widgetId: targetId, title: result.title, config: configObj }),
          });
          if (!res.ok) throw new Error();
        } catch {
          toast.error("Failed to save chart");
          return;
        }
      }
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === targetId
            ? {
                ...w,
                title: result.title,
                chartConfig: result.chartConfig,
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
    if (!isDefaultDashboard) {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
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
      return;
    }
    setWidgets((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "custom",
        title: result.title,
        width: 1,
        chartConfig: result.chartConfig,
        showDataLabels: result.showDataLabels,
        benchmark: result.benchmark,
      },
    ]);
    toast.success(`"${result.title}" added`);
  };

  // ── Add / edit: text widget ──
  const openTextNew = () => {
    setTextDraft({ id: "", title: "Text", text: "" });
    setTextOpen(true);
  };
  const openTextEdit = (w: DashboardWidget) => {
    setTextDraft({ id: w.id, title: w.title, text: w.text || "" });
    setTextOpen(true);
  };
  const handleTextSave = async () => {
    const text = textDraft.text.trim();
    const title = textDraft.title.trim() || "Text";
    setTextOpen(false);
    const configObj = { kind: "text" as const, text };

    // EDIT existing
    if (textDraft.id) {
      const targetId = textDraft.id;
      if (!isDefaultDashboard) {
        try {
          const res = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ widgetId: targetId, title, config: configObj }),
          });
          if (!res.ok) throw new Error();
        } catch {
          toast.error("Failed to save text");
          return;
        }
      }
      setWidgets((prev) => prev.map((w) => (w.id === targetId ? { ...w, title, text } : w)));
      return;
    }

    // ADD new
    if (!isDefaultDashboard) {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
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
      return;
    }
    setWidgets((prev) => [...prev, { id: uid(), kind: "text", title, text, width: 2 }]);
  };

  // ── Remove / duplicate / resize ──
  const handleRemove = async (id: string) => {
    if (!isDefaultDashboard) {
      try {
        await fetch(`/api/dashboards/${dashboardId}/widgets?widgetId=${id}`, { method: "DELETE" });
      } catch {
        /* ignore — remove locally anyway */
      }
    }
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    toast.success("Widget removed");
  };

  const handleDuplicate = async (id: string) => {
    const original = widgets.find((w) => w.id === id);
    if (!original) return;
    const copyTitle = `${original.title} (copy)`;
    if (!isDefaultDashboard) {
      const configObj =
        original.kind === "catalog"
          ? { kind: "catalog" as const, catalogId: original.catalogId! }
          : original.kind === "text"
          ? { kind: "text" as const, text: original.text || "" }
          : {
              kind: "custom" as const,
              chartType: original.chartConfig!.chartType,
              chartConfig: original.chartConfig!,
              showDataLabels: original.showDataLabels,
              benchmark: original.benchmark,
            };
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
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
      return;
    }
    setWidgets((prev) => [
      ...prev,
      {
        ...structuredClone(original),
        id: uid(),
        title: copyTitle,
      },
    ]);
    toast.success("Widget duplicated");
  };

  const handleSetWidth = async (id: string, width: 1 | 2) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, width } : w)));
    if (!isDefaultDashboard) {
      fetch(`/api/dashboards/${dashboardId}/widgets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetId: id, width }),
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const initials =
    session?.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U";

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Breadcrumb */}
      <div className="px-4 md:px-6 py-2 text-xs md:text-sm text-slate-500 border-b bg-slate-50 truncate">
        <Link href="/reporting" className="hover:text-slate-700">
          Reporting
        </Link>
        <span className="mx-2">{">"}</span>
        <span className="text-slate-900">{config.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: config.iconColor }}
          >
            <BarChart3 className="w-4 h-4" />
          </div>
          <h1 className="text-base md:text-xl font-semibold text-slate-900 truncate min-w-0">
            {config.name}
          </h1>
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={cn(
              "transition-colors flex-shrink-0",
              isFavorite ? "text-[#a8893a]" : "text-slate-300 hover:text-[#a8893a]"
            )}
            aria-label={isFavorite ? "Unfavorite" : "Favorite"}
          >
            <Star className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-sm text-white font-medium">
            {initials}
          </div>
          <Button
            className="bg-black hover:bg-black text-white px-2 md:px-4"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied");
            }}
          >
            <Share2 className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Share</span>
          </Button>
        </div>
      </div>

      {/* Toolbar — Add widget menu (Template / Custom / Text) */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add widget</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate className="w-4 h-4 mr-2" />
              <div className="flex flex-col">
                <span>Template chart</span>
                <span className="text-[11px] text-slate-400">Prebuilt catalog</span>
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
        <button
          className="text-xs md:text-sm text-black hover:text-black"
          onClick={() => window.open("mailto:feedback@ttcivilstructural.com?subject=Reporting%20Feedback", "_blank")}
        >
          Send feedback
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {fetchError && (
          <div className="mb-4 md:mb-6 px-3 md:px-4 py-2 md:py-3 rounded-lg bg-[#a8893a]/10 border border-[#a8893a]/30 text-[#a8893a] text-xs md:text-sm flex items-start gap-2">
            <span className="font-medium flex-shrink-0">⚠</span>
            <span>
              Could not load report data. Sign in or check your connection. The widget layout below shows your saved configuration with placeholder values.
            </span>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          {[
            { title: `${kpiPrefix}Completed tasks`, value: bundle.kpis.completed, filter: "1 filter" },
            { title: `${kpiPrefix}Incomplete tasks`, value: bundle.kpis.incomplete, filter: "1 filter" },
            { title: `${kpiPrefix}Overdue tasks`, value: bundle.kpis.overdue, filter: "1 filter", danger: true },
            { title: `${kpiPrefix}Total tasks`, value: bundle.kpis.total, filter: "No filters" },
          ].map((kpi) => (
            <div key={kpi.title} className="bg-white rounded-lg border p-3 md:p-4 hover:shadow-md transition-shadow">
              <h3 className="text-xs md:text-sm text-slate-600 leading-tight">{kpi.title}</h3>
              <p
                className={cn(
                  "text-2xl md:text-4xl font-light text-center mt-2 md:mt-4",
                  kpi.danger && kpi.value > 0 ? "text-black" : "text-slate-900"
                )}
              >
                {kpi.value}
              </p>
              <div className="flex items-center justify-center gap-1 mt-2 md:mt-3 text-[10px] md:text-xs text-slate-400">
                <Filter className="w-3 h-3" />
                <span>{kpi.filter}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts grid (sortable) */}
        {widgets.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl py-12 px-4 text-center">
            <BarChart3 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700 mb-1">No charts yet</p>
            <p className="text-xs text-slate-500 mb-4">Add a chart to start visualizing your data.</p>
            <Button variant="outline" size="sm" onClick={openCustomBuilder}>
              <Plus className="w-4 h-4 mr-2" />
              Add chart
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {widgets.map((w) => (
                  <SortableWidget
                    key={w.id}
                    widget={w}
                    bundle={bundle}
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
      </div>

      {/* Template chart catalog dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[800px] max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b">
            <DialogTitle>Template chart</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
            <div className="border-b md:border-b-0 md:border-r p-2 md:p-4 bg-slate-50 md:w-48 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible flex-shrink-0">
              {Object.entries(widgetCategories).map(([key, category]) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={cn(
                    "text-left px-3 py-2 rounded-md text-xs md:text-sm transition-colors whitespace-nowrap flex-shrink-0",
                    activeCategory === key
                      ? "bg-white shadow-sm font-medium text-slate-900"
                      : "text-slate-600 hover:bg-white/50"
                  )}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className="flex-1 p-4 md:p-6 overflow-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {widgetCategories[activeCategory as keyof typeof widgetCategories]?.widgets.map((widget) => {
                  const IconComponent = chartIconMap[widget.chartType];
                  return (
                    <button
                      key={widget.id}
                      onClick={() => handleAddCatalog(widget.id, widget.name)}
                      className="border rounded-xl p-3 md:p-4 hover:border-black hover:shadow-lg transition-all text-left bg-white group"
                    >
                      <div className="flex items-center justify-center mb-3 md:mb-4 p-2 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
                        {IconComponent && <IconComponent />}
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs md:text-sm font-medium text-slate-700 leading-tight line-clamp-2 break-words">
                          {widget.name}
                        </span>
                        {"isNew" in widget && widget.isNew && (
                          <span className="text-[10px] bg-white text-black border border-black px-1.5 py-0.5 rounded font-medium shrink-0">
                            New
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom chart builder */}
      <ChartBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initial={builderInitial}
        onSubmit={handleBuilderSubmit}
      />

      {/* Text widget editor */}
      <Dialog open={textOpen} onOpenChange={setTextOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{textDraft.id ? "Edit text" : "Add text"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <input
              value={textDraft.title}
              onChange={(e) => setTextDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
            <Textarea
              value={textDraft.text}
              onChange={(e) => setTextDraft((d) => ({ ...d, text: e.target.value }))}
              placeholder="Write a note, heading, or context for this dashboard…"
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
            {expandWidget && (
              <WidgetBody widget={expandWidget} bundle={bundle} height={460} />
            )}
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
  widget: DashboardWidget;
  bundle: ReportBundle;
  onEdit: () => void;
  onExpand: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSetWidth: (width: 1 | 2) => void;
}

function SortableWidget({
  widget,
  bundle,
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
        widget.width === 2 ? "md:col-span-2" : "md:col-span-1"
      )}
    >
      <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
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
        {/* Hover toolbar: expand, edit, "…" */}
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

      <WidgetBody widget={widget} bundle={bundle} height={200} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Widget body — renders catalog / custom / text
// ══════════════════════════════════════════════════════════════════

function WidgetBody({
  widget,
  bundle,
  height,
}: {
  widget: DashboardWidget;
  bundle: ReportBundle;
  height: number;
}) {
  if (widget.kind === "text") {
    return (
      <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed min-h-[60px]">
        {widget.text || <span className="text-slate-400">Empty text widget.</span>}
      </div>
    );
  }

  if (widget.kind === "custom" && widget.chartConfig) {
    return <CustomChartWidget widget={widget} height={height} />;
  }

  // Catalog widget — render from the precomputed bundle.
  return <CatalogWidgetBody catalogId={widget.catalogId || ""} bundle={bundle} height={height} />;
}

// ── Custom chart widget: queries the engine, renders ReportChart ──

function CustomChartWidget({ widget, height }: { widget: DashboardWidget; height: number }) {
  const [resp, setResp] = useState<ChartQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const config = widget.chartConfig!;
  const configKey = JSON.stringify(config);

  // Re-query whenever the config changes. All state updates happen inside
  // the async body (guarded by `cancelled`) so nothing sets state
  // synchronously in the effect body.
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

// ── Catalog widget body (precomputed bundle) ──

function CatalogWidgetBody({
  catalogId,
  bundle,
  height,
}: {
  catalogId: string;
  bundle: ReportBundle;
  height: number;
}) {
  const resolved = catalogWidgetData(catalogId, bundle);

  const emptyState = (
    <div className="flex items-center justify-center text-slate-400" style={{ height }}>
      No data available
    </div>
  );

  let body: React.ReactElement;
  if (resolved.type === "bar-chart") {
    body =
      resolved.data && resolved.data.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={resolved.data} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {resolved.data.map((entry, index) => (
                <Cell key={index} fill={entry.color || "#888888"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        emptyState
      );
  } else if (resolved.type === "donut") {
    body =
      resolved.data && resolved.data.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={resolved.data} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" label={({ value }) => value}>
              {resolved.data.map((entry, index) => (
                <Cell key={index} fill={entry.color || "#888888"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        emptyState
      );
  } else if (resolved.type === "line") {
    body =
      resolved.data && resolved.data.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={resolved.data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        emptyState
      );
  } else if (resolved.type === "stacked") {
    body =
      resolved.stackedData && resolved.stackedData.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={resolved.stackedData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="completed" stackId="a" fill="#22c55e" name="Completed" />
            <Bar dataKey="incomplete" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Incomplete" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        emptyState
      );
  } else {
    // number
    body = (
      <div className="flex flex-col items-center justify-center" style={{ height }}>
        <p className="text-5xl font-light text-slate-900">{resolved.value ?? 0}</p>
        <p className="text-sm text-slate-400 mt-2">Total</p>
      </div>
    );
  }

  return (
    <>
      {body}
      <WidgetFooter filterSummary="Tasks in workspace" />
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
    <div className="flex items-center justify-between mt-3 md:mt-4 pt-3 border-t text-[10px] md:text-xs text-slate-400 gap-2">
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
//  Persistence mapping helpers
// ══════════════════════════════════════════════════════════════════

interface ReportWidgetRow {
  id: string;
  title: string;
  width: number;
  position: number;
  config: unknown;
}

// Map ReportWidget rows (custom dashboards) → DashboardWidget[].
function rowsToWidgets(rows: ReportWidgetRow[]): DashboardWidget[] {
  return rows.map((row) => {
    const cfg = row.config as Record<string, unknown> | null;
    const width = (row.width === 2 ? 2 : 1) as 1 | 2;
    if (cfg && cfg.kind === "text") {
      return { id: row.id, kind: "text", title: row.title, width, text: String(cfg.text ?? "") };
    }
    if (cfg && cfg.kind === "custom") {
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
    // catalog (or legacy)
    return {
      id: row.id,
      kind: "catalog",
      title: row.title,
      width,
      catalogId: cfg && typeof cfg.catalogId === "string" ? (cfg.catalogId as string) : "",
    };
  });
}

// Parse the uiState.dashboardWidgets[id] payload — supports the current
// object array AND the legacy string array ("catalogId-ts::title").
function parseSavedWidgets(saved: unknown): DashboardWidget[] {
  if (!Array.isArray(saved)) return [];
  return saved
    .map((entry): DashboardWidget | null => {
      if (typeof entry === "string") return widgetFromLegacyString(entry);
      if (entry && typeof entry === "object") {
        const o = entry as Record<string, unknown>;
        const kind = (o.kind as WidgetKind) || "catalog";
        const width = (o.width === 2 ? 2 : 1) as 1 | 2;
        const base = {
          id: typeof o.id === "string" ? o.id : uid(),
          title: typeof o.title === "string" ? o.title : "Widget",
          width,
        };
        if (kind === "text") return { ...base, kind: "text", text: String(o.text ?? "") };
        if (kind === "custom" && o.chartConfig)
          return {
            ...base,
            kind: "custom",
            chartConfig: o.chartConfig as ChartConfig,
            showDataLabels: o.showDataLabels as boolean | undefined,
            benchmark: o.benchmark as number | undefined,
          };
        return { ...base, kind: "catalog", catalogId: String(o.catalogId ?? "") };
      }
      return null;
    })
    .filter((w): w is DashboardWidget => w != null);
}
