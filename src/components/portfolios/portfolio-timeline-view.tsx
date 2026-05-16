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

const ROW_HEIGHT = 52;
const BAR_HEIGHT = 26;
const HEADER_QUARTER_H = 28;
const HEADER_MONTH_H = 28;
const PROJECT_COL = 200;
const OWNER_COL = 120;
const STATUS_COL = 100;
const LEFT_COL_PX = PROJECT_COL + OWNER_COL + STATUS_COL; // 420

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

export function PortfolioTimelineView({ projects }: Props) {
  const router = useRouter();
  const [centerDate, setCenterDate] = useState<Date>(() => new Date());
  const [scale, setScale] = useState<Scale>("months");
  const [zoomIdx, setZoomIdx] = useState<number>(1);

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

          <div className="hidden md:block w-px h-5 bg-gray-200 mx-1" />

          <ToolbarChip icon={<Filter className="h-3.5 w-3.5" />} label="Filter" />
          <ToolbarChip
            icon={<ArrowUpDown className="h-3.5 w-3.5" />}
            label="Sort"
          />
          <ToolbarChip
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Group"
          />
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
      ) : (
        <div className="overflow-x-auto">
          <div
            className="relative"
            style={{ minWidth: LEFT_COL_PX + totalPx }}
          >
            {/* ── Header (sticky top) ──────────────────────── */}
            <div className="flex bg-gray-50/80 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-20">
              <div
                className="flex-shrink-0 grid items-center bg-gray-50/80 sticky left-0 z-30 border-r border-gray-200"
                style={{
                  width: LEFT_COL_PX,
                  height: HEADER_QUARTER_H + HEADER_MONTH_H,
                  gridTemplateColumns: `${PROJECT_COL}px ${OWNER_COL}px ${STATUS_COL}px`,
                }}
              >
                <div className="px-4">Project</div>
                <div className="px-3">Owner</div>
                <div className="px-3">Status</div>
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

            {/* ── Rows ────────────────────────────────────── */}
            {rows.map((pp) => {
              const p = pp.project;
              const meta = STATUS_META[p.status];
              return (
                <div
                  key={pp.id}
                  className="flex border-b border-gray-100 last:border-0 hover:bg-gray-50/60 cursor-pointer group"
                  onClick={() => router.push(`/projects/${p.id}`)}
                >
                  {/* Left fixed cells (sticky) */}
                  <div
                    className="flex-shrink-0 grid items-center bg-white group-hover:bg-gray-50/60 sticky left-0 z-10 border-r border-gray-200"
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
                      <span className="text-[13px] font-medium text-gray-900 truncate">
                        {p.name}
                      </span>
                    </div>
                    <div className="px-3 flex items-center gap-2 min-w-0">
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
                    <div className="px-3 flex items-center">
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
                        className="absolute rounded-full flex items-center gap-1.5 px-1.5 text-[11px] font-medium overflow-hidden hover:shadow-md transition-shadow"
                        style={{
                          left: pp.bar.left,
                          width: pp.bar.width,
                          top: ROW_HEIGHT / 2 - BAR_HEIGHT / 2,
                          height: BAR_HEIGHT,
                          backgroundColor: meta.bar,
                        }}
                        title={`${p.name} · ${p.stats.progress}% · ${meta.label}`}
                      >
                        {pp.bar.width >= 80 ? (
                          <>
                            <Avatar className="h-5 w-5 flex-shrink-0 ring-1 ring-white/40">
                              <AvatarImage src={p.owner?.image || ""} />
                              <AvatarFallback className="text-[9px] bg-white/30 text-white">
                                {p.owner?.name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-white truncate">
                              {p.owner?.name || p.name}
                            </span>
                            {pp.bar.width >= 180 && (
                              <span className="text-white/80 tabular-nums ml-auto">
                                {p.stats.progress}%
                              </span>
                            )}
                          </>
                        ) : pp.bar.width >= 40 ? (
                          <span className="text-white tabular-nums mx-auto">
                            {p.stats.progress}%
                          </span>
                        ) : null}
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

            {/* ── Today marker ────────────────────────────── */}
            {todayOffset >= 0 && todayOffset <= rangeMonths && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: LEFT_COL_PX + todayPx,
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
      {rows.length > 0 && (
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
      className="hidden md:inline-flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
