"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const DAYS_VISIBLE = 14;
const DAY_PX = 60;

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

export function PortfolioWorkloadView({ portfolioId, projectCount }: Props) {
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [tasks, setTasks] = useState<WorkloadTask[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/portfolios/${portfolioId}/workload`
        );
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

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < DAYS_VISIBLE; i++) arr.push(addDays(anchor, i));
    return arr;
  }, [anchor]);

  // Build a counts map: key = `${assigneeId}|${dayIndex}` → number
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (!t.dueDate || !t.assigneeId) continue;
      const d = startOfDay(new Date(t.dueDate));
      const idx = Math.round(
        (d.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (idx < 0 || idx >= DAYS_VISIBLE) continue;
      const key = `${t.assigneeId}|${idx}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [tasks, anchor]);

  // Visible assignees: only those with at least one task in window OR all of them?
  // Better: show all assignees that appear in tasks in this window, plus an
  // "Unassigned" row for tasks with no owner.
  const visibleAssignees = useMemo(() => {
    const seen = new Set<string>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = startOfDay(new Date(t.dueDate));
      const idx = Math.round(
        (d.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (idx < 0 || idx >= DAYS_VISIBLE) continue;
      seen.add(t.assigneeId || "_unassigned");
    }
    const list: (Assignee & { isUnassigned?: boolean })[] = assignees.filter(
      (a) => seen.has(a.id)
    );
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
  }, [tasks, assignees, anchor]);

  const maxCount = useMemo(() => {
    let max = 1;
    counts.forEach((v) => {
      if (v > max) max = v;
    });
    return max;
  }, [counts]);

  const totalPx = DAYS_VISIBLE * DAY_PX;
  const today = startOfDay(new Date());

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="flex items-center gap-2 px-3 md:px-4 py-3 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchor(addDays(anchor, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchor(startOfDay(new Date()))}
        >
          <Calendar className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Today</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchor(addDays(anchor, 7))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-gray-500 ml-2 hidden md:block">
          Open tasks per assignee per day, across {projectCount}{" "}
          {projectCount === 1 ? "project" : "projects"} in this portfolio.
        </span>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 260 + totalPx }}>
            {/* Header row */}
            <div className="flex border-b bg-gray-50/60">
              <div className="w-64 flex-shrink-0 border-r px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                        "border-r flex flex-col items-center justify-center px-2 py-1",
                        isWeekend && "bg-gray-50/80",
                        isToday && "bg-[#c9a84c]/10"
                      )}
                      style={{ width: DAY_PX }}
                    >
                      <span
                        className={cn(
                          "text-[10px] uppercase",
                          isToday ? "text-[#a8893a] font-semibold" : "text-gray-500"
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
            </div>

            {/* Rows */}
            {visibleAssignees.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">
                No tasks with assignees and due dates in this 2-week window.
              </div>
            ) : (
              visibleAssignees.map((a) => (
                <div key={a.id} className="flex border-b last:border-0">
                  <div className="w-64 flex-shrink-0 border-r px-4 flex items-center gap-3 py-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={a.image || ""} />
                      <AvatarFallback className="text-xs bg-gray-200">
                        {(a.name || "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm text-black truncate">
                        {a.name || a.email || "Unknown"}
                      </div>
                      {a.jobTitle && (
                        <div className="text-[11px] text-gray-500 truncate">
                          {a.jobTitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex">
                    {days.map((_d, i) => {
                      const key = `${a.id}|${i}`;
                      const c = counts.get(key) || 0;
                      const intensity = c / maxCount;
                      const isWeekend =
                        days[i].getDay() === 0 || days[i].getDay() === 6;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "border-r flex items-center justify-center text-xs tabular-nums",
                            isWeekend && "bg-gray-50/40"
                          )}
                          style={{
                            width: DAY_PX,
                            height: 52,
                            backgroundColor:
                              c > 0
                                ? `rgba(201, 168, 76, ${0.15 + intensity * 0.6})`
                                : undefined,
                            color: c > 0 && intensity > 0.6 ? "white" : "#000",
                          }}
                          title={
                            c > 0
                              ? `${c} task${c === 1 ? "" : "s"} due`
                              : undefined
                          }
                        >
                          {c > 0 ? c : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
