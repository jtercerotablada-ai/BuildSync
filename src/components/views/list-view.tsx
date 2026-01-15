"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  MessageSquare,
  Paperclip,
  MoreHorizontal,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { toast } from "sonner";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  subtasks: { id: string; completed: boolean }[];
  _count: {
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

interface ListViewProps {
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  onAddTask: (sectionId?: string) => void;
  projectId: string;
}

const PRIORITY_COLORS = {
  NONE: "",
  LOW: "bg-white text-black border border-black",
  MEDIUM: "bg-white text-black border border-black",
  HIGH: "bg-white text-black border border-black",
};

const PRIORITY_LABELS = {
  NONE: "",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export function ListView({
  sections,
  onTaskClick,
  onAddTask,
  projectId,
}: ListViewProps) {
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map((s) => s.id))
  );
  const [addingTaskInSection, setAddingTaskInSection] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleTaskComplete = async (
    e: React.MouseEvent,
    taskId: string,
    completed: boolean
  ) => {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      toast.success(completed ? "Task marked incomplete" : "Task completed");
      router.refresh();
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleAddTaskSubmit = async (sectionId: string) => {
    if (!newTaskName.trim()) {
      setAddingTaskInSection(null);
      setNewTaskName("");
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          projectId,
          sectionId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create task");
      }

      toast.success("Task created");
      router.refresh();
      setNewTaskName("");
      setAddingTaskInSection(null);
    } catch {
      toast.error("Failed to create task");
    }
  };

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

      if (!response.ok) {
        throw new Error("Failed to create section");
      }

      toast.success("Section created");
      router.refresh();
    } catch {
      toast.error("Failed to create section");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ========================================= */}
      {/* COLUMN HEADERS - ONLY ONCE AT THE TOP    */}
      {/* ========================================= */}
      <div className="sticky top-0 bg-white border-b z-10">
        <div className="grid grid-cols-[32px_1fr_140px_130px_90px_90px_40px] gap-2 px-6 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div></div>
          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
            Name
            <ChevronDown className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
            Assignee
            <ChevronDown className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
            Due date
            <ChevronDown className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
            Priority
            <ChevronDown className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
            Status
            <ChevronDown className="w-3 h-3" />
          </div>
          {/* Add column button */}
          <div className="flex items-center justify-center">
            <button className="p-1 hover:bg-slate-100 rounded" title="Add column">
              <Plus className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Sections and Tasks */}
      <div className="flex-1 overflow-auto">
        {sections.map((section) => (
          <div key={section.id} className="border-b border-slate-200">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="flex items-center gap-2 px-6 py-2 w-full hover:bg-slate-50 text-left group"
            >
              {expandedSections.has(section.id) ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              <span className="font-semibold text-slate-900">{section.name}</span>
              <MoreHorizontal className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" />
            </button>

            {/* Section Content */}
            {expandedSections.has(section.id) && (
              <div>
                {/* Tasks */}
                {section.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[32px_1fr_140px_130px_90px_90px_40px] gap-2 px-6 py-2 hover:bg-slate-50 cursor-pointer items-center border-t border-slate-100 group"
                    onClick={() => onTaskClick(task.id)}
                  >
                    {/* Checkbox */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={task.completed}
                        onClick={(e) =>
                          handleTaskComplete(e, task.id, task.completed)
                        }
                        className="rounded-full"
                      />
                    </div>

                    {/* Task Name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "truncate text-sm",
                          task.completed && "line-through text-slate-400"
                        )}
                      >
                        {task.name}
                      </span>
                      {task._count.subtasks > 0 && (
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {task.subtasks.filter((s) => s.completed).length}/
                          {task._count.subtasks}
                        </span>
                      )}
                      {task._count.comments > 0 && (
                        <MessageSquare className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      )}
                      {task._count.attachments > 0 && (
                        <Paperclip className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      )}
                    </div>

                    {/* Assignee */}
                    <div>
                      {task.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={task.assignee.image || ""} />
                            <AvatarFallback className="text-xs bg-amber-400 text-white">
                              {task.assignee.name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-slate-700 truncate">
                            {task.assignee.name}
                          </span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                          <User className="w-3 h-3 text-slate-300" />
                        </div>
                      )}
                    </div>

                    {/* Due Date */}
                    <div>
                      {task.dueDate ? (
                        <DueDateBadge dueDate={task.dueDate} completed={task.completed} />
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </div>

                    {/* Priority */}
                    <div>
                      {task.priority && task.priority !== "NONE" ? (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]
                          )}
                        >
                          {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <span className="text-slate-400 text-sm">—</span>
                    </div>

                    {/* Empty column for "+" */}
                    <div></div>
                  </div>
                ))}

                {/* Add Task Input - Inline */}
                <div className="grid grid-cols-[32px_1fr_140px_130px_90px_90px_40px] gap-2 px-6 py-2 items-center border-t border-slate-100">
                  <div></div>
                  <div>
                    {addingTaskInSection === section.id ? (
                      <input
                        type="text"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddTaskSubmit(section.id);
                          }
                          if (e.key === "Escape") {
                            setAddingTaskInSection(null);
                            setNewTaskName("");
                          }
                        }}
                        onBlur={() => {
                          if (!newTaskName.trim()) {
                            setAddingTaskInSection(null);
                            setNewTaskName("");
                          }
                        }}
                        placeholder="Task name"
                        className="w-full px-2 py-1 text-sm outline-none bg-transparent"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => setAddingTaskInSection(section.id)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add task...
                      </button>
                    )}
                  </div>
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add Section Button */}
        <button
          onClick={handleAddSection}
          className="flex items-center gap-2 px-6 py-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 w-full text-left"
        >
          <Plus className="w-4 h-4" />
          Add section
        </button>
      </div>
    </div>
  );
}

function DueDateBadge({
  dueDate,
  completed,
}: {
  dueDate: string;
  completed: boolean;
}) {
  const date = parseISO(dueDate);
  const isOverdue = !completed && isPast(date) && !isToday(date);

  let label = format(date, "MMM d");
  if (isToday(date)) label = "Today";
  if (isTomorrow(date)) label = "Tomorrow";

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm",
        isOverdue ? "text-black" : "text-slate-600",
        completed && "text-slate-400"
      )}
    >
      <Calendar className="h-3 w-3" />
      {label}
    </div>
  );
}
