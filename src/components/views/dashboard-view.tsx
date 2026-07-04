"use client";

import { useMemo } from "react";
import {
  Plus,
  Filter,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
} from "recharts";
import { isPast, isToday } from "date-fns";
import { dueDateToLocalMidnight } from "@/lib/date-only";

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
  primary: "#a8893a", // purple
  secondary: "#c9a84c", // blue
  success: "#22C55E", // green
  warning: "#F97316", // orange
  danger: "#0a0a0a", // red
  gray: "#9CA3AF", // gray
  chart: ["#a8893a", "#c9a84c", "#22C55E", "#F97316", "#0a0a0a", "#c9a84c", "#14B8A6"],
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
      // dueDate is UTC midnight — compare by UTC calendar day so a task due
      // today isn't counted overdue for users west of UTC.
      const dueDate = dueDateToLocalMidnight(t.dueDate);
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

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add widget
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => toast.info("Chart widget coming soon")}>Chart</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("KPI card coming soon")}>KPI card</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Task list widget coming soon")}>Task list</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Custom widget coming soon")}>Custom</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button className="text-sm text-black hover:text-black" onClick={() => toast.info("Invite comments coming soon")}>
          Invite comments
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Completed tasks"
          value={kpis.completed}
          icon={<CheckCircle2 className="w-5 h-5 text-black" />}
        />
        <KPICard
          title="Incomplete tasks"
          value={kpis.incomplete}
          icon={<Clock className="w-5 h-5 text-black" />}
        />
        <KPICard
          title="Overdue tasks"
          value={kpis.overdue}
          icon={<AlertTriangle className="w-5 h-5 text-black" />}
          highlight={kpis.overdue > 0 ? "danger" : undefined}
        />
        <KPICard
          title="Total tasks"
          value={kpis.total}
          icon={<BarChart3 className="w-5 h-5 text-black" />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Bar Chart - Tasks by Section */}
        <ChartCard title="Incomplete tasks by section">
          {tasksBySection.some((s) => s.total > 0) ? (
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
        <ChartCard title="Tasks by completion status">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bar Chart - Tasks by Assignee */}
        <ChartCard title="Tasks by assignee">
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
                    <div className="w-8 h-8 rounded-full bg-[#d4b65a] flex items-center justify-center text-sm font-medium text-white">
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
  filterCount?: number;
  highlight?: "success" | "warning" | "danger";
}

function KPICard({ title, value, icon, filterCount, highlight }: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-4 hover:shadow-md transition-shadow",
        highlight === "danger" && "border-black bg-white",
        highlight === "warning" && "border-black bg-white",
        highlight === "success" && "border-black bg-white"
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
              highlight === "danger" && "text-black",
              !highlight && "text-slate-900"
            )}
          >
            {value}
          </p>
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
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-900">{title}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast.info("Edit widget coming soon")}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Duplicate widget coming soon")}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Remove widget coming soon")}>Remove</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {children}
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
