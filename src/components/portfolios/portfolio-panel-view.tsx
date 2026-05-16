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
  Legend,
} from "recharts";
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  Clock,
  Briefcase,
} from "lucide-react";
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

const TYPE_LABEL: Record<ProjectType, string> = {
  CONSTRUCTION: "Construction",
  DESIGN: "Design",
  RECERTIFICATION: "Recertification",
  PERMIT: "Permit",
};

const GATE_LABEL: Record<ProjectGate, string> = {
  PRE_DESIGN: "Pre-design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

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

export function PortfolioPanelView({
  projects,
  totalBudget,
  currency,
  totalTasks,
  completedTasks,
  overdueTasks,
  atRiskCount,
  avgProgress,
  activeProjects,
  projectCount,
  byType,
  byGate,
}: Props) {
  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-12 text-center text-sm text-gray-500">
        Add projects to this portfolio to see the panel dashboard.
      </div>
    );
  }

  // Donut: projects by status
  const statusCounts: Record<ProjectStatus, number> = {
    ON_TRACK: 0,
    AT_RISK: 0,
    OFF_TRACK: 0,
    ON_HOLD: 0,
    COMPLETE: 0,
  };
  for (const pp of projects) statusCounts[pp.project.status] += 1;
  const donutData = (Object.keys(statusCounts) as ProjectStatus[])
    .filter((k) => statusCounts[k] > 0)
    .map((k) => ({
      name: STATUS_LABEL[k],
      value: statusCounts[k],
      color: STATUS_COLOR[k],
    }));

  // Bar: tasks completed vs open per project (top 8)
  const barData = projects
    .slice(0, 8)
    .map((pp) => ({
      name: pp.project.name.length > 14
        ? pp.project.name.slice(0, 13) + "…"
        : pp.project.name,
      Completed: pp.project.stats.completed,
      Open: pp.project.stats.total - pp.project.stats.completed,
      Overdue: pp.project.stats.overdue,
    }));

  // Bar: progress per project
  const progressData = projects
    .slice(0, 10)
    .map((pp) => ({
      name: pp.project.name.length > 12
        ? pp.project.name.slice(0, 11) + "…"
        : pp.project.name,
      Progress: pp.project.stats.progress,
    }));

  return (
    <div className="space-y-4">
      {/* KPI strip — moved out of header per Asana parity */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile
          icon={<Briefcase className="h-4 w-4 text-[#a8893a]" />}
          label="Active projects"
          value={activeProjects.toString()}
          sub={`${projectCount} total`}
        />
        <Tile
          icon={<Wallet className="h-4 w-4 text-[#a8893a]" />}
          label="Total budget"
          value={formatBudget(totalBudget, currency)}
        />
        <Tile
          icon={<TrendingUp className="h-4 w-4 text-[#a8893a]" />}
          label="Avg progress"
          value={`${avgProgress}%`}
          sub={`${completedTasks}/${totalTasks} tasks`}
        />
        <Tile
          icon={<AlertTriangle className="h-4 w-4 text-[#a8893a]" />}
          label="At risk"
          value={atRiskCount.toString()}
          accent={atRiskCount > 0}
        />
        <Tile
          icon={<Clock className="h-4 w-4 text-[#a8893a]" />}
          label="Overdue tasks"
          value={overdueTasks.toString()}
          accent={overdueTasks > 0}
        />
      </div>

      {/* Type & Gate breakdowns — BuildSync-specific (no Asana equivalent) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BreakdownCard
          title="By project type"
          items={(Object.keys(TYPE_LABEL) as ProjectType[]).map((t) => ({
            label: TYPE_LABEL[t],
            count: byType[t],
          }))}
          total={projectCount}
        />
        <BreakdownCard
          title="By lifecycle gate"
          items={(Object.keys(GATE_LABEL) as ProjectGate[]).map((g) => ({
            label: GATE_LABEL[g],
            count: byGate[g],
          }))}
          total={projectCount}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title="Projects by status"
          subtitle={`${projects.length} total`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {donutData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Total budget"
          subtitle={formatBudget(totalBudget, currency)}
        >
          <div className="flex items-center justify-center h-[260px]">
            <div className="text-center">
              <div className="text-5xl font-bold text-black tabular-nums">
                {formatBudget(totalBudget, currency)}
              </div>
              <div className="text-sm text-gray-500 mt-2">
                across {projects.length} projects
              </div>
              {projects.filter((p) => p.project.budget).length <
                projects.length && (
                <div className="text-xs text-gray-400 mt-1">
                  {projects.length -
                    projects.filter((p) => p.project.budget).length}{" "}
                  project(s) without budget
                </div>
              )}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Tasks per project" subtitle="Completed vs open">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Completed" stackId="a" fill="#c9a84c" />
              <Bar dataKey="Open" stackId="a" fill="#e5e7eb" />
              <Bar dataKey="Overdue" stackId="a" fill="#000000" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Progress per project" subtitle="% complete">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={progressData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={100}
              />
              <Tooltip />
              <Bar dataKey="Progress" fill="#a8893a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function Tile({
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

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium text-black">{title}</h3>
        {subtitle && (
          <span className="text-xs text-gray-500 tabular-nums">{subtitle}</span>
        )}
      </div>
      {children}
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
