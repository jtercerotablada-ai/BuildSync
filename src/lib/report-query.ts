/**
 * report-query.ts — the aggregation engine behind POST /api/reports/query.
 *
 * Takes a validated ChartConfig, builds ONE Prisma `where` from
 * scope + filters, then aggregates a dimension × measure (× optional
 * breakdown) combination into the {data, seriesKeys, total, meta}
 * response contract the custom chart builder renders.
 *
 * Design constraints (from the HARD RULES):
 *   • date-only overdue semantics via src/lib/date-only.ts — a task due
 *     today is NEVER overdue. We NEVER replicate the legacy raw
 *     `dueDate < now` comparison.
 *   • No schema change. Custom-field values live in CustomFieldValue.value
 *     (Json), which is not groupable in SQL, so cf dimensions/measures use
 *     findMany + JS reduce.
 *   • Colors reuse the project/portfolio/status maps mirrored from
 *     /api/reports; fallback to the COLORS palette by index.
 *
 * This module is server-only (imports Prisma). The route wraps it with
 * auth + access gating; keep gating OUT of here so it stays testable.
 */

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { daysFromToday, dueDateToLocalMidnight } from "@/lib/date-only";
import type {
  ChartConfig,
  ChartDataRow,
  ChartQueryResponse,
  ChartSeriesKey,
  ChartType,
  DateGrain,
  DimField,
  Filter,
  Measure,
  MeasureField,
} from "@/lib/report-config";
import { CHRONOLOGICAL_CHART_TYPES } from "@/lib/report-config";

// ─── Palette (mirrors /api/reports) ───────────────────────────────

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#64748b",
  "#84cc16",
];

function paletteColor(index: number): string {
  return COLORS[index % COLORS.length];
}

// Status color maps mirrored from /api/reports so custom charts match the
// precomputed catalog widgets.
const PROJECT_STATUS_COLORS: Record<string, string> = {
  ON_TRACK: "#22c55e",
  AT_RISK: "#eab308",
  OFF_TRACK: "#ef4444",
  ON_HOLD: "#94a3b8",
  COMPLETE: "#3b82f6",
};

const GOAL_STATUS_COLORS: Record<string, string> = {
  ON_TRACK: "#22c55e",
  AT_RISK: "#eab308",
  OFF_TRACK: "#ef4444",
  ACHIEVED: "#3b82f6",
  PARTIAL: "#8b5cf6",
  MISSED: "#64748b",
  DROPPED: "#94a3b8",
};

const PRIORITY_COLORS: Record<string, string> = {
  NONE: "#94a3b8",
  LOW: "#22c55e",
  MEDIUM: "#eab308",
  HIGH: "#ef4444",
};

const DUE_STATUS_COLORS: Record<string, string> = {
  Upcoming: "#22c55e",
  Overdue: "#ef4444",
  "No date": "#94a3b8",
  Completed: "#3b82f6",
};

const COMPLETION_STATUS_COLORS: Record<string, string> = {
  Completed: "#3b82f6",
  Incomplete: "#f97316",
};

// ─── Public engine context ────────────────────────────────────────

export interface EngineContext {
  userId: string;
  workspaceId: string;
  /**
   * The project ids belonging to a portfolio, resolved ONCE (by the route,
   * post view-gate) when config.scope.kind === 'portfolio'. The sub-queries
   * read this instead of re-resolving the link table. An empty array means
   * the portfolio has no projects → the aggregation matches nothing (a sound,
   * honest empty result), never the whole workspace.
   */
  portfolioProjectIds?: string[];
}

/**
 * Resolve a portfolio's project ids via the PortfolioProject join. Callers
 * that already gated portfolio view-access should use this once and place the
 * result on EngineContext.portfolioProjectIds so the entity sub-queries stay
 * pure. Exported so the query route can resolve + gate in the same request.
 */
export async function portfolioProjectIds(
  portfolioId: string
): Promise<string[]> {
  const links = await prisma.portfolioProject.findMany({
    where: { portfolioId },
    select: { projectId: true },
  });
  return links.map((l) => l.projectId);
}

// A resolved task row we pull once and reduce in JS.
interface TaskRow {
  id: string;
  name: string;
  completed: boolean;
  completedAt: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  taskType: string;
  priority: string;
  projectId: string | null;
  sectionId: string | null;
  assigneeId: string | null;
  creatorId: string | null;
}

// ─── Name-resolution maps ─────────────────────────────────────────

interface ResolveMaps {
  users: Map<string, string>;
  projects: Map<string, { name: string; color: string }>;
  sections: Map<string, string>;
  portfolios: Map<string, { name: string; color: string }>;
  /** taskId -> Set<portfolioId> (via the task's project). */
  taskPortfolios: Map<string, string[]>;
  /** projectId -> Set<portfolioId>. */
  projectPortfolios: Map<string, string[]>;
  /** custom-field def id -> { name, type }. */
  cfDefs: Map<string, { name: string; type: string }>;
  /** `${taskId}:${fieldId}` -> raw Json value. */
  cfValues: Map<string, unknown>;
}

// ─── Filter → Prisma where translation (tasks) ───────────────────

const TASK_TYPE_VALUES = new Set(["TASK", "MILESTONE", "APPROVAL"]);
const PRIORITY_VALUES = new Set(["NONE", "LOW", "MEDIUM", "HIGH"]);

/**
 * Translate the SQL-expressible filters into a Prisma `Task` where clause.
 * Filters that depend on computed/date-only semantics (dueStatus) or on
 * custom-field Json values are applied in JS AFTER the fetch (see
 * applyPostFilters) — this keeps the where sound and the date logic in one
 * place.
 */
function buildTaskWhere(
  config: ChartConfig,
  ctx: EngineContext
): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [];

  // Scope.
  if (config.scope.kind === "workspace") {
    and.push({ project: { workspaceId: ctx.workspaceId } });
  } else if (config.scope.kind === "project") {
    // The route validates the project belongs to the workspace before
    // calling the engine.
    and.push({ projectId: config.scope.projectId });
  } else if (config.scope.kind === "portfolio") {
    // Tasks of the portfolio's projects. The route resolves + gates the ids
    // (post portfolio view-check) onto ctx.portfolioProjectIds. An empty list
    // matches nothing — a sound, honest empty result (never the workspace).
    and.push({ projectId: { in: ctx.portfolioProjectIds ?? [] } });
  } else {
    // 'my' — tasks assigned to the caller, still workspace-scoped.
    and.push({ project: { workspaceId: ctx.workspaceId }, assigneeId: ctx.userId });
  }

  for (const f of config.filters) {
    const clause = taskFilterToWhere(f);
    if (clause) and.push(clause);
  }

  return and.length === 1 ? and[0] : { AND: and };
}

function taskFilterToWhere(f: Filter): Prisma.TaskWhereInput | null {
  const v = f.value;
  const asArray = Array.isArray(v) ? v : v != null ? [String(v)] : [];

  switch (f.field) {
    case "assignee":
      if (f.operator === "isSet") return { assigneeId: { not: null } };
      if (f.operator === "isNotSet") return { assigneeId: null };
      if (f.operator === "isNot") return { assigneeId: { notIn: asArray } };
      return { assigneeId: { in: asArray } };
    case "creator":
      if (f.operator === "isSet") return { creatorId: { not: null } };
      if (f.operator === "isNotSet") return { creatorId: null };
      if (f.operator === "isNot") return { creatorId: { notIn: asArray } };
      return { creatorId: { in: asArray } };
    case "project":
      if (f.operator === "isSet") return { projectId: { not: null } };
      if (f.operator === "isNotSet") return { projectId: null };
      if (f.operator === "isNot") return { projectId: { notIn: asArray } };
      return { projectId: { in: asArray } };
    case "section":
      if (f.operator === "isSet") return { sectionId: { not: null } };
      if (f.operator === "isNotSet") return { sectionId: null };
      if (f.operator === "isNot") return { sectionId: { notIn: asArray } };
      return { sectionId: { in: asArray } };
    case "taskType": {
      const vals = asArray.filter((x) => TASK_TYPE_VALUES.has(x)) as Prisma.EnumTaskTypeFilter["in"];
      if (!vals || (Array.isArray(vals) && vals.length === 0)) return null;
      return f.operator === "isNot"
        ? { taskType: { notIn: vals } }
        : { taskType: { in: vals } };
    }
    case "priority": {
      const vals = asArray.filter((x) => PRIORITY_VALUES.has(x)) as Prisma.EnumPriorityFilter["in"];
      if (!vals || (Array.isArray(vals) && vals.length === 0)) return null;
      return f.operator === "isNot"
        ? { priority: { notIn: vals } }
        : { priority: { in: vals } };
    }
    case "completionStatus": {
      // value 'Completed' | 'Incomplete' (or true/false)
      const wantCompleted =
        asArray.includes("Completed") ||
        asArray.includes("completed") ||
        asArray.includes("true");
      return { completed: f.operator === "isNot" ? !wantCompleted : wantCompleted };
    }
    case "name":
      if (f.operator === "contains" && v != null)
        return { name: { contains: String(v), mode: "insensitive" } };
      if (f.operator === "is" && v != null) return { name: String(v) };
      return null;
    case "dueDate":
      return dateFilterToWhere("dueDate", f);
    case "completedAt":
      return dateFilterToWhere("completedAt", f);
    case "createdAt":
      return dateFilterToWhere("createdAt", f);
    // dueStatus + cf:* are post-filters (JS); return null here.
    case "dueStatus":
    case "portfolio":
    case "owner":
    case "status":
      return null;
    default:
      if (f.field.startsWith("cf:")) return null;
      return null;
  }
}

function startOfLocalDay(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate());
}

/** Build a Prisma date where for gt/lt/gte/lte/inLastDays/inNextDays/isSet. */
function dateFilterToWhere(
  field: "dueDate" | "completedAt" | "createdAt",
  f: Filter
): Prisma.TaskWhereInput | null {
  if (f.operator === "isSet") return { [field]: { not: null } } as Prisma.TaskWhereInput;
  if (f.operator === "isNotSet") return { [field]: null } as Prisma.TaskWhereInput;

  const today = startOfLocalDay();
  const MS_DAY = 86400000;

  if (f.operator === "inLastDays") {
    const n = Number(f.value) || 0;
    const from = new Date(today.getTime() - n * MS_DAY);
    return { [field]: { gte: from, lte: new Date() } } as Prisma.TaskWhereInput;
  }
  if (f.operator === "inNextDays") {
    const n = Number(f.value) || 0;
    const to = new Date(today.getTime() + (n + 1) * MS_DAY);
    return { [field]: { gte: today, lt: to } } as Prisma.TaskWhereInput;
  }

  if (f.value == null) return null;
  const d = new Date(String(f.value));
  if (isNaN(d.getTime())) return null;
  const op =
    f.operator === "gt"
      ? "gt"
      : f.operator === "lt"
      ? "lt"
      : f.operator === "lte"
      ? "lte"
      : "gte";
  return { [field]: { [op]: d } } as Prisma.TaskWhereInput;
}

// ─── Post-filters (dueStatus + custom-field values) ──────────────

function applyPostFilters(
  rows: TaskRow[],
  filters: Filter[],
  maps: ResolveMaps
): TaskRow[] {
  const postFilters = filters.filter(
    (f) => f.field === "dueStatus" || f.field === "portfolio" || f.field.startsWith("cf:")
  );
  if (postFilters.length === 0) return rows;

  return rows.filter((row) => {
    for (const f of postFilters) {
      if (f.field === "dueStatus") {
        const status = computeDueStatus(row);
        const want = Array.isArray(f.value)
          ? f.value
          : f.value != null
          ? [String(f.value)]
          : [];
        const match = want.includes(status);
        if (f.operator === "isNot" ? match : !match) return false;
      } else if (f.field === "portfolio") {
        const pids = row.projectId ? maps.projectPortfolios.get(row.projectId) ?? [] : [];
        const want = Array.isArray(f.value)
          ? f.value
          : f.value != null
          ? [String(f.value)]
          : [];
        if (f.operator === "isSet") {
          if (pids.length === 0) return false;
        } else if (f.operator === "isNotSet") {
          if (pids.length > 0) return false;
        } else {
          const match = pids.some((p) => want.includes(p));
          if (f.operator === "isNot" ? match : !match) return false;
        }
      } else if (f.field.startsWith("cf:")) {
        const fieldId = f.field.slice(3);
        const raw = maps.cfValues.get(`${row.id}:${fieldId}`);
        if (!matchCfFilter(raw, f)) return false;
      }
    }
    return true;
  });
}

function matchCfFilter(raw: unknown, f: Filter): boolean {
  const isSet = raw !== undefined && raw !== null && raw !== "";
  if (f.operator === "isSet") return isSet;
  if (f.operator === "isNotSet") return !isSet;
  if (!isSet) return false;

  const num = toNumber(raw);
  const str = String(cfScalar(raw));

  switch (f.operator) {
    case "is":
      return Array.isArray(f.value)
        ? f.value.includes(str)
        : String(f.value) === str;
    case "isNot":
      return Array.isArray(f.value)
        ? !f.value.includes(str)
        : String(f.value) !== str;
    case "contains":
      return str.toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "gt":
      return num != null && num > Number(f.value);
    case "lt":
      return num != null && num < Number(f.value);
    case "gte":
      return num != null && num >= Number(f.value);
    case "lte":
      return num != null && num <= Number(f.value);
    default:
      return true;
  }
}

// ─── Dimension key + label resolution ─────────────────────────────

/** Compute the Upcoming|Overdue|No date|Completed bucket for a task. */
function computeDueStatus(row: TaskRow): string {
  if (row.completed) return "Completed";
  if (!row.dueDate) return "No date";
  // date-only: due today (0) is NOT overdue; negative = overdue.
  return daysFromToday(row.dueDate) < 0 ? "Overdue" : "Upcoming";
}

function computeCompletionStatus(row: TaskRow): string {
  return row.completed ? "Completed" : "Incomplete";
}

/** Bucket a date by grain using the UTC calendar day (date-only.ts). */
function dateBucketKey(value: Date, grain: DateGrain): string {
  const d = dueDateToLocalMidnight(value); // local-midnight of the UTC day
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based
  if (grain === "day") {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (grain === "week") {
    // ISO-ish: bucket by the Monday of the week.
    const day = d.getDay(); // 0=Sun
    const diff = (day + 6) % 7; // days since Monday
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  }
  if (grain === "quarter") {
    const q = Math.floor(m / 3) + 1;
    return `${y}-Q${q}`;
  }
  // month
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function dateBucketLabel(key: string, grain: DateGrain): string {
  if (grain === "quarter") return key; // "2026-Q3"
  const parts = key.split("-");
  const y = parts[0];
  const m = parseInt(parts[1], 10) - 1;
  if (grain === "month") return `${MONTH_NAMES[m]} ${y}`;
  const dd = parts[2];
  return `${MONTH_NAMES[m]} ${parseInt(dd, 10)}`; // day / week (week labelled by its Monday)
}

/**
 * Resolve the dimension bucket a task falls into.
 * Returns { key, label, color } — key groups rows, label displays,
 * color themes the bar/slice.
 */
function resolveTaskDimension(
  row: TaskRow,
  field: DimField,
  grain: DateGrain | undefined,
  maps: ResolveMaps
): { key: string; label: string; color?: string } {
  if (field.startsWith("cf:")) {
    const fieldId = field.slice(3);
    const raw = maps.cfValues.get(`${row.id}:${fieldId}`);
    const label = raw == null || raw === "" ? "(none)" : String(cfScalar(raw));
    return { key: label, label };
  }

  switch (field) {
    case "assignee": {
      const id = row.assigneeId;
      if (!id) return { key: "__none", label: "Unassigned" };
      return { key: id, label: maps.users.get(id) ?? "Unknown" };
    }
    case "creator": {
      const id = row.creatorId;
      if (!id) return { key: "__none", label: "Unknown" };
      return { key: id, label: maps.users.get(id) ?? "Unknown" };
    }
    case "taskType":
      return { key: row.taskType, label: titleCase(row.taskType) };
    case "priority":
      return {
        key: row.priority,
        label: titleCase(row.priority),
        color: PRIORITY_COLORS[row.priority],
      };
    case "completionStatus": {
      const s = computeCompletionStatus(row);
      return { key: s, label: s, color: COMPLETION_STATUS_COLORS[s] };
    }
    case "dueStatus": {
      const s = computeDueStatus(row);
      return { key: s, label: s, color: DUE_STATUS_COLORS[s] };
    }
    case "project": {
      const id = row.projectId;
      if (!id) return { key: "__none", label: "No project" };
      const p = maps.projects.get(id);
      return { key: id, label: p?.name ?? "Unknown", color: p?.color };
    }
    case "section": {
      const id = row.sectionId;
      if (!id) return { key: "__none", label: "No section" };
      return { key: id, label: maps.sections.get(id) ?? "Unknown" };
    }
    case "date": {
      const g = grain ?? "month";
      // Bucket completed-status charts by completedAt, else by dueDate.
      const basis = row.completed && row.completedAt ? row.completedAt : row.dueDate;
      if (!basis) return { key: "__nodate", label: "No date" };
      const key = dateBucketKey(basis, g);
      return { key, label: dateBucketLabel(key, g) };
    }
    default:
      return { key: "__none", label: "Unknown" };
  }
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Custom-field value helpers ───────────────────────────────────

/** Extract a comparable scalar from a CustomFieldValue.value Json blob. */
function cfScalar(raw: unknown): string | number | boolean {
  if (raw == null) return "";
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // TIME_TRACKING stores { estimated, actual }; other structured types
    // commonly wrap under `value` / `label` / `text`.
    if ("value" in obj) return cfScalar(obj.value);
    if ("label" in obj) return String(obj.label);
    if ("text" in obj) return String(obj.text);
    return JSON.stringify(raw);
  }
  return raw as string | number | boolean;
}

function toNumber(raw: unknown): number | null {
  const s = cfScalar(raw);
  const n = typeof s === "number" ? s : parseFloat(String(s));
  return isNaN(n) ? null : n;
}

// ─── Measure evaluation ───────────────────────────────────────────

/** Extract the numeric contribution of a task row for a measure. */
function measureValue(
  row: TaskRow,
  measure: Measure,
  maps: ResolveMaps
): number | null {
  if (measure.aggregation === "count" || measure.field === "task") return 1;

  if (measure.field === "time.estimated" || measure.field === "time.actual") {
    // Estimated/Actual time live in a TIME_TRACKING custom field
    // ({ estimated, actual }). Pull the first TIME_TRACKING value for this
    // task, if any.
    const key = measure.field === "time.estimated" ? "estimated" : "actual";
    for (const [mapKey, def] of maps.cfDefs) {
      if (def.type === "TIME_TRACKING") {
        const raw = maps.cfValues.get(`${row.id}:${mapKey}`);
        if (raw && typeof raw === "object" && key in (raw as object)) {
          const n = Number((raw as Record<string, unknown>)[key]);
          return isNaN(n) ? null : n;
        }
      }
    }
    return null;
  }

  if (measure.field.startsWith("cf:")) {
    const fieldId = measure.field.slice(3);
    const raw = maps.cfValues.get(`${row.id}:${fieldId}`);
    return toNumber(raw);
  }

  return 1;
}

/** Reduce a list of per-row values into the aggregated scalar. */
function aggregate(values: number[], agg: Measure["aggregation"]): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case "count":
      return values.length;
    case "sum":
      return round2(values.reduce((a, b) => a + b, 0));
    case "avg":
      return round2(values.reduce((a, b) => a + b, 0) / values.length);
    case "min":
      return round2(Math.min(...values));
    case "max":
      return round2(Math.max(...values));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Resolve maps (batched name/color + cf lookups) ──────────────

async function loadTaskResolveMaps(
  rows: TaskRow[],
  config: ChartConfig,
  ctx: EngineContext
): Promise<ResolveMaps> {
  const userIds = new Set<string>();
  const projectIds = new Set<string>();
  const sectionIds = new Set<string>();
  const taskIds = rows.map((r) => r.id);

  for (const r of rows) {
    if (r.assigneeId) userIds.add(r.assigneeId);
    if (r.creatorId) userIds.add(r.creatorId);
    if (r.projectId) projectIds.add(r.projectId);
    if (r.sectionId) sectionIds.add(r.sectionId);
  }

  // Does this query reference any custom fields (dim, breakdown, measure,
  // filter) or time.* measures?
  const needsCf =
    config.dimension?.field.startsWith("cf:") ||
    config.breakdown?.field.startsWith("cf:") ||
    config.measures.some(
      (m) => m.field.startsWith("cf:") || m.field.startsWith("time.")
    ) ||
    config.filters.some((f) => f.field.startsWith("cf:"));

  const needsPortfolio =
    config.filters.some((f) => f.field === "portfolio");

  const [users, projects, sections, cfValueRows, cfDefRows, portfolioLinks] =
    await Promise.all([
      userIds.size
        ? prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      projectIds.size
        ? prisma.project.findMany({
            where: { id: { in: Array.from(projectIds) } },
            select: { id: true, name: true, color: true },
          })
        : Promise.resolve([]),
      sectionIds.size
        ? prisma.section.findMany({
            where: { id: { in: Array.from(sectionIds) } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      needsCf && taskIds.length
        ? prisma.customFieldValue.findMany({
            where: { taskId: { in: taskIds } },
            select: { taskId: true, fieldId: true, value: true },
          })
        : Promise.resolve([]),
      needsCf
        ? prisma.customFieldDefinition.findMany({
            where: { workspaceId: ctx.workspaceId },
            select: { id: true, name: true, type: true },
          })
        : Promise.resolve([]),
      needsPortfolio && projectIds.size
        ? prisma.portfolioProject.findMany({
            where: { projectId: { in: Array.from(projectIds) } },
            select: { projectId: true, portfolioId: true },
          })
        : Promise.resolve([]),
    ]);

  const cfValues = new Map<string, unknown>();
  for (const v of cfValueRows) cfValues.set(`${v.taskId}:${v.fieldId}`, v.value);

  const cfDefs = new Map<string, { name: string; type: string }>();
  for (const d of cfDefRows) cfDefs.set(d.id, { name: d.name, type: d.type });

  const projectPortfolios = new Map<string, string[]>();
  for (const link of portfolioLinks) {
    const arr = projectPortfolios.get(link.projectId) ?? [];
    arr.push(link.portfolioId);
    projectPortfolios.set(link.projectId, arr);
  }

  return {
    users: new Map(users.map((u) => [u.id, u.name || "Unknown"])),
    projects: new Map(
      projects.map((p) => [p.id, { name: p.name, color: p.color }])
    ),
    sections: new Map(sections.map((s) => [s.id, s.name])),
    portfolios: new Map(),
    taskPortfolios: new Map(),
    projectPortfolios,
    cfDefs,
    cfValues,
  };
}

// ─── Bucket accumulation ──────────────────────────────────────────

interface Bucket {
  key: string;
  label: string;
  color?: string;
  /** seriesKey -> list of per-row measure values (for aggregation). */
  series: Map<string, number[]>;
}

// ─── The task entity engine ───────────────────────────────────────

async function runTaskQuery(
  config: ChartConfig,
  ctx: EngineContext
): Promise<{ data: ChartDataRow[]; seriesKeys: ChartSeriesKey[]; total: number }> {
  const where = buildTaskWhere(config, ctx);

  const rawRows = await prisma.task.findMany({
    where,
    select: {
      id: true,
      name: true,
      completed: true,
      completedAt: true,
      dueDate: true,
      createdAt: true,
      taskType: true,
      priority: true,
      projectId: true,
      sectionId: true,
      assigneeId: true,
      creatorId: true,
    },
  });

  const rows: TaskRow[] = rawRows.map((r) => ({
    ...r,
    taskType: String(r.taskType),
    priority: String(r.priority),
  }));

  const maps = await loadTaskResolveMaps(rows, config, ctx);
  const filtered = applyPostFilters(rows, config.filters, maps);

  const primary = config.measures[0];
  const limit = config.options?.limit ?? 12;

  // ── 'number' card: single aggregated scalar, no dimension. ──
  if (config.chartType === "number") {
    const values: number[] = [];
    for (const row of filtered) {
      const v = measureValue(row, primary, maps);
      if (v != null) values.push(v);
    }
    const total = aggregate(values, primary.aggregation);
    return {
      data: [{ name: measureLabel(primary), value: total }],
      seriesKeys: [{ key: "value", name: measureLabel(primary), color: paletteColor(0) }],
      total,
    };
  }

  // ── burnup / burndown: cumulative completed-vs-scope over time. ──
  if (config.chartType === "burnup" || config.chartType === "burndown") {
    return buildBurn(filtered, config);
  }

  const grain = config.dimension?.dateGrain;
  const dimField = config.dimension?.field ?? "completionStatus";
  const isDateDim = dimField === "date";

  // ── Grouped/stacked with a breakdown → multi-series. ──
  const hasBreakdown =
    (config.chartType === "stackedBar" || config.chartType === "groupedBar") &&
    config.breakdown != null;

  // ── Multiple measures → each measure is a series. ──
  const multiMeasure = config.measures.length > 1 && !hasBreakdown;

  const buckets = new Map<string, Bucket>();
  const seriesMeta = new Map<string, { name: string; color?: string }>();

  for (const row of filtered) {
    const dim = resolveTaskDimension(row, dimField as DimField, grain, maps);
    let bucket = buckets.get(dim.key);
    if (!bucket) {
      bucket = { key: dim.key, label: dim.label, color: dim.color, series: new Map() };
      buckets.set(dim.key, bucket);
    }

    if (hasBreakdown) {
      const bd = resolveTaskDimension(row, config.breakdown!.field, undefined, maps);
      seriesMeta.set(bd.key, { name: bd.label, color: bd.color });
      pushSeries(bucket, bd.key, measureValue(row, primary, maps));
    } else if (multiMeasure) {
      config.measures.forEach((m, i) => {
        const skey = `m${i}`;
        seriesMeta.set(skey, { name: measureLabel(m) });
        pushSeries(bucket!, skey, measureValue(row, m, maps));
      });
    } else {
      seriesMeta.set("value", { name: measureLabel(primary) });
      pushSeries(bucket, "value", measureValue(row, primary, maps));
    }
  }

  // Aggregate each bucket's series.
  let rowsOut: (ChartDataRow & { __primary: number })[] = Array.from(
    buckets.values()
  ).map((b) => {
    const out: ChartDataRow & { __primary: number } = {
      name: b.label,
      __primary: 0,
    };
    if (b.color) out.color = b.color;
    let primaryTotal = 0;
    for (const [skey, vals] of b.series) {
      const agg =
        hasBreakdown || (!multiMeasure && skey === "value")
          ? primary.aggregation
          : multiMeasure
          ? measureForSeries(config, skey).aggregation
          : primary.aggregation;
      const val = aggregate(vals, agg);
      out[skey] = val;
      primaryTotal += val;
    }
    // For single-series, primary is the 'value'; for multi, use first series.
    out.__primary = hasBreakdown
      ? primaryTotal
      : multiMeasure
      ? (out["m0"] as number) ?? 0
      : (out["value"] as number) ?? 0;
    return out;
  });

  // Sort: chronological for date dims / line charts, else desc by primary.
  const chronological =
    isDateDim || CHRONOLOGICAL_CHART_TYPES.includes(config.chartType as ChartType);
  if (chronological) {
    rowsOut.sort((a, b) => bucketSortKey(a.name).localeCompare(bucketSortKey(b.name)));
  } else {
    rowsOut.sort((a, b) => b.__primary - a.__primary);
  }
  rowsOut = rowsOut.slice(0, limit);

  // Build seriesKeys with stable colors.
  const seriesKeys = buildSeriesKeys(
    hasBreakdown || multiMeasure,
    seriesMeta,
    rowsOut
  );

  // Fill missing series entries with 0 so recharts renders a clean grid.
  for (const r of rowsOut) {
    for (const sk of seriesKeys) {
      if (r[sk.key] === undefined) r[sk.key] = 0;
    }
  }

  // For single-series charts assign per-bucket palette colors when the
  // dimension didn't supply one (so donut slices / bars are distinct).
  if (!hasBreakdown && !multiMeasure) {
    rowsOut.forEach((r, i) => {
      if (!r.color) r.color = paletteColor(i);
    });
  }

  const total = round2(
    rowsOut.reduce((sum, r) => sum + (r.__primary || 0), 0)
  );

  const data: ChartDataRow[] = rowsOut.map(({ __primary, ...rest }) => {
    void __primary;
    return rest;
  });

  return { data, seriesKeys, total };
}

function pushSeries(bucket: Bucket, key: string, value: number | null) {
  if (value == null) return;
  const arr = bucket.series.get(key) ?? [];
  arr.push(value);
  bucket.series.set(key, arr);
}

function measureForSeries(config: ChartConfig, skey: string): Measure {
  const idx = parseInt(skey.replace("m", ""), 10);
  return config.measures[idx] ?? config.measures[0];
}

function bucketSortKey(label: string): string {
  // For quarter/month labels we stored human labels; re-derive a sortable
  // key. Fallback to the label itself.
  const q = label.match(/^(\d{4})-Q(\d)$/);
  if (q) return `${q[1]}${q[2]}`;
  const m = label.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (m) {
    const mi = MONTH_NAMES.indexOf(m[1]);
    return `${m[2]}${String(mi + 1).padStart(2, "0")}`;
  }
  const dm = label.match(/^([A-Za-z]{3})\s+(\d+)$/);
  if (dm) {
    const mi = MONTH_NAMES.indexOf(dm[1]);
    return `${String(mi + 1).padStart(2, "0")}${String(Number(dm[2])).padStart(2, "0")}`;
  }
  return label;
}

function buildSeriesKeys(
  multi: boolean,
  seriesMeta: Map<string, { name: string; color?: string }>,
  rows: ChartDataRow[]
): ChartSeriesKey[] {
  if (!multi) {
    const meta = seriesMeta.get("value");
    return [{ key: "value", name: meta?.name ?? "Value", color: paletteColor(0) }];
  }
  // Order series by their first appearance / total desc for stable legend.
  const totals = new Map<string, number>();
  for (const [key] of seriesMeta) {
    let t = 0;
    for (const r of rows) t += (r[key] as number) ?? 0;
    totals.set(key, t);
  }
  const ordered = Array.from(seriesMeta.entries()).sort(
    (a, b) => (totals.get(b[0]) ?? 0) - (totals.get(a[0]) ?? 0)
  );
  return ordered.map(([key, meta], i) => ({
    key,
    name: meta.name,
    color: meta.color ?? paletteColor(i),
  }));
}

function measureLabel(m: Measure): string {
  const aggLabel =
    m.aggregation === "count"
      ? "Count"
      : m.aggregation.charAt(0).toUpperCase() + m.aggregation.slice(1);
  const fieldLabel = measureFieldLabel(m.field);
  return m.aggregation === "count" ? fieldLabel || "Count" : `${aggLabel} of ${fieldLabel}`;
}

function measureFieldLabel(field: MeasureField): string {
  switch (field) {
    case "task":
      return "Tasks";
    case "project":
      return "Projects";
    case "goal":
      return "Goals";
    case "time.estimated":
      return "Estimated time";
    case "time.actual":
      return "Actual time";
    default:
      return field.startsWith("cf:") ? "Custom field" : String(field);
  }
}

// ─── Burnup / burndown (documented approximation) ─────────────────
//
// True burnup/burndown needs a daily scope + completed snapshot history,
// which BuildSync does NOT store (no schema change allowed). We approximate
// from what exists: the CURRENT scope of the filtered task set, plus each
// task's completedAt. Over the last N grain buckets we plot the CUMULATIVE
// completed count (burnup) vs. the flat total scope line; burndown plots
// remaining = scope − cumulativeCompleted. This is a faithful reconstruction
// assuming scope was constant over the window — the standard caveat.

function buildBurn(
  rows: TaskRow[],
  config: ChartConfig
): { data: ChartDataRow[]; seriesKeys: ChartSeriesKey[]; total: number } {
  const grain: DateGrain = config.dimension?.dateGrain ?? "week";
  const limit = config.options?.limit ?? 12;
  const scope = rows.length;

  // Build the last `limit` grain buckets ending today.
  const bucketKeys = lastNBuckets(grain, limit);
  const bucketSet = new Set(bucketKeys);

  // Cumulative completed per bucket.
  const completedInBucket = new Map<string, number>();
  for (const row of rows) {
    if (row.completed && row.completedAt) {
      const key = dateBucketKey(row.completedAt, grain);
      if (bucketSet.has(key)) {
        completedInBucket.set(key, (completedInBucket.get(key) ?? 0) + 1);
      }
    }
  }
  // Completed BEFORE the window forms the starting cumulative baseline.
  const firstKey = bucketKeys[0];
  let baseline = 0;
  for (const row of rows) {
    if (row.completed && row.completedAt) {
      const key = dateBucketKey(row.completedAt, grain);
      if (key < firstKey) baseline++;
    }
  }

  let cumulative = baseline;
  const isBurnup = config.chartType === "burnup";
  const data: ChartDataRow[] = bucketKeys.map((key) => {
    cumulative += completedInBucket.get(key) ?? 0;
    const value = isBurnup ? cumulative : Math.max(scope - cumulative, 0);
    return {
      name: dateBucketLabel(key, grain),
      value,
      scope: isBurnup ? scope : undefined,
    };
  });

  const seriesKeys: ChartSeriesKey[] = isBurnup
    ? [
        { key: "value", name: "Completed", color: "#3b82f6" },
        { key: "scope", name: "Total scope", color: "#94a3b8" },
      ]
    : [{ key: "value", name: "Remaining", color: "#3b82f6" }];

  return { data, seriesKeys, total: scope };
}

function lastNBuckets(grain: DateGrain, n: number): string[] {
  const keys: string[] = [];
  const today = startOfLocalDay();
  if (grain === "quarter") {
    let y = today.getFullYear();
    let q = Math.floor(today.getMonth() / 3);
    for (let i = 0; i < n; i++) {
      keys.unshift(`${y}-Q${q + 1}`);
      q--;
      if (q < 0) { q = 3; y--; }
    }
    return keys;
  }
  if (grain === "month") {
    let y = today.getFullYear();
    let m = today.getMonth();
    for (let i = 0; i < n; i++) {
      keys.unshift(`${y}-${String(m + 1).padStart(2, "0")}`);
      m--;
      if (m < 0) { m = 11; y--; }
    }
    return keys;
  }
  // day / week
  const step = grain === "week" ? 7 : 1;
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getTime() - i * step * 86400000);
    keys.unshift(dateBucketKey(d, grain));
  }
  // De-dupe week Mondays that could collide, keep chronological.
  return Array.from(new Set(keys));
}

// ─── Project / Goal entity engine ────────────────────────────────
//
// Projects and Goals share a "record" shape: each row resolves a dimension
// (and optional breakdown) bucket, and the only measure they expose is a
// count (the PROJECT_MEASURES / GOAL_MEASURES catalogs offer count-only —
// there are no numeric custom-field measures for these entities). So every
// measure evaluates to 1 and aggregates as a count. Filters are honored the
// same way the task engine does: SQL-expressible fields (status, owner) go
// into the Prisma where; the portfolio link filter is applied in JS after
// the fetch (mirrors applyPostFilters for tasks).

/** A resolved project/goal row, with its portfolio links (projects only). */
interface RecordRow {
  id: string;
  name?: string;
  status: string;
  ownerId: string | null;
  /** portfolioIds this row belongs to (projects only; empty for goals). */
  portfolioIds: string[];
}

/** Maps needed to label a record's dimension buckets. */
interface RecordMaps {
  users: Map<string, string>;
  portfolios: Map<string, { name: string; color: string }>;
  statusColors: Record<string, string>;
}

const PROJECT_STATUS_VALUES = new Set([
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "ON_HOLD",
  "COMPLETE",
]);
const GOAL_STATUS_VALUES = new Set([
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "ACHIEVED",
  "PARTIAL",
  "MISSED",
  "DROPPED",
]);

/**
 * Translate a project/goal filter into a Prisma where clause. Only the
 * SQL-expressible fields (status, owner) are handled here; portfolio is a
 * link-table filter applied in JS (see applyRecordPostFilters). Returns null
 * for anything not expressible so it's simply ignored at the SQL layer.
 *
 * `validStatuses` guards the status enum: the builder renders a free-text
 * input for status, so an invalid/typo'd value must NOT crash Prisma. An
 * `is` filter with no valid values matches nothing (honest empty result);
 * an `isNot` with no valid values is a no-op (nothing to exclude).
 */
function recordFilterToWhere(
  f: Filter,
  validStatuses: Set<string>
): { status?: unknown; ownerId?: unknown } | null {
  const v = f.value;
  const asArray = Array.isArray(v) ? v : v != null ? [String(v)] : [];

  if (f.field === "status") {
    const vals = asArray.filter((x) => validStatuses.has(x));
    if (f.operator === "isNot") {
      return vals.length ? { status: { notIn: vals } } : null;
    }
    // `is` (or any positive operator): all-invalid → match nothing.
    return { status: { in: vals } };
  }
  if (f.field === "owner") {
    if (f.operator === "isSet") return { ownerId: { not: null } };
    if (f.operator === "isNotSet") return { ownerId: null };
    if (asArray.length === 0) return null;
    return f.operator === "isNot"
      ? { ownerId: { notIn: asArray } }
      : { ownerId: { in: asArray } };
  }
  return null;
}

/**
 * Apply the portfolio filter (link-table) in JS — projects only. Mirrors the
 * task engine's applyPostFilters portfolio branch. Goals have no portfolio
 * link so a portfolio filter on goals matches nothing meaningful and is
 * skipped (no portfolioIds ever populated).
 */
function applyRecordPostFilters(rows: RecordRow[], filters: Filter[]): RecordRow[] {
  const postFilters = filters.filter((f) => f.field === "portfolio");
  if (postFilters.length === 0) return rows;

  return rows.filter((row) => {
    for (const f of postFilters) {
      const pids = row.portfolioIds;
      const want = Array.isArray(f.value)
        ? f.value
        : f.value != null
        ? [String(f.value)]
        : [];
      if (f.operator === "isSet") {
        if (pids.length === 0) return false;
      } else if (f.operator === "isNotSet") {
        if (pids.length > 0) return false;
      } else {
        const match = pids.some((p) => want.includes(p));
        if (f.operator === "isNot" ? match : !match) return false;
      }
    }
    return true;
  });
}

/** Resolve the dimension bucket a project/goal row falls into. */
function resolveRecordDimension(
  row: RecordRow,
  field: DimField,
  maps: RecordMaps
): { key: string; label: string; color?: string } {
  switch (field) {
    case "owner": {
      const id = row.ownerId;
      if (!id) return { key: "__none", label: "No owner" };
      return { key: id, label: maps.users.get(id) ?? "Unknown" };
    }
    case "portfolio": {
      // Handled specially by the caller (a row can be in multiple
      // portfolios). This branch is only hit defensively.
      return { key: "__none", label: "No portfolio" };
    }
    case "status":
    default:
      return {
        key: row.status,
        label: titleCase(row.status),
        color: maps.statusColors[row.status],
      };
  }
}

async function runProjectQuery(
  config: ChartConfig,
  ctx: EngineContext
): Promise<{ data: ChartDataRow[]; seriesKeys: ChartSeriesKey[]; total: number }> {
  const where: Prisma.ProjectWhereInput = { workspaceId: ctx.workspaceId };
  if (config.scope.kind === "my") where.ownerId = ctx.userId;
  else if (config.scope.kind === "portfolio") {
    // Restrict to the portfolio's projects (resolved + view-gated by the
    // route). workspaceId stays in the where as a defense-in-depth guard.
    // Empty id list → matches nothing (sound empty).
    where.id = { in: ctx.portfolioProjectIds ?? [] };
  }

  // Fold SQL-expressible filters (status, owner) into the where.
  const and: Prisma.ProjectWhereInput[] = [];
  for (const f of config.filters) {
    const clause = recordFilterToWhere(f, PROJECT_STATUS_VALUES);
    if (clause) and.push(clause as Prisma.ProjectWhereInput);
  }
  if (and.length) where.AND = and;

  const projects = await prisma.project.findMany({
    where,
    select: { id: true, name: true, color: true, status: true, ownerId: true },
  });

  // Load portfolio links when needed for the dimension, breakdown, or a
  // portfolio filter.
  const needsPortfolio =
    config.dimension?.field === "portfolio" ||
    config.breakdown?.field === "portfolio" ||
    config.filters.some((f) => f.field === "portfolio");

  const projectPortfolios = new Map<string, string[]>();
  const portfolioMeta = new Map<string, { name: string; color: string }>();
  if (needsPortfolio && projects.length) {
    const links = await prisma.portfolioProject.findMany({
      where: { projectId: { in: projects.map((p) => p.id) } },
      select: { projectId: true, portfolioId: true },
    });
    for (const l of links) {
      const arr = projectPortfolios.get(l.projectId) ?? [];
      arr.push(l.portfolioId);
      projectPortfolios.set(l.projectId, arr);
    }
    const pfs = await prisma.portfolio.findMany({
      where: { id: { in: Array.from(new Set(links.map((l) => l.portfolioId))) } },
      select: { id: true, name: true, color: true },
    });
    for (const p of pfs) {
      portfolioMeta.set(p.id, { name: p.name, color: p.color ?? "#7C3AED" });
    }
  }

  const rows: RecordRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: String(p.status),
    ownerId: p.ownerId,
    portfolioIds: projectPortfolios.get(p.id) ?? [],
  }));

  const ownerIds = new Set(rows.map((r) => r.ownerId).filter(Boolean) as string[]);
  const users = ownerIds.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(ownerIds) } },
        select: { id: true, name: true },
      })
    : [];

  const maps: RecordMaps = {
    users: new Map(users.map((u) => [u.id, u.name || "Unknown"])),
    portfolios: portfolioMeta,
    statusColors: PROJECT_STATUS_COLORS,
  };

  return runRecordQuery(rows, config, maps);
}

async function runGoalQuery(
  config: ChartConfig,
  ctx: EngineContext
): Promise<{ data: ChartDataRow[]; seriesKeys: ChartSeriesKey[]; total: number }> {
  // Portfolio scope + goals: goals have NO portfolio link in the schema
  // (Portfolio has no goals relation; RecordRow.portfolioIds is always []
  // for goals — see applyRecordPostFilters). Rather than silently widening
  // to the whole workspace, a portfolio-scoped goals query returns an empty
  // result set. This mirrors the documented goal-portfolio-filter no-op:
  // there is simply nothing to aggregate across a portfolio's (absent) goals.
  if (config.scope.kind === "portfolio") {
    return runRecordQuery([], config, {
      users: new Map(),
      portfolios: new Map(),
      statusColors: GOAL_STATUS_COLORS,
    });
  }

  const where: Prisma.ObjectiveWhereInput = { workspaceId: ctx.workspaceId };
  if (config.scope.kind === "my") where.ownerId = ctx.userId;

  const and: Prisma.ObjectiveWhereInput[] = [];
  for (const f of config.filters) {
    const clause = recordFilterToWhere(f, GOAL_STATUS_VALUES);
    if (clause) and.push(clause as Prisma.ObjectiveWhereInput);
  }
  if (and.length) where.AND = and;

  const goals = await prisma.objective.findMany({
    where,
    select: { id: true, name: true, status: true, ownerId: true },
  });

  const rows: RecordRow[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    status: String(g.status),
    ownerId: g.ownerId,
    portfolioIds: [],
  }));

  const ownerIds = new Set(rows.map((r) => r.ownerId).filter(Boolean) as string[]);
  const users = ownerIds.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(ownerIds) } },
        select: { id: true, name: true },
      })
    : [];

  const maps: RecordMaps = {
    users: new Map(users.map((u) => [u.id, u.name || "Unknown"])),
    portfolios: new Map(),
    statusColors: GOAL_STATUS_COLORS,
  };

  return runRecordQuery(rows, config, maps);
}

/**
 * Shared project/goal aggregation. Honors chartType (number/single/multi),
 * dimension, breakdown (stacked/grouped) and multiple count measures.
 * Every measure evaluates to 1 (count-only entities), so each extra measure
 * is an identical count series — but the engine no longer silently drops the
 * breakdown or the extra series.
 */
function runRecordQuery(
  rows: RecordRow[],
  config: ChartConfig,
  maps: RecordMaps
): { data: ChartDataRow[]; seriesKeys: ChartSeriesKey[]; total: number } {
  const filtered = applyRecordPostFilters(rows, config.filters);
  const limit = config.options?.limit ?? 12;

  // ── 'number' card: single aggregated scalar (count), no dimension. ──
  if (config.chartType === "number") {
    const primary = config.measures[0];
    const total = filtered.length;
    return {
      data: [{ name: measureLabel(primary), value: total }],
      seriesKeys: [
        { key: "value", name: measureLabel(primary), color: paletteColor(0) },
      ],
      total,
    };
  }

  const dimField = (config.dimension?.field ?? "status") as DimField;
  const hasBreakdown =
    (config.chartType === "stackedBar" || config.chartType === "groupedBar") &&
    config.breakdown != null;
  const multiMeasure = config.measures.length > 1 && !hasBreakdown;

  // Expand a row into the (dimension bucket, breakdown bucket) pairs it
  // contributes to. Portfolio is multi-valued (a project can be in several
  // portfolios), so it yields one entry per portfolio; other fields yield
  // exactly one.
  const dimBucketsFor = (
    row: RecordRow,
    field: DimField
  ): { key: string; label: string; color?: string }[] => {
    if (field === "portfolio") {
      if (row.portfolioIds.length === 0)
        return [{ key: "__none", label: "No portfolio" }];
      return row.portfolioIds.map((pid) => {
        const meta = maps.portfolios.get(pid);
        return { key: pid, label: meta?.name ?? "Unknown", color: meta?.color };
      });
    }
    return [resolveRecordDimension(row, field, maps)];
  };

  const buckets = new Map<string, Bucket>();
  const seriesMeta = new Map<string, { name: string; color?: string }>();

  for (const row of filtered) {
    for (const dim of dimBucketsFor(row, dimField)) {
      let bucket = buckets.get(dim.key);
      if (!bucket) {
        bucket = { key: dim.key, label: dim.label, color: dim.color, series: new Map() };
        buckets.set(dim.key, bucket);
      }
      if (hasBreakdown) {
        for (const bd of dimBucketsFor(row, config.breakdown!.field)) {
          seriesMeta.set(bd.key, { name: bd.label, color: bd.color });
          pushSeries(bucket, bd.key, 1);
        }
      } else if (multiMeasure) {
        config.measures.forEach((m, i) => {
          const skey = `m${i}`;
          seriesMeta.set(skey, { name: measureLabel(m) });
          pushSeries(bucket!, skey, 1);
        });
      } else {
        seriesMeta.set("value", { name: measureLabel(config.measures[0]) });
        pushSeries(bucket, "value", 1);
      }
    }
  }

  // Aggregate each bucket's series (count => length of pushed 1s).
  let rowsOut: (ChartDataRow & { __primary: number })[] = Array.from(
    buckets.values()
  ).map((b) => {
    const out: ChartDataRow & { __primary: number } = { name: b.label, __primary: 0 };
    if (b.color) out.color = b.color;
    let primaryTotal = 0;
    for (const [skey, vals] of b.series) {
      const val = aggregate(vals, "count");
      out[skey] = val;
      primaryTotal += val;
    }
    out.__primary = hasBreakdown
      ? primaryTotal
      : multiMeasure
      ? (out["m0"] as number) ?? 0
      : (out["value"] as number) ?? 0;
    return out;
  });

  rowsOut.sort((a, b) => b.__primary - a.__primary);
  rowsOut = rowsOut.slice(0, limit);

  const seriesKeys = buildSeriesKeys(hasBreakdown || multiMeasure, seriesMeta, rowsOut);

  for (const r of rowsOut) {
    for (const sk of seriesKeys) {
      if (r[sk.key] === undefined) r[sk.key] = 0;
    }
  }

  if (!hasBreakdown && !multiMeasure) {
    rowsOut.forEach((r, i) => {
      if (!r.color) r.color = paletteColor(i);
    });
  }

  const total = round2(rowsOut.reduce((sum, r) => sum + (r.__primary || 0), 0));

  const data: ChartDataRow[] = rowsOut.map(({ __primary, ...rest }) => {
    void __primary;
    return rest;
  });

  return { data, seriesKeys, total };
}

// ─── Public entrypoint ────────────────────────────────────────────

export async function runChartQuery(
  config: ChartConfig,
  ctx: EngineContext
): Promise<Omit<ChartQueryResponse, "meta">> {
  if (config.entity === "projects") return runProjectQuery(config, ctx);
  if (config.entity === "goals") return runGoalQuery(config, ctx);
  return runTaskQuery(config, ctx);
}

// ─── Meta / drilldown helpers ─────────────────────────────────────

const SCOPE_LABEL: Record<ChartConfig["scope"]["kind"], string> = {
  workspace: "My workspace",
  project: "a project",
  my: "assigned to me",
  portfolio: "a portfolio",
};

export function buildMeta(config: ChartConfig): {
  filterSummary: string;
  drilldownBase: string;
} {
  const entityLabel =
    config.entity === "tasks"
      ? "Tasks"
      : config.entity === "projects"
      ? "Projects"
      : "Goals";
  const n = config.filters.length;
  const filterPart = n === 0 ? "No filters" : `${n} filter${n === 1 ? "" : "s"}`;
  const scopeLabel = SCOPE_LABEL[config.scope.kind];
  const filterSummary = `${filterPart} · ${entityLabel} in ${scopeLabel}`;

  // drilldownBase: a querystring the task-list view can replay. We encode
  // the scope + entity + filters so the UI can translate to its own params.
  const params = new URLSearchParams();
  params.set("entity", config.entity);
  params.set("scope", config.scope.kind);
  if (config.scope.kind === "project") params.set("projectId", config.scope.projectId);
  if (config.scope.kind === "portfolio")
    params.set("portfolioId", config.scope.portfolioId);
  if (config.filters.length) params.set("filters", JSON.stringify(config.filters));
  const drilldownBase = params.toString();

  return { filterSummary, drilldownBase };
}
