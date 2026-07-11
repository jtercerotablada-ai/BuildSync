"use client";

/**
 * /teams/[teamId]/calendar — Team Calendar (Asana "Calendario" parity).
 *
 * Thin wrapper around the shared CalendarView (the same component the
 * project Calendar tab uses), fed with every task from the team's
 * projects. That inherits the whole Asana feature set for free:
 *
 *   - Multi-day tasks render as spanning bars (startDate → dueDate)
 *     that pack into lanes, so stacking many activities stays clean
 *     instead of overlapping.
 *   - Weekend columns styling, infinite week scroll, Today jump,
 *     live month label.
 *   - "No date (N)" drawer for dateless tasks.
 *   - Inline "+ Add" task creation on any day, drag to reschedule.
 *
 * Clicking a task opens the TaskDetailPanel — the same slide-in panel
 * as the project views (assignee, dates, projects, description,
 * subtasks, comments) — instead of navigating away.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TeamHeader } from "@/components/teams/team-header";
import { CalendarView } from "@/components/views/calendar-view";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  startDate?: string | null;
  priority: string;
  taskType?: "TASK" | "MILESTONE" | "APPROVAL" | null;
  assignee?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
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
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [firstProjectId, setFirstProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/tasks`);
      if (res.ok) setTasks(await res.json());
    } catch (error) {
      console.error("Error fetching team tasks:", error);
    }
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [teamRes, tasksRes, projectsRes] = await Promise.all([
          fetch(`/api/teams/${teamId}`),
          fetch(`/api/teams/${teamId}/tasks`),
          fetch(`/api/teams/${teamId}/projects`),
        ]);
        if (cancelled) return;
        if (teamRes.ok) setTeam(await teamRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (projectsRes.ok) {
          const projects = await projectsRes.json();
          // The shared CalendarView's inline "+ Add" creates the task in
          // this project — the team's first project, mirroring the
          // POST /api/teams/[teamId]/tasks fallback.
          if (Array.isArray(projects) && projects.length > 0) {
            setFirstProjectId(projects[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Team not found
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <TeamHeader team={team} activeTab="calendar" />

      {/* CalendarView is flex-col h-full; give it the remaining height. */}
      <div className="flex-1 min-h-0">
        <CalendarView
          sections={[
            { id: "team-tasks", name: "Team tasks", position: 0, tasks },
          ]}
          onTaskClick={(taskId) => setSelectedTaskId(taskId)}
          projectId={firstProjectId}
          onTaskMutated={fetchTasks}
        />
      </div>

      {/* Task detail slide-in — same panel as the project views. */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={fetchTasks}
        />
      )}
    </div>
  );
}
