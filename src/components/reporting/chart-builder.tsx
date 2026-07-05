"use client";

/**
 * chart-builder.tsx — the Asana-parity "Custom chart" builder modal.
 *
 * Left  = LIVE PREVIEW that re-queries POST /api/reports/query (debounced)
 *         and renders the result via the shared <ReportChart/>.
 * Right = a config form producing a ChartConfig:
 *           • Report on  (entity: Tasks | Projects | Goals)
 *           • Include from (scope: My workspace | a project | Assigned to me)
 *           • Chart type  (9-type icon gallery)
 *           • Chart data  (X-axis dimension + date grain, Y-axis measure +
 *                          aggregation, + Add metric, + breakdown series)
 *           • Filters     (+ Add filter: field + operator + value)
 *           • Data annotations (Show data labels toggle, Benchmark line)
 *
 * On "Add chart" the parent receives the finished ChartConfig (+ title,
 * showDataLabels, benchmark) and persists it per the two-tier contract.
 * Editing an existing widget seeds this modal from its stored ChartConfig.
 *
 * All field catalogs + the ChartConfig type come from the shared contract
 * (src/lib/report-config.ts) so builder + engine can never drift.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Plus, X, Loader2, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ReportChart } from "@/components/reporting/report-chart";
import {
  CHART_TYPES,
  MULTI_SERIES_CHART_TYPES,
  CHRONOLOGICAL_CHART_TYPES,
  dimensionsForEntity,
  measuresForEntity,
  defaultMeasure,
  FILTER_OPERATORS,
  type ChartEntity,
  type ChartType,
  type ChartConfig,
  type ChartScope,
  type Dimension,
  type Breakdown,
  type Measure,
  type Aggregation,
  type Filter,
  type FilterOperator,
  type DateGrain,
  type CatalogOption,
  type ChartQueryResponse,
} from "@/lib/report-config";

// ── Chart-type gallery icons (mirrors the page's SVG style) ──────────

function IconColumn() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="20" width="12" height="24" rx="2" fill="#888888" />
      <rect x="20" y="12" width="12" height="32" rx="2" fill="#94A3B8" />
      <rect x="36" y="8" width="12" height="36" rx="2" fill="#888888" />
      <rect x="52" y="16" width="8" height="28" rx="2" fill="#CBD5E1" />
    </svg>
  );
}
function IconBar() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="4" width="40" height="8" rx="2" fill="#888888" />
      <rect x="4" y="16" width="28" height="8" rx="2" fill="#94A3B8" />
      <rect x="4" y="28" width="52" height="8" rx="2" fill="#888888" />
      <rect x="4" y="40" width="20" height="6" rx="2" fill="#CBD5E1" />
    </svg>
  );
}
function IconStacked() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="28" width="12" height="16" rx="2" fill="#888888" />
      <rect x="4" y="16" width="12" height="12" rx="2" fill="#94A3B8" />
      <rect x="20" y="20" width="12" height="24" rx="2" fill="#888888" />
      <rect x="20" y="8" width="12" height="12" rx="2" fill="#CBD5E1" />
      <rect x="36" y="24" width="12" height="20" rx="2" fill="#888888" />
      <rect x="36" y="12" width="12" height="12" rx="2" fill="#94A3B8" />
    </svg>
  );
}
function IconGrouped() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <rect x="4" y="18" width="8" height="26" rx="2" fill="#888888" />
      <rect x="13" y="26" width="8" height="18" rx="2" fill="#CBD5E1" />
      <rect x="28" y="10" width="8" height="34" rx="2" fill="#888888" />
      <rect x="37" y="20" width="8" height="24" rx="2" fill="#CBD5E1" />
      <rect x="52" y="22" width="8" height="22" rx="2" fill="#888888" />
    </svg>
  );
}
function IconLine() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <path d="M4 40L16 28L28 32L40 16L56 8" stroke="#888888" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="28" r="3" fill="#888888" />
      <circle cx="40" cy="16" r="3" fill="#888888" />
      <circle cx="56" cy="8" r="3" fill="#888888" />
    </svg>
  );
}
function IconBurnup() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <line x1="4" y1="10" x2="60" y2="10" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M4 42L18 34L32 24L46 16L60 12" stroke="#888888" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function IconBurndown() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <path d="M4 8L18 16L32 26L46 34L60 42" stroke="#888888" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="4" cy="8" r="3" fill="#888888" />
      <circle cx="60" cy="42" r="3" fill="#888888" />
    </svg>
  );
}
function IconDonut() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <path d="M32 4C18.7 4 8 14.7 8 28s10.7 24 24 24 24-10.7 24-24S45.3 4 32 4zm0 36c-6.6 0-12-5.4-12-12s5.4-12 12-12 12 5.4 12 12-5.4 12-12 12z" fill="#CBD5E1" />
      <path d="M32 4v12c6.6 0 12 5.4 12 12h12c0-13.3-10.7-24-24-24z" fill="#888888" />
      <path d="M44 28c0-6.6-5.4-12-12-12V4c13.3 0 24 10.7 24 24h-12z" fill="#94A3B8" />
    </svg>
  );
}
function IconNumber() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <rect x="8" y="8" width="48" height="32" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
      <text x="32" y="32" textAnchor="middle" fontSize="20" fontWeight="600" fill="#888888">42</text>
    </svg>
  );
}
function IconLollipop() {
  return (
    <svg width="40" height="28" viewBox="0 0 64 48" fill="none">
      <circle cx="12" cy="16" r="6" fill="#888888" />
      <circle cx="28" cy="24" r="6" fill="#94A3B8" />
      <circle cx="44" cy="12" r="6" fill="#CBD5E1" />
      <line x1="12" y1="22" x2="12" y2="44" stroke="#888888" strokeWidth="2" />
      <line x1="28" y1="30" x2="28" y2="44" stroke="#94A3B8" strokeWidth="2" />
      <line x1="44" y1="18" x2="44" y2="44" stroke="#CBD5E1" strokeWidth="2" />
    </svg>
  );
}

const CHART_TYPE_META: Record<ChartType, { label: string; Icon: () => React.ReactElement }> = {
  column: { label: "Column", Icon: IconColumn },
  bar: { label: "Horizontal bar", Icon: IconBar },
  stackedBar: { label: "Stacked bars", Icon: IconStacked },
  groupedBar: { label: "Grouped bars", Icon: IconGrouped },
  line: { label: "Line", Icon: IconLine },
  burnup: { label: "Burnup", Icon: IconBurnup },
  burndown: { label: "Burndown", Icon: IconBurndown },
  donut: { label: "Donut", Icon: IconDonut },
  number: { label: "Number", Icon: IconNumber },
  lollipop: { label: "Lollipop", Icon: IconLollipop },
};

const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

// Filter fields the builder offers per entity (subset of FilterField the
// engine understands). Kept static + entity-aware so the operator/value
// controls always target a real column.
const TASK_FILTER_FIELDS: CatalogOption[] = [
  { value: "assignee", label: "Assignee" },
  { value: "creator", label: "Creator" },
  { value: "project", label: "Project" },
  { value: "section", label: "Section" },
  { value: "taskType", label: "Task type" },
  { value: "priority", label: "Priority" },
  { value: "completionStatus", label: "Completion status" },
  { value: "dueStatus", label: "Due-date status" },
  { value: "name", label: "Name" },
  { value: "dueDate", label: "Due date" },
  { value: "completedAt", label: "Completed at" },
  { value: "createdAt", label: "Created at" },
];
const PROJECT_FILTER_FIELDS: CatalogOption[] = [
  { value: "owner", label: "Owner" },
  { value: "status", label: "Status" },
  { value: "portfolio", label: "Portfolio" },
];
const GOAL_FILTER_FIELDS: CatalogOption[] = [
  { value: "status", label: "Status" },
  { value: "owner", label: "Owner" },
];

function filterFieldsForEntity(entity: ChartEntity): CatalogOption[] {
  if (entity === "projects") return PROJECT_FILTER_FIELDS;
  if (entity === "goals") return GOAL_FILTER_FIELDS;
  return TASK_FILTER_FIELDS;
}

// Enum-valued fields get a value dropdown; everything else a free text input.
const ENUM_FIELD_VALUES: Record<string, { value: string; label: string }[]> = {
  taskType: [
    { value: "TASK", label: "Task" },
    { value: "MILESTONE", label: "Milestone" },
    { value: "APPROVAL", label: "Approval" },
  ],
  priority: [
    { value: "NONE", label: "None" },
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
  ],
  completionStatus: [
    { value: "Completed", label: "Completed" },
    { value: "Incomplete", label: "Incomplete" },
  ],
  dueStatus: [
    { value: "Upcoming", label: "Upcoming" },
    { value: "Overdue", label: "Overdue" },
    { value: "No date", label: "No date" },
    { value: "Completed", label: "Completed" },
  ],
};

const NO_VALUE_OPERATORS: FilterOperator[] = ["isSet", "isNotSet"];

// ── Project option (for scope + project-filter pickers) ──────────────
interface ProjectOption {
  id: string;
  name: string;
}

// ── Builder props ────────────────────────────────────────────────────

export interface ChartBuilderResult {
  title: string;
  chartType: ChartType;
  chartConfig: ChartConfig;
  showDataLabels: boolean;
  benchmark?: number;
}

export interface ChartBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Seed when editing an existing widget; null when creating fresh. */
  initial?: {
    title: string;
    chartConfig: ChartConfig;
    showDataLabels?: boolean;
    benchmark?: number;
  } | null;
  onSubmit: (result: ChartBuilderResult) => void;
  /**
   * When provided, the "Include from" scope is PRESET to this scope and
   * LOCKED (the scope selector is replaced by a read-only pill). The Portfolio
   * Panel passes { kind:'portfolio', portfolioId } so every chart it produces
   * aggregates across the portfolio's projects and can never target a foreign
   * scope. Optional — the Reporting dashboards omit it and keep the full
   * workspace/project/my selector.
   */
  lockedScope?: ChartScope;
  /** Human label for the locked scope pill (e.g. the portfolio name). */
  lockedScopeLabel?: string;
}

// ── Default config factory ───────────────────────────────────────────

function defaultConfig(scope?: ChartScope): ChartConfig {
  return {
    entity: "tasks",
    scope: scope ?? { kind: "workspace" },
    chartType: "column",
    dimension: { field: "assignee" },
    measures: [defaultMeasure("tasks")],
    filters: [],
    options: { showDataLabels: true, limit: 12 },
  };
}

export function ChartBuilder({
  open,
  onOpenChange,
  initial,
  onSubmit,
  lockedScope,
  lockedScopeLabel,
}: ChartBuilderProps) {
  const [title, setTitle] = useState("Untitled chart");
  const [config, setConfig] = useState<ChartConfig>(defaultConfig());
  const [showDataLabels, setShowDataLabels] = useState(true);
  const [benchmark, setBenchmark] = useState<string>("");

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  // Custom-field defs for the selected project scope (dimension + measures).
  const [customFields, setCustomFields] = useState<
    { id: string; name: string; type: string }[]
  >([]);

  // Live-preview state.
  const [preview, setPreview] = useState<ChartQueryResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ── Seed from `initial` each time the modal opens ──
  useEffect(() => {
    if (!open) return;
    if (initial) {
      // When a lockedScope is set, force the seeded config onto it so an edit
      // can never carry a stale foreign scope.
      const seeded = structuredClone(initial.chartConfig);
      if (lockedScope) seeded.scope = lockedScope;
      setTitle(initial.title || "Untitled chart");
      setConfig(seeded);
      setShowDataLabels(
        initial.showDataLabels ?? initial.chartConfig.options?.showDataLabels ?? true
      );
      setBenchmark(
        initial.benchmark != null
          ? String(initial.benchmark)
          : initial.chartConfig.options?.benchmark != null
          ? String(initial.chartConfig.options.benchmark)
          : ""
      );
    } else {
      setTitle("Untitled chart");
      setConfig(defaultConfig(lockedScope));
      setShowDataLabels(true);
      setBenchmark("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Load projects once (for scope + project filters) ──
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects?fields=summary");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setProjects(
            (data as { id: string; name: string }[]).map((p) => ({
              id: p.id,
              name: p.name,
            }))
          );
        }
      } catch {
        /* ignore — scope still works with workspace/my */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // ── Load custom fields for the selected project scope ──
  const scopeProjectId =
    config.scope.kind === "project" ? config.scope.projectId : null;
  useEffect(() => {
    if (!open || !scopeProjectId || config.entity !== "tasks") {
      setCustomFields([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${scopeProjectId}/custom-fields`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          // The route returns links with a nested `field` OR flat defs —
          // normalize defensively.
          const defs = (Array.isArray(data) ? data : []).map(
            (row: Record<string, unknown>) => {
              const f = (row.field as Record<string, unknown>) || row;
              return {
                id: String(f.id ?? row.fieldId ?? ""),
                name: String(f.name ?? "Custom field"),
                type: String(f.type ?? "TEXT"),
              };
            }
          ).filter((d: { id: string }) => d.id);
          setCustomFields(defs);
        } else if (!cancelled) {
          setCustomFields([]);
        }
      } catch {
        if (!cancelled) setCustomFields([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, scopeProjectId, config.entity]);

  // ── Effective config sent to the engine (merge annotation controls) ──
  const effectiveConfig = useMemo<ChartConfig>(() => {
    const b = benchmark.trim() === "" ? undefined : Number(benchmark);
    return {
      ...config,
      // Re-assert the locked scope on every derived config so it can never
      // drift from a state update elsewhere (defense in depth alongside the
      // hidden selector). No-op when lockedScope is undefined.
      scope: lockedScope ?? config.scope,
      options: {
        ...config.options,
        showDataLabels,
        benchmark: b != null && !isNaN(b) ? b : undefined,
      },
    };
  }, [config, showDataLabels, benchmark, lockedScope]);

  // ── Debounced live preview ──
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runPreview = useCallback((cfg: ChartConfig) => {
    setPreviewLoading(true);
    setPreviewError(null);
    fetch("/api/reports/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Query failed (${res.status})`);
        }
        return res.json();
      })
      .then((data: ChartQueryResponse) => {
        setPreview(data);
        setPreviewLoading(false);
      })
      .catch((e: Error) => {
        setPreviewError(e.message);
        setPreviewLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runPreview(effectiveConfig), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, effectiveConfig, runPreview]);

  // ── Config mutators ──
  const patch = (p: Partial<ChartConfig>) => setConfig((c) => ({ ...c, ...p }));

  const onEntityChange = (entity: ChartEntity) => {
    // Reset dimension + measure to entity defaults so we never carry a
    // field the new entity can't produce.
    const dims = dimensionsForEntity(entity);
    setConfig((c) => ({
      ...c,
      entity,
      dimension: { field: dims[0]?.value as Dimension["field"] },
      breakdown: undefined,
      measures: [defaultMeasure(entity)],
      // 'my' scope means different things per entity but is valid for all.
      filters: [],
    }));
  };

  const onChartTypeChange = (chartType: ChartType) => {
    setConfig((c) => {
      const next: ChartConfig = { ...c, chartType };
      // Multi-series types need a breakdown; drop it for others.
      if (!MULTI_SERIES_CHART_TYPES.includes(chartType)) {
        next.breakdown = undefined;
      }
      // Chronological types want a date dimension by default (only tasks
      // have a date dimension). Nudge the user there if we can.
      if (
        CHRONOLOGICAL_CHART_TYPES.includes(chartType) &&
        c.entity === "tasks" &&
        c.dimension?.field !== "date"
      ) {
        next.dimension = { field: "date", dateGrain: "month" };
      }
      return next;
    });
  };

  const onScopeChange = (value: string) => {
    if (value === "workspace") patch({ scope: { kind: "workspace" } });
    else if (value === "my") patch({ scope: { kind: "my" } });
    else patch({ scope: { kind: "project", projectId: value } as ChartScope });
  };

  // ── Field catalogs (static + custom fields when project-scoped) ──
  const dimOptions = useMemo<CatalogOption[]>(() => {
    const base = [...dimensionsForEntity(config.entity)];
    if (config.entity === "tasks") {
      for (const cf of customFields) {
        base.push({ value: `cf:${cf.id}`, label: cf.name });
      }
    }
    return base;
  }, [config.entity, customFields]);

  const measureOptions = useMemo<CatalogOption[]>(() => {
    const base = [...measuresForEntity(config.entity)];
    if (config.entity === "tasks") {
      for (const cf of customFields) {
        // Only numeric-ish custom fields make sense as sum/avg measures.
        if (["NUMBER", "CURRENCY", "PERCENTAGE"].includes(cf.type)) {
          base.push({ value: `cf:${cf.id}`, label: cf.name });
        }
      }
    }
    return base;
  }, [config.entity, customFields]);

  const isNumberCard = config.chartType === "number";
  const isMultiSeries = MULTI_SERIES_CHART_TYPES.includes(config.chartType);
  const dimField = config.dimension?.field;
  const isDateDim = dimField === "date";

  // ── Measure helpers ──
  const setMeasure = (index: number, m: Partial<Measure>) => {
    setConfig((c) => {
      const measures = c.measures.map((mm, i) =>
        i === index ? ({ ...mm, ...m } as Measure) : mm
      );
      return { ...c, measures };
    });
  };
  const addMeasure = () => {
    setConfig((c) => ({
      ...c,
      measures: [...c.measures, defaultMeasure(c.entity)],
    }));
  };
  const removeMeasure = (index: number) => {
    setConfig((c) => ({
      ...c,
      measures: c.measures.length > 1 ? c.measures.filter((_, i) => i !== index) : c.measures,
    }));
  };

  // A field labelled "Count" forces the count aggregation; numeric fields
  // allow sum/avg/min/max.
  const measureAllowsAgg = (field: string) =>
    field !== "task" && field !== "project" && field !== "goal";

  // ── Filter helpers ──
  const addFilter = () => {
    const fields = filterFieldsForEntity(config.entity);
    setConfig((c) => ({
      ...c,
      filters: [
        ...c.filters,
        { field: fields[0]?.value as Filter["field"], operator: "is", value: "" },
      ],
    }));
  };
  const setFilter = (index: number, f: Partial<Filter>) => {
    setConfig((c) => ({
      ...c,
      filters: c.filters.map((ff, i) => (i === index ? ({ ...ff, ...f } as Filter) : ff)),
    }));
  };
  const removeFilter = (index: number) => {
    setConfig((c) => ({ ...c, filters: c.filters.filter((_, i) => i !== index) }));
  };

  // ── Submit ──
  const handleSubmit = () => {
    const finalConfig = { ...effectiveConfig };
    onSubmit({
      title: title.trim() || "Untitled chart",
      chartType: finalConfig.chartType,
      chartConfig: finalConfig,
      showDataLabels,
      benchmark: benchmark.trim() === "" ? undefined : Number(benchmark),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[1040px] max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-4 md:px-6 py-3 border-b">
          <DialogTitle>{initial ? "Edit chart" : "Add chart"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* ── LIVE PREVIEW ── */}
          <div className="md:w-1/2 border-b md:border-b-0 md:border-r bg-slate-50 p-4 md:p-6 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Preview
              </span>
              {previewLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              )}
            </div>
            <div className="bg-white rounded-lg border p-3 md:p-4 flex-1 min-h-[260px] flex flex-col">
              <h3 className="text-sm font-medium text-slate-900 mb-2 truncate">
                {title || "Untitled chart"}
              </h3>
              <div className="flex-1 min-h-[200px]">
                {previewError ? (
                  <div className="h-full min-h-[200px] flex items-center justify-center text-center text-sm text-[#a8893a] px-4">
                    {previewError}
                  </div>
                ) : preview ? (
                  <ReportChart
                    chartType={config.chartType}
                    data={preview.data}
                    seriesKeys={preview.seriesKeys}
                    total={preview.total}
                    showDataLabels={showDataLabels}
                    benchmark={
                      benchmark.trim() === "" ? undefined : Number(benchmark)
                    }
                    height={240}
                  />
                ) : (
                  <div className="h-full min-h-[200px] flex items-center justify-center text-slate-300">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>
              {preview && (
                <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t truncate">
                  {preview.meta.filterSummary}
                </p>
              )}
            </div>
          </div>

          {/* ── CONFIG FORM ── */}
          <div className="md:w-1/2 p-4 md:p-6 overflow-y-auto overflow-x-hidden space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="chart-title">Chart title</Label>
              <Input
                id="chart-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Tasks by assignee"
              />
            </div>

            {/* Report on (entity) */}
            <div className="space-y-1.5">
              <Label>Report on</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["tasks", "projects", "goals"] as ChartEntity[]).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => onEntityChange(e)}
                    className={cn(
                      "px-2 py-1.5 rounded-md text-sm border capitalize transition-colors",
                      config.entity === e
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope */}
            <div className="space-y-1.5">
              <Label>Include {config.entity} from</Label>
              {lockedScope ? (
                // Preset + locked scope (e.g. the Portfolio Panel). Rendered as
                // a read-only pill so the user can see — but not change — that
                // this chart aggregates across the current portfolio.
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-600">
                  <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">
                    {lockedScopeLabel ??
                      (lockedScope.kind === "portfolio"
                        ? "This portfolio"
                        : "Locked scope")}
                  </span>
                </div>
              ) : (
                <Select
                  value={
                    config.scope.kind === "project"
                      ? config.scope.projectId
                      : config.scope.kind
                  }
                  onValueChange={onScopeChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">My workspace</SelectItem>
                    <SelectItem value="my">
                      {config.entity === "tasks" ? "Assigned to me" : "Owned by me"}
                    </SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Chart type gallery */}
            <div className="space-y-1.5">
              <Label>Chart type</Label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {CHART_TYPES.map((ct) => {
                  const meta = CHART_TYPE_META[ct];
                  const active = config.chartType === ct;
                  return (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => onChartTypeChange(ct)}
                      title={meta.label}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                        active
                          ? "border-slate-900 ring-1 ring-slate-900 bg-white"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <meta.Icon />
                      <span className="text-[10px] text-slate-500 leading-tight text-center line-clamp-1">
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chart data — X axis dimension (hidden for number cards) */}
            {!isNumberCard && (
              <div className="space-y-1.5">
                <Label>X axis (dimension)</Label>
                <div className="flex gap-2">
                  <Select
                    value={dimField}
                    onValueChange={(v) =>
                      patch({
                        dimension: {
                          field: v as Dimension["field"],
                          dateGrain: v === "date" ? config.dimension?.dateGrain ?? "month" : undefined,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dimOptions.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isDateDim && (
                    <Select
                      value={config.dimension?.dateGrain ?? "month"}
                      onValueChange={(v) =>
                        patch({
                          dimension: {
                            field: "date",
                            dateGrain: v as DateGrain,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="quarter">Quarter</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* Y axis measures */}
            <div className="space-y-2">
              <Label>Y axis (measure)</Label>
              {config.measures.map((m, i) => {
                const allowsAgg = measureAllowsAgg(m.field);
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <Select
                      value={m.field}
                      onValueChange={(v) =>
                        setMeasure(i, {
                          field: v as Measure["field"],
                          aggregation: measureAllowsAgg(v)
                            ? m.aggregation === "count"
                              ? "sum"
                              : m.aggregation
                            : "count",
                        })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {measureOptions.map((mo) => (
                          <SelectItem key={mo.value} value={mo.value}>
                            {mo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={m.aggregation}
                      onValueChange={(v) => setMeasure(i, { aggregation: v as Aggregation })}
                      disabled={!allowsAgg}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(allowsAgg ? AGGREGATIONS : AGGREGATIONS.filter((a) => a.value === "count")).map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {config.measures.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMeasure(i)}
                        className="text-slate-400 hover:text-black p-1"
                        aria-label="Remove metric"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!isNumberCard && !isMultiSeries && config.measures.length < 4 && (
                <button
                  type="button"
                  onClick={addMeasure}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add metric
                </button>
              )}
            </div>

            {/* Breakdown (stacked / grouped only) */}
            {isMultiSeries && (
              <div className="space-y-1.5">
                <Label>Break down by</Label>
                <Select
                  value={config.breakdown?.field ?? "__none"}
                  onValueChange={(v) =>
                    patch({
                      breakdown:
                        v === "__none"
                          ? undefined
                          : ({ field: v as Breakdown["field"] } as Breakdown),
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a series dimension" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {dimOptions
                      .filter((d) => d.value !== dimField && d.value !== "date")
                      .map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Filters</Label>
                <button
                  type="button"
                  onClick={addFilter}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add filter
                </button>
              </div>
              {config.filters.length === 0 && (
                <p className="text-xs text-slate-400">No filters applied.</p>
              )}
              {config.filters.map((f, i) => {
                const fields = filterFieldsForEntity(config.entity);
                const enumValues = ENUM_FIELD_VALUES[f.field];
                const projectValued = f.field === "project";
                const noValue = NO_VALUE_OPERATORS.includes(f.operator);
                return (
                  <div key={i} className="flex flex-wrap gap-2 items-center">
                    <Select
                      value={f.field}
                      onValueChange={(v) =>
                        setFilter(i, { field: v as Filter["field"], value: "" })
                      }
                    >
                      <SelectTrigger className="w-[38%] min-w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((ff) => (
                          <SelectItem key={ff.value} value={ff.value}>
                            {ff.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={f.operator}
                      onValueChange={(v) => setFilter(i, { operator: v as FilterOperator })}
                    >
                      <SelectTrigger className="w-[28%] min-w-[92px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!noValue &&
                      (enumValues ? (
                        <Select
                          value={String(f.value ?? "")}
                          onValueChange={(v) => setFilter(i, { value: v })}
                        >
                          <SelectTrigger className="flex-1 min-w-[100px]">
                            <SelectValue placeholder="Value" />
                          </SelectTrigger>
                          <SelectContent>
                            {enumValues.map((ev) => (
                              <SelectItem key={ev.value} value={ev.value}>
                                {ev.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : projectValued ? (
                        <Select
                          value={String(f.value ?? "")}
                          onValueChange={(v) => setFilter(i, { value: v })}
                        >
                          <SelectTrigger className="flex-1 min-w-[100px]">
                            <SelectValue placeholder="Project" />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="flex-1 min-w-[100px]"
                          value={String(f.value ?? "")}
                          onChange={(e) => setFilter(i, { value: e.target.value })}
                          placeholder={
                            f.operator === "inLastDays" || f.operator === "inNextDays"
                              ? "days"
                              : "value"
                          }
                        />
                      ))}
                    <button
                      type="button"
                      onClick={() => removeFilter(i)}
                      className="text-slate-400 hover:text-black p-1"
                      aria-label="Remove filter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Data annotations */}
            <div className="space-y-3 pt-1">
              <Label>Data annotations</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Show data labels</span>
                <Switch checked={showDataLabels} onCheckedChange={setShowDataLabels} />
              </div>
              {config.chartType !== "number" && config.chartType !== "donut" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-600">Benchmark line</span>
                  <Input
                    type="number"
                    className="w-28"
                    value={benchmark}
                    onChange={(e) => setBenchmark(e.target.value)}
                    placeholder="none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-4 md:px-6 py-3 border-t flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-slate-900 hover:bg-slate-800 text-white"
            onClick={handleSubmit}
          >
            {initial ? "Save changes" : "Add chart"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChartBuilder;
