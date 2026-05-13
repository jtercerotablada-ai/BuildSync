"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          projectId,
          sectionId: firstSection.id,
          dueDate: new Date(dateStr).toISOString(),
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
              <DropdownMenuItem onClick={() => toast.info("Coming soon")}>Color by project</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Week Day Headers */}
      <div className={cn("grid border-b", gridCols)}>
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              "py-1 md:py-2 text-center text-[10px] md:text-xs font-medium text-black uppercase border-r last:border-r-0",
              showWeekends && index >= 5 && "bg-white"
            )}
          >
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar — per-week containers. Each row stacks two grids:
          a background day grid (for cell affordances + quick-add) and
          a bar overlay (CSS-grid with grid-column span + lane rows)
          so multi-day tasks render as horizontal bars spanning days.
          Mobile keeps the compact dot-strip representation. */}
      <div className="flex-1 overflow-auto">
        {weeks.map((week, weekIdx) => {
          const segments = segmentsByWeek[weekIdx] || [];
          const isWeek = viewMode === "week";
          // Lane count drives how tall the bar zone needs to be.
          // Clamp to avoid rows growing forever on busy projects.
          const laneCount = Math.min(
            isWeek ? 30 : 6,
            Math.max(1, ...segments.map((s) => s.lane + 1), 1)
          );
          const overflowSegments = segments.filter(
            (s) => s.lane >= laneCount
          );
          // Compute per-day overflow counts ("+N more") for any
          // segments that didn't fit into visible lanes.
          const overflowByCol: number[] = Array(week.length).fill(0);
          for (const seg of overflowSegments) {
            for (let c = seg.colStart; c < seg.colStart + seg.colSpan; c++) {
              overflowByCol[c]++;
            }
          }

          return (
            <div key={weekIdx} className="relative border-b">
              {/* Background day grid */}
              <div className={cn("grid", gridCols)}>
                {week.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);
                  const dayOfWeek = day.getDay();
                  const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                  const dayNum = day.getDate();
                  const isFirstOfMonth = dayNum === 1;

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "border-r last:border-r-0 p-0.5 md:p-1 relative",
                        isWeek
                          ? "min-h-[400px]"
                          : "min-h-[90px] md:min-h-[110px]",
                        !isCurrentMonth && !isWeek && "bg-white/50",
                        isWeekendDay && showWeekends && "bg-white/30",
                        isCreatingTask !== dateStr &&
                          "cursor-pointer hover:bg-[#c9a84c]/[0.04]"
                      )}
                      style={{
                        // Reserve enough space for the bar lanes so day
                        // numbers and overflow chips don't overlap bars.
                        paddingTop: 4 + laneCount * 22 + 4,
                      }}
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setIsCreatingTask(dateStr);
                        }
                      }}
                    >
                      {/* Day number — pinned to top-left, above the bar
                          area, with pointer-events:none so the bar
                          overlay catches the click cleanly. */}
                      <div className="absolute top-1 left-1 right-1 flex items-start justify-between pointer-events-none">
                        <span
                          className={cn(
                            "text-xs md:text-sm",
                            !isCurrentMonth && !isWeek && "text-slate-300",
                            isCurrentDay &&
                              "bg-black text-white rounded-full w-6 h-6 flex items-center justify-center font-medium"
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

                      {/* Per-day overflow chip */}
                      {(() => {
                        const colIdx = week.indexOf(day);
                        const extra = overflowByCol[colIdx] || 0;
                        if (extra === 0) return null;
                        return (
                          <div className="absolute bottom-1 left-1 text-[10px] text-slate-500 font-medium pointer-events-none">
                            +{extra} more
                          </div>
                        );
                      })()}

                      {/* Quick-add input pinned over bar area */}
                      {isCreatingTask === dateStr && (
                        <input
                          type="text"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleCreateTask(dateStr);
                            if (e.key === "Escape") {
                              setIsCreatingTask(null);
                              setNewTaskName("");
                            }
                          }}
                          onBlur={() => {
                            if (newTaskName.trim()) {
                              handleCreateTask(dateStr);
                            } else {
                              setIsCreatingTask(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Task name"
                          className="absolute bottom-1 left-1 right-1 text-xs px-2 py-1 border rounded outline-none focus:ring-2 focus:ring-[#c9a84c] bg-white z-20"
                          autoFocus
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bar overlay — CSS grid that mirrors the day grid so
                  segments can use `gridColumn: span N` to abarcar
                  múltiples celdas. Lane rows are 22px tall each. */}
              <div
                className={cn(
                  "absolute left-0 right-0 grid gap-y-0.5 px-1 pointer-events-none",
                  gridCols
                )}
                style={{
                  top: 22, // below the day number row
                  gridTemplateRows: `repeat(${laneCount}, 20px)`,
                }}
              >
                {segments
                  .filter((s) => s.lane < laneCount)
                  .map((seg) => {
                    const TypeIcon =
                      seg.task.taskType === "MILESTONE"
                        ? Diamond
                        : seg.task.taskType === "APPROVAL"
                          ? ThumbsUp
                          : null;
                    return (
                      <button
                        key={`${weekIdx}-${seg.task.id}-${seg.colStart}`}
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
                        style={{
                          gridColumn: `${seg.colStart + 1} / span ${seg.colSpan}`,
                          gridRow: seg.lane + 1,
                        }}
                        className={cn(
                          "pointer-events-auto h-5 flex items-center gap-1 px-1.5 text-[11px] font-medium truncate cursor-pointer shadow-sm transition-colors",
                          seg.task.completed
                            ? "bg-slate-100 text-slate-400 line-through"
                            : "bg-white text-slate-800 hover:bg-[#fdf7e8]",
                          seg.colSpan > 1
                            ? "border-2 border-[#c9a84c]"
                            : "border border-slate-200 hover:border-[#c9a84c]",
                          seg.clipsLeft && !seg.clipsRight && "rounded-r",
                          seg.clipsRight && !seg.clipsLeft && "rounded-l",
                          !seg.clipsLeft && !seg.clipsRight && "rounded",
                          seg.clipsLeft && seg.clipsRight && "rounded-none"
                        )}
                      >
                        {TypeIcon && (
                          <TypeIcon className="h-3 w-3 text-[#a8893a] flex-shrink-0" />
                        )}
                        <span className="truncate flex-1 min-w-0">
                          {seg.clipsLeft ? "… " : ""}
                          {seg.task.name}
                          {seg.clipsRight ? " …" : ""}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
