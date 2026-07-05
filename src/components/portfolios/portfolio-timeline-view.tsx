"use client";

import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  ZoomIn,
  ZoomOut,
  Filter,
  ArrowUpDown,
  Layers,
  SlidersHorizontal,
  Search,
  CalendarRange,
  Check,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUiState } from "@/hooks/use-ui-state";

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

interface TimelineProject {
  id: string;
  name: string;
  color: string;
  status: ProjectStatus;
  // These reach us at runtime from `portfolio.projects` (the page passes
  // the full PortfolioProject list). Optional here so callers with a
  // narrower shape still typecheck; filter/sort treat missing values as
  // "none".
  type?: ProjectType | null;
  gate?: ProjectGate | null;
  budget?: number | null;
  currency?: string | null;
  startDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  stats: { progress: number };
}

interface Props {
  projects: { id: string; project: TimelineProject }[];
}

const STATUS_META: Record<
  ProjectStatus,
  { label: string; bar: string; dot: string; chip: string }
> = {
  ON_TRACK: {
    label: "On track",
    bar: "#c9a84c",
    dot: "bg-[#c9a84c]",
    chip: "bg-[#c9a84c]/15 text-[#a8893a]",
  },
  AT_RISK: {
    label: "At risk",
    bar: "#f59e0b",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
  },
  OFF_TRACK: {
    label: "Off track",
    bar: "#111827",
    dot: "bg-gray-900",
    chip: "bg-gray-100 text-gray-900",
  },
  ON_HOLD: {
    label: "On hold",
    bar: "#9ca3af",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-700",
  },
  COMPLETE: {
    label: "Complete",
    bar: "#a8893a",
    dot: "bg-[#a8893a]",
    chip: "bg-[#a8893a]/15 text-[#a8893a]",
  },
};

const TYPE_META: Record<ProjectType, { label: string }> = {
  CONSTRUCTION: { label: "Construction" },
  DESIGN: { label: "Design" },
  RECERTIFICATION: { label: "Recertification" },
  PERMIT: { label: "Permit" },
};

const GATE_META: Record<ProjectGate, { label: string }> = {
  PRE_DESIGN: { label: "Pre-design" },
  DESIGN: { label: "Design" },
  PERMITTING: { label: "Permitting" },
  CONSTRUCTION: { label: "Construction" },
  CLOSEOUT: { label: "Closeout" },
};

// Health order so "worse" statuses float to the top (Asana parity).
const STATUS_SORT_ORDER: Record<ProjectStatus, number> = {
  OFF_TRACK: 0,
  AT_RISK: 1,
  ON_TRACK: 2,
  ON_HOLD: 3,
  COMPLETE: 4,
};

const ROW_HEIGHT = 52;
const BAR_HEIGHT = 26;
const GROUP_BAND_H = 30;
const HEADER_QUARTER_H = 28;
const HEADER_MONTH_H = 28;
const PROJECT_COL = 200;
const OWNER_COL = 120;
const STATUS_COL = 100;

type LeftColumnKey = "owner" | "status";

const LEFT_COLUMN_DEFS: { key: LeftColumnKey; label: string; px: number }[] = [
  { key: "owner", label: "Owner", px: OWNER_COL },
  { key: "status", label: "Status", px: STATUS_COL },
];

type Scale = "quarters" | "months";

const MONTH_PX_BY_ZOOM = {
  quarters: [44, 56, 72] as const,
  months: [96, 128, 160] as const,
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}
function monthsBetween(a: Date, b: Date) {
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}
function fractionalMonths(start: Date, point: Date) {
  const wholeMonths = monthsBetween(start, point);
  const monthStart = addMonths(start, wholeMonths);
  const monthEnd = addMonths(start, wholeMonths + 1);
  const monthLengthMs = monthEnd.getTime() - monthStart.getTime();
  const offsetMs = point.getTime() - monthStart.getTime();
  return wholeMonths + offsetMs / monthLengthMs;
}

// ── Date-only helpers (avoid TZ drift) ──────────────────────
// Project dates are stored/served as UTC-midnight ISO strings. We read
// them by their UTC calendar day so a bar lands on the right column
// regardless of the viewer's timezone, and we PATCH back the same way.
function isoToLocalDay(value: string): Date {
  const d = new Date(value);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function toDateOnlyString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── View state ──────────────────────────────────────────────

type TimelineSortKey = "manual" | "name" | "status" | "progress" | "due";
type SortDir = "asc" | "desc";
type TimelineGroupKey = "none" | "status" | "owner" | "type" | "gate";

interface TimelineViewState {
  columns: LeftColumnKey[];
  filter: {
    status: ProjectStatus[];
    type: ProjectType[];
    gate: ProjectGate[];
    ownerId: string[];
  };
  sort: { key: TimelineSortKey; dir: SortDir };
  group: TimelineGroupKey;
  showProgressOnBar: boolean;
}

const DEFAULT_COLUMNS: LeftColumnKey[] = ["owner", "status"];

const DEFAULT_TIMELINE_VIEW: TimelineViewState = {
  columns: DEFAULT_COLUMNS,
  filter: { status: [], type: [], gate: [], ownerId: [] },
  sort: { key: "manual", dir: "asc" },
  group: "none",
  showProgressOnBar: true,
};

const SORT_LABELS: Record<Exclude<TimelineSortKey, "manual">, string> = {
  name: "name",
  status: "status",
  progress: "progress",
  due: "due date",
};

const GROUP_LABELS: Record<Exclude<TimelineGroupKey, "none">, string> = {
  status: "status",
  owner: "owner",
  type: "type",
  gate: "gate",
};

function normalizeTimelineView(raw: unknown): TimelineViewState {
  if (!raw || typeof raw !== "object") return DEFAULT_TIMELINE_VIEW;
  const r = raw as Partial<TimelineViewState>;
  const validCols = new Set<LeftColumnKey>(LEFT_COLUMN_DEFS.map((c) => c.key));
  const columns = Array.isArray(r.columns)
    ? r.columns.filter((c): c is LeftColumnKey => validCols.has(c as LeftColumnKey))
    : DEFAULT_COLUMNS;
  return {
    columns,
    filter: {
      status: Array.isArray(r.filter?.status) ? r.filter!.status : [],
      type: Array.isArray(r.filter?.type) ? r.filter!.type : [],
      gate: Array.isArray(r.filter?.gate) ? r.filter!.gate : [],
      ownerId: Array.isArray(r.filter?.ownerId) ? r.filter!.ownerId : [],
    },
    sort: {
      key: (r.sort?.key as TimelineSortKey) || "manual",
      dir: r.sort?.dir === "desc" ? "desc" : "asc",
    },
    group: (r.group as TimelineGroupKey) || "none",
    showProgressOnBar: r.showProgressOnBar !== false,
  };
}

// Optimistic date override applied on top of the incoming props while a
// PATCH is in flight (and until the parent refetches on tab switch).
interface DateOverride {
  startDate: string | null;
  endDate: string | null;
}

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  ppId: string;
  projectId: string;
  mode: DragMode;
  startClientX: number;
  origStart: Date;
  origEnd: Date;
  // Live preview dates during the drag (date-only local days).
  previewStart: Date;
  previewEnd: Date;
}

export function PortfolioTimelineView({ projects }: Props) {
  const router = useRouter();
  const params = useParams();
  const portfolioId = (params?.portfolioId as string) || "_";

  const [centerDate, setCenterDate] = useState<Date>(() => new Date());
  const [scale, setScale] = useState<Scale>("months");
  const [zoomIdx, setZoomIdx] = useState<number>(1);

  // Persisted per-portfolio, per-user view preferences.
  const { value: rawView, setValue: setRawView } = useUiState<
    Record<string, TimelineViewState>
  >("portfolioTimelineView", {});
  const view = normalizeTimelineView(rawView[portfolioId]);
  const setView = useCallback(
    (next: TimelineViewState) =>
      setRawView((prev) => ({ ...prev, [portfolioId]: next })),
    [portfolioId, setRawView]
  );

  // Client-side text search over project names (ephemeral).
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Optimistic date overrides keyed by project id.
  const [dateOverrides, setDateOverrides] = useState<
    Record<string, DateOverride>
  >({});

  // Live drag state (null when not dragging).
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const monthPx = MONTH_PX_BY_ZOOM[scale][zoomIdx];
  const rangeMonths = scale === "months" ? 12 : 24;
  const rangeStart = useMemo(() => {
    const c = startOfMonth(centerDate);
    const backMonths = scale === "months" ? 3 : 6;
    return addMonths(c, -backMonths);
  }, [centerDate, scale]);

  const today = new Date();
  const todayOffset = fractionalMonths(rangeStart, today);
  const todayPx = todayOffset * monthPx;
  const totalPx = rangeMonths * monthPx;

  const activeLeftColumns = LEFT_COLUMN_DEFS.filter((c) =>
    view.columns.includes(c.key)
  );
  const leftColPx =
    PROJECT_COL + activeLeftColumns.reduce((sum, c) => sum + c.px, 0);
  const leftGridTemplate = [
    `${PROJECT_COL}px`,
    ...activeLeftColumns.map((c) => `${c.px}px`),
  ].join(" ");

  // Pixels-per-day at the current zoom, averaged across the visible
  // range (months differ slightly in length; good enough for snapping).
  const pxPerDay = useMemo(() => {
    const rangeEnd = addMonths(rangeStart, rangeMonths);
    const days = (rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY;
    return totalPx / days;
  }, [rangeStart, rangeMonths, totalPx]);

  // Unique owners across projects, for the Filter popover.
  const ownerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const pp of projects) {
      const o = pp.project.owner;
      if (o) map.set(o.id, o.name || "Unknown");
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [projects]);

  const activeFilterCount =
    view.filter.status.length +
    view.filter.type.length +
    view.filter.gate.length +
    view.filter.ownerId.length;

  const listModified =
    activeFilterCount > 0 ||
    view.sort.key !== "manual" ||
    view.group !== "none" ||
    search.trim().length > 0;

  // Merge optimistic overrides + live drag preview onto each project's
  // effective start/end dates.
  const effectiveDates = useCallback(
    (pp: { id: string; project: TimelineProject }) => {
      const p = pp.project;
      // Live drag preview wins for the bar being dragged.
      if (drag && drag.ppId === pp.id) {
        return {
          start: drag.previewStart as Date | null,
          end: drag.previewEnd as Date | null,
        };
      }
      const ov = dateOverrides[p.id];
      const startStr = ov ? ov.startDate : p.startDate;
      const endStr = ov ? ov.endDate : p.endDate;
      return {
        start: startStr ? isoToLocalDay(startStr) : null,
        end: endStr ? isoToLocalDay(endStr) : null,
      };
    },
    [drag, dateOverrides]
  );

  // ── Filter / sort / search ────────────────────────────────
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = view.filter;
    let rows = projects.filter((pp) => {
      const p = pp.project;
      if (f.status.length && !f.status.includes(p.status)) return false;
      if (f.type.length && (!p.type || !f.type.includes(p.type))) return false;
      if (f.gate.length && (!p.gate || !f.gate.includes(p.gate))) return false;
      if (f.ownerId.length && (!p.owner || !f.ownerId.includes(p.owner.id)))
        return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });

    if (view.sort.key !== "manual") {
      const dir = view.sort.dir === "desc" ? -1 : 1;
      rows = rows.slice().sort((a, b) => {
        const pa = a.project;
        const pb = b.project;
        let cmp = 0;
        switch (view.sort.key) {
          case "name":
            cmp = pa.name.localeCompare(pb.name);
            break;
          case "status":
            cmp = STATUS_SORT_ORDER[pa.status] - STATUS_SORT_ORDER[pb.status];
            break;
          case "progress":
            cmp = pa.stats.progress - pb.stats.progress;
            break;
          case "due": {
            const ea = effectiveDates(a).end;
            const eb = effectiveDates(b).end;
            const da = ea ? ea.getTime() : Infinity;
            const db = eb ? eb.getTime() : Infinity;
            cmp = da - db;
            break;
          }
        }
        return cmp * dir;
      });
    }
    return rows;
  }, [projects, view.filter, view.sort, search, effectiveDates]);

  // ── Group ─────────────────────────────────────────────────
  const groupedRows = useMemo(() => {
    if (view.group === "none") {
      return [{ key: "all", label: "", rows: visibleRows }];
    }
    const buckets = new Map<
      string,
      { label: string; rows: typeof visibleRows }
    >();
    const order: string[] = [];
    const ensure = (key: string, label: string) => {
      if (!buckets.has(key)) {
        buckets.set(key, { label, rows: [] });
        order.push(key);
      }
      return buckets.get(key)!;
    };
    for (const pp of visibleRows) {
      const p = pp.project;
      let key = "_none";
      let label = "None";
      if (view.group === "status") {
        key = p.status;
        label = STATUS_META[p.status].label;
      } else if (view.group === "owner") {
        key = p.owner?.id || "_none";
        label = p.owner?.name || "No owner";
      } else if (view.group === "type") {
        key = p.type || "_none";
        label = p.type ? TYPE_META[p.type].label : "No type";
      } else if (view.group === "gate") {
        key = p.gate || "_none";
        label = p.gate ? GATE_META[p.gate].label : "No gate";
      }
      ensure(key, label).rows.push(pp);
    }
    if (view.group === "status") {
      order.sort(
        (a, b) =>
          (STATUS_SORT_ORDER[a as ProjectStatus] ?? 99) -
          (STATUS_SORT_ORDER[b as ProjectStatus] ?? 99)
      );
    }
    return order.map((key) => ({
      key,
      label: buckets.get(key)!.label,
      rows: buckets.get(key)!.rows,
    }));
  }, [visibleRows, view.group]);

  // ── Bar geometry for one project ──────────────────────────
  const barFor = useCallback(
    (pp: { id: string; project: TimelineProject }) => {
      const { start, end } = effectiveDates(pp);
      if (!start || !end || end.getTime() < start.getTime()) return null;
      const startOffset = fractionalMonths(rangeStart, start);
      // Add one day so a bar whose start == end still has visible width
      // and inclusive end semantics (Asana shows the end day filled).
      const endOffset = fractionalMonths(rangeStart, addDays(end, 1));
      const left = startOffset * monthPx;
      const width = Math.max((endOffset - startOffset) * monthPx, 6);
      return { left, width };
    },
    [effectiveDates, rangeStart, monthPx]
  );

  const months = useMemo(() => {
    const arr: { label: string; year: number; index: number }[] = [];
    for (let i = 0; i < rangeMonths; i++) {
      const m = addMonths(rangeStart, i);
      arr.push({
        label: MONTH_NAMES[m.getMonth()],
        year: m.getFullYear(),
        index: i,
      });
    }
    return arr;
  }, [rangeStart, rangeMonths]);

  const quarters = useMemo(() => {
    const result: { label: string; widthPx: number }[] = [];
    let i = 0;
    while (i < months.length) {
      const m = addMonths(rangeStart, i);
      const q = Math.floor(m.getMonth() / 3) + 1;
      const year = m.getFullYear();
      let count = 0;
      while (
        i < months.length &&
        Math.floor(addMonths(rangeStart, i).getMonth() / 3) + 1 === q &&
        addMonths(rangeStart, i).getFullYear() === year
      ) {
        i++;
        count++;
      }
      result.push({
        label: `Q${q} ${year}`,
        widthPx: count * monthPx,
      });
    }
    return result;
  }, [months, rangeStart, monthPx]);

  const maxZoom = MONTH_PX_BY_ZOOM[scale].length - 1;

  // ── Drag to reschedule ────────────────────────────────────
  const commitReschedule = useCallback(
    async (
      projectId: string,
      newStart: Date,
      newEnd: Date,
      prevStart: string | null,
      prevEnd: string | null
    ) => {
      const startStr = toDateOnlyString(newStart);
      const endStr = toDateOnlyString(newEnd);
      // Optimistic override.
      setDateOverrides((prev) => ({
        ...prev,
        [projectId]: { startDate: startStr, endDate: endStr },
      }));
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: startStr, endDate: endStr }),
        });
        if (!res.ok) {
          // Revert to the pre-drag dates.
          setDateOverrides((prev) => ({
            ...prev,
            [projectId]: { startDate: prevStart, endDate: prevEnd },
          }));
          const err = await res.json().catch(() => ({}));
          toast.error(
            err.error ||
              (res.status === 403
                ? "You don't have permission to reschedule this project"
                : "Failed to reschedule")
          );
          return;
        }
        toast.success("Project rescheduled");
      } catch {
        setDateOverrides((prev) => ({
          ...prev,
          [projectId]: { startDate: prevStart, endDate: prevEnd },
        }));
        toast.error("Failed to reschedule");
      }
    },
    []
  );

  const onBarPointerDown = useCallback(
    (
      e: React.PointerEvent,
      pp: { id: string; project: TimelineProject },
      mode: DragMode
    ) => {
      // Only left button; ignore if no dates to move.
      if (e.button !== 0) return;
      const { start, end } = effectiveDates(pp);
      if (!start || !end) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const state: DragState = {
        ppId: pp.id,
        projectId: pp.project.id,
        mode,
        startClientX: e.clientX,
        origStart: start,
        origEnd: end,
        previewStart: start,
        previewEnd: end,
      };
      // Sync the ref immediately so a pointermove that fires before the
      // next render already sees the active drag.
      dragRef.current = state;
      setDrag(state);
    },
    [effectiveDates]
  );

  const onBarPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const dxPx = e.clientX - d.startClientX;
      const dayDelta = Math.round(dxPx / pxPerDay);
      let previewStart = d.origStart;
      let previewEnd = d.origEnd;
      if (d.mode === "move") {
        previewStart = addDays(d.origStart, dayDelta);
        previewEnd = addDays(d.origEnd, dayDelta);
      } else if (d.mode === "resize-start") {
        previewStart = addDays(d.origStart, dayDelta);
        // Don't let start cross end.
        if (previewStart.getTime() > d.origEnd.getTime())
          previewStart = d.origEnd;
      } else if (d.mode === "resize-end") {
        previewEnd = addDays(d.origEnd, dayDelta);
        if (previewEnd.getTime() < d.origStart.getTime())
          previewEnd = d.origStart;
      }
      setDrag({ ...d, previewStart, previewEnd });
    },
    [pxPerDay]
  );

  const onBarPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      const moved =
        d.previewStart.getTime() !== d.origStart.getTime() ||
        d.previewEnd.getTime() !== d.origEnd.getTime();
      const pp = projects.find((x) => x.id === d.ppId);
      setDrag(null);
      if (!moved || !pp) return;
      commitReschedule(
        d.projectId,
        d.previewStart,
        d.previewEnd,
        // Pre-drag persisted values (respect any existing override).
        dateOverrides[d.projectId]?.startDate ?? pp.project.startDate,
        dateOverrides[d.projectId]?.endDate ?? pp.project.endDate
      );
    },
    [projects, commitReschedule, dateOverrides]
  );

  const rowsCount = visibleRows.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 md:px-4 py-2 border-b border-gray-200">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-gray-200"
          onClick={() =>
            setCenterDate(addMonths(centerDate, scale === "months" ? -3 : -6))
          }
          aria-label="Previous"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-gray-200 text-xs font-medium"
          onClick={() => setCenterDate(new Date())}
        >
          <Calendar className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Today</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-gray-200"
          onClick={() =>
            setCenterDate(addMonths(centerDate, scale === "months" ? 3 : 6))
          }
          aria-label="Next"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <span className="hidden lg:inline text-[12px] text-gray-500 ml-2">
          Drag a bar to reschedule.
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Filter / Sort / Group / Options */}
          <TimelineFilterPopover
            view={view}
            setView={setView}
            ownerOptions={ownerOptions}
            activeCount={activeFilterCount}
          />
          <TimelineSortPopover view={view} setView={setView} />
          <TimelineGroupPopover view={view} setView={setView} />
          <TimelineOptionsPopover view={view} setView={setView} />

          {/* Search */}
          {searchOpen ? (
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <Input
                value={search}
                autoFocus
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    setSearchOpen(false);
                  }
                }}
                onBlur={() => {
                  if (!search) setSearchOpen(false);
                }}
                placeholder="Search projects..."
                className="h-8 w-40 md:w-52 pl-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSearchOpen(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 hover:bg-gray-100 rounded-md"
              aria-label="Search"
            >
              <Search className="h-4 w-4 text-gray-500" />
            </button>
          )}

          <div className="hidden md:block w-px h-5 bg-gray-200 mx-1" />

          {/* Quarters / Months toggle */}
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setScale("quarters")}
              className={cn(
                "px-2.5 py-1 text-[12px] font-medium rounded-sm transition-colors",
                scale === "quarters"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-900"
              )}
            >
              Quarters
            </button>
            <button
              onClick={() => setScale("months")}
              className={cn(
                "px-2.5 py-1 text-[12px] font-medium rounded-sm transition-colors",
                scale === "months"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-900"
              )}
            >
              Months
            </button>
          </div>

          {/* Zoom */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-gray-200"
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
            disabled={zoomIdx === 0}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-gray-200"
            onClick={() => setZoomIdx((i) => Math.min(maxZoom, i + 1))}
            disabled={zoomIdx === maxZoom}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Active view summary bar ──────────────────────────── */}
      {listModified && (
        <div className="flex flex-wrap items-center gap-2 px-3 md:px-4 py-2 border-b border-gray-200 bg-gray-50/60 text-xs text-gray-600">
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Filter className="h-3 w-3" />
              {activeFilterCount}{" "}
              {activeFilterCount === 1 ? "filter" : "filters"}
            </span>
          )}
          {view.sort.key !== "manual" && (
            <span className="inline-flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" />
              Sorted by {SORT_LABELS[view.sort.key]}
            </span>
          )}
          {view.group !== "none" && (
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" />
              Grouped by {GROUP_LABELS[view.group]}
            </span>
          )}
          {search.trim() && (
            <span className="inline-flex items-center gap-1">
              <Search className="h-3 w-3" />“{search.trim()}”
            </span>
          )}
          <span className="text-gray-400">·</span>
          <span className="tabular-nums">
            {rowsCount} of {projects.length}
          </span>
          <button
            onClick={() => {
              setView({
                ...view,
                filter: { status: [], type: [], gate: [], ownerId: [] },
                sort: { key: "manual", dir: "asc" },
                group: "none",
              });
              setSearch("");
            }}
            className="text-[#a8893a] hover:underline ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <CalendarRange className="h-5 w-5 text-gray-400" />
          </div>
          <h3 className="text-[14px] font-semibold text-gray-900 mb-1">
            No projects in this timeline
          </h3>
          <p className="text-[13px] text-gray-500 max-w-sm">
            Add projects with start and end dates to see them on the timeline.
          </p>
        </div>
      ) : rowsCount === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500">
          No projects match your filters or search.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="relative" style={{ minWidth: leftColPx + totalPx }}>
            {/* ── Header (sticky top) ──────────────────────── */}
            <div className="flex bg-gray-50/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-20">
              <div
                className="flex-shrink-0 grid items-center bg-gray-50/80 sticky left-0 z-30 border-r border-gray-200"
                style={{
                  width: leftColPx,
                  height: HEADER_QUARTER_H + HEADER_MONTH_H,
                  gridTemplateColumns: leftGridTemplate,
                }}
              >
                <div className="px-4">Project</div>
                {activeLeftColumns.map((c) => (
                  <div key={c.key} className="px-3">
                    {c.label}
                  </div>
                ))}
              </div>
              <div className="flex flex-col" style={{ width: totalPx }}>
                {/* Quarter band */}
                <div
                  className="flex border-b border-gray-200"
                  style={{ height: HEADER_QUARTER_H }}
                >
                  {quarters.map((q, i) => (
                    <div
                      key={`${q.label}-${i}`}
                      className="text-[12px] font-semibold text-gray-700 normal-case px-2 border-r border-gray-200 flex items-center justify-center"
                      style={{ width: q.widthPx }}
                    >
                      {q.label}
                    </div>
                  ))}
                </div>
                {/* Month band */}
                <div className="flex" style={{ height: HEADER_MONTH_H }}>
                  {months.map((m, i) => (
                    <div
                      key={`m-${i}`}
                      className="text-[11px] text-gray-500 normal-case px-2 border-r border-gray-200 flex items-center justify-center tabular-nums"
                      style={{ width: monthPx }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Grouped sections + rows ──────────────────── */}
            {groupedRows.map((g) => (
              <div key={g.key}>
                {g.label && (
                  <div
                    className="flex items-center bg-gray-100/80 border-b border-gray-200 sticky left-0 z-[18]"
                    style={{ height: GROUP_BAND_H, width: leftColPx + totalPx }}
                  >
                    <div
                      className="flex items-center gap-2 px-4 text-[12px] font-semibold text-gray-700 normal-case sticky left-0"
                      style={{ width: leftColPx }}
                    >
                      {g.label}
                      <span className="text-gray-400 tabular-nums font-normal">
                        {g.rows.length}
                      </span>
                    </div>
                  </div>
                )}
                {g.rows.map((pp) => {
                  const p = pp.project;
                  const meta = STATUS_META[p.status];
                  const bar = barFor(pp);
                  const isDragging = drag?.ppId === pp.id;
                  const { start, end } = effectiveDates(pp);
                  return (
                    <div
                      key={pp.id}
                      className="flex border-b border-gray-100 last:border-0 hover:bg-gray-50/60 group"
                    >
                      {/* Left fixed cells (sticky) */}
                      <div
                        className="flex-shrink-0 grid items-center bg-white group-hover:bg-gray-50/60 sticky left-0 z-10 border-r border-gray-200 cursor-pointer"
                        style={{
                          width: leftColPx,
                          gridTemplateColumns: leftGridTemplate,
                          height: ROW_HEIGHT,
                        }}
                        onClick={() => router.push(`/projects/${p.id}`)}
                      >
                        <div className="px-4 flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-[13px] font-medium text-gray-900 truncate">
                            {p.name}
                          </span>
                        </div>
                        {activeLeftColumns.map((c) => {
                          if (c.key === "owner") {
                            return (
                              <div
                                key={c.key}
                                className="px-3 flex items-center gap-2 min-w-0"
                              >
                                <Avatar className="h-6 w-6 flex-shrink-0">
                                  <AvatarImage src={p.owner?.image || ""} />
                                  <AvatarFallback className="text-[10px] bg-gray-200 text-gray-700">
                                    {p.owner?.name?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[12px] text-gray-700 truncate">
                                  {p.owner?.name || "—"}
                                </span>
                              </div>
                            );
                          }
                          // status
                          return (
                            <div key={c.key} className="px-3 flex items-center">
                              <Badge
                                className={cn(
                                  meta.chip,
                                  "text-[11px] rounded-full px-2 py-0.5"
                                )}
                              >
                                <span
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full mr-1.5",
                                    meta.dot
                                  )}
                                />
                                {meta.label}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>

                      {/* Timeline cell */}
                      <div
                        className="relative flex-shrink-0"
                        style={{ width: totalPx, height: ROW_HEIGHT }}
                      >
                        {/* Vertical month gridlines */}
                        {months.map((_, i) => (
                          <div
                            key={`d-${i}`}
                            className="absolute top-0 bottom-0 border-r border-gray-100"
                            style={{ left: i * monthPx, width: monthPx }}
                          />
                        ))}
                        {bar ? (
                          <div
                            className={cn(
                              "absolute rounded-full flex items-center gap-1.5 px-1.5 text-[11px] font-medium overflow-hidden select-none touch-none",
                              isDragging
                                ? "shadow-lg ring-2 ring-white cursor-grabbing z-[5]"
                                : "hover:shadow-md transition-shadow cursor-grab"
                            )}
                            style={{
                              left: bar.left,
                              width: bar.width,
                              top: ROW_HEIGHT / 2 - BAR_HEIGHT / 2,
                              height: BAR_HEIGHT,
                              backgroundColor: meta.bar,
                            }}
                            title={
                              start && end
                                ? `${p.name} · ${toDateOnlyString(
                                    start
                                  )} → ${toDateOnlyString(end)} · ${
                                    p.stats.progress
                                  }% · ${meta.label}`
                                : p.name
                            }
                            onPointerDown={(e) =>
                              onBarPointerDown(e, pp, "move")
                            }
                            onPointerMove={onBarPointerMove}
                            onPointerUp={onBarPointerUp}
                          >
                            {/* Left resize handle */}
                            <span
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
                              onPointerDown={(e) =>
                                onBarPointerDown(e, pp, "resize-start")
                              }
                              onPointerMove={onBarPointerMove}
                              onPointerUp={onBarPointerUp}
                            />
                            {bar.width >= 80 ? (
                              <>
                                <Avatar className="h-5 w-5 flex-shrink-0 ring-1 ring-white/40 pointer-events-none">
                                  <AvatarImage src={p.owner?.image || ""} />
                                  <AvatarFallback className="text-[9px] bg-white/30 text-white">
                                    {p.owner?.name?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-white truncate pointer-events-none">
                                  {p.owner?.name || p.name}
                                </span>
                                {view.showProgressOnBar &&
                                  bar.width >= 180 && (
                                    <span className="text-white/80 tabular-nums ml-auto pointer-events-none">
                                      {p.stats.progress}%
                                    </span>
                                  )}
                              </>
                            ) : view.showProgressOnBar && bar.width >= 40 ? (
                              <span className="text-white tabular-nums mx-auto pointer-events-none">
                                {p.stats.progress}%
                              </span>
                            ) : null}
                            {/* Right resize handle */}
                            <span
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                              onPointerDown={(e) =>
                                onBarPointerDown(e, pp, "resize-end")
                              }
                              onPointerMove={onBarPointerMove}
                              onPointerUp={onBarPointerUp}
                            />
                          </div>
                        ) : (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 text-[12px] text-gray-400 italic"
                            style={{ left: 12 }}
                          >
                            No dates set
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* ── Today marker ────────────────────────────── */}
            {todayOffset >= 0 && todayOffset <= rangeMonths && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: leftColPx + todayPx,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "rgba(59, 130, 246, 0.4)",
                  zIndex: 15,
                }}
              >
                <div
                  className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: "rgba(59, 130, 246, 0.85)" }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────── */}
      {rowsCount > 0 && (
        <div className="px-4 py-2.5 text-[11px] text-gray-500 border-t border-gray-200 bg-gray-50/40 flex items-center gap-4 flex-wrap">
          <span className="font-medium text-gray-600 uppercase tracking-wider">
            Status
          </span>
          {(Object.keys(STATUS_META) as ProjectStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: STATUS_META[s].bar }}
              />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toolbar chip trigger ────────────────────────────────────

const ToolbarChipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    count?: number;
  }
>(function ToolbarChipTrigger(
  { icon, label, active, count, className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "hidden md:inline-flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-medium rounded-md transition-colors",
        active
          ? "bg-gray-900 text-white hover:bg-gray-800"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        className
      )}
      {...props}
    >
      {icon}
      <span>{label}</span>
      {count ? (
        <span
          className={cn(
            "ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] tabular-nums",
            active ? "bg-white/25 text-white" : "bg-gray-200 text-gray-700"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
});

// ── Popovers ────────────────────────────────────────────────

function CheckRow({
  checked,
  label,
  onToggle,
  dot,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 text-left"
    >
      <span
        className={cn(
          "flex items-center justify-center size-4 shrink-0 rounded-[4px] border transition-colors",
          checked
            ? "bg-gray-900 border-gray-900 text-white"
            : "border-gray-300 bg-white"
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      {dot && <span className={cn("w-2 h-2 rounded-full", dot)} />}
      <span className="text-sm text-gray-800 flex-1">{label}</span>
    </button>
  );
}

function TimelineFilterPopover({
  view,
  setView,
  ownerOptions,
  activeCount,
}: {
  view: TimelineViewState;
  setView: (v: TimelineViewState) => void;
  ownerOptions: { id: string; name: string }[];
  activeCount: number;
}) {
  const f = view.filter;
  const toggle = <K extends keyof TimelineViewState["filter"]>(
    key: K,
    value: TimelineViewState["filter"][K][number]
  ) => {
    const arr = f[key] as string[];
    const next = arr.includes(value as string)
      ? arr.filter((v) => v !== value)
      : [...arr, value as string];
    setView({ ...view, filter: { ...f, [key]: next } });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarChipTrigger
          icon={<Filter className="h-3.5 w-3.5" />}
          label="Filter"
          active={activeCount > 0}
          count={activeCount || undefined}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 p-3 max-h-[70vh] overflow-y-auto"
      >
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Status
            </div>
            {(Object.keys(STATUS_META) as ProjectStatus[]).map((s) => (
              <CheckRow
                key={s}
                checked={f.status.includes(s)}
                label={STATUS_META[s].label}
                dot={STATUS_META[s].dot}
                onToggle={() => toggle("status", s)}
              />
            ))}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Type
            </div>
            {(Object.keys(TYPE_META) as ProjectType[]).map((t) => (
              <CheckRow
                key={t}
                checked={f.type.includes(t)}
                label={TYPE_META[t].label}
                onToggle={() => toggle("type", t)}
              />
            ))}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Gate
            </div>
            {(Object.keys(GATE_META) as ProjectGate[]).map((g) => (
              <CheckRow
                key={g}
                checked={f.gate.includes(g)}
                label={GATE_META[g].label}
                onToggle={() => toggle("gate", g)}
              />
            ))}
          </div>
          {ownerOptions.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Owner
              </div>
              {ownerOptions.map((o) => (
                <CheckRow
                  key={o.id}
                  checked={f.ownerId.includes(o.id)}
                  label={o.name}
                  onToggle={() => toggle("ownerId", o.id)}
                />
              ))}
            </div>
          )}
          {activeCount > 0 && (
            <button
              onClick={() =>
                setView({
                  ...view,
                  filter: { status: [], type: [], gate: [], ownerId: [] },
                })
              }
              className="w-full text-center text-xs text-[#a8893a] hover:underline pt-1"
            >
              Clear all filters
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimelineSortPopover({
  view,
  setView,
}: {
  view: TimelineViewState;
  setView: (v: TimelineViewState) => void;
}) {
  const options: { key: TimelineSortKey; label: string }[] = [
    { key: "manual", label: "Manual (portfolio order)" },
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
    { key: "progress", label: "Progress" },
    { key: "due", label: "Due date" },
  ];
  const active = view.sort.key !== "manual";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarChipTrigger
          icon={<ArrowUpDown className="h-3.5 w-3.5" />}
          label="Sort"
          active={active}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="space-y-0.5">
          {options.map((o) => {
            const isActive = view.sort.key === o.key;
            return (
              <button
                key={o.key}
                onClick={() =>
                  setView({
                    ...view,
                    sort: {
                      key: o.key,
                      dir: isActive ? view.sort.dir : "asc",
                    },
                  })
                }
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-gray-100",
                  isActive && "bg-gray-50 font-medium"
                )}
              >
                {isActive ? (
                  <Check className="h-3.5 w-3.5 text-[#a8893a]" />
                ) : (
                  <span className="w-3.5" />
                )}
                {o.label}
              </button>
            );
          })}
          {active && (
            <div className="border-t mt-1 pt-1 flex gap-1">
              <button
                onClick={() =>
                  setView({ ...view, sort: { ...view.sort, dir: "asc" } })
                }
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-gray-100",
                  view.sort.dir === "asc" && "bg-gray-100 font-medium"
                )}
              >
                <ArrowUp className="h-3.5 w-3.5" /> Ascending
              </button>
              <button
                onClick={() =>
                  setView({ ...view, sort: { ...view.sort, dir: "desc" } })
                }
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-gray-100",
                  view.sort.dir === "desc" && "bg-gray-100 font-medium"
                )}
              >
                <ArrowDown className="h-3.5 w-3.5" /> Descending
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimelineGroupPopover({
  view,
  setView,
}: {
  view: TimelineViewState;
  setView: (v: TimelineViewState) => void;
}) {
  const options: { key: TimelineGroupKey; label: string }[] = [
    { key: "none", label: "None" },
    { key: "status", label: "Status" },
    { key: "owner", label: "Owner" },
    { key: "type", label: "Type" },
    { key: "gate", label: "Gate" },
  ];
  const active = view.group !== "none";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarChipTrigger
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Group"
          active={active}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <div className="space-y-0.5">
          {options.map((o) => {
            const isActive = view.group === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setView({ ...view, group: o.key })}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-gray-100",
                  isActive && "bg-gray-50 font-medium"
                )}
              >
                {isActive ? (
                  <Check className="h-3.5 w-3.5 text-[#a8893a]" />
                ) : (
                  <span className="w-3.5" />
                )}
                {o.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimelineOptionsPopover({
  view,
  setView,
}: {
  view: TimelineViewState;
  setView: (v: TimelineViewState) => void;
}) {
  const isVisible = (key: LeftColumnKey) => view.columns.includes(key);
  const toggleColumn = (key: LeftColumnKey) => {
    const next = isVisible(key)
      ? view.columns.filter((c) => c !== key)
      : LEFT_COLUMN_DEFS.filter(
          (c) => view.columns.includes(c.key) || c.key === key
        ).map((c) => c.key);
    setView({ ...view, columns: next });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarChipTrigger
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          label="Options"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Left columns
        </div>
        <div className="space-y-0.5">
          {LEFT_COLUMN_DEFS.map((def) => (
            <CheckRow
              key={def.key}
              checked={isVisible(def.key)}
              label={def.label}
              onToggle={() => toggleColumn(def.key)}
            />
          ))}
        </div>
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 mt-3">
          Bar labels
        </div>
        <CheckRow
          checked={view.showProgressOnBar}
          label="Show progress %"
          onToggle={() =>
            setView({ ...view, showProgressOnBar: !view.showProgressOnBar })
          }
        />
        <button
          onClick={() =>
            setView({
              ...view,
              columns: DEFAULT_COLUMNS,
              showProgressOnBar: true,
            })
          }
          className="w-full text-center text-xs text-[#a8893a] hover:underline pt-2"
        >
          Reset options
        </button>
      </PopoverContent>
    </Popover>
  );
}
