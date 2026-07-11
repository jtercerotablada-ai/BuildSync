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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WorkloadTask {
  id: string;
  name: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  completed: boolean;
  projectId: string | null;
  taskStatus: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | null;
  priority: string;
  /** Sum of estimatedMin across TIME_TRACKING fields on the task (minutes). */
  estimatedMinutes: number;
}

interface Assignee {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  jobTitle?: string | null;
}

interface ProjectRef {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  /** Portfolio mode: fetch that portfolio's cross-project workload. */
  portfolioId?: string;
  /** Project mode: fetch a single project's workload (assignee grouping only). */
  projectId?: string;
  projectCount?: number;
}

type WindowSize = 7 | 14 | 30;
type Measure = "tasks" | "hours";
type GroupBy = "assignee" | "project";

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

const STATUS_LABELS: Record<string, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  __none: "No status",
};

const UNASSIGNED = "_unassigned";
const NO_PROJECT = "_noproject";

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

/** Round to one decimal for hour display without trailing ".0" noise. */
function fmtHours(mins: number): string {
  const h = mins / 60;
  if (h === 0) return "0";
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function PortfolioWorkloadView({
  portfolioId,
  projectId,
  projectCount,
}: Props) {
  // Two modes share this component: a portfolio's cross-project workload, or
  // a single project's. Only the fetch endpoint + a couple of project-grouping
  // affordances differ.
  const singleProject = !!projectId;
  const endpoint = projectId
    ? `/api/projects/${projectId}/workload`
    : `/api/portfolios/${portfolioId}/workload`;

  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [windowSize, setWindowSize] = useState<WindowSize>(14);
  const [measure, setMeasure] = useState<Measure>("tasks");
  const [tasks, setTasks] = useState<WorkloadTask[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Toolbar state ──────────────────────────────────────────
  const [groupBy, setGroupBy] = useState<GroupBy>("assignee");
  // Filters: empty set = "no filter" (show all). A populated set keeps
  // only rows whose value is in the set.
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());
  const [projectFilter, setProjectFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  // Options.
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [showEmptyRows, setShowEmptyRows] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(endpoint);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTasks(data.tasks || []);
          setAssignees(data.assignees || []);
          setProjects(data.projects || []);
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
  }, [endpoint]);

  // Adapt column width to window size so longer ranges still fit
  // legibly on wide screens.
  const dayPx = windowSize === 7 ? 96 : windowSize === 14 ? 72 : 48;

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < windowSize; i++) arr.push(addDays(anchor, i));
    return arr;
  }, [anchor, windowSize]);

  const projectNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  // Apply the Filter dropdown selections. Empty set = pass-through.
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (
        assigneeFilter.size > 0 &&
        !assigneeFilter.has(t.assigneeId || UNASSIGNED)
      )
        return false;
      if (
        projectFilter.size > 0 &&
        !projectFilter.has(t.projectId || NO_PROJECT)
      )
        return false;
      if (statusFilter.size > 0 && !statusFilter.has(t.taskStatus || "__none"))
        return false;
      return true;
    });
  }, [tasks, assigneeFilter, projectFilter, statusFilter]);

  // The value a task contributes to a cell: 1 task, or its estimated
  // minutes (converted to hours at render time).
  const taskValue = (t: WorkloadTask) =>
    measure === "hours" ? t.estimatedMinutes : 1;

  // counts[`${rowId}|${dayIdx}`] = summed measure value that day.
  // In "hours" mode the accumulated value is in MINUTES; we divide by 60
  // only for display so the running totals stay exact.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTasks) {
      if (!t.dueDate) continue;
      const d = startOfDay(new Date(t.dueDate));
      const idx = Math.round(
        (d.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (idx < 0 || idx >= windowSize) continue;
      const rowId =
        groupBy === "project"
          ? t.projectId || NO_PROJECT
          : t.assigneeId || UNASSIGNED;
      const key = `${rowId}|${idx}`;
      map.set(key, (map.get(key) || 0) + taskValue(t));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, anchor, windowSize, measure, groupBy]);

  // Row descriptors (assignee or project depending on groupBy).
  interface RowMeta {
    id: string;
    name: string;
    email: string | null;
    image: string | null;
    jobTitle?: string | null;
    isUnassigned?: boolean;
    isProject?: boolean;
    color?: string | null;
  }

  const allRows: RowMeta[] = useMemo(() => {
    if (groupBy === "project") {
      const rows: RowMeta[] = projects.map((p) => ({
        id: p.id,
        name: p.name,
        email: null,
        image: null,
        isProject: true,
        color: p.color,
      }));
      rows.push({
        id: NO_PROJECT,
        name: "No project",
        email: null,
        image: null,
        isProject: true,
        isUnassigned: true,
      });
      return rows;
    }
    const rows: RowMeta[] = assignees.map((a) => ({
      id: a.id,
      name: a.name || a.email || "Unknown",
      email: a.email,
      image: a.image,
      jobTitle: a.jobTitle,
    }));
    rows.push({
      id: UNASSIGNED,
      name: "Unassigned",
      email: null,
      image: null,
      isUnassigned: true,
    });
    return rows;
  }, [groupBy, assignees, projects]);

  // Visible rows: those with at least one task in the window (unless
  // "show empty rows" is on). Unassigned/No-project bucket respects the
  // showUnassigned option and always sorts to the bottom.
  const visibleRows = useMemo(() => {
    const inWindow = new Set<string>();
    for (const t of filteredTasks) {
      if (!t.dueDate) continue;
      const d = startOfDay(new Date(t.dueDate));
      const idx = Math.round(
        (d.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (idx < 0 || idx >= windowSize) continue;
      inWindow.add(
        groupBy === "project"
          ? t.projectId || NO_PROJECT
          : t.assigneeId || UNASSIGNED
      );
    }
    const named = allRows
      .filter((r) => !r.isUnassigned)
      .filter((r) => showEmptyRows || inWindow.has(r.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const bucketId = groupBy === "project" ? NO_PROJECT : UNASSIGNED;
    const bucket = allRows.find((r) => r.id === bucketId);
    if (
      bucket &&
      showUnassigned &&
      (showEmptyRows || inWindow.has(bucketId))
    ) {
      named.push(bucket);
    }
    return named;
  }, [
    filteredTasks,
    allRows,
    anchor,
    windowSize,
    groupBy,
    showUnassigned,
    showEmptyRows,
  ]);

  // Per-row totals (for the right-hand aggregate + overload tag).
  const rowTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of visibleRows) {
      let sum = 0;
      for (let i = 0; i < windowSize; i++) {
        sum += counts.get(`${r.id}|${i}`) || 0;
      }
      map.set(r.id, sum);
    }
    return map;
  }, [visibleRows, counts, windowSize]);

  const today = startOfDay(new Date());
  const totalPx = windowSize * dayPx;
  const LEFT_PX = 260;
  const TOTAL_COL_PX = 72;

  // Active-filter count for the chip badge.
  const activeFilterCount =
    (assigneeFilter.size > 0 ? 1 : 0) +
    (projectFilter.size > 0 ? 1 : 0) +
    (statusFilter.size > 0 ? 1 : 0);
  const optionsChanged = !showUnassigned || showEmptyRows;

  // Distinct statuses present in the data (for the status filter list).
  const statusesInData = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) s.add(t.taskStatus || "__none");
    return Array.from(s);
  }, [tasks]);

  const toggleInSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          {measure === "hours" ? "Estimated hours" : "Open tasks"} per{" "}
          {groupBy === "project" ? "project" : "assignee"} per day, across this{" "}
          {singleProject ? "project" : "portfolio"}.
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

          {/* Measure selector — really switches count vs hours */}
          <Select
            value={measure}
            onValueChange={(v) => setMeasure(v as Measure)}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tasks">Task count</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
            </SelectContent>
          </Select>

          <div className="hidden md:block w-px h-5 bg-gray-200 mx-1" />

          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "hidden md:inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md",
                  activeFilterCount > 0
                    ? "text-[#a8893a] bg-[#c9a84c]/10 hover:bg-[#c9a84c]/20"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[#a8893a] text-white text-[10px]">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-60 max-h-[70vh] overflow-y-auto"
            >
              <DropdownMenuLabel>Assignee</DropdownMenuLabel>
              {assignees.length === 0 && (
                <div className="px-2 py-1 text-xs text-gray-400">
                  No assignees
                </div>
              )}
              {assignees.map((a) => (
                <DropdownMenuCheckboxItem
                  key={a.id}
                  checked={assigneeFilter.has(a.id)}
                  onCheckedChange={() => toggleInSet(setAssigneeFilter, a.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {a.name || a.email || "Unknown"}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuCheckboxItem
                checked={assigneeFilter.has(UNASSIGNED)}
                onCheckedChange={() => toggleInSet(setAssigneeFilter, UNASSIGNED)}
                onSelect={(e) => e.preventDefault()}
              >
                Unassigned
              </DropdownMenuCheckboxItem>

              {!singleProject && projects.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Project</DropdownMenuLabel>
                  {projects.map((p) => (
                    <DropdownMenuCheckboxItem
                      key={p.id}
                      checked={projectFilter.has(p.id)}
                      onCheckedChange={() => toggleInSet(setProjectFilter, p.id)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {p.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {statusesInData.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={statusFilter.has(s)}
                  onCheckedChange={() => toggleInSet(setStatusFilter, s)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {STATUS_LABELS[s] ?? s}
                </DropdownMenuCheckboxItem>
              ))}

              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    type="button"
                    onClick={() => {
                      setAssigneeFilter(new Set());
                      setProjectFilter(new Set());
                      setStatusFilter(new Set());
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-sm"
                  >
                    Clear all filters
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hidden md:inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Group</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Group rows by</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={groupBy}
                onValueChange={(v) => setGroupBy(v as GroupBy)}
              >
                <DropdownMenuRadioItem value="assignee">
                  Assignee
                </DropdownMenuRadioItem>
                {!singleProject && (
                  <DropdownMenuRadioItem value="project">
                    Project
                  </DropdownMenuRadioItem>
                )}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "hidden md:inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md",
                  optionsChanged
                    ? "text-[#a8893a] bg-[#c9a84c]/10 hover:bg-[#c9a84c]/20"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Options</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Display options</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={showUnassigned}
                onCheckedChange={(c) => setShowUnassigned(!!c)}
                onSelect={(e) => e.preventDefault()}
              >
                Show {groupBy === "project" ? "no-project" : "unassigned"} row
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showEmptyRows}
                onCheckedChange={(c) => setShowEmptyRows(!!c)}
                onSelect={(e) => e.preventDefault()}
              >
                Show rows with no tasks in range
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <CalendarRange className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-base font-medium text-black mb-1">
            {activeFilterCount > 0
              ? "No tasks match the current filters"
              : measure === "hours"
                ? "No estimated hours in this window"
                : "No tasks with due dates in this window"}
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            {measure === "hours"
              ? "Add time-tracking estimates and due dates to tasks to see hours distributed across "
              : "Assign tasks and add due dates to see workload distribution across "}
            {singleProject
              ? "this project."
              : `the ${projectCount ?? 0} ${
                  projectCount === 1 ? "project" : "projects"
                } in this portfolio.`}
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
                {groupBy === "project" ? "Project" : "Assignee"}
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
                {measure === "hours" ? "Total h" : "Total"}
              </div>
            </div>

            {/* Rows */}
            {visibleRows.map((a) => {
              const rowTotal = rowTotals.get(a.id) || 0;
              // Overload threshold scales with the measure. Tasks: >2/day
              // avg over the window. Hours: >6h/day avg (≈overbooked).
              const overloadTotal =
                measure === "hours" ? windowSize * 6 * 60 : windowSize * 2;
              const rowOverloaded = rowTotal > overloadTotal;
              return (
                <div
                  key={a.id}
                  className="flex border-b last:border-0 hover:bg-gray-50"
                >
                  <div
                    className="flex-shrink-0 border-r px-4 flex items-center gap-3 py-2.5"
                    style={{ width: LEFT_PX }}
                  >
                    {a.isProject ? (
                      <span
                        className="h-7 w-7 flex-shrink-0 rounded-md flex items-center justify-center text-xs font-semibold text-white"
                        style={{
                          backgroundColor: a.isUnassigned
                            ? "#e5e7eb"
                            : a.color || "#94a3b8",
                          color: a.isUnassigned ? "#6b7280" : "#fff",
                        }}
                      >
                        {a.isUnassigned ? "?" : (a.name || "?").charAt(0)}
                      </span>
                    ) : (
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
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-sm truncate",
                          a.isUnassigned
                            ? "text-gray-500 italic"
                            : "text-black"
                        )}
                      >
                        {a.name}
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
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <WorkloadCell
                          key={i}
                          rawValue={c}
                          measure={measure}
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
                      {measure === "hours" ? fmtHours(rowTotal) : rowTotal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────── */}
      {!loading && visibleRows.length > 0 && (
        <div className="px-4 py-2 text-[11px] text-gray-500 border-t bg-gray-50/40 flex items-center gap-3 flex-wrap">
          <span className="font-medium text-gray-600">Load</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
            None
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-100" />
            {measure === "hours" ? "Light (≤2h)" : "Light (1–2)"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#c9a84c]/40" />
            {measure === "hours" ? "Normal (2–4h)" : "Normal (3–4)"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#a8893a]/70" />
            {measure === "hours" ? "High (4–8h)" : "High (5+)"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500/80" />
            {measure === "hours" ? "Overloaded (8h+)" : "Overloaded (8+)"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────

function WorkloadCell({
  rawValue,
  measure,
  width,
  isToday,
  isWeekend,
}: {
  /** Task count, or accumulated MINUTES when measure === 'hours'. */
  rawValue: number;
  measure: Measure;
  width: number;
  isToday: boolean;
  isWeekend: boolean;
}) {
  // Normalize to a comparable "intensity" number, then bucket. For tasks
  // it's the count; for hours it's the hours-per-day (minutes / 60).
  const intensity = measure === "hours" ? rawValue / 60 : rawValue;
  // Bucket thresholds per measure.
  const t1 = measure === "hours" ? 2 : 2; // light upper
  const t2 = measure === "hours" ? 4 : 4; // normal upper
  const t3 = measure === "hours" ? 8 : 7; // high upper

  let pillClass = "";
  let textClass = "text-gray-300";
  if (intensity <= 0) {
    // empty — leave muted
  } else if (intensity <= t1) {
    pillClass = "bg-gray-100";
    textClass = "text-gray-700";
  } else if (intensity <= t2) {
    pillClass = "bg-[#c9a84c]/40";
    textClass = "text-[#7a6428] font-medium";
  } else if (intensity <= t3) {
    pillClass = "bg-[#a8893a]/70";
    textClass = "text-white font-semibold";
  } else {
    pillClass = "bg-amber-500/80";
    textClass = "text-white font-semibold";
  }

  const display =
    measure === "hours" ? fmtHours(rawValue) : String(rawValue);
  const hasValue = intensity > 0;

  return (
    <div
      className={cn(
        "border-r flex items-center justify-center",
        isWeekend && "bg-gray-50/40",
        isToday && !isWeekend && "bg-[#c9a84c]/5"
      )}
      style={{ width, height: 44 }}
    >
      {hasValue ? (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-7 h-6 px-2 rounded-md text-xs tabular-nums",
            pillClass,
            textClass
          )}
        >
          {display}
          {measure === "hours" && (
            <span className="ml-0.5 text-[9px] opacity-80">h</span>
          )}
        </span>
      ) : (
        <span className={cn("text-[11px] tabular-nums", textClass)}>0</span>
      )}
    </div>
  );
}
