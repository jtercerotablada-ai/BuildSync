"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { CreateObjectiveDialog } from "@/components/goals/create-objective-dialog";
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Plus,
  FolderKanban,
  Target,
  ArrowRight,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface DashboardStats {
  dueToday: number;
  overdue: number;
  completedThisWeek: number;
  activeProjects: number;
}

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
  _count?: {
    tasks: number;
  };
}

interface Task {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface Objective {
  id: string;
  name: string;
  progress: number;
  status: string;
}

export function HomeContent() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, projectsRes, tasksRes, objectivesRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/projects?limit=5"),
        fetch("/api/tasks?myTasks=true"),
        fetch("/api/objectives?limit=5"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const upcoming: Task[] = [];
        const overdue: Task[] = [];
        const completed: Task[] = [];

        tasksData.forEach((task: Task) => {
          if (task.completed) {
            completed.push(task);
          } else if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            if (dueDate < today) {
              overdue.push(task);
            } else if (dueDate <= nextWeek) {
              upcoming.push(task);
            }
          } else {
            upcoming.push(task);
          }
        });

        setUpcomingTasks(upcoming.slice(0, 5));
        setOverdueTasks(overdue.slice(0, 5));
        setCompletedTasks(completed.slice(0, 5));
      }

      if (objectivesRes.ok) {
        const objectivesData = await objectivesRes.json();
        setObjectives(objectivesData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });

      if (response.ok) {
        toast.success(completed ? "Task marked as incomplete" : "Task completed!");
        fetchData(); // Refresh data
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleTaskClick = (task: Task) => {
    if (task.projectId) {
      router.push(`/projects/${task.projectId}?task=${task.id}`);
    } else {
      router.push(`/my-tasks?task=${task.id}`);
    }
  };

  const handleProjectCreated = () => {
    fetchData();
  };

  const handleGoalCreated = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* My Tasks Widget */}
      <Card className="col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">My tasks</CardTitle>
            <CardDescription>Tasks assigned to you</CardDescription>
          </div>
          <Link href="/my-tasks">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upcoming">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upcoming" className="text-xs">
                <Clock className="mr-1 h-3 w-3" />
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="overdue" className="text-xs">
                <AlertCircle className="mr-1 h-3 w-3" />
                Overdue
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                <CheckSquare className="mr-1 h-3 w-3" />
                Completed
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4">
              {upcomingTasks.length === 0 ? (
                <EmptyTaskState type="upcoming" />
              ) : (
                <TaskList
                  tasks={upcomingTasks}
                  onToggle={handleToggleTask}
                  onClick={handleTaskClick}
                />
              )}
            </TabsContent>
            <TabsContent value="overdue" className="mt-4">
              {overdueTasks.length === 0 ? (
                <EmptyTaskState type="overdue" />
              ) : (
                <TaskList
                  tasks={overdueTasks}
                  onToggle={handleToggleTask}
                  onClick={handleTaskClick}
                />
              )}
            </TabsContent>
            <TabsContent value="completed" className="mt-4">
              {completedTasks.length === 0 ? (
                <EmptyTaskState type="completed" />
              ) : (
                <TaskList
                  tasks={completedTasks}
                  onToggle={handleToggleTask}
                  onClick={handleTaskClick}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Projects Widget */}
      <Card className="col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Projects</CardTitle>
            <CardDescription>Your recent projects</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateProject(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <EmptyProjectState onCreateClick={() => setShowCreateProject(true)} />
          ) : (
            <ProjectList projects={projects} />
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Quick overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard
              label="Tasks due today"
              value={stats?.dueToday ?? 0}
              icon={<Clock className="h-4 w-4" />}
              color="blue"
            />
            <StatCard
              label="Overdue tasks"
              value={stats?.overdue ?? 0}
              icon={<AlertCircle className="h-4 w-4" />}
              color="red"
            />
            <StatCard
              label="Completed this week"
              value={stats?.completedThisWeek ?? 0}
              icon={<CheckSquare className="h-4 w-4" />}
              color="green"
            />
            <StatCard
              label="Active projects"
              value={stats?.activeProjects ?? 0}
              icon={<FolderKanban className="h-4 w-4" />}
              color="purple"
            />
          </div>
        </CardContent>
      </Card>

      {/* Goals Widget */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Goals</CardTitle>
            <CardDescription>Track your objectives and key results</CardDescription>
          </div>
          <Link href="/goals">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {objectives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="font-medium text-slate-900">No goals yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Set goals to track your team&apos;s progress and align everyone on what matters most.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setShowCreateGoal(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create a goal
              </Button>
            </div>
          ) : (
            <GoalsList objectives={objectives} />
          )}
        </CardContent>
      </Card>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onProjectCreated={handleProjectCreated}
      />

      {/* Create Goal Dialog */}
      <CreateObjectiveDialog
        open={showCreateGoal}
        onOpenChange={setShowCreateGoal}
        onObjectiveCreated={handleGoalCreated}
      />
    </div>
  );
}

function TaskList({
  tasks,
  onToggle,
  onClick
}: {
  tasks: Task[];
  onToggle: (taskId: string, completed: boolean) => void;
  onClick: (task: Task) => void;
}) {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-3 rounded-lg border p-3 hover:bg-slate-50 transition-colors cursor-pointer"
          onClick={() => onClick(task)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => onToggle(task.id, task.completed)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${task.completed ? "text-slate-500 line-through" : "text-slate-900"}`}>
              {task.name}
            </p>
            {task.project && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: task.project.color }}
                />
                <span className="text-xs text-slate-500">{task.project.name}</span>
              </div>
            )}
          </div>
          {task.dueDate && (
            <span className="text-xs text-slate-500">
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <Link key={project.id} href={`/projects/${project.id}`}>
          <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-slate-50 transition-colors">
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center text-white font-medium text-sm"
              style={{ backgroundColor: project.color }}
            >
              {project.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{project.name}</p>
              <p className="text-xs text-slate-500">
                {project._count?.tasks ?? 0} tasks
              </p>
            </div>
            <StatusBadge status={project.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function GoalsList({ objectives }: { objectives: Objective[] }) {
  return (
    <div className="space-y-3">
      {objectives.map((objective) => (
        <Link key={objective.id} href={`/goals/${objective.id}`}>
          <div className="rounded-lg border p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-900">{objective.name}</p>
              <StatusBadge status={objective.status} />
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${objective.progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{objective.progress}% complete</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    ON_TRACK: "bg-green-100 text-green-700",
    AT_RISK: "bg-yellow-100 text-yellow-700",
    OFF_TRACK: "bg-red-100 text-red-700",
    ON_HOLD: "bg-slate-100 text-slate-700",
    COMPLETE: "bg-blue-100 text-blue-700",
    ACHIEVED: "bg-green-100 text-green-700",
  };

  const statusLabels: Record<string, string> = {
    ON_TRACK: "On track",
    AT_RISK: "At risk",
    OFF_TRACK: "Off track",
    ON_HOLD: "On hold",
    COMPLETE: "Complete",
    ACHIEVED: "Achieved",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[status] || "bg-slate-100 text-slate-700"}`}>
      {statusLabels[status] || status}
    </span>
  );
}

function EmptyTaskState({ type }: { type: "upcoming" | "overdue" | "completed" }) {
  const messages = {
    upcoming: {
      title: "No upcoming tasks",
      description: "Tasks due in the next 7 days will appear here.",
    },
    overdue: {
      title: "No overdue tasks",
      description: "You're all caught up!",
    },
    completed: {
      title: "No completed tasks",
      description: "Tasks you complete will appear here.",
    },
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <CheckSquare className="h-10 w-10 text-slate-300 mb-3" />
      <h3 className="font-medium text-slate-900">{messages[type].title}</h3>
      <p className="text-sm text-slate-500 mt-1">{messages[type].description}</p>
    </div>
  );
}

function EmptyProjectState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <FolderKanban className="h-10 w-10 text-slate-300 mb-3" />
      <h3 className="font-medium text-slate-900">No projects yet</h3>
      <p className="text-sm text-slate-500 mt-1">
        Create a project to start organizing your work.
      </p>
      <Button
        className="mt-4"
        variant="outline"
        size="sm"
        onClick={onCreateClick}
      >
        <Plus className="mr-2 h-4 w-4" />
        Create project
      </Button>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "red" | "green" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <div className={`rounded-lg p-2 ${colorClasses[color]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
