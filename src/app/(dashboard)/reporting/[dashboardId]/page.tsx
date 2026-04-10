"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Widget types
interface Widget {
  id: string;
  type: "kpi" | "bar-chart" | "donut" | "line" | "stacked" | "number";
  title: string;
  config: {
    value?: number;
    filter?: string;
    data?: { name: string; value: number; color?: string }[];
    stackedData?: { name: string; completed: number; incomplete: number }[];
  };
}

// Chart type icons
type ChartType = "bar" | "horizontal-bar" | "donut" | "line" | "stacked" | "number" | "lollipop";

// Widget categories for the modal
const widgetCategories = {
  recommended: {
    label: "Recommended",
    widgets: [
      { id: "custom-chart", name: "Custom chart", chartType: "bar" as ChartType },
      { id: "incomplete-by-project", name: "Incomplete tasks by project", chartType: "horizontal-bar" as ChartType },
      { id: "projects-by-status", name: "Projects by status", chartType: "donut" as ChartType },
    ],
  },
  resources: {
    label: "Resources",
    widgets: [
      { id: "time-estimate-assignee", name: "Time estimate vs actual by assignee", chartType: "stacked" as ChartType, isNew: true },
      { id: "time-over-time", name: "Time estimate vs actual over time", chartType: "line" as ChartType, isNew: true },
      { id: "tasks-assignee-status", name: "Tasks by assignee and status", chartType: "stacked" as ChartType, isNew: true },
      { id: "upcoming-by-assignee", name: "Upcoming tasks this week by assignee", chartType: "lollipop" as ChartType },
      { id: "tasks-month-project", name: "Tasks this month by project", chartType: "bar" as ChartType },
      { id: "custom-field-total", name: "Custom field total", chartType: "number" as ChartType },
      { id: "projects-by-owner", name: "Projects by owner", chartType: "horizontal-bar" as ChartType },
      { id: "projects-by-portfolio", name: "Projects by portfolio", chartType: "donut" as ChartType },
      { id: "tasks-by-creator", name: "Tasks by creator", chartType: "bar" as ChartType },
    ],
  },
  workStatus: {
    label: "Work status",
    widgets: [
      { id: "time-custom-field", name: "Time in custom field", chartType: "stacked" as ChartType },
      { id: "tasks-custom-field", name: "Tasks by custom field", chartType: "bar" as ChartType },
      { id: "overdue-by-project", name: "Overdue tasks by project", chartType: "horizontal-bar" as ChartType },
      { id: "upcoming-by-project", name: "Upcoming tasks by project", chartType: "bar" as ChartType },
      { id: "custom-total-project", name: "Custom field total by project", chartType: "bar" as ChartType },
      { id: "projects-custom-field", name: "Projects by custom field", chartType: "donut" as ChartType },
      { id: "goals-by-status", name: "Goals by status", chartType: "donut" as ChartType },
    ],
  },
  progress: {
    label: "Progress",
    widgets: [
      { id: "projects-most-completed", name: "Projects with most completed tasks", chartType: "horizontal-bar" as ChartType },
      { id: "tasks-month-status", name: "Tasks this month by completion status", chartType: "donut" as ChartType },
      { id: "tasks-completed-month", name: "Tasks completed by month", chartType: "line" as ChartType },
    ],
  },
};

// SVG Chart Icons - Minimalistic Slate Colors
function BarChartIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="20" width="12" height="24" rx="2" fill="#64748B" />
      <rect x="20" y="12" width="12" height="32" rx="2" fill="#94A3B8" />
      <rect x="36" y="8" width="12" height="36" rx="2" fill="#64748B" />
      <rect x="52" y="16" width="8" height="28" rx="2" fill="#CBD5E1" />
    </svg>
  );
}

function HorizontalBarIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="4" width="40" height="8" rx="2" fill="#64748B" />
      <rect x="4" y="16" width="28" height="8" rx="2" fill="#94A3B8" />
      <rect x="4" y="28" width="52" height="8" rx="2" fill="#64748B" />
      <rect x="4" y="40" width="20" height="6" rx="2" fill="#CBD5E1" />
    </svg>
  );
}

function DonutChartIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <path d="M32 4C18.7 4 8 14.7 8 28s10.7 24 24 24 24-10.7 24-24S45.3 4 32 4zm0 36c-6.6 0-12-5.4-12-12s5.4-12 12-12 12 5.4 12 12-5.4 12-12 12z" fill="#CBD5E1" />
      <path d="M32 4v12c6.6 0 12 5.4 12 12h12c0-13.3-10.7-24-24-24z" fill="#64748B" />
      <path d="M44 28c0-6.6-5.4-12-12-12V4c13.3 0 24 10.7 24 24h-12z" fill="#94A3B8" />
    </svg>
  );
}

function LineChartIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <path d="M4 40L16 28L28 32L40 16L56 8" stroke="#64748B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M4 44L16 34L28 38L40 22L56 14" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="4 4" />
      <circle cx="16" cy="28" r="3" fill="#64748B" />
      <circle cx="28" cy="32" r="3" fill="#64748B" />
      <circle cx="40" cy="16" r="3" fill="#64748B" />
      <circle cx="56" cy="8" r="3" fill="#64748B" />
    </svg>
  );
}

function StackedBarIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="28" width="12" height="16" rx="2" fill="#64748B" />
      <rect x="4" y="16" width="12" height="12" rx="2" fill="#94A3B8" />
      <rect x="20" y="20" width="12" height="24" rx="2" fill="#64748B" />
      <rect x="20" y="8" width="12" height="12" rx="2" fill="#CBD5E1" />
      <rect x="36" y="24" width="12" height="20" rx="2" fill="#64748B" />
      <rect x="36" y="12" width="12" height="12" rx="2" fill="#94A3B8" />
      <rect x="52" y="32" width="8" height="12" rx="2" fill="#64748B" />
      <rect x="52" y="20" width="8" height="12" rx="2" fill="#CBD5E1" />
    </svg>
  );
}

function NumberIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <rect x="8" y="8" width="48" height="32" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
      <text x="32" y="32" textAnchor="middle" fontSize="20" fontWeight="600" fill="#64748B">42</text>
    </svg>
  );
}

function LollipopChartIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
      <line x1="12" y1="8" x2="12" y2="44" stroke="#E2E8F0" strokeWidth="2" />
      <line x1="28" y1="8" x2="28" y2="44" stroke="#E2E8F0" strokeWidth="2" />
      <line x1="44" y1="8" x2="44" y2="44" stroke="#E2E8F0" strokeWidth="2" />
      <circle cx="12" cy="16" r="6" fill="#64748B" />
      <circle cx="28" cy="24" r="6" fill="#94A3B8" />
      <circle cx="44" cy="12" r="6" fill="#CBD5E1" />
      <line x1="12" y1="22" x2="12" y2="44" stroke="#64748B" strokeWidth="2" />
      <line x1="28" y1="30" x2="28" y2="44" stroke="#94A3B8" strokeWidth="2" />
      <line x1="44" y1="18" x2="44" y2="44" stroke="#CBD5E1" strokeWidth="2" />
    </svg>
  );
}

// Map chart types to icons
const chartIconMap: Record<ChartType, () => React.ReactElement> = {
  "bar": BarChartIcon,
  "horizontal-bar": HorizontalBarIcon,
  "donut": DonutChartIcon,
  "line": LineChartIcon,
  "stacked": StackedBarIcon,
  "number": NumberIcon,
  "lollipop": LollipopChartIcon,
};

// Dashboard configurations
const dashboardConfigs: Record<
  string,
  { name: string; iconColor: string; prefix: string }
> = {
  "my-organization": {
    name: "My organization",
    iconColor: "#000000",
    prefix: "",
  },
  "my-impact": {
    name: "My impact",
    iconColor: "#000000",
    prefix: "My ",
  },
};

export default function DashboardPage() {
  const params = useParams();
  const { data: session } = useSession();
  const dashboardId = params.dashboardId as string;
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("recommended");
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [reportData, setReportData] = useState<{
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
  } | null>(null);

  // Custom dashboard metadata (fetched from API for non-default dashboards)
  const [customDashboard, setCustomDashboard] = useState<{
    name: string;
    iconColor: string;
  } | null>(null);

  const isDefaultDashboard = dashboardId === "my-organization" || dashboardId === "my-impact";

  const config = dashboardConfigs[dashboardId] ||
    (customDashboard
      ? { name: customDashboard.name, iconColor: customDashboard.iconColor, prefix: "" }
      : { name: "Dashboard", iconColor: "#000000", prefix: "" });

  // Fetch custom dashboard metadata
  useEffect(() => {
    if (isDefaultDashboard) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          setCustomDashboard({
            name: d.name,
            iconColor: d.iconColor || "#000000",
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [dashboardId, isDefaultDashboard]);

  // Fetch report data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setFetchError(false);
      try {
        const reportType = dashboardId === "my-impact" ? "my-impact" : "organization";
        const res = await fetch(`/api/reports?type=${reportType}`);
        if (res.ok) {
          const data = await res.json();
          setReportData(data);
        } else {
          setFetchError(true);
        }
      } catch (error) {
        console.error("Error fetching report data:", error);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dashboardId]);

  // Empty data fallback so widgets always render
  const emptyData = {
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
  const data = reportData || emptyData;

  // Widgets state — persisted per-dashboard in DB via uiState
  const [widgets, setWidgets] = useState<Widget[]>([]);
  // Stores user customizations (which catalog widgets are added/removed)
  const [customWidgetIds, setCustomWidgetIds] = useState<string[] | null>(null);
  const initialLoadDoneRef = React.useRef(false);

  // Load custom widget IDs from API on mount (uiState.dashboardWidgets[dashboardId])
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/preferences");
        if (res.ok && !cancelled) {
          const prefs = await res.json();
          const dashboardWidgets = (prefs.uiState as { dashboardWidgets?: Record<string, string[]> } | null)?.dashboardWidgets;
          const saved = dashboardWidgets?.[dashboardId];
          if (saved) {
            setCustomWidgetIds(saved);
          }
          initialLoadDoneRef.current = true;
          return;
        }
      } catch {
        // network error — fall back to localStorage
      }

      if (cancelled) return;

      // Local fallback
      try {
        const saved = typeof window !== "undefined" ? localStorage.getItem(`buildsync-widgets-${dashboardId}`) : null;
        if (saved) {
          setCustomWidgetIds(JSON.parse(saved));
        }
      } catch {
        // ignore
      }
      initialLoadDoneRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [dashboardId]);

  // Persist widgets whenever they change (after initial load) — to DB and localStorage
  useEffect(() => {
    if (customWidgetIds === null || !initialLoadDoneRef.current) return;

    // Local fallback
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`buildsync-widgets-${dashboardId}`, JSON.stringify(customWidgetIds));
      } catch {
        // ignore quota
      }
    }

    // DB save (debounced via timeout)
    const t = setTimeout(() => {
      fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uiState: {
            dashboardWidgets: { [dashboardId]: customWidgetIds },
          },
        }),
      }).catch(() => { /* ignore */ });
    }, 400);
    return () => clearTimeout(t);
  }, [customWidgetIds, dashboardId]);

  // Build widgets from data (real or empty fallback) + persisted state
  useEffect(() => {
    const defaults: Widget[] = [
      {
        id: "1",
        type: "kpi",
        title: `${config.prefix}Completed tasks`,
        config: { value: data.kpis.completed, filter: "1 filter" },
      },
      {
        id: "2",
        type: "kpi",
        title: `${config.prefix}Incomplete tasks`,
        config: { value: data.kpis.incomplete, filter: "1 filter" },
      },
      {
        id: "3",
        type: "kpi",
        title: `${config.prefix}Overdue tasks`,
        config: { value: data.kpis.overdue, filter: "1 filter" },
      },
      {
        id: "4",
        type: "kpi",
        title: `${config.prefix}Total tasks`,
        config: { value: data.kpis.total, filter: "No filters" },
      },
      {
        id: "5",
        type: "bar-chart",
        title: `${config.prefix}Incomplete tasks by project`,
        config: { data: data.tasksByProject },
      },
      {
        id: "6",
        type: "donut",
        title: `Tasks by completion status this month`,
        config: { data: data.tasksByStatus },
      },
      {
        id: "7",
        type: "bar-chart",
        title: `Upcoming tasks this week by assignee`,
        config: { data: data.upcomingByAssignee || [] },
      },
      {
        id: "8",
        type: "donut",
        title: `Projects by status`,
        config: { data: data.projectsByStatus || [] },
      },
    ];

    if (customWidgetIds === null) {
      setWidgets(defaults);
      return;
    }

    // Replay persisted state: keep ALL kpis from defaults, then add saved chart widgets
    const kpis = defaults.filter((w) => w.type === "kpi");
    const customs = customWidgetIds
      .map((entry) => {
        const [catalogId, name] = entry.split("::");
        const { type, data: chartData, stackedData, value } = getWidgetDataAndType(catalogId);
        return {
          id: `widget-${entry}`,
          type,
          title: name || catalogId,
          config: { data: chartData || [], stackedData, value, filter: "1 filter" },
        } as Widget;
      })
      .filter(Boolean);
    setWidgets([...kpis, ...customs]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, config.prefix, customWidgetIds]);

  // Map widget catalog IDs to their data source and chart type
  const getWidgetDataAndType = (widgetId: string): { type: Widget["type"]; data?: Widget["config"]["data"]; stackedData?: Widget["config"]["stackedData"]; value?: number } => {
    switch (widgetId) {
      // Recommended
      case "custom-chart":
        return { type: "bar-chart", data: data.tasksByProject };
      case "incomplete-by-project":
        return { type: "bar-chart", data: data.tasksByProject };
      case "projects-by-status":
        return { type: "donut", data: data.projectsByStatus };
      // Resources
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
      // Work Status
      case "time-custom-field":
        return { type: "stacked", stackedData: data.tasksByAssigneeAndStatus };
      case "tasks-custom-field":
        return { type: "donut", data: data.tasksByStatus };
      case "overdue-by-project":
        return { type: "donut", data: data.overdueByProject };
      case "upcoming-by-project":
        return { type: "bar-chart", data: data.upcomingByProject };
      case "custom-total-project":
        return { type: "bar-chart", data: data.tasksByProject };
      case "projects-custom-field":
        return { type: "donut", data: data.projectsByStatus };
      case "goals-by-status":
        return { type: "donut", data: data.goalsByStatus };
      // Progress
      case "projects-most-completed":
        return { type: "bar-chart", data: data.projectsMostCompleted };
      case "tasks-month-status":
        return { type: "donut", data: data.tasksByStatus };
      case "tasks-completed-month":
        return { type: "line", data: data.tasksCompletedByMonth?.map(d => ({ ...d, color: "#3b82f6" })) };
      // Time-related (use stacked as approximation)
      case "time-estimate-assignee":
        return { type: "stacked", stackedData: data.tasksByAssigneeAndStatus };
      case "time-over-time":
        return { type: "line", data: data.tasksCompletedByMonth?.map(d => ({ ...d, color: "#3b82f6" })) };
      default:
        return { type: "bar-chart", data: [] };
    }
  };

  const handleAddWidget = (widgetId: string, widgetName: string) => {
    const entry = `${widgetId}-${Date.now()}::${widgetName}`;
    setCustomWidgetIds((prev) => {
      const base = prev ?? widgets.filter((w) => w.type !== "kpi").map((w) => `${w.id}::${w.title}`);
      return [...base, entry];
    });
    setIsAddWidgetOpen(false);
    toast.success(`"${widgetName}" added`);
  };

  const handleRemoveWidget = (widgetId: string) => {
    // Persist by removing from customWidgetIds (only chart widgets, not KPIs)
    setCustomWidgetIds((prev) => {
      const base = prev ?? widgets.filter((w) => w.type !== "kpi").map((w) => `${w.id}::${w.title}`);
      const target = widgets.find((w) => w.id === widgetId);
      if (!target) return base;
      return base.filter((entry) => `widget-${entry}` !== widgetId && entry !== `${target.id}::${target.title}`);
    });
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    toast.success("Widget removed");
  };

  const handleDuplicateWidget = (widgetId: string) => {
    const original = widgets.find((w) => w.id === widgetId);
    if (!original || original.type === "kpi") return;
    const catalogId = original.id.replace(/^widget-/, "").split("-")[0];
    handleAddWidget(catalogId, `${original.title} (copy)`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

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
              isFavorite ? "text-yellow-500" : "text-slate-300 hover:text-yellow-500"
            )}
            aria-label={isFavorite ? "Unfavorite" : "Favorite"}
          >
            <Star className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-sm text-white font-medium">
            {session?.user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U"}
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

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddWidgetOpen(true)}
        >
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Add widget</span>
        </Button>
        <button
          className="text-xs md:text-sm text-black hover:text-black"
          onClick={() => window.open('mailto:feedback@ttcivilstructural.com?subject=Reporting%20Feedback', '_blank')}
        >
          Send feedback
        </button>
      </div>

      {/* Widgets Grid */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Error banner */}
        {fetchError && (
          <div className="mb-4 md:mb-6 px-3 md:px-4 py-2 md:py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs md:text-sm flex items-start gap-2">
            <span className="font-medium flex-shrink-0">⚠</span>
            <span>
              Could not load report data. Sign in or check your connection. The widget layout below shows your saved configuration with placeholder values.
            </span>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          {widgets
            .filter((w) => w.type === "kpi")
            .map((widget) => (
              <div
                key={widget.id}
                className="bg-white rounded-lg border p-3 md:p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between gap-1">
                  <h3 className="text-xs md:text-sm text-slate-600 leading-tight">{widget.title}</h3>
                </div>
                <p
                  className={cn(
                    "text-2xl md:text-4xl font-light text-center mt-2 md:mt-4",
                    widget.title.includes("Overdue") && widget.config.value! > 0
                      ? "text-black"
                      : "text-slate-900"
                  )}
                >
                  {widget.config.value}
                </p>
                <div className="flex items-center justify-center gap-1 mt-2 md:mt-3 text-[10px] md:text-xs text-slate-400">
                  <Filter className="w-3 h-3" />
                  <span>{widget.config.filter}</span>
                </div>
              </div>
            ))}
        </div>

        {/* Charts Grid */}
        {widgets.filter((w) => w.type !== "kpi").length === 0 && (
          <div className="border-2 border-dashed rounded-xl py-12 px-4 text-center">
            <BarChart3 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700 mb-1">No charts yet</p>
            <p className="text-xs text-slate-500 mb-4">Add a chart to start visualizing your data.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddWidgetOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add chart
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {widgets
            .filter((w) => w.type !== "kpi")
            .map((widget) => (
              <div
                key={widget.id}
                className="bg-white rounded-lg border p-3 md:p-4 group"
              >
                <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
                  <h3 className="text-sm font-medium text-slate-900 break-words flex-1 min-w-0">
                    {widget.title}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:text-slate-600 flex-shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDuplicateWidget(widget.id)}>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => handleRemoveWidget(widget.id)}>Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {widget.type === "bar-chart" && (
                  <>
                    {widget.config.data && widget.config.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={widget.config.data} layout="vertical">
                          <XAxis type="number" />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={100}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {widget.config.data.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={entry.color || "#64748B"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-slate-400">
                        No data available
                      </div>
                    )}
                  </>
                )}

                {widget.type === "donut" && (
                  <>
                    {widget.config.data && widget.config.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={widget.config.data}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            dataKey="value"
                            label={({ value }) => value}
                          >
                            {widget.config.data.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={entry.color || "#64748B"}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-slate-400">
                        No data available
                      </div>
                    )}
                  </>
                )}

                {widget.type === "line" && (
                  <>
                    {widget.config.data && widget.config.data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={widget.config.data}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ fill: "#3b82f6", r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-slate-400">
                        No data available
                      </div>
                    )}
                  </>
                )}

                {widget.type === "stacked" && (
                  <>
                    {widget.config.stackedData && widget.config.stackedData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={widget.config.stackedData}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="completed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} name="Completed" />
                          <Bar dataKey="incomplete" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Incomplete" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-slate-400">
                        No data available
                      </div>
                    )}
                  </>
                )}

                {widget.type === "number" && (
                  <div className="h-[200px] flex flex-col items-center justify-center">
                    <p className="text-5xl font-light text-slate-900">{widget.config.value ?? 0}</p>
                    <p className="text-sm text-slate-400 mt-2">Total</p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 md:mt-4 pt-3 border-t text-[10px] md:text-xs text-slate-400 gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <Filter className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">Tasks in workspace</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Add Widget Dialog */}
      <Dialog open={isAddWidgetOpen} onOpenChange={setIsAddWidgetOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[800px] max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b">
            <DialogTitle>Add chart</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
            {/* Sidebar / Tabs (horizontal scroll on mobile, vertical on desktop) */}
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

            {/* Widgets Grid */}
            <div className="flex-1 p-4 md:p-6 overflow-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {widgetCategories[
                  activeCategory as keyof typeof widgetCategories
                ]?.widgets.map((widget) => {
                  const IconComponent = chartIconMap[widget.chartType];
                  return (
                    <button
                      key={widget.id}
                      onClick={() => handleAddWidget(widget.id, widget.name)}
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
    </div>
  );
}
