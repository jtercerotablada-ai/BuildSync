"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Filter,
  ArrowUpDown,
  Settings,
  ZoomIn,
  ZoomOut,
  Diamond,
  Link2,
  GripVertical,
  AlertTriangle,
  Target,
  MoreHorizontal,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
// PRIORITY & STATUS COLORS
// ============================================

const PRIORITY_COLORS: Record<string, string> = {
  NONE: "#3B82F6", // blue-500
  LOW: "#60A5FA", // blue-400
  MEDIUM: "#FBBF24", // yellow-400
  HIGH: "#F97316", // orange-500
};

const STATUS_COLORS = {
  notStarted: "#9CA3AF",
  inProgress: "#3B82F6",
  completed: "#22C55E",
  delayed: "#EF4444",
  atRisk: "#F97316",
};

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
  const [showDependencies, setShowDependencies] = useState(true);
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showBaseline, setShowBaseline] = useState(false);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);

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
      // Error handling
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
  // DETERMINE IF TASK IS CRITICAL
  // ============================================

  const isTaskCritical = (task: Task) => {
    if (!task.dueDate) return false;
    const dueDate = parseISO(task.dueDate);
    const today = new Date();
    const daysUntilDue = differenceInDays(dueDate, today);
    return daysUntilDue <= 3 && !task.completed;
  };

  // ============================================
  // DETERMINE IF TASK IS A MILESTONE
  // ============================================

  const isTaskMilestone = (task: Task) => {
    if (!task.dueDate) return false;
    const taskEnd = parseISO(task.dueDate);
    const taskStart = task.startDate
      ? parseISO(task.startDate)
      : new Date(taskEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    return isSameDay(taskStart, taskEnd);
  };

  // ============================================
  // RENDER
  // ============================================

  const sidebarWidth = 280;
  const rowHeight = 44;
  const headerHeight = 80;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ============================================ */}
      {/* TOOLBAR */}
      {/* ============================================ */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
        {/* Left */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add task
            <ChevronDown className="w-3 h-3 ml-1" />
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
        <div className="flex items-center gap-2">
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

          {/* View Options */}
          <Button
            variant={showDependencies ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowDependencies(!showDependencies)}
          >
            <Link2 className="w-4 h-4 mr-1" />
            Dependencies
          </Button>
          <Button
            variant={showCriticalPath ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowCriticalPath(!showCriticalPath)}
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Critical
          </Button>
          <Button
            variant={showBaseline ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowBaseline(!showBaseline)}
          >
            <Target className="w-4 h-4 mr-1" />
            Baseline
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          <Button variant="ghost" size="sm">
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4 mr-1" />
            Options
          </Button>
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
              className="border-b bg-slate-50 px-4 flex items-center font-medium text-sm text-slate-700"
              style={{ height: headerHeight }}
            >
              Task Name
            </div>

            {/* Sections & Tasks */}
            {sections.map((section) => {
              const isCollapsed = collapsedSections.has(section.id);

              return (
                <div key={section.id}>
                  {/* Section Row */}
                  <button
                    className="flex items-center gap-2 px-4 border-b bg-slate-50 hover:bg-slate-100 cursor-pointer w-full text-left"
                    style={{ height: rowHeight }}
                    onClick={() => toggleSection(section.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="font-semibold text-sm text-slate-900">
                      {section.name}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">
                      {section.tasks.length}
                    </span>
                  </button>

                  {/* Tasks */}
                  {!isCollapsed &&
                    section.tasks.map((task) => {
                      const isMilestone = isTaskMilestone(task);
                      const isCritical = isTaskCritical(task);
                      const progress = getTaskProgress(task);

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-2 px-4 border-b hover:bg-white cursor-pointer group",
                            selectedTaskId === task.id && "bg-white"
                          )}
                          style={{ height: rowHeight }}
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            onTaskClick(task.id);
                          }}
                        >
                          <GripVertical className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100" />

                          {isMilestone ? (
                            <Diamond className="w-4 h-4 text-black" />
                          ) : (
                            <div
                              className="w-3 h-3 rounded-sm"
                              style={{
                                backgroundColor:
                                  PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.NONE,
                              }}
                            />
                          )}

                          <span
                            className={cn(
                              "text-sm truncate flex-1",
                              task.completed && "line-through text-slate-400"
                            )}
                          >
                            {task.name}
                          </span>

                          {isCritical && showCriticalPath && (
                            <AlertTriangle className="w-3 h-3 text-black" />
                          )}

                          {progress > 0 && progress < 100 && (
                            <span className="text-xs text-slate-500">{progress}%</span>
                          )}

                          {task.assignee && (
                            <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-xs font-medium text-white">
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
              className="flex items-center gap-2 px-4 text-slate-500 hover:bg-slate-50 cursor-pointer w-full text-left"
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
                    className="flex items-center justify-center text-sm font-medium text-slate-700 border-r"
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
              {sections.map((section) => {
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
                        const isCritical = isTaskCritical(task);
                        const progress = getTaskProgress(task);
                        const taskColor =
                          PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.NONE;

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
                                // Milestone Diamond
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform z-10"
                                  style={{ left: position.left }}
                                  onClick={() => onTaskClick(task.id)}
                                >
                                  <Diamond
                                    className="w-6 h-6"
                                    fill="#8B5CF6"
                                    color="#8B5CF6"
                                  />
                                </div>
                              ) : (
                                // Task Bar
                                <div
                                  className={cn(
                                    "absolute top-1.5 rounded cursor-pointer group/bar",
                                    "hover:ring-2 hover:ring-blue-400 hover:ring-offset-1",
                                    "transition-all",
                                    selectedTaskId === task.id &&
                                      "ring-2 ring-blue-500 ring-offset-1",
                                    isCritical &&
                                      showCriticalPath &&
                                      "ring-2 ring-red-400"
                                  )}
                                  style={{
                                    left: position.left,
                                    width: position.width,
                                    height: rowHeight - 12,
                                    backgroundColor: task.completed
                                      ? "#22C55E"
                                      : taskColor,
                                  }}
                                  onClick={() => onTaskClick(task.id)}
                                >
                                  {/* Progress Fill (darker overlay for remaining) */}
                                  {progress > 0 && progress < 100 && (
                                    <div
                                      className="absolute inset-0 rounded bg-black/20"
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
                                    <span className="text-xs text-white font-medium truncate">
                                      {task.name}
                                    </span>
                                    {progress > 0 && progress < 100 && (
                                      <span className="text-[10px] text-white/80 ml-auto flex-shrink-0">
                                        {progress}%
                                      </span>
                                    )}
                                  </div>

                                  {/* Resize Handles */}
                                  <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/30 rounded-l" />
                                  <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/30 rounded-r" />
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
    </div>
  );
}
