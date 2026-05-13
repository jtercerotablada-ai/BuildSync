"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Plus,
  Filter,
  Settings,
  Diamond,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
  parseISO,
} from "date-fns";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

type TaskType = "TASK" | "MILESTONE" | "APPROVAL";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  startDate?: string | null;
  priority: string;
  taskType?: TaskType | null;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface Section {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

interface CalendarViewProps {
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  projectId: string;
}

type ViewMode = "month" | "week";

// ============================================
// MAIN COMPONENT
// ============================================

export function CalendarView({
  sections,
  onTaskClick,
  projectId,
}: CalendarViewProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? "week" : "month"
  );
  const [isCreatingTask, setIsCreatingTask] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [calFilter, setCalFilter] = useState<"all" | "incomplete" | "completed">("all");
  const [showWeekends, setShowWeekends] = useState(true);

  // Ref-based focus management — the bare `autoFocus` attribute only
  // fires on initial mount, so when the user clicks from one cell's
  // active input to another the input stayed unfocused. The effect
  // below also resets the in-progress name so the new cell doesn't
  // inherit a half-typed task from the previous one (B4).
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (isCreatingTask) {
      setNewTaskName("");
      // requestAnimationFrame so React has actually mounted the
      // input before we try to focus.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isCreatingTask]);

  // Flatten all tasks and apply filter
  const allTasks = useMemo(() => {
    const flat = sections.flatMap((section) =>
      section.tasks.map((task) => ({
        ...task,
        sectionId: section.id,
        sectionName: section.name,
      }))
    );
    if (calFilter === "incomplete") return flat.filter((t) => !t.completed);
    if (calFilter === "completed") return flat.filter((t) => t.completed);
    return flat;
  }, [sections, calFilter]);

  // ============================================
  // GENERATE CALENDAR DAYS
  // ============================================

  const calendarDays = useMemo(() => {
    let days: Date[];
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
    if (!showWeekends) {
      days = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }
    return days;
  }, [currentDate, viewMode, showWeekends]);

  // ============================================
  // WEEK GROUPING + BAR SEGMENT LANE ASSIGNMENT
  // ============================================
  // Build the per-week structure once. Days inside each week become
  // background cells; tasks become bar segments stacked into lanes
  // so multi-day ranges never overlap horizontally — same Asana /
  // my-tasks pattern but kept local to projects' month/week paging.

  const daysPerRow = showWeekends ? 7 : 5;

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += daysPerRow) {
      out.push(calendarDays.slice(i, i + daysPerRow));
    }
    return out;
  }, [calendarDays, daysPerRow]);

  type BarSegment = {
    task: (typeof allTasks)[number];
    colStart: number; // 0-indexed column within the visible week
    colSpan: number;
    lane: number;
    clipsLeft: boolean;
    clipsRight: boolean;
  };

  const segmentsByWeek = useMemo(() => {
    if (weeks.length === 0) return [] as BarSegment[][];
    const out: BarSegment[][] = weeks.map(() => []);

    for (const task of allTasks) {
      if (!task.dueDate && !task.startDate) continue;
      const dueRaw = task.dueDate ? parseISO(task.dueDate) : null;
      const startRaw = task.startDate ? parseISO(task.startDate) : null;
      const start = startRaw ?? dueRaw!;
      const end = dueRaw ?? startRaw!;
      // Normalize to local midnight so day arithmetic stays correct.
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      for (let w = 0; w < weeks.length; w++) {
        const week = weeks[w];
        if (week.length === 0) continue;
        const weekStart = week[0];
        const weekEnd = week[week.length - 1];

        // Skip task entirely outside the visible week.
        if (endDay.getTime() < weekStart.getTime()) continue;
        if (startDay.getTime() > weekEnd.getTime()) continue;

        // Find first matching day index inside the visible week
        // (handles showWeekends=false where Sat/Sun are dropped).
        let colStart = -1;
        let colEnd = -1;
        for (let i = 0; i < week.length; i++) {
          if (isSameDay(week[i], startDay) || week[i].getTime() > startDay.getTime()) {
            if (colStart === -1) colStart = i;
          }
          if (week[i].getTime() <= endDay.getTime()) {
            colEnd = i;
          }
        }
        if (colStart === -1) colStart = 0;
        if (colEnd === -1) continue;
        if (colEnd < colStart) continue;

        out[w].push({
          task,
          colStart,
          colSpan: colEnd - colStart + 1,
          lane: 0,
          clipsLeft: startDay.getTime() < weekStart.getTime(),
          clipsRight: endDay.getTime() > weekEnd.getTime(),
        });
      }
    }

    // Greedy interval lane assignment per week: multi-day bars
    // (colSpan>1) go to lower lanes first, then single-day pills.
    for (const list of out) {
      list.sort((a, b) => {
        const aMulti = a.colSpan > 1 ? 0 : 1;
        const bMulti = b.colSpan > 1 ? 0 : 1;
        if (aMulti !== bMulti) return aMulti - bMulti;
        if (a.colSpan !== b.colSpan) return b.colSpan - a.colSpan;
        if (a.colStart !== b.colStart) return a.colStart - b.colStart;
        return a.task.id.localeCompare(b.task.id);
      });
      const lanes: BarSegment[][] = [];
      for (const seg of list) {
        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
          const overlaps = lanes[i].some(
            (existing) =>
              !(
                seg.colStart + seg.colSpan <= existing.colStart ||
                seg.colStart >= existing.colStart + existing.colSpan
              )
          );
          if (!overlaps) {
            lanes[i].push(seg);
            seg.lane = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          lanes.push([seg]);
          seg.lane = lanes.length - 1;
        }
      }
    }

    return out;
  }, [allTasks, weeks]);

  // ============================================
  // NAVIGATION
  // ============================================

  const goToPrev = () =>
    setCurrentDate(viewMode === "week" ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  const goToNext = () =>
    setCurrentDate(viewMode === "week" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // ============================================
  // CREATE TASK
  // ============================================

  const handleCreateTask = async (dateStr: string) => {
    if (!newTaskName.trim()) {
      setIsCreatingTask(null);
      setNewTaskName("");
      return;
    }

    try {
      const firstSection = sections[0];
      if (!firstSection) {
        toast.error("No section available to add task");
        return;
      }

      // Build a local-midnight Date for the picked day. Using
      // `new Date("2026-05-13")` parses as UTC midnight, which in
      // negative-UTC timezones (Miami / America/New_York is UTC-4)
      // converts to "the day before" 8pm — the task would land on
      // the previous day on the calendar. Splitting the yyyy-MM-dd
      // string and constructing Date with explicit local components
      // pins the dueDate to the calendar day the user clicked.
      const [y, m, d] = dateStr.split("-").map(Number);
      const localMidnight = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          projectId,
          sectionId: firstSection.id,
          dueDate: localMidnight.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create task");
      }

      toast.success("Task created");
      router.refresh();
      setNewTaskName("");
      setIsCreatingTask(null);
    } catch {
      toast.error("Failed to create task");
    }
  };

  // ============================================
  // RENDER
  // ============================================

  const weekDays = showWeekends
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const gridCols = showWeekends
    ? "grid-cols-[1fr_1fr_1fr_1fr_1fr_0.7fr_0.7fr]"
    : "grid-cols-5";

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Navigation toolbar - centered like My Tasks */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-2 px-2 md:px-4 py-2 md:py-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrev}
          className="h-10 w-10 md:h-8 md:w-8"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          className="px-3"
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          className="h-10 w-10 md:h-8 md:w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="font-medium text-black ml-2 text-base md:text-lg">
          {viewMode === "week"
            ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`
            : format(currentDate, "MMMM yyyy")}
        </span>

        {/* Extra controls - subtle, right-aligned */}
        <div className="ml-auto flex items-center gap-1">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "px-2 py-0.5 text-xs font-medium rounded transition-colors",
                viewMode === "week"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "px-2 py-0.5 text-xs font-medium rounded transition-colors",
                viewMode === "month"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Month
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5 mr-1" />
                {calFilter !== "all" ? (calFilter === "incomplete" ? "Incomplete" : "Completed") : "Filter"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCalFilter("all")}>All tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCalFilter("incomplete")}>Incomplete tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCalFilter("completed")}>Completed tasks</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500">
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowWeekends(!showWeekends)}>
                {showWeekends ? "Hide weekends" : "Show weekends"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Week Day Headers — sticky so they stay visible while
          scrolling through long months. */}
      <div
        className={cn(
          "grid border-b sticky top-0 z-20 bg-white",
          gridCols
        )}
      >
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              "py-1 md:py-2 text-center text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider border-r last:border-r-0",
              showWeekends && index >= 5 && "bg-white"
            )}
          >
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar — per-week containers with VARIABLE heights based
          on how many lanes each individual week actually needs. Each
          row stacks two grids:
            (a) BACKGROUND day grid — borders, weekend tint, today
                tint, day number, hit-target for quick-add.
            (b) FOREGROUND bar overlay — solid gold pills via CSS
                grid spanning. The inline add input lives in this
                grid too as "the next bar" in the lane stack.
          Matches the my-tasks calendar treatment (Asana-style). */}
      <div className="flex-1 overflow-auto">
        {weeks.map((week, weekIdx) => {
          const segments = segmentsByWeek[weekIdx] || [];
          const isWeek = viewMode === "week";

          // Per-week lane cap. Anything over this collapses into the
          // "+N more" popover. Week view gets a generous 30 lanes
          // because the user opted in to see everything in detail;
          // month view caps at 6 so a busy week doesn't blow up the
          // row height.
          const MAX_LANES = isWeek ? 30 : 6;

          // Visible segments are the ones that fit in MAX_LANES;
          // anything past goes into +N more for the columns it
          // would have covered.
          const visibleSegments = segments.filter(
            (s) => s.lane < MAX_LANES
          );
          const hiddenByCol: Record<number, number> = {};
          const hiddenTasksByCol: Record<number, Task[]> = {};
          for (const s of segments) {
            if (s.lane >= MAX_LANES) {
              for (let c = s.colStart; c < s.colStart + s.colSpan; c++) {
                hiddenByCol[c] = (hiddenByCol[c] || 0) + 1;
                if (!hiddenTasksByCol[c]) hiddenTasksByCol[c] = [];
                if (
                  !hiddenTasksByCol[c].some((t) => t.id === s.task.id)
                ) {
                  hiddenTasksByCol[c].push(s.task);
                }
              }
            }
          }

          // Per-column deepest lane (used both for the variable
          // week-height calc AND for placing the +N more pill /
          // inline-add input at "the next free lane" in that column.
          const columnMaxLane: number[] = Array(week.length).fill(-1);
          for (const s of visibleSegments) {
            for (let c = s.colStart; c < s.colStart + s.colSpan; c++) {
              if (s.lane > columnMaxLane[c]) columnMaxLane[c] = s.lane;
            }
          }

          // Which column is currently in add-mode in this week?
          const addingColIndex =
            isCreatingTask &&
            week.some((d) => format(d, "yyyy-MM-dd") === isCreatingTask)
              ? week.findIndex(
                  (d) => format(d, "yyyy-MM-dd") === isCreatingTask
                )
              : -1;

          // Place the +N more pill and the inline-add input on the
          // SAME column's next free lane. If both would land at the
          // same row, the input goes one row LOWER so they don't
          // collide. We compute both lane values up front so the
          // weekHeight calc below knows the true deepest row.
          const moreLaneByCol: Record<number, number> = {};
          for (let c = 0; c < week.length; c++) {
            if (hiddenByCol[c] && hiddenByCol[c] > 0) {
              moreLaneByCol[c] = (columnMaxLane[c] ?? -1) + 1;
            }
          }
          const addingLane =
            addingColIndex >= 0
              ? moreLaneByCol[addingColIndex] !== undefined
                ? // Another row past the +N more pill so they stack
                  // cleanly instead of overlapping (B2 fix).
                  moreLaneByCol[addingColIndex] + 1
                : (columnMaxLane[addingColIndex] ?? -1) + 1
              : 0;

          // Walk every column: its bottom row is its deepest lane,
          // bumped one more if a +N more pill needs to sit there,
          // and bumped AGAIN if the inline-add input lives in this
          // column (so the row never overflows the weekHeight — B3
          // fix). Then derive total content height.
          let maxRow = -1;
          for (let c = 0; c < week.length; c++) {
            let bottom = columnMaxLane[c];
            if (moreLaneByCol[c] !== undefined) {
              bottom = moreLaneByCol[c];
            }
            if (c === addingColIndex && addingLane > bottom) {
              bottom = addingLane;
            }
            if (bottom > maxRow) maxRow = bottom;
          }

          // 4px top padding (above day number) + 22px day number row
          // + (maxRow + 1) × 22px lane height + 10px bottom breathing.
          const DAY_HEADER_PX = 26;
          const LANE_PX = 22;
          const ROW_BOTTOM_PX = 10;
          const ROW_MIN_PX = isWeek ? 400 : 90;
          const contentPx =
            maxRow >= 0
              ? DAY_HEADER_PX + (maxRow + 1) * LANE_PX + ROW_BOTTOM_PX
              : ROW_MIN_PX;
          const weekHeight = Math.max(ROW_MIN_PX, contentPx);

          return (
            <div
              key={weekIdx}
              className="relative border-b border-slate-200"
              style={{ height: weekHeight }}
            >
              {/* Background day grid */}
              <div className={cn("grid h-full", gridCols)}>
                {week.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);
                  const dayOfWeek = day.getDay();
                  const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                  const dayNum = day.getDate();
                  const isFirstOfMonth = dayNum === 1;
                  const isAdding = isCreatingTask === dateStr;

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "border-r last:border-r-0 relative h-full",
                        !isCurrentMonth && !isWeek && "bg-slate-50/40",
                        isWeekendDay && showWeekends && isCurrentMonth && "bg-slate-50/20",
                        isCurrentDay && "bg-[#c9a84c]/5",
                        isAdding &&
                          "ring-2 ring-[#c9a84c]/60 ring-inset",
                        !isAdding &&
                          "cursor-pointer hover:bg-[#c9a84c]/[0.04]"
                      )}
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setIsCreatingTask(dateStr);
                        }
                      }}
                    >
                      {/* Day number — pinned to top-left, above the bar
                          area, pointer-events:none so the bar overlay
                          catches the click cleanly. */}
                      <div className="px-2 pt-1.5 pointer-events-none">
                        <span
                          className={cn(
                            "text-[12px] font-mono tabular-nums inline-block",
                            !isCurrentMonth && !isWeek && "text-slate-300",
                            isCurrentMonth && !isCurrentDay && "text-slate-700",
                            isCurrentDay &&
                              "bg-black text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold text-[11px]"
                          )}
                        >
                          {isFirstOfMonth && isCurrentMonth && !isWeek
                            ? day.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : dayNum}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Foreground bar overlay — CSS grid that mirrors the
                  day grid. pointer-events:none on the wrapper so
                  click-through to the empty cell still works; bars
                  re-enable pointer-events to be clickable. */}
              <div
                className={cn(
                  "absolute left-0 right-0 grid gap-y-0.5 px-px pointer-events-none",
                  gridCols
                )}
                style={{
                  top: DAY_HEADER_PX,
                  gridAutoRows: `${LANE_PX - 2}px`,
                }}
              >
                {/* Solid-gold task bars (Asana style) */}
                {visibleSegments.map((seg) => {
                  const TypeIcon =
                    seg.task.taskType === "MILESTONE"
                      ? Diamond
                      : seg.task.taskType === "APPROVAL"
                        ? ThumbsUp
                        : null;
                  return (
                    <div
                      key={`${weekIdx}-${seg.task.id}-${seg.colStart}`}
                      style={{
                        gridColumn: `${seg.colStart + 1} / span ${seg.colSpan}`,
                        gridRow: seg.lane + 1,
                      }}
                      className="px-px min-w-0"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(seg.task.id);
                        }}
                        title={
                          seg.task.startDate && seg.task.dueDate
                            ? `${seg.task.name}  •  ${format(
                                parseISO(seg.task.startDate),
                                "MMM d"
                              )} → ${format(parseISO(seg.task.dueDate), "MMM d")}`
                            : seg.task.name
                        }
                        className={cn(
                          "w-full block text-left text-[11px] leading-snug px-1.5 py-[3px] truncate cursor-pointer pointer-events-auto font-medium transition-colors flex items-center gap-1",
                          !seg.clipsLeft && "rounded-l-sm",
                          !seg.clipsRight && "rounded-r-sm",
                          seg.task.completed
                            ? "bg-slate-200 text-slate-500 line-through"
                            : "bg-[#c9a84c] text-white hover:bg-[#a8893a]"
                        )}
                      >
                        {TypeIcon && (
                          <TypeIcon className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {seg.task.name}
                        </span>
                      </button>
                    </div>
                  );
                })}

                {/* "+N more" — real Popover per overflowing column,
                    listing the hidden tasks. Sits at the lane right
                    after that column's deepest visible bar. */}
                {week.map((_, dayOfWeek) => {
                  const count = hiddenByCol[dayOfWeek];
                  if (!count) return null;
                  const dayDate = week[dayOfWeek];
                  // moreLaneByCol is 0-indexed; CSS grid rows are
                  // 1-indexed, hence +1.
                  const gridRow = (moreLaneByCol[dayOfWeek] ?? 0) + 1;
                  return (
                    <div
                      key={`more-${weekIdx}-${dayOfWeek}`}
                      style={{
                        gridColumn: `${dayOfWeek + 1} / span 1`,
                        gridRow,
                      }}
                      className="px-px min-w-0 pointer-events-auto"
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="px-1.5 py-[2px] text-[10px] font-medium text-slate-500 hover:text-black hover:bg-slate-100 rounded-sm"
                          >
                            +{count} more
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-64 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-3 py-2 border-b">
                            <p className="text-xs font-semibold text-black">
                              {dayDate.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {count} hidden {count === 1 ? "task" : "tasks"}
                            </p>
                          </div>
                          <ul className="max-h-64 overflow-y-auto py-1">
                            {(hiddenTasksByCol[dayOfWeek] || []).map((t) => (
                              <li key={t.id}>
                                <button
                                  onClick={() => onTaskClick(t.id)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <span
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-sm flex-shrink-0",
                                      t.completed
                                        ? "bg-slate-300"
                                        : "bg-[#c9a84c]"
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "text-[12px] truncate flex-1",
                                      t.completed
                                        ? "text-slate-400 line-through"
                                        : "text-black"
                                    )}
                                  >
                                    {t.name}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })}

                {/* Inline add input — appears as the next bar in the
                    target column's lane stack. Same dimensions as a
                    task bar so the rhythm doesn't break. */}
                {addingColIndex >= 0 && (
                  <div
                    style={{
                      gridColumn: `${addingColIndex + 1} / span 1`,
                      gridRow: addingLane + 1,
                    }}
                    className="px-px min-w-0 pointer-events-auto"
                  >
                    <div
                      className="w-full bg-white border border-[#c9a84c] rounded-sm shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          const dateStr = isCreatingTask;
                          if (!dateStr) return;
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateTask(dateStr);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setIsCreatingTask(null);
                            setNewTaskName("");
                          }
                        }}
                        onBlur={() => {
                          const dateStr = isCreatingTask;
                          if (!dateStr) return;
                          if (newTaskName.trim()) {
                            handleCreateTask(dateStr);
                          } else {
                            setIsCreatingTask(null);
                          }
                        }}
                        placeholder="Task name…"
                        className="w-full px-1.5 py-[3px] text-[11px] leading-snug bg-transparent border-none outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
