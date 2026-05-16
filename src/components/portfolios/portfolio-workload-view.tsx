"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  Filter,
  Layers,
  SlidersHorizontal,
  CalendarRange,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WorkloadTask {
  id: string;
  name: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  completed: boolean;
  projectId: string;
}

interface Assignee {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  jobTitle?: string | null;
}

interface Props {
  portfolioId: string;
  projectCount: number;
}

type WindowSize = 7 | 14 | 30;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function PortfolioWorkloadView({
  portfolioId,
  projectCount,
}: Props) {
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [windowSize, setWindowSize] = useState<WindowSize>(14);
  const [tasks, setTasks] = useState<WorkloadTask[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/portfolios/${portfolioId}/workload`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTasks(data.tasks || []);
          setAssignees(data.assignees || []);
        }
      } catch (err) {
        console.error("Error loading workload:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [portfolioId]);

  // Adapt column width to window size so longer ranges still fit
  // legibly on wide screens.
  const dayPx = windowSize === 7 ? 96 : windowSize === 14 ? 72 : 48;

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < windowSize; i++) arr.push(addDays(anchor, i));
    return arr;
  }, [anchor, windowSize]);

  // counts[`${assigneeId}|${dayIdx}`] = number of open tasks due that day
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = startOfDay(new Date(t.dueDate));
      const idx = Math.round(
        (d.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (idx < 0 || idx >= windowSize) continue;
      const key = `${t.assigneeId || "_unassigned"}|${idx}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [tasks, anchor, windowSize]);

  // Visible rows: only assignees who have at least one task in the
  // window. Unassigned bucket appears at the bottom if it has any.
  const visibleAssignees = useMemo(() => {
    const seen = new Set<string>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = startOfDay(new Date(t.dueDate));
      const idx = Math.round(
        (d.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (idx < 0 || idx >= windowSize) continue;
      seen.add(t.assigneeId || "_unassigned");
    }
    const list: (Assignee & { isUnassigned?: boolean })[] = assignees
      .filter((a) => seen.has(a.id))
      // Show assigned users first by name
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (seen.has("_unassigned")) {
      list.push({
        id: "_unassigned",
        name: "Unassigned",
        email: null,
        image: null,
        isUnassigned: true,
      });
    }
    return list;
  }, [tasks, assignees, anchor, windowSize]);

  // Per-row totals so we can show a quick aggregate at the right of
  // each row (and tag overloads).
  const rowTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of visibleAssignees) {
      let sum = 0;
      for (let i = 0; i < windowSize; i++) {
        sum += counts.get(`${a.id}|${i}`) || 0;
      }
      map.set(a.id, sum);
    }
    return map;
  }, [visibleAssignees, counts, windowSize]);

  const today = startOfDay(new Date());
  const totalPx = windowSize * dayPx;
  const LEFT_PX = 260;
  const TOTAL_COL_PX = 64;

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 md:px-4 py-2.5 border-b">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setAnchor(addDays(anchor, -windowSize))}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setAnchor(startOfDay(new Date()))}
        >
          <Calendar className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Today</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setAnchor(addDays(anchor, windowSize))}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="hidden lg:inline text-[11px] text-gray-500 ml-2">
          Open tasks per assignee per day, across this portfolio.
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Date range selector */}
          <Select
            value={String(windowSize)}
            onValueChange={(v) => setWindowSize(Number(v) as WindowSize)}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">1 week</SelectItem>
              <SelectItem value="14">2 weeks</SelectItem>
              <SelectItem value="30">1 month</SelectItem>
            </SelectContent>
          </Select>

          {/* Unit selector (placeholder — only Tasks for now) */}
          <Select value="tasks" onValueChange={() => {}}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tasks">Tasks</SelectItem>
              <SelectItem value="hours" disabled>
                Hours (soon)
              </SelectItem>
              <SelectItem value="points" disabled>
                Points (soon)
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="hidden md:block w-px h-5 bg-gray-200 mx-1" />

          <ToolbarChip
            icon={<Filter className="h-3.5 w-3.5" />}
            label="Filter"
          />
          <ToolbarChip
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Group"
          />
          <ToolbarChip
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            label="Options"
          />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : visibleAssignees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <CalendarRange className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-black mb-1">
            No tasks with assignees and due dates in this window
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Assign tasks and add due dates to see workload distribution across
            the {projectCount}{" "}
            {projectCount === 1 ? "project" : "projects"} in this portfolio.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="relative"
            style={{ minWidth: LEFT_PX + totalPx + TOTAL_COL_PX }}
          >
            {/* Header */}
            <div className="flex border-b bg-gray-50/60 sticky top-0 z-10">
              <div
                className="flex-shrink-0 border-r px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center"
                style={{ width: LEFT_PX }}
              >
                Assignee
              </div>
              <div className="flex">
                {days.map((d, i) => {
                  const isToday = sameDay(d, today);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "border-r flex flex-col items-center justify-center px-1 py-1.5",
                        isWeekend && "bg-gray-50/80",
                        isToday && "bg-[#c9a84c]/10"
                      )}
                      style={{ width: dayPx }}
                    >
                      <span
                        className={cn(
                          "text-[10px] uppercase font-medium",
                          isToday
                            ? "text-[#a8893a]"
                            : isWeekend
                              ? "text-gray-400"
                              : "text-gray-500"
                        )}
                      >
                        {DAY_NAMES[d.getDay()]}
                      </span>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          isToday
                            ? "text-[#a8893a] font-semibold"
                            : "text-gray-700"
                        )}
                      >
                        {MONTH_NAMES[d.getMonth()]} {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                className="flex-shrink-0 border-l px-2 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center justify-center"
                style={{ width: TOTAL_COL_PX }}
              >
                Total
              </div>
            </div>

            {/* Rows */}
            {visibleAssignees.map((a) => {
              const rowTotal = rowTotals.get(a.id) || 0;
              const rowOverloaded = rowTotal > windowSize * 2; // arbitrary
              return (
                <div
                  key={a.id}
                  className="flex border-b last:border-0 hover:bg-gray-50"
                >
                  <div
                    className="flex-shrink-0 border-r px-4 flex items-center gap-3 py-2.5"
                    style={{ width: LEFT_PX }}
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={a.image || ""} />
                      <AvatarFallback
                        className={cn(
                          "text-xs",
                          a.isUnassigned
                            ? "bg-gray-100 text-gray-500"
                            : "bg-gray-200 text-gray-700"
                        )}
                      >
                        {a.isUnassigned ? "?" : (a.name || "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-sm truncate",
                          a.isUnassigned
                            ? "text-gray-500 italic"
                            : "text-black"
                        )}
                      >
                        {a.name || a.email || "Unknown"}
                      </div>
                      {a.jobTitle && !a.isUnassigned && (
                        <div className="text-[11px] text-gray-500 truncate">
                          {a.jobTitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex">
                    {days.map((d, i) => {
                      const c = counts.get(`${a.id}|${i}`) || 0;
                      const isToday = sameDay(d, today);
                      const isWeekend =
                        d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <WorkloadCell
                          key={i}
                          count={c}
                          width={dayPx}
                          isToday={isToday}
                          isWeekend={isWeekend}
                        />
                      );
                    })}
                  </div>
                  <div
                    className="flex-shrink-0 border-l flex items-center justify-center text-xs tabular-nums"
                    style={{ width: TOTAL_COL_PX }}
                  >
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-md",
                        rowOverloaded
                          ? "bg-amber-100 text-amber-800 font-semibold"
                          : rowTotal > 0
                            ? "text-black font-medium"
                            : "text-gray-300"
                      )}
                    >
                      {rowTotal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────── */}
      {!loading && visibleAssignees.length > 0 && (
        <div className="px-4 py-2 text-[11px] text-gray-500 border-t bg-gray-50/40 flex items-center gap-3 flex-wrap">
          <span className="font-medium text-gray-600">Load</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
            None
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-100" />
            Light (1–2)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#c9a84c]/40" />
            Normal (3–4)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#a8893a]/70" />
            High (5+)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500/80" />
            Overloaded (8+)
          </span>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────

function WorkloadCell({
  count,
  width,
  isToday,
  isWeekend,
}: {
  count: number;
  width: number;
  isToday: boolean;
  isWeekend: boolean;
}) {
  // Cell intensity buckets — pills, not heatmap blobs.
  let pillClass = "";
  let textClass = "text-gray-300";
  if (count === 0) {
    // empty — leave muted
  } else if (count <= 2) {
    pillClass = "bg-gray-100";
    textClass = "text-gray-700";
  } else if (count <= 4) {
    pillClass = "bg-[#c9a84c]/40";
    textClass = "text-[#7a6428] font-medium";
  } else if (count <= 7) {
    pillClass = "bg-[#a8893a]/70";
    textClass = "text-white font-semibold";
  } else {
    pillClass = "bg-amber-500/80";
    textClass = "text-white font-semibold";
  }

  return (
    <div
      className={cn(
        "border-r flex items-center justify-center",
        isWeekend && "bg-gray-50/40",
        isToday && !isWeekend && "bg-[#c9a84c]/5"
      )}
      style={{ width, height: 44 }}
    >
      {count > 0 ? (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-7 h-6 px-2 rounded-md text-xs tabular-nums",
            pillClass,
            textClass
          )}
        >
          {count}
        </span>
      ) : (
        <span className={cn("text-[11px] tabular-nums", textClass)}>0</span>
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
