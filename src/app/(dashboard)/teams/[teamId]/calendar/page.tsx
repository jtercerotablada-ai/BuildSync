"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Add days from previous month to fill the first week
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push(date);
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Add days from next month to complete the last week
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}

export default function TeamCalendarPage() {
  const params = useParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const today = new Date();
  const days = getDaysInMonth(
    currentDate.getFullYear(),
    currentDate.getMonth()
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const [teamRes, tasksRes] = await Promise.all([
          fetch(`/api/teams/${teamId}`),
          fetch(`/api/teams/${teamId}/tasks`),
        ]);

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          setTeam(teamData);
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [teamId]);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getTasksForDate = (date: Date): Task[] => {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      return isSameDay(new Date(task.dueDate), date);
    });
  };

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return <div>Equipo no encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamHeader team={team} activeTab="calendar" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white border rounded-xl p-6">
            {/* Calendar header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                >
                  Hoy
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateMonth("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateMonth("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isToday = isSameDay(date, today);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const dateTasks = getTasksForDate(date);

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "aspect-square p-1 rounded-lg transition-colors relative",
                      isCurrentMonth
                        ? "hover:bg-gray-100"
                        : "text-gray-300 hover:bg-gray-50",
                      isSelected && "bg-blue-100 hover:bg-blue-100",
                      isToday && "ring-2 ring-blue-500"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm",
                        isToday && "font-bold text-blue-600"
                      )}
                    >
                      {date.getDate()}
                    </span>

                    {/* Task indicators */}
                    {dateTasks.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1">
                        {dateTasks.slice(0, 3).map((task, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              task.completed
                                ? "bg-gray-300"
                                : task.project?.color
                                ? ""
                                : "bg-blue-500"
                            )}
                            style={
                              task.project?.color
                                ? { backgroundColor: task.project.color }
                                : undefined
                            }
                          />
                        ))}
                        {dateTasks.length > 3 && (
                          <span className="text-[8px] text-gray-400">
                            +{dateTasks.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected date details */}
          <div className="bg-white border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                  : "Select a date"}
              </h3>

              {selectedDate && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                  const name = prompt('Nombre de la tarea:');
                  if (!name?.trim()) return;
                  const dateStr = selectedDate.toISOString().split('T')[0];
                  fetch(`/api/teams/${teamId}/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name.trim(), dueDate: dateStr }),
                  }).then(async res => {
                    if (res.ok) {
                      const task = await res.json();
                      setTasks(prev => [...prev, task]);
                      toast.success('Tarea agregada');
                    } else {
                      toast.error('Error al crear tarea');
                    }
                  }).catch(() => toast.error('Error al crear tarea'));
                }}>
                  <Plus className="h-3 w-3" />
                  Agregar
                </Button>
              )}
            </div>

            {selectedDate ? (
              selectedDateTasks.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateTasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "p-3 border rounded-lg",
                        task.completed && "opacity-50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => {
                            const updated = !task.completed;
                            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: updated } : t));
                            fetch(`/api/tasks/${task.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ completed: updated }),
                            }).then(res => {
                              if (res.ok) toast.success(updated ? 'Tarea completada' : 'Tarea reabierta');
                            });
                          }}
                          className="mt-0.5 rounded cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium text-gray-900",
                              task.completed && "line-through"
                            )}
                          >
                            {task.name}
                          </p>
                          {task.project && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div
                                className="w-2 h-2 rounded"
                                style={{
                                  backgroundColor: task.project.color,
                                }}
                              />
                              <span className="text-xs text-gray-500">
                                {task.project.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CalendarIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    No tasks for this day
                  </p>
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Click on a day to see tasks
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
