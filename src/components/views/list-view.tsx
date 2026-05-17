"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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
  CalendarDays,
  MessageSquare,
  Paperclip,
  MoreHorizontal,
  User,
  Pencil,
  Trash2,
  CheckCircle2,
  ArrowRight,
  X,
  Check,
  Diamond,
  ThumbsUp,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import { AddColumnDropdown } from "@/components/tasks/add-column-dropdown";
import { CustomFieldModal } from "@/components/tasks/custom-field-modal";
import { CustomFieldCell } from "@/components/tasks/custom-field-cell";
import type { FieldTypeConfig } from "@/lib/field-types";

// Per-project custom field metadata returned by
// GET /api/projects/:id/custom-fields.
interface CustomFieldOption {
  id: string;
  label: string;
  color?: string;
}
interface CustomFieldDef {
  id: string;
  linkId: string;
  position: number;
  name: string;
  type:
    | "TEXT"
    | "NUMBER"
    | "DATE"
    | "DROPDOWN"
    | "MULTI_SELECT"
    | "PEOPLE"
    | "CHECKBOX"
    | "CURRENCY"
    | "PERCENTAGE";
  options: CustomFieldOption[] | null;
  isRequired: boolean;
}
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { kanbanCollisionDetection } from "@/lib/kanban-collision-detection";

type TaskType = "TASK" | "MILESTONE" | "APPROVAL";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  // Optional so legacy rows / cached pages keep rendering; the API
  // serializes the enum verbatim when present and the UI swaps the
  // round checkbox for a Diamond (milestone) or ThumbsUp (approval).
  taskType?: TaskType | null;
  // Workflow status set by the user — independent of completed.
  // Drives the Status pill color (on track / at risk / off track).
  // Falsy → derived state (To do / Overdue / Done) is shown instead.
  taskStatus?: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | null;
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

  // Custom field definitions linked to this project + a bulk map of
  // every CustomFieldValue keyed by taskId → fieldId. Both refetch when
  // the modal creates a new field and when a task edit elsewhere
  // changes a value.
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, Record<string, unknown>>
  >({});

  const reloadCustomFields = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/custom-fields`);
      if (res.ok) {
        const data: CustomFieldDef[] = await res.json();
        setCustomFieldDefs(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silent — fields are optional metadata; the list still renders.
    }
  }, [projectId]);

  const reloadCustomFieldValues = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/custom-fields/values`
      );
      if (res.ok) {
        const data: Record<string, Record<string, unknown>> = await res.json();
        setCustomFieldValues(data ?? {});
      }
    } catch {
      // Silent — empty values just render empty cells.
    }
  }, [projectId]);

  useEffect(() => {
    reloadCustomFields();
    reloadCustomFieldValues();
  }, [reloadCustomFields, reloadCustomFieldValues]);

  // Refetch values whenever the task list changes (a task elsewhere
  // may have edited a custom field via the detail panel).
  useEffect(() => {
    reloadCustomFieldValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // Grid template adapts to the number of custom-field columns.
  // Order: checkbox · Name · Assignee · Due date · Priority · Status ·
  // N × custom (140px each) · "+ add column" (40px).
  //
  // Checkbox column widened from 32px → 48px so the GripVertical
  // drag handle (14px) + gap (4px) + completion icon (16px) fit
  // inside the column. With the old 32px, content overflowed into
  // the Name column and the task title visually touched the circle.
  const gridTemplate = useMemo(() => {
    const customCols = customFieldDefs.map(() => "140px").join(" ");
    return `48px 1fr 140px 130px 90px 90px${customCols ? ` ${customCols}` : ""} 40px`;
  }, [customFieldDefs]);

  // Drag & drop state — same pattern as my-tasks ListDndProvider.
  // localSections is the optimistic source of truth during a drag so
  // the user sees the task land in the new position before the server
  // round-trip completes. handleDragOver mutates it cross-section;
  // handleDragEnd commits the final position to the server.
  const [localSections, setLocalSections] = useState<Section[]>(sections);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const isDraggingRef = useRef(false);
  const dragSourceSectionRef = useRef<string | null>(null);

  // Sync from server props — but never clobber an in-flight drag.
  useEffect(() => {
    if (isDraggingRef.current) return;
    setLocalSections(sections);
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const allTaskIds = useMemo(
    () => localSections.flatMap((s) => s.tasks.map((t) => t.id)),
    [localSections]
  );
  const allSelected = allTaskIds.length > 0 && allTaskIds.every((id) => selectedTasks.has(id));
  const someSelected = selectedTasks.size > 0;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    isDraggingRef.current = true;
    for (const section of localSections) {
      const task = section.tasks.find((t) => t.id === id);
      if (task) {
        setActiveTask(task);
        dragSourceSectionRef.current = section.id;
        break;
      }
    }
  }, [localSections]);

  // Mid-drag updater that runs entirely inside setLocalSections so
  // there are no stale closure reads of localSections. This is the
  // exact pattern that makes the my-tasks list drag visually fluid
  // across columns without the dreaded bounce-back.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    setLocalSections((prev) => {
      const srcSection = prev.find((s) =>
        s.tasks.some((t) => t.id === activeId)
      );
      if (!srcSection) return prev;

      let destSection = prev.find((s) => s.id === overId);
      if (!destSection) {
        destSection = prev.find((s) =>
          s.tasks.some((t) => t.id === overId)
        );
      }
      if (!destSection || srcSection.id === destSection.id) return prev;

      const task = srcSection.tasks.find((t) => t.id === activeId);
      if (!task) return prev;

      return prev.map((s) => {
        if (s.id === srcSection.id) {
          return { ...s, tasks: s.tasks.filter((t) => t.id !== activeId) };
        }
        if (s.id === destSection!.id) {
          const idx = s.tasks.findIndex((t) => t.id === overId);
          const newTasks = [...s.tasks];
          if (idx >= 0) newTasks.splice(idx, 0, task);
          else newTasks.push(task);
          return { ...s, tasks: newTasks };
        }
        return s;
      });
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const originalSourceId = dragSourceSectionRef.current;
      setActiveTask(null);
      dragSourceSectionRef.current = null;
      isDraggingRef.current = false;

      if (!over) return;
      const activeId = active.id as string;
      const overId = over.id as string;

      // Resolve destination section from current localSections
      // (which handleDragOver has already pre-mutated for cross-
      // section drags).
      let destSectionId: string | undefined;
      if (localSections.some((s) => s.id === overId)) {
        destSectionId = overId;
      } else {
        for (const s of localSections) {
          if (s.tasks.some((t) => t.id === overId)) {
            destSectionId = s.id;
            break;
          }
        }
      }
      if (!destSectionId) return;

      // Same-section path: arrayMove the local copy first so the
      // ordering we're about to persist matches what the user sees.
      let workingSections = localSections;
      if (originalSourceId === destSectionId && overId !== destSectionId) {
        const section = workingSections.find((s) => s.id === destSectionId);
        if (section) {
          const oldIndex = section.tasks.findIndex((t) => t.id === activeId);
          const newIndex = section.tasks.findIndex((t) => t.id === overId);
          if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
            workingSections = workingSections.map((s) =>
              s.id === section.id
                ? { ...s, tasks: arrayMove(s.tasks, oldIndex, newIndex) }
                : s
            );
            setLocalSections(workingSections);
          }
        }
      }

      // Persist the full destination order atomically. Same endpoint
      // handles both same-section reorders and cross-section moves;
      // it wraps every update in $transaction so the column is never
      // left half-renumbered on partial failure. Crucially, this
      // renumbers EVERY task in the destination section, fixing the
      // "drop lands at the wrong index" bug a single-row PATCH had.
      const destSection = workingSections.find((s) => s.id === destSectionId);
      if (!destSection) return;
      const orderedIds = destSection.tasks.map((t) => t.id);

      try {
        const res = await fetch("/api/tasks/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: destSectionId,
            orderedTaskIds: orderedIds,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        router.refresh();
      } catch {
        toast.error("Failed to move task");
        setLocalSections(sections); // rollback to server truth
      }
    },
    [localSections, sections, router]
  );

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

  const saveInlineEdit = async (
    taskId: string,
    field: string,
    value: string | boolean | null
  ) => {
    cancelEditing();
    const body: Record<string, unknown> = {};
    if (field === "name") {
      if (typeof value !== "string" || !value.trim()) return;
      body.name = value.trim();
    } else if (field === "dueDate") {
      body.dueDate = value || null;
    } else if (field === "priority") {
      body.priority = value;
    } else if (field === "taskStatus") {
      // Pass-through: null clears the status pill back to derived
      // (To do / Overdue), otherwise sets ON_TRACK / AT_RISK / OFF_TRACK.
      body.taskStatus = value;
    } else if (field === "completed") {
      body.completed = value;
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

  // Mobile helpers
  const isOverdue = (dueDate: string) => {
    const date = parseISO(dueDate);
    return isPast(date) && !isToday(date);
  };
  const formatMobileDate = (dueDate: string) => {
    const date = parseISO(dueDate);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  return (
    <div className="flex flex-col h-full">
      {/* ========================================= */}
      {/* COLUMN HEADERS - ONLY ONCE AT THE TOP    */}
      {/* ========================================= */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
        <div
          // Excel/Asana-style grid: vertical dividers between every
          // column via `[&>*+*]:border-l`, internal cell padding via
          // `[&>*]:px-2` so the borders sit flush against cell content
          // instead of floating in a gap-2 whitespace strip.
          className="hidden md:grid px-6 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider [&>*]:px-2 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*]:flex [&>*]:items-center"
          style={{ gridTemplateColumns: gridTemplate }}
        >
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
          {/* Custom field columns — one header per project-linked
              CustomFieldDefinition. Header label only; clicking the
              header could open a config dropdown in a future iteration. */}
          {customFieldDefs.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-1 truncate"
              title={field.name}
            >
              <span className="truncate">{field.name}</span>
            </div>
          ))}
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

      {/* Sections and Tasks — wrapped in DndContext so rows can be
          dragged within a section (reorder) and across sections
          (move). The pattern matches my-tasks ListDndProvider: source
          row is hidden via opacity:0 during drag, a portal-mounted
          DragOverlay renders the ghost, no bounce-back. */}
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
      <div className="flex-1 overflow-auto">
        {localSections.map((section) => (
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
                    className="font-semibold text-slate-900 bg-transparent outline-none border-b-2 border-[#c9a84c] px-1"
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
                    className="text-black"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Section Content */}
            {expandedSections.has(section.id) && (
              <SortableContext
                items={section.tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
                id={section.id}
              >
              <div>
                {/* Tasks */}
                {section.tasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    sectionId={section.id}
                    onTaskClick={onTaskClick}
                    handleTaskComplete={handleTaskComplete}
                    isOverdue={isOverdue}
                    formatMobileDate={formatMobileDate}
                    selectedTasks={selectedTasks}
                    someSelected={someSelected}
                    toggleTaskSelection={toggleTaskSelection}
                    editingTaskId={editingTaskId}
                    editingField={editingField}
                    editingValue={editingValue}
                    setEditingValue={setEditingValue}
                    startEditing={startEditing}
                    cancelEditing={cancelEditing}
                    saveInlineEdit={saveInlineEdit}
                    customFieldDefs={customFieldDefs}
                    customFieldValuesForTask={customFieldValues[task.id] ?? {}}
                    gridTemplate={gridTemplate}
                  />
                ))}

                {/* Add Task Input - Inline */}
                <div
                  className="grid grid-cols-[32px_1fr] md:[grid-template-columns:var(--list-grid)] gap-2 px-3 md:px-6 py-2 items-center border-t border-slate-100"
                  style={{ "--list-grid": gridTemplate } as React.CSSProperties}>
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
                  {/* Empty placeholders matching custom-field columns */}
                  {customFieldDefs.map((f) => (
                    <div key={f.id} className="hidden md:block"></div>
                  ))}
                  <div className="hidden md:block"></div>
                </div>
              </div>
              </SortableContext>
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

      {/* DragOverlay — portal-mounted ghost that follows the cursor.
          The source row gets opacity:0 while this ghost is alive, so
          the drop never reads as a snap-back. */}
      {typeof window !== "undefined" &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeTask && <TaskRowOverlay task={activeTask} />}
          </DragOverlay>,
          document.body
        )}
      </DndContext>

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
            className="text-black hover:bg-black/30 hover:text-gray-300 gap-1.5 h-7 text-xs"
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

      {/* Custom Field Modal — on successful create we refetch the
          project's field list so the new column appears immediately. */}
      <CustomFieldModal
        open={customFieldModalOpen}
        onOpenChange={setCustomFieldModalOpen}
        initialFieldType={preselectedFieldType ?? undefined}
        initialFieldName={preselectedFieldName}
        initialTab={initialTab}
        projectId={projectId}
        onFieldCreated={() => {
          reloadCustomFields();
          reloadCustomFieldValues();
        }}
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

// =============================================================
// TASK COMPLETION ICON
// =============================================================
// MILESTONE → gold Diamond, APPROVAL → gold ThumbsUp, default
// regular task → round checkbox. AEC users immediately recognize
// the icons (Diamond = milestone is industry standard since
// MS Project / Primavera).
function TaskCompletionIcon({
  task,
  onToggle,
  size = "default",
}: {
  task: Task;
  onToggle: (e: React.MouseEvent) => void;
  size?: "default" | "small";
}) {
  const dim = size === "small" ? "w-4 h-4" : "h-5 w-5";

  if (task.taskType === "MILESTONE") {
    return (
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-center flex-shrink-0",
          task.completed ? "text-[#a8893a]" : "text-[#c9a84c] hover:text-[#a8893a]"
        )}
        aria-label={task.completed ? "Mark milestone incomplete" : "Mark milestone complete"}
      >
        <Diamond className={dim} />
      </button>
    );
  }
  if (task.taskType === "APPROVAL") {
    return (
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-center flex-shrink-0",
          task.completed ? "text-[#a8893a]" : "text-[#c9a84c] hover:text-[#a8893a]"
        )}
        aria-label={task.completed ? "Mark approval incomplete" : "Approve"}
      >
        <ThumbsUp className={dim} />
      </button>
    );
  }
  return (
    <button
      onClick={onToggle}
      className={cn(
        size === "small"
          ? "w-[18px] h-[18px]"
          : "h-5 w-5",
        "rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
        task.completed
          ? "bg-[#c9a84c] border-[#c9a84c]"
          : "border-gray-300 hover:border-gray-400"
      )}
      aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
    >
      {task.completed && <Check className="h-3 w-3 text-white" />}
    </button>
  );
}

// =============================================================
// SORTABLE TASK ROW
// =============================================================
// Wraps each row in useSortable so dnd-kit can register it as a
// sortable item. The grip lives on the whole row (mirroring
// my-tasks' approach) — a quick click still opens the slide-over,
// a real drag motion starts the sortable drag past the 6px
// activation threshold defined in ListView's sensor config.

interface SortableTaskRowProps {
  task: Task;
  sectionId: string;
  onTaskClick: (taskId: string) => void;
  handleTaskComplete: (e: React.MouseEvent, taskId: string, completed: boolean) => void;
  isOverdue: (dueDate: string) => boolean;
  formatMobileDate: (dueDate: string) => string;
  selectedTasks: Set<string>;
  someSelected: boolean;
  toggleTaskSelection: (taskId: string, e: React.MouseEvent) => void;
  editingTaskId: string | null;
  editingField: string | null;
  editingValue: string;
  setEditingValue: (v: string) => void;
  startEditing: (taskId: string, field: string, currentValue: string) => void;
  cancelEditing: () => void;
  // Widened to string | boolean | null so the Status dropdown can
  // pass a boolean (completed toggle) or null (clear taskStatus)
  // through the same plumbing as name/dueDate/priority text edits.
  saveInlineEdit: (
    taskId: string,
    field: string,
    value: string | boolean | null
  ) => Promise<void>;
  /** Custom field columns to render to the right of Status, before
   *  the "+" placeholder. */
  customFieldDefs: CustomFieldDef[];
  /** Map of fieldId → value for this task. */
  customFieldValuesForTask: Record<string, unknown>;
  /** CSS gridTemplateColumns string the row should use so the row
   *  aligns with the header. */
  gridTemplate: string;
}

function SortableTaskRow({
  task,
  onTaskClick,
  handleTaskComplete,
  isOverdue,
  formatMobileDate,
  selectedTasks,
  someSelected,
  toggleTaskSelection,
  editingTaskId,
  editingField,
  editingValue,
  setEditingValue,
  startEditing,
  cancelEditing,
  saveInlineEdit,
  customFieldDefs,
  customFieldValuesForTask,
  gridTemplate,
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  // Hide the source row entirely while dragging — the portal-mounted
  // DragOverlay paints the visual ghost. Anything other than full
  // opacity:0 here reads as a "snap back" the moment the ghost fades.
  const dragStyle: React.CSSProperties = isDragging
    ? { opacity: 0, transition }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const completionIcon = (
    <TaskCompletionIcon
      task={task}
      onToggle={(e) => {
        e.stopPropagation();
        handleTaskComplete(e, task.id, task.completed);
      }}
    />
  );

  return (
    <div ref={setNodeRef} style={dragStyle} {...attributes} {...listeners}>
      {/* ===== Mobile Task Card ===== */}
      <div
        className="md:hidden mobile-task-card"
        onClick={() => onTaskClick(task.id)}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{completionIcon}</div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-medium leading-tight",
                task.completed && "line-through text-gray-400"
              )}
            >
              {task.name}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {task.dueDate && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                    !task.completed && isOverdue(task.dueDate)
                      ? "bg-gray-100 text-black"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  <CalendarDays className="h-3 w-3" />
                  {formatMobileDate(task.dueDate)}
                </span>
              )}
              {task.priority && task.priority !== "NONE" && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                    task.priority === "HIGH"
                      ? "bg-gray-100 text-black"
                      : task.priority === "MEDIUM"
                        ? "bg-[#a8893a]/10 text-[#a8893a]"
                        : "bg-[#c9a84c]/10 text-[#a8893a]"
                  )}
                >
                  {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                </span>
              )}
              {task._count.subtasks > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  {task.subtasks.filter((s) => s.completed).length}/
                  {task._count.subtasks} subtasks
                </span>
              )}
            </div>
            {task.assignee && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 overflow-hidden">
                  {task.assignee.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={task.assignee.image}
                      className="h-full w-full object-cover"
                      alt=""
                    />
                  ) : (
                    task.assignee.name?.[0]
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {task.assignee.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Desktop Grid Row =====
          Vertical + horizontal dividers ALL use slate-200 so the
          column lines align visually with the header (header was
          slate-200 but rows used slate-100 which was nearly invisible
          on white — looked like the columns were misaligned). */}
      <div
        className="hidden md:grid px-6 py-2 hover:bg-slate-50 cursor-pointer items-center border-t border-slate-200 group [&>*]:px-2 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*]:min-w-0"
        style={{ gridTemplateColumns: gridTemplate }}
        onClick={() => onTaskClick(task.id)}
      >
        {/* Checkbox - select or complete (icon swaps per task type) */}
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
          <GripVertical
            className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            aria-hidden
          />
          {someSelected ? (
            <Checkbox
              checked={selectedTasks.has(task.id)}
              onClick={(e) => toggleTaskSelection(task.id, e)}
              className={cn(
                "rounded",
                selectedTasks.has(task.id) &&
                  "border-[#c9a84c] data-[state=checked]:bg-[#c9a84c]"
              )}
            />
          ) : (
            <TaskCompletionIcon
              task={task}
              onToggle={(e) => {
                e.stopPropagation();
                handleTaskComplete(e, task.id, task.completed);
              }}
              size="small"
            />
          )}
        </div>

        {/* Task Name — clicking the name (or anywhere in this column)
            opens the slide-over panel. Inline rename moved to a
            dedicated Pencil icon that surfaces on hover, matching
            the my-tasks pattern. */}
        <div className="flex items-center gap-2 min-w-0">
          {editingTaskId === task.id && editingField === "name" ? (
            <input
              type="text"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  saveInlineEdit(task.id, "name", editingValue);
                if (e.key === "Escape") cancelEditing();
              }}
              onBlur={() => saveInlineEdit(task.id, "name", editingValue)}
              className="w-full px-1 py-0.5 text-sm outline-none border-b-2 border-[#c9a84c] bg-transparent"
              autoFocus
            />
          ) : (
            <>
              <span
                className={cn(
                  "truncate text-sm",
                  task.completed && "line-through text-slate-400"
                )}
                onDoubleClick={(e) => {
                  // Asana parity — double-click jumps straight into
                  // inline rename. Single click stays as "open panel"
                  // (the row's onClick) so single-click users aren't
                  // surprised. stopPropagation prevents the row click
                  // from racing the edit-mode swap.
                  e.stopPropagation();
                  startEditing(task.id, "name", task.name);
                }}
              >
                {task.name}
              </span>
              {/* Hover-only rename trigger — keeps inline edit
                  available without hijacking the row's open-panel
                  click. */}
              <button
                type="button"
                aria-label="Rename task"
                title="Rename"
                className="p-0.5 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(task.id, "name", task.name);
                }}
              >
                <Pencil className="h-3 w-3" />
              </button>
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
            </>
          )}
        </div>

        {/* Assignee */}
        <div>
          {task.assignee ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={task.assignee.image || ""} />
                <AvatarFallback className="text-xs bg-[#d4b65a] text-white">
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
              onKeyDown={(e) => {
                if (e.key === "Escape") cancelEditing();
              }}
              className="text-sm border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-500 w-full"
              autoFocus
            />
          ) : (
            <div
              className="cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1"
              onClick={() =>
                startEditing(
                  task.id,
                  "dueDate",
                  task.dueDate ? task.dueDate.split("T")[0] : ""
                )
              }
            >
              {task.dueDate ? (
                <DueDateBadge
                  dueDate={task.dueDate}
                  completed={task.completed}
                />
              ) : (
                <span className="text-slate-400 text-sm">---</span>
              )}
            </div>
          )}
        </div>

        {/* Priority - Inline Editable */}
        <div onClick={(e) => e.stopPropagation()}>
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
                  <span className="text-slate-400 text-sm">---</span>
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

        {/* Status — clickable pill that opens a dropdown to set
            workflow status (On track / At risk / Off track), toggle
            completion, or clear back to the derived state. Mirrors
            the Priority cell's inline-edit pattern. */}
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 w-full text-left">
                {(() => {
                  // Display priority:
                  //   1. completed → "Done" (gold)
                  //   2. explicit taskStatus → that label + color
                  //   3. dueDate in the past → "Overdue" (black)
                  //   4. otherwise → "To do" (gold soft)
                  if (task.completed) {
                    return (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-[#c9a84c]/10 text-[#a8893a] border-[#c9a84c]/30"
                      >
                        Done
                      </Badge>
                    );
                  }
                  if (task.taskStatus === "ON_TRACK") {
                    return (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-[#dff1e6] text-[#1d6b3e] border-[#1d6b3e]/30"
                      >
                        On track
                      </Badge>
                    );
                  }
                  if (task.taskStatus === "AT_RISK") {
                    return (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-[#fbeed3] text-[#7a5b1b] border-[#a8893a]/40"
                      >
                        At risk
                      </Badge>
                    );
                  }
                  if (task.taskStatus === "OFF_TRACK") {
                    return (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-black text-white border-black"
                      >
                        Off track
                      </Badge>
                    );
                  }
                  if (
                    task.dueDate &&
                    isPast(parseISO(task.dueDate)) &&
                    !isToday(parseISO(task.dueDate))
                  ) {
                    return (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-gray-100 text-black border-gray-300"
                      >
                        Overdue
                      </Badge>
                    );
                  }
                  return (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-[#c9a84c]/10 text-[#a8893a] border-[#c9a84c]/30"
                    >
                      To do
                    </Badge>
                  );
                })()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => saveInlineEdit(task.id, "taskStatus", "ON_TRACK")}
                className={cn(task.taskStatus === "ON_TRACK" && "bg-slate-100")}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-[#1d6b3e] mr-2" />
                On track
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => saveInlineEdit(task.id, "taskStatus", "AT_RISK")}
                className={cn(task.taskStatus === "AT_RISK" && "bg-slate-100")}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-[#a8893a] mr-2" />
                At risk
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => saveInlineEdit(task.id, "taskStatus", "OFF_TRACK")}
                className={cn(task.taskStatus === "OFF_TRACK" && "bg-slate-100")}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-black mr-2" />
                Off track
              </DropdownMenuItem>
              {task.taskStatus && (
                <DropdownMenuItem
                  onClick={() => saveInlineEdit(task.id, "taskStatus", null)}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-300 mr-2" />
                  Clear status
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  saveInlineEdit(task.id, "completed", !task.completed)
                }
              >
                <Check className="mr-2 h-4 w-4 text-[#a8893a]" />
                {task.completed ? "Mark incomplete" : "Mark complete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Custom field value cells — one per project-linked field.
            Read-only here; editing happens inside the task detail
            panel (CustomFieldsSection) which has type-aware inputs. */}
        {customFieldDefs.map((field) => (
          <div
            key={field.id}
            className="overflow-hidden flex items-center"
            onClick={(e) => e.stopPropagation()}
            title={field.name}
          >
            <CustomFieldCell
              type={field.type}
              options={field.options}
              value={customFieldValuesForTask[field.id] ?? null}
            />
          </div>
        ))}

        {/* Empty column for "+" */}
        <div></div>
      </div>
    </div>
  );
}

// =============================================================
// DRAG OVERLAY — simplified row painted over the cursor
// =============================================================
function TaskRowOverlay({ task }: { task: Task }) {
  return (
    <div className="bg-white border-2 border-[#c9a84c] rounded-md shadow-2xl px-4 py-2 flex items-center gap-3 min-w-[480px] max-w-[720px] pointer-events-none rotate-[0.5deg]">
      <TaskCompletionIcon
        task={task}
        onToggle={() => {}}
        size="small"
      />
      <span
        className={cn(
          "text-sm font-medium truncate flex-1",
          task.completed && "line-through text-slate-400"
        )}
      >
        {task.name}
      </span>
      {task.dueDate && (
        <DueDateBadge dueDate={task.dueDate} completed={task.completed} />
      )}
      {task.assignee && (
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={task.assignee.image || ""} />
          <AvatarFallback className="text-xs bg-[#d4b65a] text-white">
            {task.assignee.name?.[0] || "?"}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
