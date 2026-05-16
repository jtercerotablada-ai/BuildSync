"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ProjectStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

interface TimelineProject {
  id: string;
  name: string;
  color: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
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
    bar: "#000000",
    dot: "bg-black",
    chip: "bg-gray-100 text-black",
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

const ROW_HEIGHT = 48;
const LEFT_COL_PX = 460; // Project / Owner / Status fixed columns
const PROJECT_COL = 220;
const OWNER_COL = 140;
const STATUS_COL = 100;

// Per-scale layout. The toolbar's zoom buttons step between these.
type Scale = "quarters" | "months";

const MONTH_PX_BY_ZOOM = {
  quarters: [40, 60, 80] as const, // tight → wide
  months: [90, 120, 160] as const,
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

export function PortfolioTimelineView({ projects }: Props) {
  const router = useRouter();
  const [centerDate, setCenterDate] = useState<Date>(() => new Date());
  const [scale, setScale] = useState<Scale>("months");
  const [zoomIdx, setZoomIdx] = useState<number>(1); // middle step

  const monthPx = MONTH_PX_BY_ZOOM[scale][zoomIdx];
  // Window size adapts to scale: months show 12, quarters span 24 for context.
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

  const rows = useMemo(() => {
    return projects.map((pp) => {
      const p = pp.project;
      const s = p.startDate ? new Date(p.startDate) : null;
      const e = p.endDate ? new Date(p.endDate) : null;
      if (!s || !e || e.getTime() < s.getTime()) {
        return { ...pp, bar: null as null | { left: number; width: number } };
      }
      const startOffset = fractionalMonths(rangeStart, s);
      const endOffset = fractionalMonths(rangeStart, e);
      const left = startOffset * monthPx;
      const width = Math.max((endOffset - startOffset) * monthPx, 4);
      return { ...pp, bar: { left, width } };
    });
  }, [projects, rangeStart, monthPx]);

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
    const result: { label: string; widthPx: number; startIdx: number }[] = [];
    let i = 0;
    while (i < months.length) {
      const m = addMonths(rangeStart, i);
      const q = Math.floor(m.getMonth() / 3) + 1;
      const year = m.getFullYear();
      const startIdx = i;
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
        startIdx,
      });
    }
    return result;
  }, [months, rangeStart, monthPx]);

  const maxZoom = MONTH_PX_BY_ZOOM[scale].length - 1;

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 md:px-4 py-2.5 border-b">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            setCenterDate(
              addMonths(centerDate, scale === "months" ? -3 : -6)
            )
          }
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setCenterDate(new Date())}
        >
          <Calendar className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Today</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            setCenterDate(addMonths(centerDate, scale === "months" ? 3 : 6))
          }
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="hidden lg:inline text-[11px] text-gray-500 ml-2">
          Drag a bar to reschedule.
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Scale toggle */}
          <div className="inline-flex rounded-md border bg-white p-0.5">
            <button
              onClick={() => setScale("quarters")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors",
                scale === "quarters"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:text-black"
              )}
            >
              Quarters
            </button>
            <button
              onClick={() => setScale("months")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-sm transition-colors",
                scale === "months"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:text-black"
              )}
            >
              Months
            </button>
          </div>

          {/* Zoom */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
            disabled={zoomIdx === 0}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoomIdx((i) => Math.min(maxZoom, i + 1))}
            disabled={zoomIdx === maxZoom}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          <div className="hidden md:block w-px h-5 bg-gray-200 mx-1" />

          <ToolbarChip icon={<Filter className="h-3.5 w-3.5" />} label="Filter" />
          <ToolbarChip icon={<ArrowUpDown className="h-3.5 w-3.5" />} label="Sort" />
          <ToolbarChip icon={<Layers className="h-3.5 w-3.5" />} label="Group" />
          <ToolbarChip
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            label="Options"
          />
          <button
            onClick={() => toast.message("Search coming soon")}
            className="p-1.5 hover:bg-gray-100 rounded-md"
            aria-label="Search"
          >
            <Search className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <CalendarRange className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-black mb-1">
            No projects in this timeline
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Add projects with start and end dates to see them on the timeline.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="relative"
            style={{ minWidth: LEFT_COL_PX + totalPx }}
          >
            {/* ── Header ──────────────────────────────────────── */}
            <div className="flex border-b bg-gray-50/60 text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 z-10">
              <div
                className="flex-shrink-0 grid items-center border-r"
                style={{
                  width: LEFT_COL_PX,
                  gridTemplateColumns: `${PROJECT_COL}px ${OWNER_COL}px ${STATUS_COL}px`,
                }}
              >
                <div className="px-4 py-2">Project</div>
                <div className="px-2 py-2">Owner</div>
                <div className="px-2 py-2">Status</div>
              </div>
              <div className="flex flex-col" style={{ width: totalPx }}>
                {/* Quarter band */}
                <div className="flex border-b">
                  {quarters.map((q, i) => (
                    <div
                      key={`${q.label}-${i}`}
                      className="text-[11px] font-semibold text-gray-700 normal-case px-2 py-1 border-r flex items-center justify-center"
                      style={{ width: q.widthPx }}
                    >
                      {q.label}
                    </div>
                  ))}
                </div>
                {/* Month band */}
                <div className="flex">
                  {months.map((m, i) => (
                    <div
                      key={`m-${i}`}
                      className="text-[10px] text-gray-500 normal-case px-2 py-1 border-r flex items-center justify-center tabular-nums"
                      style={{ width: monthPx }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Rows ────────────────────────────────────────── */}
            {rows.map((pp) => {
              const p = pp.project;
              const meta = STATUS_META[p.status];
              return (
                <div
                  key={pp.id}
                  className="flex border-b last:border-0 hover:bg-gray-50 cursor-pointer group"
                  onClick={() => router.push(`/projects/${p.id}`)}
                >
                  {/* Left fixed cells */}
                  <div
                    className="flex-shrink-0 grid items-center border-r bg-white group-hover:bg-gray-50"
                    style={{
                      width: LEFT_COL_PX,
                      gridTemplateColumns: `${PROJECT_COL}px ${OWNER_COL}px ${STATUS_COL}px`,
                      height: ROW_HEIGHT,
                    }}
                  >
                    <div className="px-4 flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-sm font-medium text-black truncate">
                        {p.name}
                      </span>
                    </div>
                    <div className="px-2 flex items-center gap-2 min-w-0">
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarImage src={p.owner?.image || ""} />
                        <AvatarFallback className="text-[10px] bg-gray-200">
                          {p.owner?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-gray-700 truncate">
                        {p.owner?.name || "—"}
                      </span>
                    </div>
                    <div className="px-2 flex items-center">
                      <Badge className={cn(meta.chip, "text-[10px]")}>
                        {meta.label}
                      </Badge>
                    </div>
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
                    {pp.bar ? (
                      <div
                        className="absolute rounded-full flex items-center px-2.5 text-[11px] font-medium text-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                        style={{
                          left: pp.bar.left,
                          width: pp.bar.width,
                          top: ROW_HEIGHT / 2 - 10,
                          height: 20,
                          backgroundColor: meta.bar,
                        }}
                        title={`${p.name} · ${p.stats.progress}% · ${meta.label}`}
                      >
                        {pp.bar.width > 60 && (
                          <span className="truncate">
                            {p.stats.progress}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 text-[11px] text-gray-400 italic"
                        style={{ left: 12 }}
                      >
                        No dates set
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* ── Today marker ────────────────────────────────── */}
            {todayOffset >= 0 && todayOffset <= rangeMonths && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: LEFT_COL_PX + todayPx,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "rgba(168, 137, 58, 0.45)",
                }}
              >
                <div
                  className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: "rgba(168, 137, 58, 0.9)" }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="px-4 py-2 text-[11px] text-gray-500 border-t bg-gray-50/40 flex items-center gap-3 flex-wrap">
          <span className="font-medium text-gray-600">Status</span>
          {(Object.keys(STATUS_META) as ProjectStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
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

function ToolbarChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => toast.message(`${label} coming soon`)}
      className="hidden md:inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
