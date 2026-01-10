"use client";

import { useMemo } from "react";
import {
  Plus,
  Filter,
  MoreHorizontal,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { format, parseISO, isPast, isToday } from "date-fns";

// ============================================
// TYPES
// ============================================

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  subtasks?: { id: string; completed: boolean }[];
  _count?: {
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

interface DashboardViewProps {
  sections: Section[];
  projectId: string;
}

// ============================================
// COLORS
// ============================================

const COLORS = {
  primary: "#8B5CF6", // purple
  secondary: "#3B82F6", // blue
  success: "#22C55E", // green
  warning: "#F97316", // orange
  danger: "#EF4444", // red
  gray: "#9CA3AF", // gray
  chart: ["#8B5CF6", "#3B82F6", "#22C55E", "#F97316", "#EF4444", "#EC4899", "#14B8A6"],
};

// ============================================
// MAIN COMPONENT
// ============================================

export function DashboardView({ sections, projectId }: DashboardViewProps) {
  // Flatten all tasks from sections
  const allTasks = useMemo(() => {
    return sections.flatMap((section) =>
      section.tasks.map((task) => ({
        ...task,
        sectionName: section.name,
      }))
    );
  }, [sections]);

  // ============================================
  // KPI CALCULATIONS
  // ============================================

  const kpis = useMemo(() => {
    const completed = allTasks.filter((t) => t.completed).length;
    const incomplete = allTasks.filter((t) => !t.completed).length;
    const overdue = allTasks.filter((t) => {
      if (!t.dueDate || t.completed) return false;
      const dueDate = parseISO(t.dueDate);
      return isPast(dueDate) && !isToday(dueDate);
    }).length;
    const total = allTasks.length;

    return { completed, incomplete, overdue, total };
  }, [allTasks]);

  // ============================================
  // CHART DATA
  // ============================================

  // Tasks by section
  const tasksBySection = useMemo(() => {
    return sections.map((section) => ({
      name: section.name.length > 12 ? section.name.slice(0, 12) + "..." : section.name,
      fullName: section.name,
      incomplete: section.tasks.filter((t) => !t.completed).length,
      completed: section.tasks.filter((t) => t.completed).length,
      total: section.tasks.length,
    }));
  }, [sections]);

  // Tasks by status (for donut)
  const tasksByStatus = useMemo(() => {
    const data = [
      { name: "Completed", value: kpis.completed, color: COLORS.success },
      { name: "Incomplete", value: kpis.incomplete - kpis.overdue, color: COLORS.primary },
      { name: "Overdue", value: kpis.overdue, color: COLORS.danger },
    ].filter((item) => item.value > 0);
    return data;
  }, [kpis]);

  // Tasks by assignee
  const tasksByAssignee = useMemo(() => {
    const assigneeMap = new Map<string, { name: string; count: number; image: string | null }>();

    allTasks.forEach((task) => {
      if (task.assignee) {
        const key = task.assignee.id;
        const current = assigneeMap.get(key) || {
          name: task.assignee.name || task.assignee.email || "Unknown",
          count: 0,
          image: task.assignee.image,
        };
        assigneeMap.set(key, { ...current, count: current.count + 1 });
      }
    });

    // Add unassigned if there are any
    const unassigned = allTasks.filter((t) => !t.assignee).length;
    if (unassigned > 0) {
      assigneeMap.set("unassigned", { name: "Unassigned", count: unassigned, image: null });
    }

    return Array.from(assigneeMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      tasks: data.count,
      initials: data.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      image: data.image,
    }));
  }, [allTasks]);

  // Progress over time (simulated - in production would come from actual data)
  const progressOverTime = useMemo(() => {
    const dates = [];
    const today = new Date();

    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Simulate gradual completion
      const dayIndex = 13 - i;
      const completedByDate = Math.min(
        Math.floor((dayIndex / 14) * kpis.completed * 1.5),
        kpis.completed
      );

      dates.push({
        date: format(date, "MMM d"),
        total: kpis.total,
        completed: completedByDate,
      });
    }

    return dates;
  }, [kpis]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add widget
        </Button>
        <button className="text-sm text-blue-600 hover:text-blue-700">
          Invite comments
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Completed tasks"
          value={kpis.completed}
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
          trend={kpis.completed > 0 ? { value: 12, isPositive: true } : undefined}
          filterCount={1}
        />
        <KPICard
          title="Incomplete tasks"
          value={kpis.incomplete}
          icon={<Clock className="w-5 h-5 text-purple-500" />}
          filterCount={1}
        />
        <KPICard
          title="Overdue tasks"
          value={kpis.overdue}
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          filterCount={1}
          highlight={kpis.overdue > 0 ? "danger" : undefined}
        />
        <KPICard
          title="Total tasks"
          value={kpis.total}
          icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Bar Chart - Tasks by Section */}
        <ChartCard title="Incomplete tasks by section" filterCount={2}>
          {tasksBySection.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={tasksBySection}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value, name) => [value ?? 0, name === "incomplete" ? "Incomplete" : name]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar
                  dataKey="incomplete"
                  fill={COLORS.primary}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No sections with tasks" />
          )}
        </ChartCard>

        {/* Donut Chart - Tasks by Status */}
        <ChartCard title="Tasks by completion status" filterCount={1}>
          {tasksByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={tasksByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ value }) => value}
                  labelLine={false}
                >
                  {tasksByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No tasks to display" />
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bar Chart - Tasks by Assignee */}
        <ChartCard title="Tasks by assignee" filterCount={2}>
          {tasksByAssignee.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={tasksByAssignee}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="tasks"
                    fill={COLORS.warning}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>

              {/* Avatars below chart */}
              <div className="flex justify-center gap-6 mt-2">
                {tasksByAssignee.slice(0, 5).map((assignee, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-sm font-medium text-white">
                      {assignee.initials}
                    </div>
                    <span className="text-xs text-slate-500 mt-1 truncate max-w-[60px]">
                      {assignee.name.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyChartState message="No assignees found" />
          )}
        </ChartCard>

        {/* Area Chart - Progress Over Time */}
        <ChartCard title="Task completion over time">
          {progressOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart
                data={progressOverTime}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.gray} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.gray} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  allowDecimals={false}
                />
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={COLORS.gray}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  strokeWidth={2}
                  dot={false}
                  name="Total"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke={COLORS.primary}
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                  strokeWidth={2}
                  dot={{ fill: COLORS.primary, r: 3 }}
                  name="Completed"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No data to display" />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================
// KPI CARD COMPONENT
// ============================================

interface KPICardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  filterCount?: number;
  highlight?: "success" | "warning" | "danger";
}

function KPICard({ title, value, icon, trend, filterCount, highlight }: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-4 hover:shadow-md transition-shadow",
        highlight === "danger" && "border-red-200 bg-red-50",
        highlight === "warning" && "border-yellow-200 bg-yellow-50",
        highlight === "success" && "border-green-200 bg-green-50"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        {icon}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p
            className={cn(
              "text-4xl font-bold",
              highlight === "danger" && "text-red-600",
              !highlight && "text-slate-900"
            )}
          >
            {value}
          </p>

          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs mt-1",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.value}% from last week</span>
            </div>
          )}
        </div>
      </div>

      {filterCount !== undefined && (
        <div className="mt-3 pt-3 border-t flex items-center text-xs text-slate-500">
          <Filter className="w-3 h-3 mr-1" />
          {filterCount} {filterCount === 1 ? "filter" : "filters"}
        </div>
      )}
    </div>
  );
}

// ============================================
// CHART CARD COMPONENT
// ============================================

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  filterCount?: number;
}

function ChartCard({ title, children, filterCount }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-900">{title}</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {children}

      <div className="mt-4 pt-3 border-t flex items-center justify-between">
        <div className="flex items-center text-xs text-slate-500">
          <Filter className="w-3 h-3 mr-1" />
          {filterCount !== undefined ? `${filterCount} filters` : "No filters"}
        </div>
        <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
          View all
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-[250px] flex items-center justify-center">
      <div className="text-center">
        <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}
