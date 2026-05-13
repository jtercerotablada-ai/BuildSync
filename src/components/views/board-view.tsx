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
  CalendarDays,
  MessageSquare,
  Paperclip,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  Diamond,
  ThumbsUp,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

type TaskType = "TASK" | "MILESTONE" | "APPROVAL";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  taskType?: TaskType | null;
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
  HIGH: { dot: "bg-black", label: "High" },
  MEDIUM: { dot: "bg-[#a8893a]", label: "Medium" },
  LOW: { dot: "bg-[#c9a84c]", label: "Low" },
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
  const [mobileColumnIndex, setMobileColumnIndex] = useState(0);

  // Optimistic state: local copy of sections for instant UI updates
  const [localSections, setLocalSections] = useState<Section[]>(sections);
  const dragSourceSectionRef = useRef<string | null>(null);
  // Guard against the useEffect below clobbering localSections while
  // a drag is in flight. Without this, a parent re-render mid-drag
  // (eg. router.refresh from another action) would snap the dragged
  // card back to its server-side position.
  const isDraggingRef = useRef(false);

  // Sync local state when prop changes (after router.refresh) — but
  // never mid-drag.
  useEffect(() => {
    if (isDraggingRef.current) return;
    setLocalSections(sections);
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // ---- DRAG START ----
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const taskId = event.active.id as string;
      isDraggingRef.current = true;
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

  // Atomic reorder of a section. The endpoint wraps every position
  // update in a single $transaction so the column is never left in a
  // half-renumbered state on partial failure.
  const persistReorder = useCallback(
    async (sectionId: string, orderedTaskIds: string[]) => {
      const res = await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, orderedTaskIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    []
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
  //
  // Same-section drag: arrayMove locally, then persist the full new
  // order with a single reorder call so positions are coherent across
  // every card (not just the dragged one, which used to leave
  // duplicate `position` values and undefined ordering on refresh).
  //
  // Cross-section drag: handleDragOver already optimistically moved
  // the task into the destination column at the correct index. On
  // drop we persist the full destination order — same endpoint —
  // which also writes the new sectionId on the moved task. One HTTP
  // round-trip, atomic in $transaction.
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);
      const originalSourceId = dragSourceSectionRef.current;
      dragSourceSectionRef.current = null;
      isDraggingRef.current = false;

      if (!over) {
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      // Resolve destination section from the drop target.
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
      // optimistic order matches what we're about to persist.
      let workingSections = localSections;
      if (destSectionId === originalSourceId && activeId !== overId) {
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

      // Whatever order is in workingSections for the destination is
      // the authoritative new order. Persist it atomically.
      const destSection = workingSections.find((s) => s.id === destSectionId);
      if (!destSection) return;
      const orderedIds = destSection.tasks.map((t) => t.id);

      try {
        await persistReorder(destSectionId, orderedIds);
        router.refresh();
      } catch {
        toast.error("Failed to move task");
        setLocalSections(sections); // rollback to server truth
      }
    },
    [localSections, sections, router, persistReorder]
  );

  // ---- CREATE TASK ----
  // After a successful create the input stays open and clears its
  // value so the user can batch-add tasks (Asana / my-tasks UX).
  // Escape or click-outside (handled at the column level) closes it.
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
      // Keep the input open for consecutive creation — only clear the
      // value, don't close the input.
      setNewTaskName("");
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

  // Mobile helpers
  const isMobileOverdue = (dueDate: string) => {
    const date = parseISO(dueDate);
    return isPast(date) && !isToday(date);
  };
  const formatMobileDate = (dueDate: string) => {
    const date = parseISO(dueDate);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const mobileActiveSection = localSections[mobileColumnIndex];

  const handleMobileAddTask = async () => {
    if (!newTaskName.trim() || !mobileActiveSection) {
      setNewTaskName("");
      setAddingTaskInSection(null);
      return;
    }
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          projectId,
          sectionId: mobileActiveSection.id,
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

  return (
    <>
      {/* ===== Mobile Board View ===== */}
      <div className="md:hidden flex flex-col h-full">
        {/* Column selector pills */}
        <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
          {localSections.map((section, i) => (
            <button
              key={section.id}
              onClick={() => setMobileColumnIndex(i)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                i === mobileColumnIndex
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {section.name} ({section.tasks.length})
            </button>
          ))}
        </div>

        {/* Column indicator dots */}
        <div className="board-column-dots">
          {localSections.map((_, i) => (
            <div
              key={i}
              className={cn("board-column-dot", i === mobileColumnIndex && "active")}
            />
          ))}
        </div>

        {/* Active column cards */}
        <div className="flex-1 overflow-y-auto px-3 py-1">
          {mobileActiveSection?.tasks.map((task) => (
            <div
              key={task.id}
              className="mobile-task-card"
              onClick={() => onTaskClick(task.id)}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fetch(`/api/tasks/${task.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ completed: !task.completed }),
                    }).then((res) => {
                      if (res.ok) router.refresh();
                      else toast.error("Failed to update task");
                    });
                  }}
                  className={cn(
                    "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    task.completed
                      ? "bg-[#c9a84c] border-[#c9a84c]"
                      : "border-gray-300"
                  )}
                >
                  {task.completed && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium leading-tight", task.completed && "line-through text-gray-400")}>
                    {task.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {task.dueDate && (
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                        !task.completed && isMobileOverdue(task.dueDate) ? "bg-gray-100 text-black" : "bg-gray-100 text-gray-600"
                      )}>
                        <CalendarDays className="h-3 w-3" />
                        {formatMobileDate(task.dueDate)}
                      </span>
                    )}
                    {task.priority && task.priority !== "NONE" && (
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                        task.priority === "HIGH" ? "bg-gray-100 text-black" :
                        task.priority === "MEDIUM" ? "bg-[#a8893a]/10 text-[#a8893a]" :
                        "bg-[#c9a84c]/10 text-[#a8893a]"
                      )}>
                        {task.priority === "HIGH" ? "\u{1F534}" : task.priority === "MEDIUM" ? "\u{1F7E1}" : "\u{1F535}"}
                        {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                      </span>
                    )}
                  </div>
                  {task.assignee && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 overflow-hidden">
                        {task.assignee.image ? (
                          <img src={task.assignee.image} className="h-full w-full object-cover" alt="" />
                        ) : (
                          task.assignee.name?.[0]
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{task.assignee.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {mobileActiveSection?.tasks.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">No tasks in this column</p>
            </div>
          )}

          {/* Add task button */}
          {addingTaskInSection === mobileActiveSection?.id ? (
            <div className="mobile-task-card">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleMobileAddTask();
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
                className="w-full text-sm outline-none bg-transparent"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => {
                if (mobileActiveSection) {
                  setAddingTaskInSection(mobileActiveSection.id);
                  setNewTaskName("");
                }
              }}
              className="w-full py-3 text-sm text-gray-400 text-center"
            >
              + Add task
            </button>
          )}
        </div>
      </div>

      {/* ===== Desktop Board View ===== */}
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        {/* Outer container is responsible for BOTH axes of scroll
            (vertical + horizontal). Each column has no internal
            overflow, so its gray background grows with the cards
            inside it (Asana behavior). Without this, every column
            stretched to viewport height even when half-empty. */}
        <div className="hidden md:flex gap-3 px-6 py-4 overflow-auto items-start min-h-full">
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
    </>
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
        // No max-h-full — the gray background grows with the cards
        // inside it instead of being clipped to viewport height.
        // The outer board container handles vertical scroll when a
        // column grows past the page.
        "flex-shrink-0 w-[260px] md:w-[280px] flex flex-col rounded-xl transition-colors",
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
              <DropdownMenuItem onClick={handleDelete} className="text-black">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Task Cards — no flex-1 / no overflow-y-auto so the column's
          height tracks the cards inside it. Long columns get
          scrolled by the page-level container above, not by an
          internal scrollbar. */}
      <div className="px-2 pb-2 min-h-[60px]">
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

        {/* Empty state — doubles as drop-target affordance during drag
            and quick-add affordance on click. Mirrors the my-tasks
            board treatment so the user gets immediate feedback when
            hovering over an empty column with a dragged card. */}
        {section.tasks.length === 0 && !isAddingTask && (
          <button
            type="button"
            onClick={onStartAddTask}
            className={cn(
              "w-full text-center text-xs rounded-lg border-2 border-dashed transition-colors py-6",
              isOver
                ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#a8893a]"
                : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500"
            )}
          >
            {isOver ? "Drop task here" : "No tasks · click to add"}
          </button>
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
        "bg-white rounded-lg border border-slate-200 p-2 md:p-3 cursor-grab active:cursor-grabbing transition-all",
        isDragging
          ? "opacity-40 shadow-none"
          : "hover:shadow-md hover:border-slate-300 shadow-sm"
      )}
      onClick={onClick}
    >
      {/* Top row: type-aware completion icon + name. MILESTONE = gold
          Diamond, APPROVAL = gold ThumbsUp, default regular task =
          round checkbox. Matches the same convention as List view + AEC
          tools (MS Project / Primavera). */}
      <div className="flex items-start gap-2">
        <CardCompletionIcon task={task} onToggle={handleToggleComplete} />
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
              <AvatarFallback className="text-[10px] bg-[#c9a84c] text-white">
                {task.assignee.name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div />
          )}

          {/* Meta info */}
          <div className="flex items-center gap-2 text-slate-400">
            {task._count.subtasks > 0 && (
              <span className="text-[11px] tabular-nums flex items-center gap-0.5">
                <Layers className="w-3 h-3" />
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
        <CardCompletionIcon task={task} onToggle={() => {}} />
        <span className="text-[13px] leading-snug flex-1 min-w-0 text-slate-800">
          {task.name}
        </span>
        {task.assignee && (
          <Avatar className="h-5 w-5 flex-shrink-0">
            <AvatarImage src={task.assignee.image || ""} />
            <AvatarFallback className="text-[10px] bg-[#c9a84c] text-white">
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

// =============================================================
// CARD COMPLETION ICON (shared by SortableBoardCard + Overlay)
// =============================================================
function CardCompletionIcon({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (e: React.MouseEvent) => void;
}) {
  if (task.taskType === "MILESTONE") {
    return (
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-center flex-shrink-0 mt-0.5",
          task.completed ? "text-[#a8893a]" : "text-[#c9a84c] hover:text-[#a8893a]"
        )}
        aria-label={task.completed ? "Mark milestone incomplete" : "Mark milestone complete"}
      >
        <Diamond className="w-4 h-4" />
      </button>
    );
  }
  if (task.taskType === "APPROVAL") {
    return (
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-center flex-shrink-0 mt-0.5",
          task.completed ? "text-[#a8893a]" : "text-[#c9a84c] hover:text-[#a8893a]"
        )}
        aria-label={task.completed ? "Mark approval incomplete" : "Approve"}
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
    );
  }
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
        task.completed
          ? "bg-[#c9a84c] border-[#c9a84c]"
          : "border-slate-300 hover:border-slate-400"
      )}
      aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
    >
      {task.completed && <Check className="w-3 h-3 text-white" />}
    </button>
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
            ? "text-black font-medium"
            : today
              ? "text-[#a8893a]"
              : "text-slate-400"
      )}
    >
      <Calendar className="h-3 w-3" />
      {label}
    </span>
  );
}
