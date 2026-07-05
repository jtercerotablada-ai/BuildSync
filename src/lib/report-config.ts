/**
 * report-config.ts — shared ChartConfig contract for the custom chart
 * builder + the aggregation engine.
 *
 * This file is the SINGLE SOURCE OF TRUTH for:
 *   • The `ChartConfig` shape the builder produces and the engine consumes
 *     (POST /api/reports/query).
 *   • The zod schema that validates an incoming ChartConfig.
 *   • The dimension / measure / filter field CATALOGS the builder's
 *     dropdowns render from (so UI + engine can never drift).
 *   • The coarse-WidgetType enum mapping used when a chart is persisted as
 *     a ReportWidget row (the Prisma enum is fixed + coarse — the precise
 *     chartType lives inside config).
 *
 * NO Prisma imports here — this module is safe to import from client
 * components (the builder) and the server (the engine + widgets API).
 */

import { z } from "zod";

// ─── Entity ───────────────────────────────────────────────────────

export type ChartEntity = "tasks" | "projects" | "goals";

// ─── Chart type ───────────────────────────────────────────────────

export type ChartType =
  | "column" // vertical bars
  | "bar" // horizontal bars
  | "stackedBar"
  | "groupedBar"
  | "line"
  | "burnup"
  | "burndown"
  | "donut" // ring with total in center
  | "number" // single big value
  | "lollipop";

export const CHART_TYPES: ChartType[] = [
  "column",
  "bar",
  "stackedBar",
  "groupedBar",
  "line",
  "burnup",
  "burndown",
  "donut",
  "number",
  "lollipop",
];

/** Chart types that are inherently chronological (X axis is time, so the
 *  engine must NOT sort buckets by descending measure). */
export const CHRONOLOGICAL_CHART_TYPES: ChartType[] = [
  "line",
  "burnup",
  "burndown",
];

/** Chart types that carry a second breakdown series. */
export const MULTI_SERIES_CHART_TYPES: ChartType[] = [
  "stackedBar",
  "groupedBar",
];

// ─── Scope ────────────────────────────────────────────────────────

export type ChartScope =
  | { kind: "workspace" }
  | { kind: "project"; projectId: string }
  | { kind: "my" }; // assignee (tasks) / owner (projects, goals) = caller

// ─── Dimension fields ─────────────────────────────────────────────

/** Dimension fields for tasks. `cf:<id>` = a custom-field dimension. */
export type TaskDimField =
  | "assignee"
  | "creator"
  | "taskType"
  | "completionStatus"
  | "dueStatus"
  | "project"
  | "section"
  | "priority"
  | "date"
  | `cf:${string}`;

export type ProjectDimField = "owner" | "status" | "portfolio";
export type GoalDimField = "status" | "owner";

export type DimField = TaskDimField | ProjectDimField | GoalDimField;

export type DateGrain = "day" | "week" | "month" | "quarter";

export interface Dimension {
  field: DimField;
  /** Required when field === 'date'; ignored otherwise. */
  dateGrain?: DateGrain;
}

export interface Breakdown {
  field: DimField;
}

// ─── Measures ─────────────────────────────────────────────────────

export type MeasureField =
  | "task"
  | "project"
  | "goal"
  | "time.estimated"
  | "time.actual"
  | `cf:${string}`;

export type Aggregation = "count" | "sum" | "avg" | "min" | "max";

export interface Measure {
  field: MeasureField;
  aggregation: Aggregation;
}

// ─── Filters ──────────────────────────────────────────────────────

export type FilterOperator =
  | "is"
  | "isNot"
  | "contains"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "isSet"
  | "isNotSet"
  | "inLastDays"
  | "inNextDays";

/**
 * Filter fields. These overlap dimension fields but also add fields you'd
 * filter but not necessarily group by (name, dueDate, completedAt, etc.).
 */
export type FilterField =
  | "assignee"
  | "creator"
  | "project"
  | "section"
  | "portfolio"
  | "owner"
  | "taskType"
  | "priority"
  | "status"
  | "completionStatus"
  | "dueStatus"
  | "name"
  | "dueDate"
  | "completedAt"
  | "createdAt"
  | `cf:${string}`;

export interface Filter {
  field: FilterField;
  operator: FilterOperator;
  value?: string | number | string[];
}

// ─── Options ──────────────────────────────────────────────────────

export interface ChartOptions {
  showDataLabels?: boolean;
  benchmark?: number;
  /** Max number of dimension buckets returned. Defaults to 12. */
  limit?: number;
}

// ─── ChartConfig ──────────────────────────────────────────────────

export interface ChartConfig {
  entity: ChartEntity;
  scope: ChartScope;
  chartType: ChartType;
  /** Omitted/ignored for chartType 'number'. */
  dimension?: Dimension;
  /** 2nd series dimension — only for stacked/grouped/line-multi. */
  breakdown?: Breakdown;
  measures: Measure[];
  filters: Filter[];
  options?: ChartOptions;
}

// ─── Response contract ────────────────────────────────────────────

export interface ChartDataRow {
  name: string;
  color?: string;
  /** Each series key holds that series' aggregated numeric value. */
  [seriesKey: string]: number | string | undefined;
}

export interface ChartSeriesKey {
  key: string;
  name: string;
  color: string;
}

export interface ChartQueryMeta {
  entity: ChartEntity;
  chartType: ChartType;
  /** e.g. "2 filters · Tasks in My workspace". */
  filterSummary: string;
  /** Querystring the task-list drilldown replays. */
  drilldownBase: string;
}

export interface ChartQueryResponse {
  data: ChartDataRow[];
  seriesKeys: ChartSeriesKey[];
  /** Grand total of the primary measure — powers 'number' + donut center. */
  total: number;
  meta: ChartQueryMeta;
}

// ─── Zod schema (validates an incoming ChartConfig on the wire) ────

const scopeSchema = z.union([
  z.object({ kind: z.literal("workspace") }),
  z.object({ kind: z.literal("project"), projectId: z.string().min(1) }),
  z.object({ kind: z.literal("my") }),
]);

const dimFieldSchema = z.string().min(1); // refined per-entity in the engine

const dimensionSchema = z.object({
  field: dimFieldSchema,
  dateGrain: z.enum(["day", "week", "month", "quarter"]).optional(),
});

const measureSchema = z.object({
  field: z.string().min(1),
  aggregation: z.enum(["count", "sum", "avg", "min", "max"]),
});

const filterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    "is",
    "isNot",
    "contains",
    "gt",
    "lt",
    "gte",
    "lte",
    "isSet",
    "isNotSet",
    "inLastDays",
    "inNextDays",
  ]),
  value: z
    .union([z.string(), z.number(), z.array(z.string())])
    .optional(),
});

const optionsSchema = z
  .object({
    showDataLabels: z.boolean().optional(),
    benchmark: z.number().optional(),
    limit: z.number().int().positive().max(50).optional(),
  })
  .optional();

export const chartConfigSchema = z.object({
  entity: z.enum(["tasks", "projects", "goals"]),
  scope: scopeSchema,
  chartType: z.enum([
    "column",
    "bar",
    "stackedBar",
    "groupedBar",
    "line",
    "burnup",
    "burndown",
    "donut",
    "number",
    "lollipop",
  ]),
  dimension: dimensionSchema.optional(),
  breakdown: z.object({ field: dimFieldSchema }).optional(),
  measures: z.array(measureSchema).min(1),
  filters: z.array(filterSchema).default([]),
  options: optionsSchema,
});

export type ChartConfigInput = z.infer<typeof chartConfigSchema>;

// ─── Coarse WidgetType enum mapping ───────────────────────────────
//
// The Prisma `WidgetType` enum is fixed + coarse. When a configured chart
// is persisted as a ReportWidget row, we map the precise chartType to the
// closest enum value (the precise type lives in config.chartType). Text
// widgets use TASK_LIST as a sentinel (config.kind === 'text').

export type WidgetTypeEnum =
  | "KPI_CARD"
  | "BAR_CHART"
  | "DONUT_CHART"
  | "LINE_CHART"
  | "STACKED_BAR"
  | "TASK_LIST";

export function chartTypeToWidgetType(chartType: ChartType): WidgetTypeEnum {
  switch (chartType) {
    case "number":
      return "KPI_CARD";
    case "donut":
      return "DONUT_CHART";
    case "line":
    case "burnup":
    case "burndown":
      return "LINE_CHART";
    case "stackedBar":
    case "groupedBar":
      return "STACKED_BAR";
    case "column":
    case "bar":
    case "lollipop":
    default:
      return "BAR_CHART";
  }
}

// ─── UI catalogs — the builder's dropdown option lists ────────────
//
// The builder imports these so its dimension/measure/filter menus stay in
// lockstep with what the engine actually supports. `cf:<id>` entries are
// appended dynamically by the builder from the workspace's custom-field
// definitions — these arrays are the STATIC (non-custom-field) options.

export interface CatalogOption {
  value: string;
  label: string;
  /** For date dimension — whether a grain submenu applies. */
  needsGrain?: boolean;
}

export const TASK_DIMENSIONS: CatalogOption[] = [
  { value: "assignee", label: "Assignee" },
  { value: "creator", label: "Creator" },
  { value: "taskType", label: "Task type" },
  { value: "completionStatus", label: "Completion status" },
  { value: "dueStatus", label: "Due-date status" },
  { value: "project", label: "Project" },
  { value: "section", label: "Section" },
  { value: "priority", label: "Priority" },
  { value: "date", label: "Date", needsGrain: true },
];

export const PROJECT_DIMENSIONS: CatalogOption[] = [
  { value: "owner", label: "Owner" },
  { value: "status", label: "Status" },
  { value: "portfolio", label: "Portfolio" },
];

export const GOAL_DIMENSIONS: CatalogOption[] = [
  { value: "status", label: "Status" },
  { value: "owner", label: "Owner" },
];

export function dimensionsForEntity(entity: ChartEntity): CatalogOption[] {
  switch (entity) {
    case "tasks":
      return TASK_DIMENSIONS;
    case "projects":
      return PROJECT_DIMENSIONS;
    case "goals":
      return GOAL_DIMENSIONS;
  }
}

export const TASK_MEASURES: CatalogOption[] = [
  { value: "task", label: "Task count" },
  { value: "time.estimated", label: "Estimated time" },
  { value: "time.actual", label: "Actual time" },
];

export const PROJECT_MEASURES: CatalogOption[] = [
  { value: "project", label: "Project count" },
];

export const GOAL_MEASURES: CatalogOption[] = [
  { value: "goal", label: "Goal count" },
];

export function measuresForEntity(entity: ChartEntity): CatalogOption[] {
  switch (entity) {
    case "tasks":
      return TASK_MEASURES;
    case "projects":
      return PROJECT_MEASURES;
    case "goals":
      return GOAL_MEASURES;
  }
}

export const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: "at least" },
  { value: "lte", label: "at most" },
  { value: "isSet", label: "is set" },
  { value: "isNotSet", label: "is not set" },
  { value: "inLastDays", label: "in the last N days" },
  { value: "inNextDays", label: "in the next N days" },
];

/** Default measure for an entity (count of the entity itself). */
export function defaultMeasure(entity: ChartEntity): Measure {
  const field: MeasureField =
    entity === "tasks" ? "task" : entity === "projects" ? "project" : "goal";
  return { field, aggregation: "count" };
}
