"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Settings,
  ChevronDown,
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
  isToday,
  parseISO,
  differenceInDays,
  isPast,
} from "date-fns";
import { toast } from "sonner";

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
// PRIORITY COLORS
// ============================================

const PRIORITY_COLORS: Record<string, string> = {
  NONE: "#3B82F6", // blue
  LOW: "#60A5FA", // blue-400
  MEDIUM: "#FBBF24", // yellow
  HIGH: "#F97316", // orange
};

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
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [isCreatingTask, setIsCreatingTask] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // Flatten all tasks
  const allTasks = useMemo(() => {
    return sections.flatMap((section) =>
      section.tasks.map((task) => ({
        ...task,
        sectionId: section.id,
        sectionName: section.name,
      }))
    );
  }, [sections]);

  // ============================================
  // GENERATE CALENDAR DAYS
  // ============================================

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // ============================================
  // GET TASKS FOR A DAY
  // ============================================

  const getTasksForDay = (day: Date) => {
    return allTasks.filter((task) => {
      if (!task.dueDate) return false;

      const taskEnd = parseISO(task.dueDate);
      const taskStart = task.startDate
        ? parseISO(task.startDate)
        : taskEnd;

      // Task starts on this day
      if (isSameDay(taskStart, day)) return true;

      // Multi-day task continues on this day (only show at start of week)
      if (taskStart < day && taskEnd >= day) {
        const dayOfWeek = day.getDay();
        // Monday = 1, or if it's the first day of the visible calendar
        return dayOfWeek === 1;
      }

      return false;
    });
  };

  // ============================================
  // GET ALL TASKS IN DAY (for count)
  // ============================================

  const getTasksCountForDay = (day: Date) => {
    return allTasks.filter((task) => {
      if (!task.dueDate) return false;
      const taskEnd = parseISO(task.dueDate);
      const taskStart = task.startDate ? parseISO(task.startDate) : taskEnd;
      return day >= taskStart && day <= taskEnd;
    }).length;
  };

  // ============================================
  // CALCULATE TASK BAR WIDTH (days)
  // ============================================

  const getTaskBarWidth = (task: (typeof allTasks)[0], day: Date) => {
    if (!task.dueDate) return 1;

    const taskEnd = parseISO(task.dueDate);
    const endOfWeekDay = endOfWeek(day, { weekStartsOn: 1 });
    const effectiveEnd = taskEnd > endOfWeekDay ? endOfWeekDay : taskEnd;
    const daysRemaining = differenceInDays(effectiveEnd, day) + 1;

    return Math.max(1, Math.min(daysRemaining, 7));
  };

  // ============================================
  // CHECK IF TASK IS MILESTONE (single day)
  // ============================================

  const isTaskMilestone = (task: (typeof allTasks)[0]) => {
    if (!task.dueDate) return false;
    const taskEnd = parseISO(task.dueDate);
    const taskStart = task.startDate ? parseISO(task.startDate) : taskEnd;
    return isSameDay(taskStart, taskEnd);
  };

  // ============================================
  // NAVIGATION
  // ============================================

  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
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
      // Get the first section or create one
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

  const weekDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
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
              onClick={goToPrevMonth}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextMonth}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Current Month/Year */}
          <h2 className="text-lg font-semibold ml-4">
            {format(currentDate, "MMMM yyyy")}
          </h2>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
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
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
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
              <Button variant="ghost" size="sm">
                <Filter className="w-4 h-4 mr-1" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.info("Filtering incomplete tasks")}>Incomplete tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Filtering completed tasks")}>Completed tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Filtering tasks due this week")}>Due this week</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Filtering tasks assigned to me")}>Assigned to me</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4 mr-1" />
                Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.info("Show weekends toggled")}>Show weekends</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Compact mode coming soon")}>Compact mode</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Color by project coming soon")}>Color by project</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Save view
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.success("View saved")}>Save current view</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Save as new view coming soon")}>Save as new view</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("View reset to default")}>Reset to default</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {/* Week Day Headers */}
        <div className="grid grid-cols-7 border-b bg-slate-50 sticky top-0 z-10">
          {weekDays.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-xs font-medium text-slate-500 text-center border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const isHovered = hoveredDay === dateStr;

            return (
              <div
                key={dateStr}
                className={cn(
                  "min-h-[120px] border-b border-r p-1 group relative transition-colors",
                  !isCurrentMonth && "bg-slate-50",
                  isHovered && isCurrentMonth && "bg-white"
                )}
                onMouseEnter={() => setHoveredDay(dateStr)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                      isCurrentDay && "bg-black text-white",
                      !isCurrentDay && isCurrentMonth && "text-slate-900",
                      !isCurrentDay && !isCurrentMonth && "text-slate-400"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Show month name on 1st day */}
                  {day.getDate() === 1 && (
                    <span className="text-xs text-slate-500 font-medium">
                      {format(day, "MMM")}
                    </span>
                  )}
                </div>

                {/* Tasks */}
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => {
                    const isMilestone = isTaskMilestone(task);
                    const taskColor =
                      PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.NONE;

                    if (isMilestone) {
                      // Single-day task - show as chip
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-1 text-xs cursor-pointer hover:opacity-80 transition-opacity px-1.5 py-0.5 rounded truncate",
                            task.completed && "opacity-60"
                          )}
                          style={{ backgroundColor: `${taskColor}20` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskClick(task.id);
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: taskColor }}
                          />
                          <span
                            className={cn(
                              "truncate",
                              task.completed && "line-through"
                            )}
                            style={{ color: taskColor }}
                          >
                            {task.name}
                          </span>
                        </div>
                      );
                    }

                    // Multi-day task bar
                    const barWidth = getTaskBarWidth(task, day);
                    const taskStart = task.startDate
                      ? parseISO(task.startDate)
                      : parseISO(task.dueDate!);
                    const isStart = isSameDay(taskStart, day);

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "text-xs text-white px-2 py-1 truncate cursor-pointer hover:opacity-90 transition-opacity relative z-10",
                          isStart && "rounded-l-md",
                          "rounded-r-md",
                          task.completed && "opacity-60"
                        )}
                        style={{
                          backgroundColor: task.completed ? "#22C55E" : taskColor,
                          width: `calc(${barWidth * 100}% + ${(barWidth - 1) * 1}px)`,
                          maxWidth: `calc(${barWidth * 100}% + ${(barWidth - 1) * 8}px)`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(task.id);
                        }}
                      >
                        {task.name}
                      </div>
                    );
                  })}

                  {/* Show "+N more" if there are more tasks */}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-slate-500 px-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>

                {/* Hover: Add Task Button or Input */}
                {isCreatingTask === dateStr ? (
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateTask(dateStr);
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
                    placeholder="Task name"
                    className="w-full text-xs px-2 py-1 border rounded mt-1 outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setIsCreatingTask(dateStr)}
                    className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 bg-white/80 px-1.5 py-0.5 rounded"
                  >
                    <Plus className="w-3 h-3" />
                    Add task
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
