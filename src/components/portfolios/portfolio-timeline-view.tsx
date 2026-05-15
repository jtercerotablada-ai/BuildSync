"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  stats: { progress: number };
}

interface Props {
  projects: { id: string; project: TimelineProject }[];
}

const STATUS_BAR_COLOR: Record<ProjectStatus, string> = {
  ON_TRACK: "#c9a84c",
  AT_RISK: "#f59e0b",
  OFF_TRACK: "#000000",
  ON_HOLD: "#9ca3af",
  COMPLETE: "#a8893a",
};

const MONTH_PX = 120; // pixels per month on screen
const ROW_HEIGHT = 44;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function fractionalMonths(start: Date, point: Date) {
  // How many "months" the point is from start, including a fractional day part.
  const wholeMonths = monthsBetween(start, point);
  const monthStart = addMonths(start, wholeMonths);
  const monthEnd = addMonths(start, wholeMonths + 1);
  const monthLengthMs = monthEnd.getTime() - monthStart.getTime();
  const offsetMs = point.getTime() - monthStart.getTime();
  return wholeMonths + offsetMs / monthLengthMs;
}

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

export function PortfolioTimelineView({ projects }: Props) {
  const router = useRouter();
  const [centerDate, setCenterDate] = useState<Date>(() => new Date());

  const { rangeStart, rangeMonths } = useMemo(() => {
    // Always show a 12-month window: -3 from center, +9 forward.
    const c = startOfMonth(centerDate);
    return { rangeStart: addMonths(c, -3), rangeMonths: 12 };
  }, [centerDate]);

  const today = new Date();
  const todayOffset = fractionalMonths(rangeStart, today);
  const todayPx = todayOffset * MONTH_PX;
  const totalPx = rangeMonths * MONTH_PX;

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
      const left = startOffset * MONTH_PX;
      const width = Math.max((endOffset - startOffset) * MONTH_PX, 4);
      return { ...pp, bar: { left, width } };
    });
  }, [projects, rangeStart]);

  const months = useMemo(() => {
    const arr: { label: string; year: number }[] = [];
    for (let i = 0; i < rangeMonths; i++) {
      const m = addMonths(rangeStart, i);
      arr.push({ label: MONTH_NAMES[m.getMonth()], year: m.getFullYear() });
    }
    return arr;
  }, [rangeStart, rangeMonths]);

  // Group by quarter for the top header band.
  const quarters = useMemo(() => {
    const result: { label: string; widthPx: number; startIdx: number }[] = [];
    let i = 0;
    while (i < months.length) {
      const m = addMonths(rangeStart, i);
      const q = Math.floor(m.getMonth() / 3) + 1;
      const year = m.getFullYear();
      const startIdx = i;
      // count months in this quarter from this point
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
        widthPx: count * MONTH_PX,
        startIdx,
      });
    }
    return result;
  }, [months, rangeStart]);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="flex items-center gap-2 px-3 md:px-4 py-3 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCenterDate(addMonths(centerDate, -3))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCenterDate(new Date())}
        >
          <Calendar className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Today</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCenterDate(addMonths(centerDate, 3))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-gray-500 ml-2 hidden md:block">
          Drag a bar in a future iteration to reschedule.
        </span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 320 + totalPx }}>
          {/* Header */}
          <div className="flex border-b bg-gray-50/60 sticky top-0 z-10">
            <div className="w-80 flex-shrink-0 border-r px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project
            </div>
            <div className="relative" style={{ width: totalPx }}>
              {/* Quarter band */}
              <div className="flex border-b">
                {quarters.map((q, i) => (
                  <div
                    key={`${q.label}-${i}`}
                    className="text-xs font-medium text-gray-700 px-2 py-1 border-r"
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
                    className="text-[11px] text-gray-500 px-2 py-1 border-r tabular-nums"
                    style={{ width: MONTH_PX }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              No projects with dates yet. Add projects and set start/end dates
              to see them on the timeline.
            </div>
          ) : (
            rows.map((pp) => {
              const p = pp.project;
              return (
                <div
                  key={pp.id}
                  className="flex border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/projects/${p.id}`)}
                >
                  <div
                    className="w-80 flex-shrink-0 border-r px-4 flex items-center gap-2 min-w-0"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-sm font-medium text-black truncate">
                      {p.name}
                    </span>
                  </div>
                  <div
                    className="relative flex-shrink-0"
                    style={{ width: totalPx, height: ROW_HEIGHT }}
                  >
                    {/* Month dividers */}
                    {months.map((_, i) => (
                      <div
                        key={`d-${i}`}
                        className="absolute top-0 bottom-0 border-r border-gray-100"
                        style={{ left: i * MONTH_PX, width: MONTH_PX }}
                      />
                    ))}
                    {pp.bar ? (
                      <div
                        className="absolute rounded-md flex items-center px-2 text-[11px] font-medium text-white shadow-sm overflow-hidden"
                        style={{
                          left: pp.bar.left,
                          width: pp.bar.width,
                          top: 8,
                          height: ROW_HEIGHT - 16,
                          backgroundColor: STATUS_BAR_COLOR[p.status],
                        }}
                        title={`${p.name} · ${p.stats.progress}%`}
                      >
                        <span className="truncate">{p.stats.progress}%</span>
                      </div>
                    ) : (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 text-[11px] text-gray-400 italic"
                        style={{ left: 8 }}
                      >
                        No dates set
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Today line */}
          {todayOffset >= 0 && todayOffset <= rangeMonths && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: 320 + todayPx,
                top: 0,
                bottom: 0,
                width: 2,
                background: "rgba(168, 137, 58, 0.5)",
              }}
            />
          )}
        </div>
      </div>
      <div className="px-4 py-2 text-[11px] text-gray-500 border-t bg-gray-50/40 flex items-center gap-3 flex-wrap">
        <span className="font-medium">Legend:</span>
        {(
          [
            ["On track", "ON_TRACK"],
            ["At risk", "AT_RISK"],
            ["Off track", "OFF_TRACK"],
            ["On hold", "ON_HOLD"],
            ["Complete", "COMPLETE"],
          ] as [string, ProjectStatus][]
        ).map(([label, status]) => (
          <span key={status} className="inline-flex items-center gap-1">
            <span
              className={cn("w-3 h-3 rounded-sm")}
              style={{ background: STATUS_BAR_COLOR[status] }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
