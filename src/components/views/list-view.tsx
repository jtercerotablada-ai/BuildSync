"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  MessageSquare,
  Paperclip,
  MoreHorizontal,
  User,
  Pencil,
  Trash2,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import { AddColumnDropdown } from "@/components/tasks/add-column-dropdown";
import { CustomFieldModal } from "@/components/tasks/custom-field-modal";
import type { FieldTypeConfig } from "@/lib/field-types";

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
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renamingSectionName, setRenamingSectionName] = useState("");
  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  // Multi-select state
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  // Custom field modal state
  const [customFieldModalOpen, setCustomFieldModalOpen] = useState(false);
  const [preselectedFieldType, setPreselectedFieldType] = useState<string | null>(null);
  const [preselectedFieldName, setPreselectedFieldName] = useState("");
  const [initialTab, setInitialTab] = useState<"create" | "library">("create");

  const allTaskIds = sections.flatMap((s) => s.tasks.map((t) => t.id));
  const allSelected = allTaskIds.length > 0 && allTaskIds.every((id) => selectedTasks.has(id));
  const someSelected = selectedTasks.size > 0;

  const toggleTaskSelection = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(allTaskIds));
    }
  };

  const handleBulkAction = async (action: string, value?: string) => {
    if (selectedTasks.size === 0) return;
    try {
      const response = await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: Array.from(selectedTasks),
          action,
          value,
        }),
      });
      if (!response.ok) throw new Error("Bulk action failed");
      const data = await response.json();
      toast.success(`${data.count} task${data.count > 1 ? "s" : ""} updated`);
      setSelectedTasks(new Set());
      router.refresh();
    } catch {
      toast.error("Failed to perform bulk action");
    }
  };

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

  const handleRenameSection = async (sectionId: string) => {
    if (!renamingSectionName.trim()) {
      setRenamingSectionId(null);
      return;
    }
    try {
      const response = await fetch(`/api/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renamingSectionName.trim() }),
      });
      if (!response.ok) throw new Error("Failed to rename section");
      toast.success("Section renamed");
      setRenamingSectionId(null);
      router.refresh();
    } catch {
      toast.error("Failed to rename section");
    }
  };

  const handleDeleteSection = async (sectionId: string, taskCount: number) => {
    const msg = taskCount > 0
      ? `Delete this section and its ${taskCount} task${taskCount > 1 ? "s" : ""}? This cannot be undone.`
      : "Delete this empty section?";
    if (!confirm(msg)) return;
    try {
      const response = await fetch(`/api/sections/${sectionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete section");
      toast.success("Section deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete section");
    }
  };

  const startEditing = (taskId: string, field: string, currentValue: string) => {
    setEditingTaskId(taskId);
    setEditingField(field);
    setEditingValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingField(null);
    setEditingValue("");
  };

  const saveInlineEdit = async (taskId: string, field: string, value: string) => {
    cancelEditing();
    const body: Record<string, unknown> = {};
    if (field === "name") {
      if (!value.trim()) return;
      body.name = value.trim();
    } else if (field === "dueDate") {
      body.dueDate = value || null;
    } else if (field === "priority") {
      body.priority = value;
    }
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      toast.error("Failed to update task");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ========================================= */}
      {/* COLUMN HEADERS - ONLY ONCE AT THE TOP    */}
      {/* ========================================= */}
      <div className="sticky top-0 bg-white border-b z-10">
        <div className="hidden md:grid grid-cols-[32px_1fr_140px_130px_90px_90px_40px] gap-2 px-6 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={allSelected}
              onClick={toggleSelectAll}
              className="rounded"
            />
          </div>
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
          <AddColumnDropdown
            onSelectType={(ft: FieldTypeConfig, name: string) => {
              setPreselectedFieldType(ft.id);
              setPreselectedFieldName(name);
              setInitialTab("create");
              setCustomFieldModalOpen(true);
            }}
            onFromLibrary={() => {
              setPreselectedFieldType(null);
              setPreselectedFieldName("");
              setInitialTab("library");
              setCustomFieldModalOpen(true);
            }}
          />
        </div>
      </div>

      {/* Sections and Tasks */}
      <div className="flex-1 overflow-auto">
        {sections.map((section) => (
          <div key={section.id} className="border-b border-slate-200">
            {/* Section Header */}
            <div className="flex items-center gap-2 px-3 md:px-6 py-2 hover:bg-slate-50 group">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {expandedSections.has(section.id) ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                {renamingSectionId === section.id ? (
                  <input
                    type="text"
                    value={renamingSectionName}
                    onChange={(e) => setRenamingSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") handleRenameSection(section.id);
                      if (e.key === "Escape") setRenamingSectionId(null);
                    }}
                    onBlur={() => handleRenameSection(section.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-slate-900 bg-transparent outline-none border-b-2 border-blue-500 px-1"
                    autoFocus
                  />
                ) : (
                  <span className="font-semibold text-slate-900">{section.name}</span>
                )}
                <span className="text-xs text-slate-400">{section.tasks.length}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => {
                    setRenamingSectionId(section.id);
                    setRenamingSectionName(section.name);
                  }}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename section
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAddingTaskInSection(section.id)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add task
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteSection(section.id, section.tasks.length)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Section Content */}
            {expandedSections.has(section.id) && (
              <div>
                {/* Tasks */}
                {section.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[32px_1fr_auto] md:grid-cols-[32px_1fr_140px_130px_90px_90px_40px] gap-2 px-3 md:px-6 py-2 hover:bg-slate-50 cursor-pointer items-center border-t border-slate-100 group"
                    onClick={() => onTaskClick(task.id)}
                  >
                    {/* Checkbox - select or complete */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedTasks.has(task.id) || (!someSelected && task.completed)}
                        onClick={(e) => {
                          if (someSelected) {
                            toggleTaskSelection(task.id, e);
                          } else {
                            handleTaskComplete(e, task.id, task.completed);
                          }
                        }}
                        className={cn(
                          someSelected ? "rounded" : "rounded-full",
                          selectedTasks.has(task.id) && "border-blue-600 data-[state=checked]:bg-blue-600"
                        )}
                      />
                    </div>

                    {/* Task Name - Inline Editable */}
                    <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                      {editingTaskId === task.id && editingField === "name" ? (
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveInlineEdit(task.id, "name", editingValue);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          onBlur={() => saveInlineEdit(task.id, "name", editingValue)}
                          className="w-full px-1 py-0.5 text-sm outline-none border-b-2 border-blue-500 bg-transparent"
                          autoFocus
                        />
                      ) : (
                        <span
                          className={cn(
                            "truncate text-sm cursor-text hover:bg-slate-100 px-1 py-0.5 rounded -mx-1",
                            task.completed && "line-through text-slate-400"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(task.id, "name", task.name);
                          }}
                        >
                          {task.name}
                        </span>
                      )}
                      {!(editingTaskId === task.id && editingField === "name") && (
                        <>
                          {task._count.subtasks > 0 && (
                            <span className="text-xs text-slate-500 flex-shrink-0" onClick={() => onTaskClick(task.id)}>
                              {task.subtasks.filter((s) => s.completed).length}/
                              {task._count.subtasks}
                            </span>
                          )}
                          {task._count.comments > 0 && (
                            <MessageSquare className="h-3 w-3 text-slate-400 flex-shrink-0" onClick={() => onTaskClick(task.id)} />
                          )}
                          {task._count.attachments > 0 && (
                            <Paperclip className="h-3 w-3 text-slate-400 flex-shrink-0" onClick={() => onTaskClick(task.id)} />
                          )}
                        </>
                      )}
                    </div>

                    {/* Assignee */}
                    <div className="hidden md:block">
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

                    {/* Due Date - Inline Editable */}
                    <div onClick={(e) => e.stopPropagation()}>
                      {editingTaskId === task.id && editingField === "dueDate" ? (
                        <input
                          type="date"
                          value={editingValue}
                          onChange={(e) => {
                            saveInlineEdit(task.id, "dueDate", e.target.value);
                          }}
                          onBlur={() => cancelEditing()}
                          onKeyDown={(e) => { if (e.key === "Escape") cancelEditing(); }}
                          className="text-sm border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-500 w-full"
                          autoFocus
                        />
                      ) : (
                        <div
                          className="cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1"
                          onClick={() => startEditing(task.id, "dueDate", task.dueDate ? task.dueDate.split("T")[0] : "")}
                        >
                          {task.dueDate ? (
                            <DueDateBadge dueDate={task.dueDate} completed={task.completed} />
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Priority - Inline Editable */}
                    <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 w-full text-left">
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
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {(["HIGH", "MEDIUM", "LOW", "NONE"] as const).map((p) => (
                            <DropdownMenuItem
                              key={p}
                              onClick={() => saveInlineEdit(task.id, "priority", p)}
                              className={cn(task.priority === p && "bg-slate-100")}
                            >
                              {p === "NONE" ? "No priority" : PRIORITY_LABELS[p]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Status */}
                    <div className="hidden md:block">
                      {task.completed ? (
                        <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Done
                        </Badge>
                      ) : task.dueDate && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate)) ? (
                        <Badge variant="secondary" className="text-xs bg-red-50 text-red-700 border-red-200">
                          Overdue
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          To do
                        </Badge>
                      )}
                    </div>

                    {/* Empty column for "+" */}
                    <div className="hidden md:block"></div>
                  </div>
                ))}

                {/* Add Task Input - Inline */}
                <div className="grid grid-cols-[32px_1fr] md:grid-cols-[32px_1fr_140px_130px_90px_90px_40px] gap-2 px-3 md:px-6 py-2 items-center border-t border-slate-100">
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
                  <div className="hidden md:block"></div>
                  <div className="hidden md:block"></div>
                  <div className="hidden md:block"></div>
                  <div className="hidden md:block"></div>
                  <div className="hidden md:block"></div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add Section Button */}
        <button
          onClick={handleAddSection}
          className="flex items-center gap-2 px-3 md:px-6 py-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 w-full text-left"
        >
          <Plus className="w-4 h-4" />
          Add section
        </button>
      </div>

      {/* Floating Bulk Actions Bar */}
      {someSelected && (
        <div className="sticky bottom-4 mx-auto w-fit bg-slate-900 text-white rounded-lg shadow-xl px-4 py-2 flex items-center gap-3 z-20 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">{selectedTasks.size} selected</span>
          <div className="h-4 w-px bg-slate-600" />
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-700 gap-1.5 h-7 text-xs"
            onClick={() => handleBulkAction("complete")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 gap-1.5 h-7 text-xs">
                <ArrowRight className="h-3.5 w-3.5" />
                Move to
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {sections.map((section) => (
                <DropdownMenuItem
                  key={section.id}
                  onClick={() => handleBulkAction("move_section", section.id)}
                >
                  {section.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 gap-1.5 h-7 text-xs">
                Priority
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {(["HIGH", "MEDIUM", "LOW", "NONE"] as const).map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => handleBulkAction("set_priority", p)}
                >
                  {p === "NONE" ? "No priority" : PRIORITY_LABELS[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-red-900/30 hover:text-red-300 gap-1.5 h-7 text-xs"
            onClick={() => {
              if (confirm(`Delete ${selectedTasks.size} task${selectedTasks.size > 1 ? "s" : ""}? This cannot be undone.`)) {
                handleBulkAction("delete");
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <div className="h-4 w-px bg-slate-600" />
          <button
            onClick={() => setSelectedTasks(new Set())}
            className="p-1 hover:bg-slate-700 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Custom Field Modal */}
      <CustomFieldModal
        open={customFieldModalOpen}
        onOpenChange={setCustomFieldModalOpen}
        initialFieldType={preselectedFieldType ?? undefined}
        initialFieldName={preselectedFieldName}
        initialTab={initialTab}
      />
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
