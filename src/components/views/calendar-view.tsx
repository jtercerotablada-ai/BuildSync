"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Plus,
  Filter,
  Settings,
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
  // GET TASKS FOR A DAY (simple: due date matches)
  // ============================================

  const getTasksForDay = (day: Date) => {
    return allTasks.filter((task) => {
      if (!task.dueDate) return false;
      const taskDue = parseISO(task.dueDate);
      return isSameDay(taskDue, day);
    });
  };

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
        <span className="font-medium text-black ml-2">
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

      {/* Calendar Days */}
      <div className={cn("flex-1 grid auto-rows-fr overflow-auto", gridCols)}>
          {calendarDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const isWeek = viewMode === "week";
            const dayOfWeek = day.getDay();
            const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
            const maxVisible = isWeek ? 20 : 2;
            const dayNum = day.getDate();
            const isFirstOfMonth = dayNum === 1;

            return (
              <div
                key={dateStr}
                className={cn(
                  "border-r border-b p-0.5 md:p-1 group relative",
                  isWeek ? "min-h-[400px]" : "min-h-[90px]",
                  !isCurrentMonth && !isWeek && "bg-white/50",
                  isWeekendDay && showWeekends && "bg-white/30"
                )}
              >
                {/* Day number */}
                <div className="flex items-start justify-between">
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
                  {dayTasks.length > maxVisible && (
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2" />
                  )}
                </div>

                {/* Tasks */}
                <div className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, maxVisible).map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "text-xs p-0.5 md:p-1 bg-white border rounded shadow-sm truncate cursor-pointer hover:bg-white",
                        task.completed && "line-through text-slate-400 opacity-60"
                      )}
                      title={task.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task.id);
                      }}
                    >
                      <span className="hidden md:inline">{task.name}</span>
                      <span className="md:hidden w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    </div>
                  ))}
                  {dayTasks.length > maxVisible && (
                    <span className="text-xs text-black pl-1">
                      +{dayTasks.length - maxVisible} more
                    </span>
                  )}
                </div>

                {/* Hover: Add Task Button or Inline Input */}
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
                    className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 text-xs text-black hover:text-black flex items-center gap-0.5 transition-opacity"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
    </div>
  );
}
