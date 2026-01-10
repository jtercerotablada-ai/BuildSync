"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  List,
  Columns,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  Settings,
  ChevronDown,
  ChevronRight,
  Star,
  Share2,
  MoreHorizontal,
  Check,
  Globe,
  Lock,
  Layers,
  ArrowLeftRight,
  Paperclip,
  MessageSquare,
  Heart,
  Link2,
  Maximize2,
  X,
  BarChart3,
  FileText,
  Loader2,
  Flag,
  FolderPlus,
  ChevronLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// Types
interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
  assignee: { id: string; name: string | null; email: string | null; image: string | null } | null;
  project: { id: string; name: string; color: string } | null;
  section: { id: string; name: string } | null;
  subtasks?: { id: string; name: string; completed: boolean }[];
  _count: { subtasks: number; comments: number; attachments: number };
}

interface SmartSection {
  id: string;
  name: string;
  collapsed: boolean;
  tasks: Task[];
}

type ViewType = "list" | "board" | "calendar" | "dashboard" | "files";

export default function MyTasksPage() {
  const { data: session } = useSession();
  const [view, setView] = useState<ViewType>("list");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [sections, setSections] = useState<SmartSection[]>([]);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks?myTasks=true");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
        organizeTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  function organizeTasks(taskList: Task[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const recentlyAssigned: Task[] = [];
    const doToday: Task[] = [];
    const doNextWeek: Task[] = [];
    const doLater: Task[] = [];

    taskList.forEach((task) => {
      if (task.completed) return;

      if (!task.dueDate) {
        recentlyAssigned.push(task);
      } else {
        const dueDate = new Date(task.dueDate);
        if (dueDate <= today) {
          doToday.push(task);
        } else if (dueDate <= nextWeek) {
          doNextWeek.push(task);
        } else {
          doLater.push(task);
        }
      }
    });

    setSections([
      { id: "recently-assigned", name: "Recently assigned", collapsed: false, tasks: recentlyAssigned },
      { id: "do-today", name: "Do today", collapsed: false, tasks: doToday },
      { id: "do-next-week", name: "Do next week", collapsed: false, tasks: doNextWeek },
      { id: "do-later", name: "Do later", collapsed: false, tasks: doLater },
    ]);
  }

  function toggleSection(sectionId: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s))
    );
  }

  async function handleToggleComplete(task: Task) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  }

  async function handleAddTask(name: string, sectionId: string): Promise<boolean> {
    if (!name.trim()) return false;

    try {
      let dueDate: string | null = null;
      const now = new Date();

      if (sectionId === "do-today") {
        dueDate = now.toISOString();
      } else if (sectionId === "do-next-week") {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        dueDate = nextWeek.toISOString();
      } else if (sectionId === "do-later") {
        const later = new Date(now);
        later.setDate(later.getDate() + 14);
        dueDate = later.toISOString();
      }

      // API auto-assigns to current user when no assigneeId provided
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dueDate }),
      });

      if (res.ok) {
        await fetchTasks();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error creating task:", error);
      return false;
    }
  }

  function openTaskDetail(task: Task) {
    setSelectedTask(task);
    setTaskPanelOpen(true);
  }

  function formatDueDate(dateStr: string | null): { text: string; className: string } {
    if (!dateStr) return { text: "", className: "text-slate-400" };

    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - today.getDay()));

    if (date < today) {
      return { text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), className: "text-red-500" };
    } else if (date.toDateString() === today.toDateString()) {
      return { text: "Today", className: "text-green-600" };
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return { text: "Tomorrow", className: "text-slate-600" };
    } else if (date <= thisWeekEnd) {
      return { text: date.toLocaleDateString("en-US", { weekday: "long" }), className: "text-slate-600" };
    } else {
      return { text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), className: "text-slate-500" };
    }
  }

  const viewTabs = [
    { id: "list", label: "List", icon: List },
    { id: "board", label: "Board", icon: Columns },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "files", label: "Files", icon: FileText },
  ];

  const userInitial = session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || "U";

  return (
    <div className="h-full flex flex-col bg-white">
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user?.image || undefined} />
            <AvatarFallback className="bg-slate-900 text-white text-sm">{userInitial}</AvatarFallback>
          </Avatar>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xl font-semibold hover:bg-slate-100 px-2 py-1 rounded">
                My tasks
                <ChevronDown className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Rename view</DropdownMenuItem>
              <DropdownMenuItem>Duplicate view</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">Delete view</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="text-slate-400 hover:text-yellow-500">
            <Star className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Customize
          </Button>
        </div>
      </div>

      {/* VIEW TABS */}
      <div className="flex items-center gap-1 px-6 border-b">
        {viewTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as ViewType)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-sm border-b-2 -mb-px transition-colors",
                view === tab.id
                  ? "text-slate-900 border-slate-900"
                  : "text-slate-500 border-transparent hover:text-slate-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md ml-1">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add task
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Plus className="w-4 h-4 mr-2" />
                Add task
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add section
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Flag className="w-4 h-4 mr-2" />
                Add milestone
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm">
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
          <Button variant="ghost" size="sm">
            <ArrowUpDown className="w-4 h-4 mr-1" />
            Sort
          </Button>
          <Button variant="ghost" size="sm">
            <LayoutGrid className="w-4 h-4 mr-1" />
            Group
          </Button>
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4 mr-1" />
            Options
          </Button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search tasks..."
            className="pl-9 w-48 h-8"
          />
        </div>
      </div>

      {/* COLUMN HEADERS - Only show in List view */}
      {view === "list" && (
        <div className="flex items-center px-6 py-2 border-b bg-slate-50 text-sm text-slate-500">
          <div className="w-8" />
          <div className="flex-1">Task name</div>
          <div className="w-[120px]">Due date</div>
          <div className="w-[100px]">Collaborators</div>
          <div className="w-[180px]">Projects</div>
          <div className="w-[140px]">Visibility</div>
          <button className="w-8 text-slate-400 hover:text-slate-600">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex">
        <div className={cn("flex-1 overflow-auto", taskPanelOpen && "pr-0")}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : view === "list" ? (
            <div>
              {sections.map((section) => (
                <TaskSection
                  key={section.id}
                  section={section}
                  onToggleSection={() => toggleSection(section.id)}
                  onToggleComplete={handleToggleComplete}
                  onTaskClick={openTaskDetail}
                  onAddTask={handleAddTask}
                  formatDueDate={formatDueDate}
                />
              ))}

              {/* Add section button */}
              <button className="flex items-center gap-2 px-6 py-3 text-slate-500 hover:text-slate-700 hover:bg-slate-50 w-full text-left">
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add section</span>
              </button>
            </div>
          ) : view === "board" ? (
            <BoardView
              sections={sections}
              onToggleComplete={handleToggleComplete}
              onTaskClick={openTaskDetail}
              onAddTask={handleAddTask}
              formatDueDate={formatDueDate}
            />
          ) : view === "calendar" ? (
            <CalendarView tasks={tasks} />
          ) : view === "dashboard" ? (
            <DashboardView tasks={tasks} sections={sections} />
          ) : (
            <FilesView />
          )}
        </div>

        {/* Task Detail Panel */}
        {taskPanelOpen && selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setTaskPanelOpen(false)}
            onUpdate={fetchTasks}
            formatDueDate={formatDueDate}
          />
        )}
      </div>
    </div>
  );
}

// Task Section Component
function TaskSection({
  section,
  onToggleSection,
  onToggleComplete,
  onTaskClick,
  onAddTask,
  formatDueDate,
}: {
  section: SmartSection;
  onToggleSection: () => void;
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (name: string, sectionId: string) => Promise<boolean>;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    if (!newTaskName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const success = await onAddTask(newTaskName.trim(), section.id);
      if (success) {
        setNewTaskName("");
        // Keep input open for adding more tasks
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setNewTaskName("");
      setIsAddingTask(false);
    }
  };

  return (
    <div className="border-b">
      {/* Section header */}
      <button
        onClick={onToggleSection}
        className="flex items-center gap-2 px-6 py-2 w-full hover:bg-slate-50 text-left"
      >
        {section.collapsed ? (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
        <span className="font-medium text-slate-900">{section.name}</span>
        {section.tasks.length > 0 && (
          <span className="text-slate-400 text-sm">{section.tasks.length}</span>
        )}
      </button>

      {/* Tasks */}
      {!section.collapsed && (
        <div>
          {section.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleComplete={() => onToggleComplete(task)}
              onClick={() => onTaskClick(task)}
              formatDueDate={formatDueDate}
            />
          ))}

          {/* Add task input - always at the end */}
          {isAddingTask ? (
            <div className="flex items-center px-6 py-2 group">
              <button
                className="w-4 h-4 rounded-full border-2 border-slate-300 mr-3 flex-shrink-0"
                disabled
              />
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (newTaskName.trim()) {
                    handleSubmit();
                  } else {
                    setIsAddingTask(false);
                  }
                }}
                placeholder="Write a task name..."
                className="flex-1 bg-transparent outline-none text-sm"
                autoFocus
                disabled={isCreating}
              />
              {isCreating && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-2" />}
            </div>
          ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="flex items-center gap-2 px-6 py-2 text-slate-400 hover:text-slate-600 w-full text-left hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add a task...</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Task Row Component
function TaskRow({
  task,
  onToggleComplete,
  onClick,
  formatDueDate,
}: {
  task: Task;
  onToggleComplete: () => void;
  onClick: () => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const dueDateInfo = formatDueDate(task.dueDate);

  return (
    <div
      onClick={onClick}
      className="flex items-center px-6 py-2 hover:bg-slate-50 cursor-pointer group"
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete();
        }}
        className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0",
          task.completed
            ? "bg-green-500 border-green-500"
            : "border-slate-300 hover:border-slate-400"
        )}
      >
        {task.completed && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Task name + indicators */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className={cn(
          "text-sm truncate",
          task.completed && "line-through text-slate-400"
        )}>
          {task.name}
        </span>
        {task._count.subtasks > 0 && (
          <span className="text-xs text-slate-400 flex items-center flex-shrink-0">
            <Layers className="w-3 h-3 mr-0.5" />
            {task._count.subtasks}
          </span>
        )}
        {task._count.attachments > 0 && (
          <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
        )}
        {task._count.comments > 0 && (
          <span className="text-xs text-slate-400 flex items-center flex-shrink-0">
            <MessageSquare className="w-3 h-3 mr-0.5" />
            {task._count.comments}
          </span>
        )}
      </div>

      {/* Due date */}
      <div className="w-[120px] flex-shrink-0">
        <span className={cn("text-sm", dueDateInfo.className)}>
          {dueDateInfo.text}
        </span>
      </div>

      {/* Collaborators */}
      <div className="w-[100px] flex-shrink-0">
        {task.assignee && (
          <Avatar className="w-6 h-6">
            <AvatarImage src={task.assignee.image || undefined} />
            <AvatarFallback className="text-xs bg-slate-200">
              {task.assignee.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Projects */}
      <div className="w-[180px] flex-shrink-0">
        {task.project && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: task.project.color }}
            />
            <span className="text-sm text-slate-600 truncate">
              {task.project.name}
            </span>
          </div>
        )}
      </div>

      {/* Visibility */}
      <div className="w-[140px] flex-shrink-0">
        <span className="text-sm text-slate-500 flex items-center gap-1">
          <Globe className="w-3 h-3" />
          My workspace
        </span>
      </div>

      {/* Spacer for + button column */}
      <div className="w-8 flex-shrink-0" />
    </div>
  );
}

// Board View Component
function BoardView({
  sections,
  onToggleComplete,
  onTaskClick,
  onAddTask,
  formatDueDate,
}: {
  sections: SmartSection[];
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (name: string, sectionId: string) => Promise<boolean>;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  return (
    <div className="flex gap-3 p-4 overflow-x-auto h-full">
      {sections.map((section) => (
        <BoardColumn
          key={section.id}
          section={section}
          onToggleComplete={onToggleComplete}
          onTaskClick={onTaskClick}
          onAddTask={onAddTask}
          formatDueDate={formatDueDate}
        />
      ))}

      {/* Add section column */}
      <div className="flex-shrink-0 w-72">
        <button className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg w-full">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add section</span>
        </button>
      </div>
    </div>
  );
}

function BoardColumn({
  section,
  onToggleComplete,
  onTaskClick,
  onAddTask,
  formatDueDate,
}: {
  section: SmartSection;
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (name: string, sectionId: string) => Promise<boolean>;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const taskCount = section.tasks.length;
  const completedCount = section.tasks.filter(t => t.completed).length;
  const progressPercent = taskCount > 0 ? (completedCount / taskCount) * 100 : 0;

  const handleSubmit = async () => {
    if (!newTaskName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const success = await onAddTask(newTaskName.trim(), section.id);
      if (success) {
        setNewTaskName("");
      }
    } finally {
      setIsCreating(false);
      setIsAddingTask(false);
    }
  };

  return (
    <div className="flex-shrink-0 w-72 bg-slate-100 rounded-lg flex flex-col max-h-full">
      {/* Column header */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">{section.name}</span>
            {taskCount > 0 && (
              <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full">
                {taskCount}
              </span>
            )}
          </div>
          <button className="p-1 hover:bg-slate-200 rounded">
            <MoreHorizontal className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Progress bar */}
        {taskCount > 0 && (
          <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Add task button at top */}
      <div className="px-3 pb-2">
        {isAddingTask ? (
          <Card className="p-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") {
                  setNewTaskName("");
                  setIsAddingTask(false);
                }
              }}
              onBlur={() => {
                if (newTaskName.trim()) handleSubmit();
                else setIsAddingTask(false);
              }}
              placeholder="Write a task name..."
              className="w-full text-sm outline-none"
              autoFocus
              disabled={isCreating}
            />
          </Card>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 py-1 w-full"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add task</span>
          </button>
        )}
      </div>

      {/* Task cards */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2">
        {section.tasks.map((task) => {
          const dueDateInfo = formatDueDate(task.dueDate);
          return (
            <Card
              key={task.id}
              className="p-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onTaskClick(task)}
            >
              <div className="flex items-start gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(task);
                  }}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0",
                    task.completed
                      ? "bg-green-500 border-green-500"
                      : "border-slate-300 hover:border-slate-400"
                  )}
                >
                  {task.completed && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    task.completed && "line-through text-slate-400"
                  )}>
                    {task.name}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={cn("text-xs", dueDateInfo.className)}>
                      {dueDateInfo.text}
                    </span>
                    <div className="flex items-center gap-1 text-slate-400">
                      {task._count.subtasks > 0 && (
                        <span className="text-xs flex items-center">
                          {task._count.subtasks}
                          <Layers className="w-3 h-3 ml-0.5" />
                        </span>
                      )}
                      {task._count.attachments > 0 && (
                        <Paperclip className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                  {task.project && (
                    <div className="flex items-center gap-1 mt-2">
                      <div
                        className="w-2 h-2 rounded-sm"
                        style={{ backgroundColor: task.project.color }}
                      />
                      <span className="text-xs text-slate-500 truncate">
                        {task.project.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add task at bottom (if has tasks) */}
      {taskCount > 0 && !isAddingTask && (
        <div className="px-3 py-2 border-t border-slate-200">
          <button
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-600 py-1 w-full"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add task</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Calendar View - Asana style
function CalendarView({ tasks }: { tasks: Task[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate days starting from Monday
  const getCalendarDays = () => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Get day of week (0=Sunday), convert to Monday-start (0=Monday)
    let startDay = firstDayOfMonth.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; // Convert: Sunday=6, Monday=0

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

  return (
    <div className="flex flex-col h-full">
      {/* Navigation toolbar - Asana style */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 border-b">
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
        <span className="font-medium text-slate-900 ml-2">
          {formatMonthYear(currentDate)}
        </span>
      </div>

      {/* Week header - Monday start, weekend narrower */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_0.7fr_0.7fr] border-b">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              "py-2 text-center text-xs font-medium text-slate-500 uppercase border-r last:border-r-0",
              index >= 5 && "bg-slate-50"
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
                !isCurrentMonth && "bg-slate-50/50",
                isWeekend && "bg-slate-50/30"
              )}
            >
              {/* Day number */}
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "text-sm",
                    !isCurrentMonth && "text-slate-300",
                    isToday && "bg-slate-900 text-white rounded-full w-6 h-6 flex items-center justify-center font-medium"
                  )}
                >
                  {isFirstOfMonth && isCurrentMonth
                    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
                    className="text-xs p-1 bg-white border rounded shadow-sm truncate cursor-pointer hover:bg-slate-50"
                    title={task.name}
                  >
                    {task.name}
                  </div>
                ))}
                {dayTasks.length > 2 && (
                  <span className="text-xs text-slate-400 pl-1">
                    +{dayTasks.length - 2} more
                  </span>
                )}
              </div>

              {/* Add task on hover */}
              <button className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5 transition-opacity">
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Dashboard View - Asana style with charts
function DashboardView({ tasks, sections }: { tasks: Task[]; sections: SmartSection[] }) {
  const completed = tasks.filter((t) => t.completed).length;
  const incomplete = tasks.filter((t) => !t.completed).length;
  const overdue = tasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const total = tasks.length;

  // Data for bar chart - tasks by section
  const tasksBySectionData = sections.map((section) => ({
    name: section.name.length > 12 ? section.name.substring(0, 12) + "..." : section.name,
    fullName: section.name,
    count: section.tasks.length,
  }));

  // Data for donut chart - completion status (minimalistic colors)
  const completionData = [
    { name: "Incomplete", value: incomplete, color: "#94A3B8" }, // slate-400
    { name: "Completed", value: completed, color: "#CBD5E1" }, // slate-300
  ].filter((item) => item.value > 0);

  // Data for projects chart
  const projectMap = new Map<string, { name: string; color: string; count: number }>();
  tasks.forEach((task) => {
    if (task.project) {
      const existing = projectMap.get(task.project.id);
      if (existing) {
        existing.count++;
      } else {
        projectMap.set(task.project.id, {
          name: task.project.name,
          color: task.project.color,
          count: 1,
        });
      }
    }
  });
  const tasksByProjectData = Array.from(projectMap.values()).map((p) => ({
    name: p.name.length > 12 ? p.name.substring(0, 12) + "..." : p.name,
    fullName: p.name,
    count: p.count,
  }));

  // Data for line chart - completion over time (last 14 days)
  const completionOverTimeData = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

    const tasksCreatedByDate = tasks.filter((t) => {
      const created = new Date(t.createdAt);
      return created <= date;
    }).length;

    const tasksCompletedByDate = tasks.filter((t) => {
      if (!t.completed || !t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate <= date;
    }).length;

    completionOverTimeData.push({
      date: dateStr,
      total: tasksCreatedByDate,
      completed: tasksCompletedByDate,
    });
  }

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header with Add widget button */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add widget
        </Button>
        <Button variant="ghost" size="sm" className="text-blue-600">
          Send feedback
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-sm text-slate-600">Completed tasks</p>
          <p className="text-4xl font-light text-slate-900 mt-2">{completed}</p>
          <div className="flex items-center justify-center mt-3 text-xs text-slate-400">
            <Filter className="w-3 h-3 mr-1" />
            1 filter
          </div>
        </Card>
        <Card className="p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-sm text-slate-600">Incomplete tasks</p>
          <p className="text-4xl font-light text-slate-900 mt-2">{incomplete}</p>
          <div className="flex items-center justify-center mt-3 text-xs text-slate-400">
            <Filter className="w-3 h-3 mr-1" />
            1 filter
          </div>
        </Card>
        <Card className="p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-sm text-slate-600">Overdue tasks</p>
          <p className="text-4xl font-light text-red-500 mt-2">{overdue}</p>
          <div className="flex items-center justify-center mt-3 text-xs text-slate-400">
            <Filter className="w-3 h-3 mr-1" />
            1 filter
          </div>
        </Card>
        <Card className="p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-sm text-slate-600">Total tasks</p>
          <p className="text-4xl font-light text-slate-900 mt-2">{total}</p>
          <div className="flex items-center justify-center mt-3 text-xs text-slate-400">
            <Filter className="w-3 h-3 mr-1" />
            No filters
          </div>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Tasks by Section */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Tasks by section</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tasksBySectionData}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name, props) => [value, props.payload.fullName]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#64748B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <div className="flex items-center text-xs text-slate-400">
              <Filter className="w-3 h-3 mr-1" />
              1 filter
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6">
              View all
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </Card>

        {/* Tasks by Completion Status (Donut) */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Tasks by completion status</h3>
          <div className="flex items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={completionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {completionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl font-semibold text-slate-900">{incomplete}</span>
              </div>
            </div>
            <div className="ml-6 space-y-2">
              {completionData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <div className="flex items-center text-xs text-slate-400">
              <Filter className="w-3 h-3 mr-1" />
              2 filters
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6">
              View all
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Tasks by Project */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Tasks by project</h3>
          {tasksByProjectData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tasksByProjectData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name, props) => [value, props.payload.fullName]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">
              No tasks assigned to projects yet
            </div>
          )}
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <div className="flex items-center text-xs text-slate-400">
              <Filter className="w-3 h-3 mr-1" />
              1 filter
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6">
              View all
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </Card>

        {/* Task Completion Over Time */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Task completion over time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={completionOverTimeData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#64748B"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Total"
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#CBD5E1"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Completed"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <div className="flex items-center text-xs text-slate-400">
              <Filter className="w-3 h-3 mr-1" />
              2 filters
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6">
              View all
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Files View
function FilesView() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <FileText className="h-12 w-12 text-slate-300 mb-4" />
      <h3 className="font-medium text-slate-900">No files yet</h3>
      <p className="text-sm text-slate-500 mt-1">Files attached to your tasks will appear here</p>
    </div>
  );
}

// Task Detail Panel
function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  formatDueDate,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const [taskDetail, setTaskDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description || "");
  const [activeTab, setActiveTab] = useState<"comments" | "activity">("comments");
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    fetchTaskDetail();
  }, [task.id]);

  async function fetchTaskDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const data = await res.json();
        setTaskDetail(data);
        setName(data.name);
        setDescription(data.description || "");
      }
    } catch (error) {
      console.error("Error fetching task detail:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(field: string, value: any) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        fetchTaskDetail();
        onUpdate();
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  }

  async function handleToggleComplete() {
    await handleUpdate("completed", !taskDetail?.completed);
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        setNewComment("");
        fetchTaskDetail();
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  }

  const dueDateInfo = formatDueDate(taskDetail?.dueDate);

  return (
    <div className="w-[500px] border-l bg-white h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 flex-1">
          <button onClick={handleToggleComplete}>
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center",
              taskDetail?.completed ? "bg-green-500 border-green-500" : "border-slate-300"
            )}>
              {taskDetail?.completed && <Check className="w-3 h-3 text-white" />}
            </div>
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== taskDetail?.name && handleUpdate("name", name)}
            className="text-lg font-medium flex-1 outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm"><Heart className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm"><Paperclip className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm"><Link2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm"><Maximize2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Visibility */}
          <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 flex items-center gap-1">
            <Globe className="h-3 w-3" />
            This task is visible to everyone in My Workspace
          </div>

          {/* Metadata */}
          <div className="p-4 space-y-4 border-b">
            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-slate-500">Assignee</span>
              <div className="flex items-center gap-2">
                {taskDetail?.assignee ? (
                  <>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-slate-200">
                        {taskDetail.assignee.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{taskDetail.assignee.name}</span>
                  </>
                ) : (
                  <span className="text-sm text-slate-400">No assignee</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-slate-500">Due date</span>
              <span className={cn("text-sm", dueDateInfo.className)}>
                {dueDateInfo.text || "No due date"}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-slate-500">Projects</span>
              {taskDetail?.project ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: taskDetail.project.color }} />
                  <span className="text-sm">{taskDetail.project.name}</span>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="text-slate-400 h-auto p-0">+ Add to project</Button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-slate-500">Priority</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0">
                    <span className={cn("text-sm",
                      taskDetail?.priority === "HIGH" ? "text-red-600" :
                      taskDetail?.priority === "MEDIUM" ? "text-amber-600" :
                      taskDetail?.priority === "LOW" ? "text-blue-600" : "text-slate-400"
                    )}>
                      {taskDetail?.priority || "None"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "HIGH")}>
                    <span className="text-red-600">High</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "MEDIUM")}>
                    <span className="text-amber-600">Medium</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "LOW")}>
                    <span className="text-blue-600">Low</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "NONE")}>
                    <span className="text-slate-400">None</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Description */}
          <div className="p-4 border-b">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Description</h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== taskDetail?.description && handleUpdate("description", description)}
              placeholder="What is this task about?"
              className="w-full p-2 text-sm border rounded-md resize-none min-h-[80px] outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {/* Subtasks */}
          <div className="p-4 border-b">
            <h4 className="text-sm font-medium text-slate-700 mb-2">
              Subtasks ({taskDetail?.subtasks?.length || 0})
            </h4>
            <div className="space-y-2">
              {taskDetail?.subtasks?.map((subtask: any) => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                    subtask.completed ? "bg-green-500 border-green-500" : "border-slate-300"
                  )}>
                    {subtask.completed && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={cn("text-sm", subtask.completed && "line-through text-slate-400")}>
                    {subtask.name}
                  </span>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-slate-500 w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Add subtask
              </Button>
            </div>
          </div>

          {/* Activity Tabs */}
          <div className="border-b">
            <div className="flex gap-4 px-4">
              <button
                onClick={() => setActiveTab("comments")}
                className={cn(
                  "py-2 text-sm font-medium border-b-2 -mb-px",
                  activeTab === "comments" ? "text-slate-900 border-slate-900" : "text-slate-500 border-transparent"
                )}
              >
                Comments
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "py-2 text-sm font-medium border-b-2 -mb-px",
                  activeTab === "activity" ? "text-slate-900 border-slate-900" : "text-slate-500 border-transparent"
                )}
              >
                All activity
              </button>
            </div>
          </div>

          {/* Activity Content */}
          <div className="p-4 space-y-4">
            {activeTab === "comments" ? (
              <>
                {taskDetail?.comments?.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-slate-200">
                        {comment.author?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comment.author?.name}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{comment.content}</p>
                    </div>
                  </div>
                ))}
                {(!taskDetail?.comments || taskDetail.comments.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">No comments yet</p>
                )}
              </>
            ) : (
              <>
                {taskDetail?.activities?.map((activity: any) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-slate-200">
                        {activity.user?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium">{activity.user?.name}</span>
                      <span className="text-slate-500"> {activity.type.replace(/_/g, " ").toLowerCase()}</span>
                      <span className="text-slate-400 text-xs ml-2">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Comment Input */}
      <div className="p-4 border-t">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-slate-900 text-white">U</AvatarFallback>
          </Avatar>
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
            className="flex-1"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Collaborators:</span>
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-slate-900 text-white">U</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="text-slate-500">Leave task</Button>
      </div>
    </div>
  );
}
