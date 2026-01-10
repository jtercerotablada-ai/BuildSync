"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Plus,
  Star,
  Share2,
  MoreHorizontal,
  Filter,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
  type: "kpi" | "bar-chart" | "donut" | "line";
  title: string;
  config: {
    value?: number;
    filter?: string;
    data?: { name: string; value: number; color?: string }[];
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
    iconColor: "#3B82F6",
    prefix: "",
  },
  "my-impact": {
    name: "My impact",
    iconColor: "#8B5CF6",
    prefix: "My ",
  },
};

export default function DashboardPage() {
  const params = useParams();
  const dashboardId = params.dashboardId as string;
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("recommended");
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<{
    kpis: { completed: number; incomplete: number; overdue: number; total: number };
    tasksByProject: { name: string; value: number; color: string }[];
    tasksByStatus: { name: string; value: number; color: string }[];
  } | null>(null);

  const config = dashboardConfigs[dashboardId] || {
    name: "Dashboard",
    iconColor: "#8B5CF6",
    prefix: "",
  };

  // Fetch report data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const reportType = dashboardId === "my-impact" ? "my-impact" : "organization";
        const res = await fetch(`/api/reports?type=${reportType}`);
        if (res.ok) {
          const data = await res.json();
          setReportData(data);
        }
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dashboardId]);

  // Default widgets based on data
  const [widgets, setWidgets] = useState<Widget[]>([]);

  useEffect(() => {
    if (reportData) {
      setWidgets([
        {
          id: "1",
          type: "kpi",
          title: `${config.prefix}Completed tasks`,
          config: { value: reportData.kpis.completed, filter: "1 filter" },
        },
        {
          id: "2",
          type: "kpi",
          title: `${config.prefix}Incomplete tasks`,
          config: { value: reportData.kpis.incomplete, filter: "1 filter" },
        },
        {
          id: "3",
          type: "kpi",
          title: `${config.prefix}Overdue tasks`,
          config: { value: reportData.kpis.overdue, filter: "1 filter" },
        },
        {
          id: "4",
          type: "kpi",
          title: `${config.prefix}Total tasks`,
          config: { value: reportData.kpis.total, filter: "No filters" },
        },
        {
          id: "5",
          type: "bar-chart",
          title: `${config.prefix}Incomplete tasks by project`,
          config: { data: reportData.tasksByProject },
        },
        {
          id: "6",
          type: "donut",
          title: `Tasks by completion status this month`,
          config: { data: reportData.tasksByStatus },
        },
        {
          id: "7",
          type: "bar-chart",
          title: `Upcoming tasks this week by assignee`,
          config: { data: [] },
        },
        {
          id: "8",
          type: "donut",
          title: `Projects by status`,
          config: { data: [] },
        },
      ]);
    }
  }, [reportData, config.prefix]);

  const handleAddWidget = (widgetId: string, widgetName: string) => {
    const widgetType =
      widgetId.includes("donut") || widgetId.includes("status")
        ? "donut"
        : widgetId.includes("line") || widgetId.includes("over-time")
        ? "line"
        : "bar-chart";

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: widgetType,
      title: widgetName,
      config: { data: [] },
    };
    setWidgets([...widgets, newWidget]);
    setIsAddWidgetOpen(false);
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
      <div className="px-6 py-2 text-sm text-slate-500 border-b bg-slate-50">
        <Link href="/reporting" className="hover:text-slate-700">
          Reporting
        </Link>
        <span className="mx-2">{">"}</span>
        <span className="text-slate-900">{config.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: config.iconColor }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{config.name}</h1>
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={cn(
              "transition-colors",
              isFavorite ? "text-yellow-500" : "text-slate-300 hover:text-yellow-500"
            )}
          >
            <Star className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-sm text-white font-medium">
            JT
          </div>
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddWidgetOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add widget
        </Button>
        <button className="text-sm text-blue-600 hover:text-blue-700">
          Send feedback
        </button>
      </div>

      {/* Widgets Grid */}
      <div className="flex-1 overflow-auto p-6">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {widgets
            .filter((w) => w.type === "kpi")
            .map((widget) => (
              <div
                key={widget.id}
                className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm text-slate-600">{widget.title}</h3>
                  <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                <p
                  className={cn(
                    "text-4xl font-light text-center mt-4",
                    widget.title.includes("Overdue") && widget.config.value! > 0
                      ? "text-red-600"
                      : "text-slate-900"
                  )}
                >
                  {widget.config.value}
                </p>
                <div className="flex items-center justify-center gap-1 mt-3 text-xs text-slate-400">
                  <Filter className="w-3 h-3" />
                  <span>{widget.config.filter}</span>
                </div>
              </div>
            ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-2 gap-4">
          {widgets
            .filter((w) => w.type !== "kpi")
            .map((widget) => (
              <div
                key={widget.id}
                className="bg-white rounded-lg border p-4 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-900">
                    {widget.title}
                  </h3>
                  <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
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
                            stroke="#64748B"
                            strokeWidth={2}
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

                <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    <span>1 filter</span>
                    <span className="mx-1">.</span>
                    <span>Tasks in My workspace</span>
                  </div>
                  <button className="text-slate-600 hover:text-slate-900">
                    View all
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Add Widget Modal */}
      {isAddWidgetOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[800px] max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Add chart</h2>
              <button
                onClick={() => setIsAddWidgetOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex h-[500px]">
              {/* Sidebar */}
              <div className="w-48 border-r p-4 bg-slate-50">
                {Object.entries(widgetCategories).map(([key, category]) => (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
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
              <div className="flex-1 p-6 overflow-auto">
                <div className="grid grid-cols-3 gap-4">
                  {widgetCategories[
                    activeCategory as keyof typeof widgetCategories
                  ]?.widgets.map((widget) => {
                    const IconComponent = chartIconMap[widget.chartType];
                    return (
                      <button
                        key={widget.id}
                        onClick={() => handleAddWidget(widget.id, widget.name)}
                        className="border rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all text-left bg-white group"
                      >
                        {/* Chart Icon Preview */}
                        <div className="flex items-center justify-center mb-4 p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                          {IconComponent && <IconComponent />}
                        </div>

                        {/* Widget Name */}
                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium text-slate-700 leading-tight line-clamp-2">
                            {widget.name}
                          </span>
                          {"isNew" in widget && widget.isNew && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">
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
          </div>
        </div>
      )}
    </div>
  );
}
