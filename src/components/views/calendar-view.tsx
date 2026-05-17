"use client";

/**
 * Project Calendar view — visually identical to the /my-tasks
 * calendar (Juan's reference). Continuous-scroll month grid with:
 *   - Centered "Today" + live month label (no prev/next chrome)
 *   - Sticky weekday header
 *   - Per-week dynamic height (lanes pack into the available rows,
 *     with a +N more popover when a column overflows)
 *   - Click empty cell space → inline quick-add input as the next bar
 *   - Drag a task bar onto another day → PATCH reschedules (preserves
 *     duration when both startDate and dueDate exist)
 *   - IntersectionObserver appends 8 more weeks when the user nears
 *     the bottom — effectively infinite downward scroll
 *
 * Accepts `sections` (the project's section[] with tasks). Internally
 * flattens to a tasks[] list because the calendar is task-centric.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  assignee?: {
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
  /** Optional — fires after a task is created or rescheduled so the
   *  parent can refresh the underlying task list. Defaults to a
   *  router.refresh() in the parent. */
  onTaskMutated?: () => void;
}

// Pixel constants — must stay in sync with the dynamic height calc.
// LANE_PX = bar height (text 11px + py-[3px] ≈ 21) + 1px gap rounded
// to 22. DAY_HEADER_PX is the day-number row at top of each cell.
// ROW_MIN_PX is the minimum week height when the week is empty.
const DAY_HEADER_PX = 28;
const LANE_PX = 22;
const ROW_BOTTOM_PX = 10;
const ROW_MIN_PX = 92;
const MAX_LANES = 6;

export function CalendarView({
  sections,
  onTaskClick,
  projectId,
  onTaskMutated,
}: CalendarViewProps) {
  // Flatten sections → tasks once per render. The calendar doesn't
  // care which section a task belongs to.
  const tasks = useMemo<Task[]>(
    () => sections.flatMap((s) => s.tasks),
    [sections]
  );

  // ── State driving the "infinite" calendar ─────────────────────
  // `windowStart` is the very first Monday rendered. Seeded at 4
  // weeks before this week's Monday so the user can scroll up a
  // month from today AND forward indefinitely. `weekCount` grows as
  // the bottom sentinel enters the viewport.
  const [windowStart] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - dayOffset);
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - 4 * 7); // 4 weeks back
    return start;
  });
  const [weekCount, setWeekCount] = useState(16); // ~4 months on mount
  const [visibleMonth, setVisibleMonth] = useState<{
    year: number;
    month: number;
  }>(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const todayWeekRef = useRef<HTMLDivElement | null>(null);

  // ── Inline quick-add (click empty cell area) ──────────────────
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [creatingInline, setCreatingInline] = useState(false);
  const newTaskInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (addingForDate && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [addingForDate]);

  // ── Drag-to-reschedule (HTML5 drag, no extra deps) ────────────
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  function handleDragStart(e: DragEvent<HTMLButtonElement>, task: Task) {
    setDraggingTaskId(task.id);
    e.dataTransfer.setData("application/x-task-id", task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverDate(null);
  }

  function handleDayDragOver(e: DragEvent<HTMLDivElement>, dateStr: string) {
    if (!draggingTaskId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== dateStr) setDragOverDate(dateStr);
  }

  async function handleDayDrop(
    e: DragEvent<HTMLDivElement>,
    dropDate: Date
  ) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("application/x-task-id");
    setDraggingTaskId(null);
    setDragOverDate(null);
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Mid-day anchor avoids the date flipping under DST or near-
    // midnight edits across timezones.
    const noon = new Date(dropDate);
    noon.setHours(12, 0, 0, 0);

    const oldDue = task.dueDate ? new Date(task.dueDate) : null;
    const oldStart = task.startDate ? new Date(task.startDate) : null;

    const body: { dueDate?: string | null; startDate?: string | null } = {};
    if (oldStart && oldDue) {
      // Preserve duration: shift both dates by the same delta.
      const oldDueNoon = new Date(oldDue);
      oldDueNoon.setHours(12, 0, 0, 0);
      const deltaMs = noon.getTime() - oldDueNoon.getTime();
      body.dueDate = noon.toISOString();
      body.startDate = new Date(oldStart.getTime() + deltaMs).toISOString();
    } else if (oldStart && !oldDue) {
      body.startDate = noon.toISOString();
    } else {
      body.dueDate = noon.toISOString();
    }

    const sameDue =
      (body.dueDate ?? null) ===
      (task.dueDate ? new Date(task.dueDate).toISOString() : null);
    const sameStart =
      (body.startDate ?? null) ===
      (task.startDate ? new Date(task.startDate).toISOString() : null);
    if (sameDue && sameStart) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onTaskMutated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't reschedule task"
      );
    }
  }

  async function commitInlineTask(forDate: Date) {
    const name = newTaskName.trim();
    if (!name) {
      setAddingForDate(null);
      setNewTaskName("");
      return;
    }
    setCreatingInline(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dueDate: forDate.toISOString(),
          projectId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success(
        `Created "${name}" for ${forDate.toLocaleDateString("en-US")}`
      );
      onTaskMutated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create task");
    } finally {
      setCreatingInline(false);
      setAddingForDate(null);
      setNewTaskName("");
    }
  }

  // ── Generate all days from windowStart ────────────────────────
  const allDays = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < weekCount * 7; i++) {
      const d = new Date(windowStart);
      d.setDate(windowStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [windowStart, weekCount]);

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let w = 0; w < weekCount; w++) {
      out.push(allDays.slice(w * 7, (w + 1) * 7));
    }
    return out;
  }, [allDays, weekCount]);

  const todayStr = new Date().toDateString();
  const todayWeekIndex = useMemo(
    () =>
      weeks.findIndex((wk) =>
        wk.some((d) => d.toDateString() === todayStr)
      ),
    [weeks, todayStr]
  );

  // ── Lane assignment per week (greedy interval scheduling) ─────
  type BarSegment = {
    task: Task;
    weekIdx: number;
    colStart: number;
    colSpan: number;
    lane: number;
    clipsLeft: boolean;
    clipsRight: boolean;
  };

  const segmentsByWeek = useMemo(() => {
    const out: BarSegment[][] = weeks.map(() => []);
    const dayMs = 86400000;

    for (const task of tasks) {
      if (!task.dueDate && !task.startDate) continue;
      const dueRaw = task.dueDate
        ? new Date(task.dueDate)
        : new Date(task.startDate!);
      const startRaw = task.startDate ? new Date(task.startDate) : dueRaw;
      const start = new Date(
        startRaw.getFullYear(),
        startRaw.getMonth(),
        startRaw.getDate()
      );
      const due = new Date(
        dueRaw.getFullYear(),
        dueRaw.getMonth(),
        dueRaw.getDate()
      );

      if (allDays.length === 0) continue;
      if (
        due.getTime() < allDays[0].getTime() ||
        start.getTime() > allDays[allDays.length - 1].getTime()
      ) {
        continue;
      }

      for (let w = 0; w < weeks.length; w++) {
        const weekStart = weeks[w][0];
        const weekEnd = new Date(weeks[w][6]);
        weekEnd.setHours(23, 59, 59, 999);
        if (due.getTime() < weekStart.getTime()) continue;
        if (start.getTime() > weekEnd.getTime()) continue;

        const segStart =
          start.getTime() < weekStart.getTime() ? weekStart : start;
        const segEndDate =
          due.getTime() > weekEnd.getTime() ? weeks[w][6] : due;
        const colStart = Math.round(
          (segStart.getTime() - weekStart.getTime()) / dayMs
        );
        const colEnd = Math.round(
          (segEndDate.getTime() - weekStart.getTime()) / dayMs
        );
        out[w].push({
          task,
          weekIdx: w,
          colStart: Math.max(0, Math.min(6, colStart)),
          colSpan: Math.max(1, Math.min(7 - colStart, colEnd - colStart + 1)),
          lane: 0,
          clipsLeft: start.getTime() < weekStart.getTime(),
          clipsRight: due.getTime() > weekEnd.getTime(),
        });
      }
    }

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
          const overlapsAny = lanes[i].some(
            (existing) =>
              !(
                seg.colStart + seg.colSpan <= existing.colStart ||
                seg.colStart >= existing.colStart + existing.colSpan
              )
          );
          if (!overlapsAny) {
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
  }, [tasks, weeks, allDays]);

  // ── Per-week dynamic height ──────────────────────────────────
  const weekHeights = useMemo(() => {
    return weeks.map((_, idx) => {
      const segs = segmentsByWeek[idx] || [];
      const visibleSegs = segs.filter((s) => s.lane < MAX_LANES);
      const hasOverflowByDay: Record<number, boolean> = {};
      for (const s of segs) {
        if (s.lane >= MAX_LANES) {
          for (let d = s.colStart; d < s.colStart + s.colSpan; d++) {
            hasOverflowByDay[d] = true;
          }
        }
      }
      let maxRow = -1;
      for (let day = 0; day < 7; day++) {
        let columnMaxLane = -1;
        for (const s of visibleSegs) {
          if (
            s.colStart <= day &&
            s.colStart + s.colSpan > day &&
            s.lane > columnMaxLane
          ) {
            columnMaxLane = s.lane;
          }
        }
        const columnRow = hasOverflowByDay[day]
          ? columnMaxLane + 1
          : columnMaxLane;
        if (columnRow > maxRow) maxRow = columnRow;
      }
      if (maxRow < 0) return ROW_MIN_PX;
      const content = DAY_HEADER_PX + (maxRow + 1) * LANE_PX + ROW_BOTTOM_PX;
      return Math.max(ROW_MIN_PX, content);
    });
  }, [weeks, segmentsByWeek]);

  const weekOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < weekHeights.length; i++) {
      offsets.push(acc);
      acc += weekHeights[i];
    }
    return offsets;
  }, [weekHeights]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // ── Bottom-sentinel observer ──────────────────────────────────
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setWeekCount((c) => c + 8);
      },
      { root, rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [weekCount]);

  // ── Visible-month label tracker ───────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const HEADER_PX = 32;
      const target = el.scrollTop - HEADER_PX;
      let idx = 0;
      for (let i = 0; i < weekOffsets.length; i++) {
        if (weekOffsets[i] <= target) idx = i;
        else break;
      }
      const midDate = allDays[idx * 7 + 3];
      if (midDate) {
        const next = {
          year: midDate.getFullYear(),
          month: midDate.getMonth(),
        };
        setVisibleMonth((prev) =>
          prev.year === next.year && prev.month === next.month ? prev : next
        );
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [allDays, weekOffsets]);

  // ── Initial scroll to today ───────────────────────────────────
  useEffect(() => {
    if (todayWeekRef.current && scrollRef.current) {
      const HEADER_PX = 32;
      const idx = todayWeekIndex >= 0 ? todayWeekIndex : 0;
      scrollRef.current.scrollTop = (weekOffsets[idx] ?? 0) - HEADER_PX;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToToday = () => {
    if (!scrollRef.current) return;
    if (todayWeekIndex >= 0) {
      const HEADER_PX = 32;
      scrollRef.current.scrollTo({
        top: (weekOffsets[todayWeekIndex] ?? 0) - HEADER_PX,
        behavior: "smooth",
      });
    }
  };

  const formatMonthYear = (year: number, month: number) =>
    new Date(year, month, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

  return (
    <div className="flex flex-col h-full">
      {/* Navigation toolbar — Today button + live month label.
          No prev/next buttons: the user drives navigation by scrolling,
          the label tracks what they're looking at. */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          className="px-3"
        >
          Today
        </Button>
        <span className="font-medium text-black ml-2 tabular-nums">
          {formatMonthYear(visibleMonth.year, visibleMonth.month)}
        </span>
      </div>

      {/* Single scroll container with sticky weekday header.
          Continuous downward scroll appends 8 weeks at a time via
          an IntersectionObserver on the bottom sentinel. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-white sticky top-0 z-10">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={cn(
                "py-2 px-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-white",
                index > 0 && "border-l border-gray-200"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {weeks.map((week, weekIdx) => {
          const weekSegments = segmentsByWeek[weekIdx] || [];
          const visibleSegments = weekSegments.filter(
            (s) => s.lane < MAX_LANES
          );
          const hiddenByDay: Record<number, number> = {};
          const hiddenTasksByDay: Record<number, Task[]> = {};
          for (const s of weekSegments) {
            if (s.lane >= MAX_LANES) {
              for (let d = s.colStart; d < s.colStart + s.colSpan; d++) {
                hiddenByDay[d] = (hiddenByDay[d] || 0) + 1;
                if (!hiddenTasksByDay[d]) hiddenTasksByDay[d] = [];
                if (!hiddenTasksByDay[d].some((t) => t.id === s.task.id)) {
                  hiddenTasksByDay[d].push(s.task);
                }
              }
            }
          }

          const addingDayIndex = addingForDate
            ? week.findIndex((d) => d.toDateString() === addingForDate)
            : -1;
          let addingLane = 0;
          if (addingDayIndex >= 0) {
            let maxLane = -1;
            for (const seg of visibleSegments) {
              if (
                seg.colStart <= addingDayIndex &&
                seg.colStart + seg.colSpan > addingDayIndex
              ) {
                if (seg.lane > maxLane) maxLane = seg.lane;
              }
            }
            addingLane = maxLane + 1;
          }

          return (
            <div
              key={weekIdx}
              ref={weekIdx === todayWeekIndex ? todayWeekRef : null}
              className="relative border-b border-gray-200"
              style={{ height: weekHeights[weekIdx] ?? ROW_MIN_PX }}
              data-week-index={weekIdx}
            >
              {/* Background cells */}
              <div className="grid grid-cols-7 h-full">
                {week.map((date, dayOfWeek) => {
                  const dateStr = date.toDateString();
                  const isToday = dateStr === todayStr;
                  const isWeekend = dayOfWeek >= 5;
                  const dayNum = date.getDate();
                  const isCurrentMonth =
                    date.getMonth() === visibleMonth.month;
                  const isFirstOfMonth = dayNum === 1;
                  const isAdding = addingForDate === dateStr;
                  const isDropTarget = dragOverDate === dateStr;
                  return (
                    <div
                      key={dateStr}
                      onClick={(e) => {
                        if (e.currentTarget === e.target && !isAdding) {
                          setAddingForDate(dateStr);
                          setNewTaskName("");
                        }
                      }}
                      onDragOver={(e) => handleDayDragOver(e, dateStr)}
                      onDragLeave={() => {
                        if (dragOverDate === dateStr) setDragOverDate(null);
                      }}
                      onDrop={(e) => handleDayDrop(e, date)}
                      className={cn(
                        "relative cursor-pointer h-full",
                        dayOfWeek > 0 && "border-l border-gray-200",
                        !isCurrentMonth && "bg-gray-50/40",
                        isWeekend && isCurrentMonth && "bg-gray-50/20",
                        isToday && "bg-[#c9a84c]/5",
                        isAdding && "ring-2 ring-[#c9a84c]/60 ring-inset",
                        isDropTarget &&
                          "ring-2 ring-[#c9a84c] ring-inset bg-[#c9a84c]/10"
                      )}
                    >
                      <div className="px-2 pt-1.5 pointer-events-none">
                        <span
                          className={cn(
                            "text-[12px] font-mono tabular-nums inline-block",
                            !isCurrentMonth && "text-gray-300",
                            isCurrentMonth && !isToday && "text-gray-700",
                            isToday &&
                              "bg-black text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold text-[11px]"
                          )}
                        >
                          {isFirstOfMonth
                            ? date.toLocaleDateString("en-US", {
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

              {/* Bars overlay */}
              <div
                className="absolute inset-x-0 grid grid-cols-7 gap-y-0.5 pointer-events-none"
                style={{ top: 28, paddingLeft: 2, paddingRight: 2 }}
              >
                {visibleSegments.map((seg) => {
                  const isBeingDragged = draggingTaskId === seg.task.id;
                  return (
                    <div
                      key={`${seg.task.id}-${weekIdx}-${seg.colStart}`}
                      style={{
                        gridColumn: `${seg.colStart + 1} / span ${seg.colSpan}`,
                        gridRow: seg.lane + 1,
                      }}
                      className="px-px min-w-0 pointer-events-none"
                    >
                      <button
                        draggable
                        onDragStart={(e) => handleDragStart(e, seg.task)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(seg.task.id);
                        }}
                        title={seg.task.name}
                        className={cn(
                          "w-full block text-left text-[11px] leading-snug px-1.5 py-[3px] truncate cursor-grab active:cursor-grabbing pointer-events-auto font-medium transition-colors",
                          !seg.clipsLeft && "rounded-l-sm",
                          !seg.clipsRight && "rounded-r-sm",
                          seg.task.completed
                            ? "bg-gray-200 text-gray-500 line-through"
                            : "bg-[#c9a84c] text-white hover:bg-[#a8893a]",
                          isBeingDragged && "opacity-40"
                        )}
                      >
                        {seg.task.name}
                      </button>
                    </div>
                  );
                })}

                {/* +N more pills */}
                {week.map((date, dayOfWeek) => {
                  const count = hiddenByDay[dayOfWeek];
                  if (!count) return null;
                  let columnMaxLane = -1;
                  for (const seg of visibleSegments) {
                    if (
                      seg.colStart <= dayOfWeek &&
                      seg.colStart + seg.colSpan > dayOfWeek &&
                      seg.lane > columnMaxLane
                    ) {
                      columnMaxLane = seg.lane;
                    }
                  }
                  return (
                    <div
                      key={`more-${weekIdx}-${dayOfWeek}`}
                      style={{
                        gridColumn: `${dayOfWeek + 1} / span 1`,
                        gridRow: columnMaxLane + 2,
                      }}
                      className="px-px min-w-0 pointer-events-auto"
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="px-1.5 py-[2px] text-[10px] font-medium text-gray-500 hover:text-black hover:bg-gray-100 rounded-sm"
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
                              {date.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {count} hidden {count === 1 ? "task" : "tasks"}
                            </p>
                          </div>
                          <ul className="max-h-64 overflow-y-auto py-1">
                            {(hiddenTasksByDay[dayOfWeek] || []).map((t) => (
                              <li key={t.id}>
                                <button
                                  onClick={() => onTaskClick(t.id)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <span
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-sm flex-shrink-0",
                                      t.completed
                                        ? "bg-gray-300"
                                        : "bg-[#c9a84c]"
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "text-[12px] truncate flex-1",
                                      t.completed
                                        ? "text-gray-400 line-through"
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

                {/* Inline Add input */}
                {addingDayIndex >= 0 && (
                  <div
                    style={{
                      gridColumn: `${addingDayIndex + 1} / span 1`,
                      gridRow: addingLane + 1,
                    }}
                    className="px-px min-w-0 pointer-events-auto"
                  >
                    <div
                      className="w-full bg-white border border-[#c9a84c] rounded-sm shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={newTaskInputRef}
                        type="text"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitInlineTask(week[addingDayIndex]);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setAddingForDate(null);
                            setNewTaskName("");
                          }
                        }}
                        onBlur={() => commitInlineTask(week[addingDayIndex])}
                        disabled={creatingInline}
                        placeholder="Task name…"
                        className="w-full px-1.5 py-[3px] text-[11px] leading-snug bg-transparent border-none outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Bottom sentinel — when it enters the viewport, the
            IntersectionObserver appends 8 more weeks. */}
        <div ref={bottomSentinelRef} className="h-1" />
      </div>
    </div>
  );
}
