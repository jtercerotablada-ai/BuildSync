"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const STATUS_COLOR: Record<ProjectStatus, string> = {
  ON_TRACK: "#c9a84c",
  AT_RISK: "#f59e0b",
  OFF_TRACK: "#000000",
  ON_HOLD: "#9ca3af",
  COMPLETE: "#a8893a",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  ON_HOLD: "On hold",
  COMPLETE: "Complete",
};

export function PortfolioPanelView({
  projects,
  totalTasks,
  completedTasks,
  overdueTasks,
}: Props) {
  const incompleteTasks = Math.max(totalTasks - completedTasks, 0);

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <Toolbar />
        <SummaryStrip
          totalTasks={0}
          completedTasks={0}
          incompleteTasks={0}
          overdueTasks={0}
        />
        <div className="bg-white rounded-lg border p-12 text-center text-sm text-gray-500">
          Add projects to this portfolio to see the panel dashboard.
        </div>
      </div>
    );
  }

  // ── Widget 1: Projects by status (donut) ─────────────────
  const statusCounts: Record<ProjectStatus, number> = {
    ON_TRACK: 0,
    AT_RISK: 0,
    OFF_TRACK: 0,
    ON_HOLD: 0,
    COMPLETE: 0,
  };
  for (const pp of projects) statusCounts[pp.project.status] += 1;
  const projectsByStatusData = (Object.keys(statusCounts) as ProjectStatus[])
    .filter((k) => statusCounts[k] > 0)
    .map((k) => ({
      name: STATUS_LABEL[k],
      value: statusCounts[k],
      color: STATUS_COLOR[k],
    }));

  // ── Widget 2: Tasks by status (donut) ────────────────────
  const tasksData = [
    { name: "Completed", value: completedTasks, color: "#c9a84c" },
    {
      name: "Open",
      value: Math.max(incompleteTasks - overdueTasks, 0),
      color: "#e5e7eb",
    },
    { name: "Overdue", value: overdueTasks, color: "#000000" },
  ].filter((d) => d.value > 0);

  // ── Widget 3: Incomplete tasks by project (bar) ──────────
  const incompleteByProject = projects
    .map((pp) => ({
      name:
        pp.project.name.length > 14
          ? pp.project.name.slice(0, 13) + "…"
          : pp.project.name,
      value: Math.max(pp.project.stats.total - pp.project.stats.completed, 0),
      color: STATUS_COLOR[pp.project.status],
    }))
    .filter((d) => d.value > 0)
    .slice(0, 8);

  // ── Widget 4: Progress per project (horizontal bar) ──────
  const progressData = projects
    .slice(0, 8)
    .map((pp) => ({
      name:
        pp.project.name.length > 16
          ? pp.project.name.slice(0, 15) + "…"
          : pp.project.name,
      progress: pp.project.stats.progress,
      color: STATUS_COLOR[pp.project.status],
    }));

  return (
    <div className="space-y-4">
      <Toolbar />
      <SummaryStrip
        totalTasks={totalTasks}
        completedTasks={completedTasks}
        incompleteTasks={incompleteTasks}
        overdueTasks={overdueTasks}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <WidgetCard
          title="Total projects by project status"
          filterLabel={`${projects.length} ${
            projects.length === 1 ? "project" : "projects"
          }`}
        >
          {projectsByStatusData.length === 0 ? (
            <Empty label="Not enough data yet" />
          ) : (
            <Donut data={projectsByStatusData} centerLabel={projects.length} />
          )}
        </WidgetCard>

        <WidgetCard
          title="Total tasks by status"
          filterLabel={`${totalTasks} total`}
        >
          {totalTasks === 0 ? (
            <Empty label="No tasks yet" />
          ) : (
            <Donut data={tasksData} centerLabel={totalTasks} />
          )}
        </WidgetCard>

        <WidgetCard
          title="Incomplete tasks by project"
          filterLabel="Top 8"
        >
          {incompleteByProject.length === 0 ? (
            <Empty label="No incomplete tasks 🎉" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={incompleteByProject} barCategoryGap={12}>
                <CartesianGrid
                  vertical={false}
                  stroke="#f3f4f6"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  cursor={{ fill: "rgba(201, 168, 76, 0.08)" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {incompleteByProject.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </WidgetCard>

        <WidgetCard
          title="Progress per project"
          filterLabel="% complete"
        >
          {progressData.length === 0 ? (
            <Empty label="Not enough data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={progressData}
                layout="vertical"
                barCategoryGap={10}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="#f3f4f6"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  cursor={{ fill: "rgba(201, 168, 76, 0.08)" }}
                  formatter={(v) => [`${v}%`, "Progress"]}
                />
                <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                  {progressData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────

function Toolbar() {
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="sm">
        <Plus className="h-4 w-4 mr-1.5" />
        Add widget
      </Button>
      <a
        href="mailto:feedback@ttcivilstructural.com?subject=Panel%20Feedback"
        className="text-xs text-[#a8893a] hover:underline inline-flex items-center gap-1"
      >
        <MessageSquare className="h-3 w-3" />
        Send feedback
      </a>
    </div>
  );
}

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
      <MetricTile
        label="Completed tasks"
        value={completedTasks}
        hint="1 filter"
      />
      <MetricTile
        label="Incomplete tasks"
        value={incompleteTasks}
        hint="1 filter"
      />
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

function WidgetCard({
  title,
  filterLabel,
  children,
}: {
  title: string;
  filterLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-medium text-black">{title}</h3>
      </div>
      <div className="px-4 flex-1 min-h-0">{children}</div>
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
        {filterLabel ? (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-gray-200" />
            {filterLabel}
          </span>
        ) : (
          <span />
        )}
        <button className="text-[#a8893a] hover:underline">View all</button>
      </div>
    </div>
  );
}

function Donut({
  data,
  centerLabel,
}: {
  data: { name: string; value: number; color: string }[];
  centerLabel: number;
}) {
  return (
    <div className="flex items-center justify-center" style={{ height: 240 }}>
      <ResponsiveContainer width="60%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={80}
            paddingAngle={2}
            stroke="white"
            strokeWidth={2}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 text-xs">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: d.color }}
            />
            <span className="text-gray-700">{d.name}</span>
            <span className="tabular-nums text-gray-500 ml-1">
              {d.value}
            </span>
          </div>
        ))}
      </div>
      <div
        className="absolute pointer-events-none text-xl font-semibold tabular-nums text-black"
        style={{
          // Center over the donut. Recharts doesn't expose center
          // measurements so we eyeball: 30% of container width from
          // left aligned to vertical center.
          marginLeft: "-23%",
        }}
      >
        {centerLabel}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 mb-2" />
      <p className="text-sm font-medium text-black">{label}</p>
      <p className="text-xs text-gray-500 mt-1">
        Add more projects or tasks to populate this chart.
      </p>
    </div>
  );
}
