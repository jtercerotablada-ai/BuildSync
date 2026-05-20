"use client";

/**
 * Timesheets MVP — weekly grid for logging billable hours per
 * project, per day. Mirrors Asana's TimesheetPage / TimesheetOverview
 * (Asana Business+) — relevant for engineering / consulting firms.
 *
 * MVP scope (this commit):
 *   - 7-day grid (Mon-Sun) for the current week
 *   - Add rows for any project; each row tracks hours per day
 *   - Total hours per day + per row, week total at top right
 *   - Persistence: localStorage (DB-backed version pending — see
 *     schema.prisma note)
 *   - Prev / Next week + Today button (Asana-style nav)
 *
 * Future (deferred — needs DB):
 *   - TimeEntry model + /api/timesheets endpoints
 *   - Manager approval workflow (DRAFT → SUBMITTED → APPROVED)
 *   - Export to CSV / billing system
 *   - Per-task entries (not just per-project)
 */

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ProjectOption {
  id: string;
  name: string;
  color: string;
}

interface TimesheetEntry {
  id: string;
  projectId: string;
  // hours indexed 0..6 = Mon..Sun
  hours: number[];
  description?: string;
}

interface WeekSnapshot {
  weekStart: string; // ISO date of Monday at 00:00 UTC
  entries: TimesheetEntry[];
}

const STORAGE_KEY = "buildsync-timesheets";

function startOfWeek(date: Date): Date {
  // ISO week — Monday as first day. Returns 00:00 local of that Monday.
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Sunday is 0 in JS; we want Sunday-as-last so dayOffset = (day + 6) % 7
  const offset = (day + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function formatDayShort(date: Date): string {
  return date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
}

function formatDayNumber(date: Date): string {
  return date.getDate().toString();
}

function formatRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const startMonth = weekStart.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

function loadAllSnapshots(): Record<string, WeekSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, WeekSnapshot>;
  } catch {
    return {};
  }
}

function saveAllSnapshots(snapshots: Record<string, WeekSnapshot>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // quota or private mode — surface silently
  }
}

export default function TimesheetsPage() {
  useSession();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  const weekKey = useMemo(() => weekStart.toISOString().slice(0, 10), [weekStart]);

  // Fetch projects for the row picker
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (res.ok && !cancelled) {
          const data = await res.json();
          // Defensive: API can return varying shapes; pick what we need
          const mapped: ProjectOption[] = (Array.isArray(data) ? data : []).map(
            (p: { id: string; name: string; color?: string }) => ({
              id: p.id,
              name: p.name,
              color: p.color || "#c9a84c",
            })
          );
          setProjects(mapped);
        }
      } catch {
        // ignore — empty project list is acceptable
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load entries for the visible week from localStorage
  useEffect(() => {
    const all = loadAllSnapshots();
    const snap = all[weekKey];
    setEntries(snap?.entries ?? []);
  }, [weekKey]);

  // Persist entries when they change
  useEffect(() => {
    const all = loadAllSnapshots();
    all[weekKey] = { weekStart: weekKey, entries };
    saveAllSnapshots(all);
  }, [entries, weekKey]);

  const days = useMemo<Date[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const totalsByDay = useMemo<number[]>(() => {
    return Array.from({ length: 7 }, (_, i) =>
      entries.reduce((acc, e) => acc + (e.hours[i] || 0), 0)
    );
  }, [entries]);

  const totalsByEntry = useMemo<number[]>(() => {
    return entries.map((e) => e.hours.reduce((acc, h) => acc + (h || 0), 0));
  }, [entries]);

  const weekTotal = useMemo<number>(() => {
    return totalsByDay.reduce((acc, h) => acc + h, 0);
  }, [totalsByDay]);

  function addRow() {
    setEntries((prev) => [
      ...prev,
      {
        id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId: projects[0]?.id || "",
        hours: Array(7).fill(0),
      },
    ]);
  }

  function removeRow(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function updateProject(id: string, projectId: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, projectId } : e))
    );
  }

  function updateHours(id: string, dayIdx: number, raw: string) {
    const value = parseFloat(raw);
    const next = Number.isFinite(value) && value >= 0 ? Math.min(value, 24) : 0;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              hours: e.hours.map((h, i) => (i === dayIdx ? next : h)),
            }
          : e
      )
    );
  }

  function goPrevWeek() {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() - 7);
    setWeekStart(d);
  }
  function goNextWeek() {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 7);
    setWeekStart(d);
  }
  function goToday() {
    setWeekStart(startOfWeek(new Date()));
  }

  const todayStr = new Date().toDateString();

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b">
        <h1 className="text-lg md:text-xl font-semibold text-gray-900">
          Timesheets
        </h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="h-8 px-3">
            Today
          </Button>
          <button
            type="button"
            onClick={goPrevWeek}
            aria-label="Previous week"
            className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goNextWeek}
            aria-label="Next week"
            className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-2 text-sm font-medium text-gray-900 tabular-nums">
            {formatRange(weekStart)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Week total</span>
          <span className="text-base font-semibold text-gray-900 tabular-nums">
            {weekTotal.toFixed(1)}h
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          {/* Day headers */}
          <div className="grid grid-cols-[minmax(220px,1.4fr)_repeat(7,minmax(80px,1fr))_80px] bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-medium">
            <div className="px-3 py-2">Project</div>
            {days.map((d, i) => {
              const isToday = d.toDateString() === todayStr;
              return (
                <div
                  key={i}
                  className={cn(
                    "px-2 py-2 text-center border-l border-gray-200",
                    isToday && "bg-[#c9a84c]/10 text-[#a8893a]"
                  )}
                >
                  <div>{formatDayShort(d)}</div>
                  <div className="text-[13px] font-semibold tabular-nums text-gray-700 mt-0.5">
                    {formatDayNumber(d)}
                  </div>
                </div>
              );
            })}
            <div className="px-2 py-2 text-center border-l border-gray-200">
              Total
            </div>
          </div>

          {/* Body rows */}
          {entries.length === 0 ? (
            <div className="grid grid-cols-1 py-16 text-center text-sm text-gray-500">
              <div className="flex flex-col items-center gap-3">
                <Briefcase className="h-10 w-10 text-gray-300" />
                <div>No entries this week.</div>
                <Button
                  size="sm"
                  onClick={addRow}
                  className="bg-black hover:bg-gray-800 text-white gap-1.5"
                  disabled={loading || projects.length === 0}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add row
                </Button>
                {!loading && projects.length === 0 && (
                  <span className="text-xs text-gray-400">
                    Create a project first to log hours against it.
                  </span>
                )}
              </div>
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={entry.id}
                className="grid grid-cols-[minmax(220px,1.4fr)_repeat(7,minmax(80px,1fr))_80px] border-b border-gray-200 last:border-b-0 hover:bg-gray-50/60"
              >
                {/* Project cell */}
                <div className="px-3 py-2 flex items-center gap-2">
                  <Select
                    value={entry.projectId}
                    onValueChange={(v) => updateProject(entry.id, v)}
                  >
                    <SelectTrigger className="h-8 text-sm border-gray-200">
                      <SelectValue placeholder="Pick a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-sm"
                              style={{ backgroundColor: p.color }}
                            />
                            {p.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeRow(entry.id)}
                    aria-label="Remove row"
                    className="h-7 w-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Day cells */}
                {entry.hours.map((h, dayIdx) => {
                  const d = days[dayIdx];
                  const isToday = d.toDateString() === todayStr;
                  return (
                    <div
                      key={dayIdx}
                      className={cn(
                        "border-l border-gray-200 px-1.5 py-1.5",
                        isToday && "bg-[#c9a84c]/5"
                      )}
                    >
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={24}
                        step={0.25}
                        value={h || ""}
                        onChange={(e) =>
                          updateHours(entry.id, dayIdx, e.target.value)
                        }
                        placeholder="0"
                        className="h-8 text-center text-sm tabular-nums border-gray-200 focus-visible:ring-1"
                      />
                    </div>
                  );
                })}

                {/* Row total */}
                <div className="border-l border-gray-200 px-2 flex items-center justify-center text-sm font-medium tabular-nums text-gray-700">
                  {totalsByEntry[idx]?.toFixed(1)}h
                </div>
              </div>
            ))
          )}

          {/* Totals row */}
          {entries.length > 0 && (
            <div className="grid grid-cols-[minmax(220px,1.4fr)_repeat(7,minmax(80px,1fr))_80px] bg-gray-50 border-t border-gray-200 text-sm font-medium">
              <div className="px-3 py-2 text-gray-500 uppercase tracking-wider text-[11px] flex items-center">
                Daily total
              </div>
              {totalsByDay.map((t, i) => (
                <div
                  key={i}
                  className="border-l border-gray-200 px-2 py-2 text-center tabular-nums text-gray-700"
                >
                  {t.toFixed(1)}h
                </div>
              ))}
              <div className="border-l border-gray-200 px-2 py-2 text-center text-gray-900 font-semibold tabular-nums">
                {weekTotal.toFixed(1)}h
              </div>
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={addRow}
              disabled={projects.length === 0}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add row
            </Button>
            <span className="text-xs text-gray-400">
              Entries saved locally · DB sync coming soon
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
