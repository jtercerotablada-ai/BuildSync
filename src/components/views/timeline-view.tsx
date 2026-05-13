"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Filter,
  Diamond,
  AlertTriangle,
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
import { toast } from "sonner";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import {
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  format,
  differenceInDays,
  isSameDay,
  startOfDay,
  parseISO,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWeekend,
} from "date-fns";

// ============================================
// TYPES
// ============================================

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  startDate?: string | null;
  priority: string;
  // Engineering taxonomy honoured here so MILESTONE/APPROVAL tasks
  // render as gold Diamond / ThumbsUp instead of a regular bar, the
  // same way they do in List + Board + Calendar (P1).
  taskType?: "TASK" | "MILESTONE" | "APPROVAL" | null;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  subtasks?: { id: string; completed: boolean }[];
  _count?: {
    subtasks: number;
    comments: number;
    attachments: number;
  };
}

interface Section {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

interface TimelineViewProps {
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  projectId: string;
}

type ZoomLevel = "day" | "week" | "month" | "quarter";

// ============================================
// PRIORITY & STATUS COLORS — monochrome + gold palette
// ============================================
// Matches the rest of the cockpit: NONE is a soft slate, LOW/MEDIUM
// climb up the gold ramp, HIGH lands on black so a high-priority task
// reads with maximum contrast against the slate grid.

const PRIORITY_COLORS: Record<string, string> = {
  NONE: "#9ca3af",   // slate-400
  LOW: "#d4b65a",    // bright gold
  MEDIUM: "#c9a84c", // gold
  HIGH: "#0a0a0a",   // black
};

// Completed bars get a muted slate fill + strike-through; in-progress
// bars use the priority color and overlay a darker gradient for the
// remaining work. "Due soon" is rendered via a gold ring on the bar.
const COMPLETED_BAR_FILL = "#94a3b8"; // slate-400

// ============================================
// MAIN COMPONENT
// ============================================

export function TimelineView({
  sections,
  onTaskClick,
  projectId,
}: TimelineViewProps) {
  const router = useRouter();

  // State
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // "Due soon" highlight — honest name for the simple at-risk flag
  // (tasks due within 7 days, not yet complete). True CPM critical
  // path with forward/backward pass + total float lands in Phase 3.
  const [showDueSoon, setShowDueSoon] = useState(true);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"all" | "incomplete" | "completed" | "due_this_week" | "has_deps">("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dragState, setDragState] = useState<{
    taskId: string;
    handle: "left" | "right";
    startX: number;
    originalStart: string | null;
    originalDue: string;
    // Live pixel delta from drag start — updated on every mousemove
    // so the bar can render its in-flight position before the server
    // commits. Without this, resizing felt completely silent until
    // mouseup + router.refresh redrew the bar.
    deltaX: number;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);

  // Apply task filter
  const filteredSections = useMemo(() => {
    if (taskFilter === "all") return sections;
    const now = new Date();
    // "Due this week" means within the Monday→Sunday window that
    // contains today — NOT every task with dueDate <= Sunday (the
    // previous implementation also matched every overdue task in
    // history, which was the wrong half of the calendar).
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    return sections.map((section) => ({
      ...section,
      tasks: section.tasks.filter((task) => {
        if (taskFilter === "incomplete") return !task.completed;
        if (taskFilter === "completed") return task.completed;
        if (taskFilter === "due_this_week") {
          if (!task.dueDate) return false;
          const due = parseISO(task.dueDate);
          return due >= weekStart && due <= weekEnd;
        }
        return true;
      }),
    }));
  }, [sections, taskFilter]);

  // ============================================
  // ZOOM CONFIGURATION
  // ============================================

  const zoomConfig = {
    day: {
      columnWidth: 40,
      range: 30,
      getColumns: (start: Date, count: number) =>
        eachDayOfInterval({ start, end: addDays(start, count - 1) }),
    },
    week: {
      columnWidth: 80,
      range: 16,
      getColumns: (start: Date, count: number) =>
        eachWeekOfInterval(
          { start, end: addWeeks(start, count - 1) },
          { weekStartsOn: 1 }
        ),
    },
    month: {
      columnWidth: 120,
      range: 12,
      getColumns: (start: Date, count: number) =>
        eachMonthOfInterval({
          start: startOfMonth(start),
          end: addMonths(start, count - 1),
        }),
    },
    quarter: {
      columnWidth: 200,
      range: 8,
      getColumns: (start: Date, count: number) => {
        const quarters = [];
        let current = startOfMonth(start);
        for (let i = 0; i < count; i++) {
          quarters.push(current);
          current = addMonths(current, 3);
        }
        return quarters;
      },
    },
  };

  const config = zoomConfig[zoomLevel];

  // ============================================
  // GENERATE TIMELINE COLUMNS
  // ============================================

  const columns = useMemo(() => {
    const startDate = zoomLevel === "week"
      ? startOfWeek(currentDate, { weekStartsOn: 1 })
      : startOfMonth(currentDate);

    const cols = config.getColumns(startDate, config.range);

    return cols.map((date) => {
      let label = "";
      let subLabel = "";

      if (zoomLevel === "day") {
        label = format(date, "d");
        subLabel = format(date, "EEE");
      } else if (zoomLevel === "week") {
        const weekEnd = addDays(date, 6);
        label = `${format(date, "d")}-${format(weekEnd, "d")}`;
        subLabel = `W${format(date, "w")}`;
      } else if (zoomLevel === "month") {
        label = format(date, "MMM");
        subLabel = format(date, "yyyy");
      } else {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        label = `Q${quarter}`;
        subLabel = format(date, "yyyy");
      }

      return {
        date,
        label,
        subLabel,
        isWeekend: zoomLevel === "day" && isWeekend(date),
        isToday: isSameDay(date, new Date()),
      };
    });
  }, [currentDate, zoomLevel, config]);

  // ============================================
  // GROUP COLUMNS BY MONTH/YEAR
  // ============================================

  const monthGroups = useMemo(() => {
    if (zoomLevel === "month" || zoomLevel === "quarter") {
      const year = format(columns[0]?.date || new Date(), "yyyy");
      return [{ label: year, columns }];
    }

    const groups: { label: string; columns: typeof columns }[] = [];
    let currentMonth = "";

    columns.forEach((col) => {
      const monthLabel = format(col.date, "MMMM yyyy");
      if (monthLabel !== currentMonth) {
        currentMonth = monthLabel;
        groups.push({ label: monthLabel, columns: [] });
      }
      groups[groups.length - 1].columns.push(col);
    });

    return groups;
  }, [columns, zoomLevel]);

  // ============================================
  // CALCULATE TASK POSITION
  // ============================================

  const getTaskPosition = useCallback(
    (task: Task) => {
      if (!task.dueDate) return null;

      const startDate = zoomLevel === "week"
        ? startOfWeek(currentDate, { weekStartsOn: 1 })
        : startOfMonth(currentDate);

      const timelineStart = columns[0]?.date || startDate;
      const timelineEnd = addDays(
        columns[columns.length - 1]?.date || startDate,
        zoomLevel === "day" ? 1 : zoomLevel === "week" ? 7 : 30
      );

      const taskEnd = parseISO(task.dueDate);
      const taskStart = task.startDate
        ? parseISO(task.startDate)
        : new Date(taskEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      if (taskEnd < timelineStart || taskStart > timelineEnd) {
        return null;
      }

      const totalWidth = columns.length * config.columnWidth;
      const totalDays = differenceInDays(timelineEnd, timelineStart);

      const startOffset = Math.max(0, differenceInDays(taskStart, timelineStart));
      const endOffset = Math.min(totalDays, differenceInDays(taskEnd, timelineStart));

      const left = (startOffset / totalDays) * totalWidth;
      const width = Math.max(((endOffset - startOffset + 1) / totalDays) * totalWidth, 24);

      return { left, width };
    },
    [columns, config.columnWidth, zoomLevel, currentDate]
  );

  // ============================================
  // CALCULATE TODAY LINE POSITION
  // ============================================

  const todayPosition = useMemo(() => {
    const today = startOfDay(new Date());
    const startDate = zoomLevel === "week"
      ? startOfWeek(currentDate, { weekStartsOn: 1 })
      : startOfMonth(currentDate);

    const timelineStart = columns[0]?.date || startDate;
    const timelineEnd = addDays(
      columns[columns.length - 1]?.date || startDate,
      zoomLevel === "day" ? 1 : zoomLevel === "week" ? 7 : 30
    );

    if (today < timelineStart || today > timelineEnd) return null;

    const totalWidth = columns.length * config.columnWidth;
    const totalDays = differenceInDays(timelineEnd, timelineStart);
    const daysFromStart = differenceInDays(today, timelineStart);

    return (daysFromStart / totalDays) * totalWidth;
  }, [columns, config.columnWidth, zoomLevel, currentDate]);

  // ============================================
  // DRAG-TO-RESIZE
  // ============================================

  const pixelsToDays = useCallback((px: number) => {
    const totalWidth = columns.length * config.columnWidth;
    const sd = zoomLevel === "week"
      ? startOfWeek(currentDate, { weekStartsOn: 1 })
      : startOfMonth(currentDate);
    const timelineStart = columns[0]?.date || sd;
    const timelineEnd = addDays(
      columns[columns.length - 1]?.date || sd,
      zoomLevel === "day" ? 1 : zoomLevel === "week" ? 7 : 30
    );
    const totalDays = differenceInDays(timelineEnd, timelineStart);
    return (px / totalWidth) * totalDays;
  }, [columns, config.columnWidth, zoomLevel, currentDate]);

  const handleResizeStart = useCallback((e: React.MouseEvent, taskId: string, handle: "left" | "right", task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    if (!task.dueDate) return;
    setDragState({
      taskId,
      handle,
      startX: e.clientX,
      originalStart: task.startDate || null,
      originalDue: task.dueDate,
      deltaX: 0,
    });
  }, []);

  useEffect(() => {
    if (!dragState) return;

    // Update the live deltaX on every mousemove so the bar can paint
    // its preview position while the user is still dragging. Snaps
    // to whole days so the visual matches what'll actually persist
    // (no sub-day "phantom" shifts).
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const snappedDays = Math.round(pixelsToDays(dx));
      const snappedPx = snappedDays * (config.columnWidth /
        (zoomLevel === "day" ? 1 : zoomLevel === "week" ? 7 : zoomLevel === "month" ? 30 : 90));
      setDragState((prev) => (prev ? { ...prev, deltaX: snappedPx } : prev));
    };

    const handleMouseUp = async (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(pixelsToDays(deltaX));
      if (deltaDays === 0) {
        setDragState(null);
        return;
      }

      const body: Record<string, string | null> = {};
      if (dragState.handle === "left") {
        const origStart = dragState.originalStart
          ? parseISO(dragState.originalStart)
          : addDays(parseISO(dragState.originalDue), -7);
        const newStart = addDays(origStart, deltaDays);
        body.startDate = format(newStart, "yyyy-MM-dd");
      } else {
        const newDue = addDays(parseISO(dragState.originalDue), deltaDays);
        body.dueDate = format(newDue, "yyyy-MM-dd");
      }

      try {
        const res = await fetch(`/api/tasks/${dragState.taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        toast.error("Failed to update dates");
      }
      setDragState(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, pixelsToDays, router, config.columnWidth, zoomLevel]);

  // ============================================
  // NAVIGATION
  // ============================================

  const navigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(new Date());
    } else {
      const amount = direction === "prev" ? -1 : 1;
      if (zoomLevel === "day") setCurrentDate((d) => addWeeks(d, amount));
      else if (zoomLevel === "week") setCurrentDate((d) => addMonths(d, amount));
      else if (zoomLevel === "month") setCurrentDate((d) => addMonths(d, amount * 3));
      else setCurrentDate((d) => addMonths(d, amount * 6));
    }
  };

  // ============================================
  // TOGGLE SECTION
  // ============================================

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  // ============================================
  // ADD SECTION
  // ============================================

  const handleAddSection = async () => {
    try {
      const response = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New section",
          projectId,
        }),
      });

      if (!response.ok) throw new Error("Failed to create section");
      router.refresh();
    } catch {
      toast.error("Failed to add section");
    }
  };

  // ============================================
  // CALCULATE PROGRESS
  // ============================================

  const getTaskProgress = (task: Task) => {
    if (task.completed) return 100;
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter((s) => s.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  };

  // ============================================
  // DETERMINE IF TASK IS DUE SOON
  // ============================================
  // Lightweight at-risk flag: due within 7 days and not yet complete.
  // This is NOT true critical-path; CPM with total float = 0 lands
  // in Phase 3 once we wire forward/backward pass.

  const isTaskDueSoon = (task: Task) => {
    if (!task.dueDate) return false;
    if (task.completed) return false;
    const dueDate = parseISO(task.dueDate);
    const today = new Date();
    const daysUntilDue = differenceInDays(dueDate, today);
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  };

  // ============================================
  // DETERMINE IF TASK IS A MILESTONE
  // ============================================
  // Two ways a task can be a milestone:
  //   1. Explicit taskType === "MILESTONE" (preferred — matches the
  //      List / Board / Calendar treatment).
  //   2. Implicit: a 0-duration task (startDate === dueDate or no
  //      startDate set and the bar would collapse).
  // The explicit form wins so a stakeholder can mark a milestone
  // intentionally without juggling dates.

  const isTaskMilestone = (task: Task) => {
    if (task.taskType === "MILESTONE") return true;
    if (!task.dueDate) return false;
    const taskEnd = parseISO(task.dueDate);
    const taskStart = task.startDate
      ? parseISO(task.startDate)
      : new Date(taskEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    return isSameDay(taskStart, taskEnd);
  };

  // Approval gates (taskType === "APPROVAL") render with the gold
  // ThumbsUp icon in place of a regular bar.
  const isTaskApproval = (task: Task) => task.taskType === "APPROVAL";

  // ============================================
  // RENDER
  // ============================================

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const sidebarWidth = isMobile ? 120 : 280;
  const rowHeight = 44;
  const headerHeight = 80;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ============================================ */}
      {/* TOOLBAR */}
      {/* ============================================ */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 bg-white border-b overflow-x-auto">
        {/* Left */}
        <div className="flex items-center gap-1 md:gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add task
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("today")}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right */}
        <div className="hidden md:flex items-center gap-2">
          {/* Zoom Level Selector */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(["day", "week", "month", "quarter"] as ZoomLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                  zoomLevel === level
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          {/* View Options — only ship toggles that actually render
              something. Dependencies arrows, baseline ghost bars, and
              true CPM critical path are queued for Phase 3 when the
              data model + algorithm are in place. */}
          <Button
            variant={showDueSoon ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowDueSoon(!showDueSoon)}
            title="Highlight tasks due within 7 days"
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Due soon
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Filter className="w-4 h-4 mr-1" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTaskFilter("all")}>All tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTaskFilter("incomplete")}>Incomplete tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTaskFilter("completed")}>Completed tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTaskFilter("due_this_week")}>Due this week</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ============================================ */}
      {/* TIMELINE GRID */}
      {/* ============================================ */}
      <div className="flex-1 overflow-auto" ref={timelineRef}>
        <div className="flex min-w-max">
          {/* ============================================ */}
          {/* SIDEBAR (Task List) */}
          {/* ============================================ */}
          <div
            className="flex-shrink-0 bg-white border-r sticky left-0 z-30"
            style={{ width: sidebarWidth }}
          >
            {/* Sidebar Header */}
            <div
              className="border-b bg-slate-50 px-2 md:px-4 flex items-center font-medium text-xs md:text-sm text-slate-700"
              style={{ height: headerHeight }}
            >
              Task Name
            </div>

            {/* Sections & Tasks */}
            {filteredSections.map((section) => {
              const isCollapsed = collapsedSections.has(section.id);

              return (
                <div key={section.id}>
                  {/* Section Row */}
                  <button
                    className="flex items-center gap-1 md:gap-2 px-2 md:px-4 border-b bg-slate-50 hover:bg-slate-100 cursor-pointer w-full text-left"
                    style={{ height: rowHeight }}
                    onClick={() => toggleSection(section.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="font-semibold text-xs md:text-sm text-slate-900 truncate">
                      {section.name}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                      {section.tasks.length}
                    </span>
                  </button>

                  {/* Tasks */}
                  {!isCollapsed &&
                    section.tasks.map((task) => {
                      const isMilestone = isTaskMilestone(task);
                      const isApproval = isTaskApproval(task);
                      const dueSoon = isTaskDueSoon(task);
                      const progress = getTaskProgress(task);

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-1 md:gap-2 px-2 md:px-4 border-b hover:bg-white cursor-pointer group",
                            selectedTaskId === task.id && "bg-white"
                          )}
                          style={{ height: rowHeight }}
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            onTaskClick(task.id);
                          }}
                        >
                          {/* Task-type marker — gold Diamond for
                              MILESTONE, gold ThumbsUp for APPROVAL,
                              gold square for regular tasks. */}
                          {isMilestone ? (
                            <Diamond className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                          ) : isApproval ? (
                            <ThumbsUp className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                          ) : (
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{
                                backgroundColor:
                                  PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.NONE,
                              }}
                            />
                          )}

                          <span
                            className={cn(
                              "text-xs md:text-sm truncate flex-1",
                              task.completed && "line-through text-slate-400"
                            )}
                          >
                            {task.name}
                          </span>

                          {dueSoon && showDueSoon && (
                            <AlertTriangle
                              className="w-3 h-3 text-[#a8893a] hidden md:block flex-shrink-0"
                              aria-label="Due within 7 days"
                            />
                          )}

                          {progress > 0 && progress < 100 && (
                            <span className="text-xs text-slate-500 hidden md:inline tabular-nums">
                              {progress}%
                            </span>
                          )}

                          {task.assignee && (
                            <div className="w-6 h-6 rounded-full bg-[#d4b65a] items-center justify-center text-xs font-medium text-white hidden md:flex flex-shrink-0">
                              {task.assignee.name?.[0] || "?"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {/* Add Section */}
            <button
              className="flex items-center gap-2 px-2 md:px-4 text-slate-500 hover:bg-slate-50 cursor-pointer w-full text-left"
              style={{ height: rowHeight }}
              onClick={handleAddSection}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add section</span>
            </button>
          </div>

          {/* ============================================ */}
          {/* GANTT CHART AREA */}
          {/* ============================================ */}
          <div className="flex-1">
            {/* Timeline Header */}
            <div
              className="sticky top-0 bg-white border-b z-20"
              style={{ height: headerHeight }}
            >
              {/* Month Row */}
              <div className="flex border-b" style={{ height: headerHeight / 2 }}>
                {monthGroups.map((group, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center text-xs md:text-sm font-medium text-slate-700 border-r"
                    style={{ width: group.columns.length * config.columnWidth }}
                  >
                    {group.label}
                  </div>
                ))}
              </div>

              {/* Day/Week Row */}
              <div className="flex" style={{ height: headerHeight / 2 }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col items-center justify-center text-xs border-r",
                      col.isWeekend && "bg-slate-50",
                      col.isToday && "bg-white"
                    )}
                    style={{ width: config.columnWidth }}
                  >
                    <span className="font-medium text-slate-700">{col.label}</span>
                    <span className="text-slate-400">{col.subLabel}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt Rows */}
            <div className="relative">
              {/* Today Line */}
              {todayPosition !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-black z-10 pointer-events-none"
                  style={{ left: todayPosition }}
                >
                  <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-black rounded-full" />
                </div>
              )}

              {/* Section Rows */}
              {filteredSections.map((section) => {
                const isCollapsed = collapsedSections.has(section.id);

                return (
                  <div key={section.id}>
                    {/* Section Header Row */}
                    <div
                      className="flex border-b bg-slate-50"
                      style={{ height: rowHeight }}
                    >
                      {columns.map((col, i) => (
                        <div
                          key={i}
                          className={cn("border-r", col.isWeekend && "bg-slate-100")}
                          style={{ width: config.columnWidth }}
                        />
                      ))}
                    </div>

                    {/* Task Rows */}
                    {!isCollapsed &&
                      section.tasks.map((task) => {
                        const position = getTaskPosition(task);
                        const isMilestone = isTaskMilestone(task);
                        const isApproval = isTaskApproval(task);
                        const dueSoon = isTaskDueSoon(task);
                        const progress = getTaskProgress(task);
                        const taskColor = task.completed
                          ? COMPLETED_BAR_FILL
                          : PRIORITY_COLORS[task.priority] ||
                            PRIORITY_COLORS.NONE;

                        // Apply the live drag delta when this is the
                        // bar being resized. Left handle shifts `left`
                        // and shrinks `width`; right handle just
                        // extends `width`.
                        const isResizing =
                          dragState && dragState.taskId === task.id;
                        const renderLeft =
                          position && isResizing && dragState.handle === "left"
                            ? position.left + dragState.deltaX
                            : position?.left;
                        const renderWidth =
                          position && isResizing
                            ? dragState.handle === "left"
                              ? position.width - dragState.deltaX
                              : position.width + dragState.deltaX
                            : position?.width;

                        return (
                          <div
                            key={task.id}
                            className="flex border-b relative"
                            style={{ height: rowHeight }}
                            onMouseEnter={() => setHoveredTask(task.id)}
                            onMouseLeave={() => setHoveredTask(null)}
                          >
                            {/* Grid columns */}
                            {columns.map((col, i) => (
                              <div
                                key={i}
                                className={cn("border-r", col.isWeekend && "bg-slate-50")}
                                style={{ width: config.columnWidth }}
                              />
                            ))}

                            {/* Task Bar */}
                            {position &&
                              (isMilestone ? (
                                // Milestone — gold Diamond (matches
                                // List / Board / Calendar convention)
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform z-10"
                                  style={{ left: renderLeft }}
                                  onClick={() => onTaskClick(task.id)}
                                  title={`${task.name} — milestone`}
                                >
                                  <Diamond
                                    className="w-6 h-6"
                                    fill="#a8893a"
                                    color="#a8893a"
                                  />
                                </div>
                              ) : isApproval ? (
                                // Approval gate — gold ThumbsUp
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform z-10"
                                  style={{ left: renderLeft }}
                                  onClick={() => onTaskClick(task.id)}
                                  title={`${task.name} — approval gate`}
                                >
                                  <ThumbsUp
                                    className="w-6 h-6"
                                    fill="#a8893a"
                                    color="#a8893a"
                                  />
                                </div>
                              ) : (
                                // Task Bar
                                <div
                                  className={cn(
                                    "absolute top-1.5 rounded cursor-pointer group/bar",
                                    "hover:ring-2 hover:ring-[#c9a84c] hover:ring-offset-1",
                                    "transition-shadow",
                                    selectedTaskId === task.id &&
                                      "ring-2 ring-[#c9a84c] ring-offset-1",
                                    dueSoon &&
                                      showDueSoon &&
                                      "ring-2 ring-[#a8893a]/70",
                                    isResizing && "shadow-lg ring-2 ring-[#c9a84c]"
                                  )}
                                  style={{
                                    left: renderLeft,
                                    width: Math.max(renderWidth ?? 24, 24),
                                    height: isMobile ? rowHeight - 8 : rowHeight - 12,
                                    backgroundColor: taskColor,
                                  }}
                                  onClick={() => onTaskClick(task.id)}
                                >
                                  {/* Progress overlay — darker right
                                      side shows remaining work. */}
                                  {progress > 0 && progress < 100 && (
                                    <div
                                      className="absolute inset-0 rounded bg-black/25"
                                      style={{
                                        width: `${100 - progress}%`,
                                        right: 0,
                                        left: "auto",
                                      }}
                                    />
                                  )}

                                  {/* Content */}
                                  <div className="relative h-full flex items-center px-2 gap-1 overflow-hidden">
                                    {task.assignee && (
                                      <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-medium text-white flex-shrink-0">
                                        {task.assignee.name?.[0] || "?"}
                                      </div>
                                    )}
                                    <span
                                      className={cn(
                                        "text-xs font-medium truncate",
                                        task.priority === "HIGH" || task.completed
                                          ? "text-white"
                                          : "text-black"
                                      )}
                                    >
                                      {task.name}
                                    </span>
                                    {progress > 0 && progress < 100 && (
                                      <span
                                        className={cn(
                                          "text-[10px] ml-auto flex-shrink-0 tabular-nums",
                                          task.priority === "HIGH" || task.completed
                                            ? "text-white/80"
                                            : "text-black/70"
                                        )}
                                      >
                                        {progress}%
                                      </span>
                                    )}
                                  </div>

                                  {/* Resize Handles */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-black/20 rounded-l z-10"
                                    onMouseDown={(e) => handleResizeStart(e, task.id, "left", task)}
                                  />
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-black/20 rounded-r z-10"
                                    onMouseDown={(e) => handleResizeStart(e, task.id, "right", task)}
                                  />
                                </div>
                              ))}

                            {/* Tooltip */}
                            {hoveredTask === task.id && position && !isMilestone && (
                              <div
                                className="absolute bg-slate-900 text-white text-xs rounded-lg px-3 py-2 z-50 pointer-events-none shadow-lg"
                                style={{
                                  left: position.left + position.width / 2,
                                  top: -60,
                                  transform: "translateX(-50%)",
                                }}
                              >
                                <div className="font-medium">{task.name}</div>
                                <div className="text-slate-300">
                                  {task.startDate &&
                                    format(parseISO(task.startDate), "MMM d")}{" "}
                                  →{" "}
                                  {task.dueDate &&
                                    format(parseISO(task.dueDate), "MMM d")}
                                </div>
                                {progress > 0 && (
                                  <div className="text-slate-300">
                                    Progress: {progress}%
                                  </div>
                                )}
                                <div className="absolute left-1/2 -bottom-1 w-2 h-2 bg-slate-900 rotate-45 -translate-x-1/2" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}

              {/* Add Section Row */}
              <div className="flex border-b" style={{ height: rowHeight }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn("border-r", col.isWeekend && "bg-slate-50")}
                    style={{ width: config.columnWidth }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
        sectionId={filteredSections[0]?.id}
      />
    </div>
  );
}
