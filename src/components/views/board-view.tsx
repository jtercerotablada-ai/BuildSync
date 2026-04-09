"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { kanbanCollisionDetection } from "@/lib/kanban-collision-detection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Calendar,
  MessageSquare,
  Paperclip,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
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

interface BoardViewProps {
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  onAddTask: (sectionId?: string) => void;
  projectId: string;
}

// ============================================
// PRIORITY CONFIG
// ============================================

const PRIORITY_CONFIG: Record<string, { dot: string; label: string }> = {
  HIGH: { dot: "bg-red-500", label: "High" },
  MEDIUM: { dot: "bg-amber-500", label: "Medium" },
  LOW: { dot: "bg-blue-500", label: "Low" },
  NONE: { dot: "", label: "" },
};

// ============================================
// MAIN BOARD VIEW
// ============================================

export function BoardView({
  sections,
  onTaskClick,
  onAddTask,
  projectId,
}: BoardViewProps) {
  const router = useRouter();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [addingTaskInSection, setAddingTaskInSection] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");

  // Optimistic state: local copy of sections for instant UI updates
  const [localSections, setLocalSections] = useState<Section[]>(sections);

  // Sync local state when prop changes (after router.refresh)
  useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const dragSourceSectionRef = useRef<string | null>(null);

  // ---- DRAG START ----
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const taskId = event.active.id as string;
      for (const section of localSections) {
        const task = section.tasks.find((t) => t.id === taskId);
        if (task) {
          setActiveTask(task);
          dragSourceSectionRef.current = section.id;
          break;
        }
      }
    },
    [localSections]
  );

  // ---- DRAG OVER (optimistic cross-column move) ----
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;
      const activeId = active.id as string;
      const overId = over.id as string;

      // All logic inside updater to avoid stale closure issues
      setLocalSections((prev) => {
        const activeSection = prev.find((s) => s.tasks.some((t) => t.id === activeId));
        if (!activeSection) return prev;

        let overSection = prev.find((s) => s.id === overId);
        if (!overSection) overSection = prev.find((s) => s.tasks.some((t) => t.id === overId));
        if (!overSection || activeSection.id === overSection.id) return prev;

        const task = activeSection.tasks.find((t) => t.id === activeId);
        if (!task) return prev;

        return prev.map((section) => {
          if (section.id === activeSection.id) {
            return { ...section, tasks: section.tasks.filter((t) => t.id !== activeId) };
          }
          if (section.id === overSection!.id) {
            const overTaskIndex = section.tasks.findIndex((t) => t.id === overId);
            const newTasks = [...section.tasks];
            if (overTaskIndex >= 0) {
              newTasks.splice(overTaskIndex, 0, task);
            } else {
              newTasks.push(task);
            }
            return { ...section, tasks: newTasks };
          }
          return section;
        });
      });
    },
    []
  );

  // ---- DRAG END (persist to backend) ----
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);
      const originalSourceId = dragSourceSectionRef.current;
      dragSourceSectionRef.current = null;

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      if (activeId === overId) return;

      // Determine destination from the drop target (event data, not stale state)
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

      // Same section → reorder only
      if (destSectionId === originalSourceId) {
        setLocalSections((prev) => {
          const section = prev.find((s) => s.id === destSectionId);
          if (!section) return prev;
          const oldIndex = section.tasks.findIndex((t) => t.id === activeId);
          const newIndex = section.tasks.findIndex((t) => t.id === overId);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
          return prev.map((s) =>
            s.id === section.id ? { ...s, tasks: arrayMove(s.tasks, oldIndex, newIndex) } : s
          );
        });

        try {
          const section = localSections.find((s) => s.id === destSectionId);
          const newIndex = section?.tasks.findIndex((t) => t.id === overId) ?? 0;
          const res = await fetch(`/api/tasks/${activeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: newIndex }),
          });
          if (!res.ok) throw new Error();
          router.refresh();
        } catch {
          toast.error("Failed to reorder task");
          setLocalSections(sections); // rollback
        }
        return;
      }

      // Cross-column move: persist to backend
      try {
        const res = await fetch(`/api/tasks/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: destSectionId }),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        toast.error("Failed to move task");
        setLocalSections(sections); // rollback
      }
    },
    [localSections, sections, router]
  );

  // ---- CREATE TASK ----
  const handleAddTaskSubmit = async (sectionId: string) => {
    if (!newTaskName.trim()) {
      setAddingTaskInSection(null);
      setNewTaskName("");
      return;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          projectId,
          sectionId,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Task created");
      router.refresh();
      setNewTaskName("");
      setAddingTaskInSection(null);
    } catch {
      toast.error("Failed to create task");
    }
  };

  // ---- ADD SECTION ----
  const handleAddSection = async () => {
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New section", projectId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Section created");
      router.refresh();
    } catch {
      toast.error("Failed to create section");
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <div className="flex gap-3 px-6 py-4 h-full overflow-x-auto">
        {localSections.map((section) => (
          <BoardColumn
            key={section.id}
            section={section}
            onTaskClick={onTaskClick}
            projectId={projectId}
            isAddingTask={addingTaskInSection === section.id}
            newTaskName={addingTaskInSection === section.id ? newTaskName : ""}
            onStartAddTask={() => {
              setAddingTaskInSection(section.id);
              setNewTaskName("");
            }}
            onNewTaskNameChange={setNewTaskName}
            onSubmitTask={() => handleAddTaskSubmit(section.id)}
            onCancelAddTask={() => {
              setAddingTaskInSection(null);
              setNewTaskName("");
            }}
          />
        ))}

        {/* + Add section */}
        <div className="flex-shrink-0">
          <button
            onClick={handleAddSection}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add section
          </button>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeTask && <TaskCardOverlay task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
}

// ============================================
// BOARD COLUMN
// ============================================

function BoardColumn({
  section,
  onTaskClick,
  projectId,
  isAddingTask,
  newTaskName,
  onStartAddTask,
  onNewTaskNameChange,
  onSubmitTask,
  onCancelAddTask,
}: {
  section: Section;
  onTaskClick: (taskId: string) => void;
  projectId: string;
  isAddingTask: boolean;
  newTaskName: string;
  onStartAddTask: () => void;
  onNewTaskNameChange: (value: string) => void;
  onSubmitTask: () => void;
  onCancelAddTask: () => void;
}) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(section.name);

  // Make the entire column a drop target (critical for empty columns)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: section.id,
  });

  const handleRename = async () => {
    if (!renameValue.trim() || renameValue === section.name) {
      setIsRenaming(false);
      setRenameValue(section.name);
      return;
    }
    try {
      const res = await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Section renamed");
      setIsRenaming(false);
      router.refresh();
    } catch {
      toast.error("Failed to rename section");
    }
  };

  const handleDelete = async () => {
    const msg =
      section.tasks.length > 0
        ? `Delete "${section.name}" and its ${section.tasks.length} task${section.tasks.length > 1 ? "s" : ""}?`
        : `Delete "${section.name}"?`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/sections/${section.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Section deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete section");
    }
  };

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        "flex-shrink-0 w-[280px] flex flex-col rounded-xl max-h-full transition-colors",
        isOver ? "bg-slate-200/80" : "bg-slate-100/80"
      )}
    >
      {/* Column Header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between group">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setIsRenaming(false);
                  setRenameValue(section.name);
                }
              }}
              onBlur={handleRename}
              className="font-medium text-sm text-slate-900 bg-white border rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-500 w-full"
              autoFocus
            />
          ) : (
            <>
              <h3 className="font-medium text-sm text-slate-900 truncate">
                {section.name}
              </h3>
              <span className="text-xs text-slate-400 tabular-nums">
                {section.tasks.length}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onStartAddTask}
            className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus className="w-4 h-4 text-slate-400" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  setIsRenaming(true);
                  setRenameValue(section.name);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Rename section
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onStartAddTask}>
                <Plus className="w-4 h-4 mr-2" />
                Add task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Task Cards */}
      <div className="flex-1 px-2 pb-2 overflow-y-auto min-h-[60px]">
        <SortableContext
          id={section.id}
          items={section.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {section.tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Empty state */}
        {section.tasks.length === 0 && !isAddingTask && (
          <div className="py-8 text-center">
            <p className="text-xs text-slate-400">No tasks</p>
          </div>
        )}

        {/* Inline add task */}
        {isAddingTask && (
          <div className="mt-1.5">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2.5">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => onNewTaskNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSubmitTask();
                  if (e.key === "Escape") onCancelAddTask();
                }}
                onBlur={() => {
                  if (!newTaskName.trim()) onCancelAddTask();
                }}
                placeholder="Write a task name"
                className="w-full text-sm outline-none placeholder:text-slate-400"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom add task */}
      {!isAddingTask && (
        <button
          onClick={onStartAddTask}
          className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-b-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add task
        </button>
      )}
    </div>
  );
}

// ============================================
// SORTABLE TASK CARD
// ============================================

function SortableTaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Failed to update task");
    }
  };

  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.NONE;
  const hasMetaInfo =
    task._count.subtasks > 0 ||
    task._count.comments > 0 ||
    task._count.attachments > 0 ||
    task.dueDate;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing transition-all",
        isDragging
          ? "opacity-40 shadow-none"
          : "hover:shadow-md hover:border-slate-300 shadow-sm"
      )}
      onClick={onClick}
    >
      {/* Top row: checkbox + name */}
      <div className="flex items-start gap-2">
        <button
          onClick={handleToggleComplete}
          className={cn(
            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
            task.completed
              ? "bg-green-500 border-green-500"
              : "border-slate-300 hover:border-slate-400"
          )}
        >
          {task.completed && <Check className="w-3 h-3 text-white" />}
        </button>

        <span
          className={cn(
            "text-[13px] leading-snug flex-1 min-w-0",
            task.completed ? "line-through text-slate-400" : "text-slate-800"
          )}
        >
          {task.name}
        </span>
      </div>

      {/* Priority indicator */}
      {task.priority && task.priority !== "NONE" && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", priority.dot)} />
          <span className="text-[11px] text-slate-500">{priority.label}</span>
        </div>
      )}

      {/* Bottom row: assignee + meta */}
      {(task.assignee || hasMetaInfo) && (
        <div className="flex items-center justify-between mt-2 pt-1.5">
          {/* Assignee */}
          {task.assignee ? (
            <Avatar className="h-5 w-5">
              <AvatarImage src={task.assignee.image || ""} />
              <AvatarFallback className="text-[10px] bg-blue-600 text-white">
                {task.assignee.name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div />
          )}

          {/* Meta info */}
          <div className="flex items-center gap-2 text-slate-400">
            {task._count.subtasks > 0 && (
              <span className="text-[11px] tabular-nums">
                {task.subtasks.filter((s) => s.completed).length}/{task._count.subtasks}
              </span>
            )}
            {task._count.comments > 0 && <MessageSquare className="h-3 w-3" />}
            {task._count.attachments > 0 && <Paperclip className="h-3 w-3" />}
            {task.dueDate && (
              <DueDateBadge dueDate={task.dueDate} completed={task.completed} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// DRAG OVERLAY CARD
// ============================================

function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-3 w-[280px] cursor-grabbing rotate-[2deg]">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
            task.completed ? "bg-green-500 border-green-500" : "border-slate-300"
          )}
        >
          {task.completed && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className="text-[13px] leading-snug flex-1 min-w-0 text-slate-800">
          {task.name}
        </span>
        {task.assignee && (
          <Avatar className="h-5 w-5 flex-shrink-0">
            <AvatarImage src={task.assignee.image || ""} />
            <AvatarFallback className="text-[10px] bg-blue-600 text-white">
              {task.assignee.name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      {task.dueDate && (
        <div className="mt-2 flex justify-end">
          <DueDateBadge dueDate={task.dueDate} completed={task.completed} />
        </div>
      )}
    </div>
  );
}

// ============================================
// DUE DATE BADGE
// ============================================

function DueDateBadge({
  dueDate,
  completed,
}: {
  dueDate: string;
  completed: boolean;
}) {
  const date = parseISO(dueDate);
  const overdue = !completed && isPast(date) && !isToday(date);
  const today = isToday(date);
  const tomorrow = isTomorrow(date);

  let label = format(date, "MMM d");
  if (today) label = "Today";
  if (tomorrow) label = "Tomorrow";

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] whitespace-nowrap",
        completed
          ? "text-slate-400"
          : overdue
            ? "text-red-500 font-medium"
            : today
              ? "text-orange-500"
              : "text-slate-400"
      )}
    >
      <Calendar className="h-3 w-3" />
      {label}
    </span>
  );
}
