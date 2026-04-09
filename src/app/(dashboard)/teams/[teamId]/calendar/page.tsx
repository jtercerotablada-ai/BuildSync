"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TeamHeader } from "@/components/teams/team-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Task {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
  project?: {
    id: string;
    name: string;
    color: string;
  };
  assignee?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface TeamProject {
  id: string;
  name: string;
  color: string;
}

interface Team {
  id: string;
  name: string;
  avatar: string | null;
  members: Array<{
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
}

export default function TeamCalendarPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamProjects, setTeamProjects] = useState<TeamProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Create task dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, [teamId]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [teamRes, tasksRes, projectsRes] = await Promise.all([
          fetch(`/api/teams/${teamId}`),
          fetch(`/api/teams/${teamId}/tasks`),
          fetch(`/api/teams/${teamId}/projects`),
        ]);

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          setTeam(teamData);
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData);
        }

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setTeamProjects(projectsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [teamId]);

  // Calculate calendar days (Monday-start)
  const getCalendarDays = () => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Get day of week (0=Sunday), convert to Monday-start (0=Monday)
    let startDay = firstDayOfMonth.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Days from previous month
    for (let i = startDay; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    // Days of current month
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    // Days from next month to complete 6 weeks
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const tasksByDate = tasks.reduce((acc, task) => {
    if (task.dueDate) {
      const date = new Date(task.dueDate).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(task);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1));
  const goToToday = () => setCurrentDate(new Date());

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const handleAddClick = (date: Date) => {
    setSelectedDate(date);
    setNewTaskName("");
    setNewTaskProjectId("");
    setShowCreateDialog(true);
  };

  const handleTaskClick = (task: Task) => {
    if (task.project) {
      router.push(`/projects/${task.project.id}?task=${task.id}`);
    } else {
      router.push(`/my-tasks?task=${task.id}`);
    }
  };

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedDate || isCreating) return;

    setIsCreating(true);
    try {
      const dateStr = selectedDate.toISOString().split("T")[0];
      const res = await fetch(`/api/teams/${teamId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          dueDate: dateStr,
          ...(newTaskProjectId ? { projectId: newTaskProjectId } : {}),
        }),
      });

      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [...prev, task]);
        setShowCreateDialog(false);
        setNewTaskName("");
        setNewTaskProjectId("");
        toast.success("Task created");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create task");
      }
    } catch {
      toast.error("Failed to create task");
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return <div>Team not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamHeader team={team} activeTab="calendar" />

      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Navigation toolbar */}
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-b bg-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevMonth}
            className="h-8 w-8"
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
            onClick={goToNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-medium text-black ml-2">
            {formatMonthYear(currentDate)}
          </span>
        </div>

        {/* Week header - Monday start, weekend narrower */}
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_0.7fr_0.7fr] border-b bg-white">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={cn(
                "py-2 text-center text-xs font-medium text-black uppercase border-r last:border-r-0",
                index >= 5 && "bg-white"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-[1fr_1fr_1fr_1fr_1fr_0.7fr_0.7fr] auto-rows-fr overflow-auto">
          {calendarDays.map(({ date, isCurrentMonth }, index) => {
            const dateStr = date.toDateString();
            const dayTasks = tasksByDate[dateStr] || [];
            const isToday = dateStr === new Date().toDateString();
            const isWeekend = index % 7 >= 5;
            const dayNum = date.getDate();
            const isFirstOfMonth = dayNum === 1;

            return (
              <div
                key={dateStr}
                className={cn(
                  "border-r border-b p-1 min-h-[90px] group relative",
                  !isCurrentMonth && "bg-white/50",
                  isWeekend && "bg-white/30"
                )}
              >
                {/* Day number */}
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      "text-sm",
                      !isCurrentMonth && "text-slate-300",
                      isToday &&
                        "bg-black text-white rounded-full w-6 h-6 flex items-center justify-center font-medium"
                    )}
                  >
                    {isFirstOfMonth && isCurrentMonth
                      ? date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : dayNum}
                  </span>
                  {dayTasks.length > 2 && (
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2" />
                  )}
                </div>

                {/* Tasks */}
                <div className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className="text-xs p-1 bg-white border rounded shadow-sm truncate cursor-pointer hover:bg-gray-50"
                      title={task.name}
                      onClick={() => handleTaskClick(task)}
                    >
                      {task.name}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <span className="text-xs text-black pl-1">
                      +{dayTasks.length - 2} more
                    </span>
                  )}
                </div>

                {/* Add task on hover */}
                <button
                  className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 text-xs text-black hover:text-black flex items-center gap-0.5 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddClick(date);
                  }}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taskName">Task name</Label>
              <Input
                id="taskName"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Enter task name..."
                autoFocus
              />
            </div>

            {teamProjects.length > 0 && (
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={newTaskProjectId}
                  onValueChange={setNewTaskProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded"
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                Due:{" "}
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newTaskName.trim() || isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
