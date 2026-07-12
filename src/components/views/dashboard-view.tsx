"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ListFilter, BarChart3 } from "lucide-react";
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
  AreaChart,
  Area,
  LabelList,
} from "recharts";
import { isPast, isToday, format, subDays, startOfDay } from "date-fns";
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
// COLORS — Asana's Panel palette, measured in the real app:
// charts are purple #9885F1 with the light #B8ACFF companion series,
// axis text #626364, card ring #E0E1E3.
// ============================================

const PURPLE = "#9885F1";
const PURPLE_LIGHT = "#B8ACFF";
const AXIS = "#626364";

// ============================================
// MAIN COMPONENT
// ============================================

export function DashboardView({ sections, projectId }: DashboardViewProps) {
  const router = useRouter();

  // Flatten all tasks from sections
  const allTasks = useMemo(() => {
    return sections.flatMap((section) =>
      section.tasks.map((task) => ({
        ...task,
        sectionName: section.name,
      }))
    );
  }, [sections]);

  // createdAt/completedAt aren't part of the section props — fetch the
  // raw rows once for the completion-over-time burnup (Asana's 4th chart).
  const [timeRows, setTimeRows] = useState<
    { createdAt?: string | null; completedAt?: string | null; completed: boolean }[]
  >([]);
  useEffect(() => {
    let canceled = false;
    fetch(`/api/tasks?projectId=${projectId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (canceled) return;
        const list = Array.isArray(data) ? data : data?.tasks || [];
        setTimeRows(list);
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [projectId, sections]);

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

  // Incomplete tasks by section (Asana: "Total de tareas sin finalizar
  // por sección")
  const tasksBySection = useMemo(() => {
    return sections.map((section) => ({
      name:
        section.name.length > 10
          ? section.name.slice(0, 10) + "…"
          : section.name,
      fullName: section.name,
      incomplete: section.tasks.filter((t) => !t.completed).length,
    }));
  }, [sections]);

  // Tasks by completion status (Asana donut: exactly two states —
  // Finalizadas / Sin finalizar; no invented third segment).
  const tasksByStatus = useMemo(() => {
    return [
      { name: "Complete", value: kpis.completed, color: PURPLE_LIGHT },
      { name: "Incomplete", value: kpis.incomplete, color: PURPLE },
    ].filter((item) => item.value > 0);
  }, [kpis]);

  // Upcoming (incomplete) tasks by assignee (Asana lollipop chart)
  const tasksByAssignee = useMemo(() => {
    const assigneeMap = new Map<
      string,
      { name: string; count: number; image: string | null }
    >();

    allTasks.forEach((task) => {
      if (task.completed) return;
      const key = task.assignee ? task.assignee.id : "unassigned";
      const name = task.assignee
        ? task.assignee.name || task.assignee.email || "Unknown"
        : "Unassigned";
      const current = assigneeMap.get(key) || {
        name,
        count: 0,
        image: task.assignee?.image || null,
      };
      assigneeMap.set(key, { ...current, count: current.count + 1 });
    });

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

  // Completion over time (Asana: "Finalización de tareas a lo largo del
  // tiempo") — last 15 days; Total = tasks that existed by each day,
  // Complete = cumulative completions by completedAt.
  const completionOverTime = useMemo(() => {
    const days: { name: string; Total: number; Complete: number }[] = [];
    const today = startOfDay(new Date());
    for (let i = 14; i >= 0; i--) {
      const day = subDays(today, i);
      const endOfThatDay = new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1);
      let total = 0;
      let complete = 0;
      for (const t of timeRows) {
        const created = t.createdAt ? new Date(t.createdAt) : null;
        if (created && created > endOfThatDay) continue;
        total++;
        const completedAt = t.completedAt ? new Date(t.completedAt) : null;
        if (t.completed && (!completedAt || completedAt <= endOfThatDay)) {
          if (completedAt) complete++;
          else if (i === 0) complete++;
        }
      }
      days.push({ name: format(day, "MM/dd"), Total: total, Complete: complete });
    }
    return days;
  }, [timeRows]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex-1 overflow-auto bg-white p-6">
      {/* Header — Asana shows a single "+ Agregar widget" control */}
      <div className="flex items-center justify-between mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add widget
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => toast.info("Chart widget coming soon")}
            >
              Chart
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => toast.info("KPI card coming soon")}
            >
              KPI card
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPI tiles row — Asana order: Complete, Incomplete, Overdue, Total */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard title="Total complete tasks" value={kpis.completed} filterLabel="1 filter" />
        <KPICard title="Total incomplete tasks" value={kpis.incomplete} filterLabel="1 filter" />
        <KPICard title="Total overdue tasks" value={kpis.overdue} filterLabel="1 filter" />
        <KPICard title="Total tasks" value={kpis.total} filterLabel="No filters" />
      </div>

      {/* Charts grid — 2 columns, 4 cards like Asana's default Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Column chart — incomplete tasks by section */}
        <ChartCard
          title="Total incomplete tasks by section"
          filterLabel="2 filters"
          onViewAll={() => router.push(`/projects/${projectId}?view=list`)}
        >
          {tasksBySection.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={tasksBySection}
                margin={{ top: 20, right: 20, left: 0, bottom: 15 }}
              >
                <CartesianGrid stroke="#E8E9EA" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={{ stroke: "#C4C6C8" }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  tick={{ fontSize: 11, fill: AXIS }}
                  interval={0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: AXIS }}
                  allowDecimals={false}
                  label={{
                    value: "Tasks (count)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: AXIS },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #E0E1E3",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value) => [value ?? 0, "Incomplete"]}
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.fullName || label
                  }
                />
                <Bar
                  dataKey="incomplete"
                  fill={PURPLE}
                  maxBarSize={24}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="incomplete"
                    position="top"
                    style={{ fontSize: 11, fill: "#1D1F21" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No sections with tasks" />
          )}
        </ChartCard>

        {/* 2. Donut — tasks by completion status, total in the center */}
        <ChartCard
          title="Total tasks by completion status"
          filterLabel="1 filter"
          onViewAll={() => router.push(`/projects/${projectId}?view=list`)}
        >
          {tasksByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={tasksByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={0}
                  dataKey="value"
                  label={({ value }) => value}
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {tasksByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                {/* Asana centers the grand total inside the ring */}
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: 28, fontWeight: 400, fill: "#1D1F21" }}
                >
                  {kpis.total}
                </text>
                <Tooltip />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="square"
                  iconSize={10}
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: "#1D1F21" }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No tasks to display" />
          )}
        </ChartCard>

        {/* 3. Lollipop — upcoming tasks by assignee (Asana style: thin
            stem + dot, avatar under each category) */}
        <ChartCard
          title="Total upcoming tasks by assignee"
          filterLabel="2 filters"
          onViewAll={() => router.push(`/projects/${projectId}?view=list`)}
        >
          {tasksByAssignee.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart
                  data={tasksByAssignee}
                  margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid stroke="#E8E9EA" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={{ stroke: "#C4C6C8" }}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: AXIS }}
                    interval={0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: AXIS }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #E0E1E3",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [value ?? 0, "Upcoming"]}
                  />
                  <Bar
                    dataKey="tasks"
                    fill={PURPLE}
                    shape={<LollipopBar />}
                    maxBarSize={8}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="tasks"
                      position="top"
                      offset={12}
                      style={{ fontSize: 11, fill: "#1D1F21" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Avatars below the chart, one per category */}
              <div className="flex justify-around mt-1 px-8">
                {tasksByAssignee.slice(0, 8).map((assignee) => (
                  <div key={assignee.id} className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-[#d4b65a] flex items-center justify-center text-[11px] font-medium text-white overflow-hidden">
                      {assignee.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={assignee.image}
                          alt={assignee.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        assignee.initials
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyChartState message="No upcoming tasks" />
          )}
        </ChartCard>

        {/* 4. Burnup — task completion over time (Total vs Complete) */}
        <ChartCard
          title="Task completion over time"
          filterLabel="No filters"
          onViewAll={() => router.push(`/projects/${projectId}?view=list`)}
        >
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart
              data={completionOverTime}
              margin={{ top: 20, right: 20, left: 0, bottom: 15 }}
            >
              <CartesianGrid stroke="#E8E9EA" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={{ stroke: "#C4C6C8" }}
                tickLine={false}
                angle={-30}
                textAnchor="end"
                tick={{ fontSize: 10, fill: AXIS }}
                interval={0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: AXIS }}
                allowDecimals={false}
                label={{
                  value: "Tasks (count)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: AXIS },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #E0E1E3",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="Total"
                stroke={PURPLE_LIGHT}
                fill={PURPLE_LIGHT}
                fillOpacity={0.55}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="Complete"
                stroke={PURPLE}
                fill={PURPLE}
                fillOpacity={0.7}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Legend
                verticalAlign="bottom"
                align="right"
                iconType="square"
                iconSize={10}
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: "#1D1F21" }}>{value}</span>
                )}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================
// LOLLIPOP BAR SHAPE — thin stem with a round head (Asana's
// "upcoming by assignee" chart mark)
// ============================================

function LollipopBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = PURPLE } = props;
  if (height <= 0) return <g />;
  const cx = x + width / 2;
  return (
    <g>
      <rect x={cx - 1} y={y} width={2} height={height} fill={fill} />
      <circle cx={cx} cy={y} r={5} fill={fill} />
    </g>
  );
}

// ============================================
// KPI TILE — Asana's stat card: 16px/500 title top-left, 48px/300
// number centered, "≡ N filters" footer bottom-left. 8px radius,
// 1px #E0E1E3 ring, no hover effects.
// ============================================

function KPICard({
  title,
  value,
  filterLabel,
}: {
  title: string;
  value: number;
  filterLabel: string;
}) {
  return (
    <div className="bg-white rounded-[8px] border border-[#E0E1E3] p-4 h-[168px] flex flex-col">
      <h3 className="text-base font-medium text-slate-900">{title}</h3>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-5xl font-light text-[#1D1F21] tabular-nums">
          {value}
        </p>
      </div>
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <ListFilter className="w-3 h-3" />
        {filterLabel}
      </div>
    </div>
  );
}

// ============================================
// CHART CARD — Asana's widget card: 16px/500 title, chart body,
// footer with "≡ N filters" left and a "View all" button right.
// ============================================

function ChartCard({
  title,
  filterLabel,
  onViewAll,
  children,
}: {
  title: string;
  filterLabel: string;
  onViewAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[8px] border border-[#E0E1E3] p-4 flex flex-col">
      <h3 className="text-base font-medium text-slate-900 mb-3">{title}</h3>
      <div className="flex-1">{children}</div>
      <div className="flex items-center justify-between pt-3">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <ListFilter className="w-3 h-3" />
          {filterLabel}
        </span>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs text-slate-700 border border-[#C4C6C8] rounded-[6px] px-2.5 py-1 hover:bg-slate-50"
          >
            View all
          </button>
        )}
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
