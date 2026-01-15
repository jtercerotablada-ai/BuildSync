"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Calendar,
  MessageSquare,
  Paperclip,
  User,
  Check,
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

interface BoardViewProps {
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  onAddTask: (sectionId?: string) => void;
  projectId: string;
}

const PRIORITY_COLORS = {
  NONE: { bg: "", text: "", label: "" },
  LOW: { bg: "bg-white border border-black", text: "text-black", label: "Low" },
  MEDIUM: { bg: "bg-white border border-black", text: "text-black", label: "Medium" },
  HIGH: { bg: "bg-white border border-black", text: "text-black", label: "High" },
};

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;

    for (const section of sections) {
      const task = section.tasks.find((t) => t.id === taskId);
      if (task) {
        setActiveTask(task);
        break;
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let sourceSection: Section | null = null;
    let destinationSectionId: string | null = null;

    for (const section of sections) {
      if (section.tasks.find((t) => t.id === taskId)) {
        sourceSection = section;
      }
      if (section.id === overId) {
        destinationSectionId = section.id;
      } else if (section.tasks.find((t) => t.id === overId)) {
        destinationSectionId = section.id;
      }
    }

    if (!destinationSectionId || sourceSection?.id === destinationSectionId) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: destinationSectionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to move task");
      }

      toast.success("Task moved");
      router.refresh();
    } catch {
      toast.error("Failed to move task");
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-6 h-full overflow-x-auto bg-slate-50">
        {/* Section Columns */}
        {sections.map((section) => (
          <Column
            key={section.id}
            section={section}
            onTaskClick={onTaskClick}
            projectId={projectId}
            isAddingTask={addingTaskInSection === section.id}
            newTaskName={newTaskName}
            onStartAddTask={() => setAddingTaskInSection(section.id)}
            onNewTaskNameChange={setNewTaskName}
            onSubmitTask={() => handleAddTaskSubmit(section.id)}
            onCancelAddTask={() => {
              setAddingTaskInSection(null);
              setNewTaskName("");
            }}
          />
        ))}

        {/* Add Section Column */}
        <button
          onClick={handleAddSection}
          className="flex-shrink-0 w-72 h-12 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add section
        </button>
      </div>

      <DragOverlay>
        {activeTask && <TaskCardOverlay task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
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
  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-slate-100 rounded-lg max-h-full">
      {/* Column Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900">{section.name}</h3>
          <span className="text-sm text-slate-500">{section.tasks.length}</span>
        </div>
      </div>

      {/* Cards Container */}
      <div className="flex-1 px-2 pb-2 overflow-y-auto">
        {/* Add Task Button/Input - AT THE TOP */}
        {isAddingTask ? (
          <div className="bg-white rounded-lg shadow-sm border p-3 mb-2">
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
              placeholder="Task name"
              className="w-full text-sm outline-none"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={onStartAddTask}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg mb-2"
          >
            <Plus className="w-4 h-4" />
            Add task
          </button>
        )}

        {/* Task Cards */}
        <SortableContext
          items={section.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {section.tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
                projectId={projectId}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  onClick,
  projectId,
}: {
  task: Task;
  onClick: () => void;
  projectId: string;
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
    opacity: isDragging ? 0.5 : 1,
  };

  const handleTaskComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      toast.success(task.completed ? "Task marked incomplete" : "Task completed");
      router.refresh();
    } catch {
      toast.error("Failed to update task");
    }
  };

  const isOverdue = task.dueDate && !task.completed && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg shadow-sm border p-3 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Task Name with Checkbox */}
      <div className="flex items-start gap-2 mb-2">
        <button
          onClick={handleTaskComplete}
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
            task.completed
              ? "bg-black border-black"
              : "border-slate-300 hover:border-slate-400"
          )}
        >
          {task.completed && <Check className="w-3 h-3 text-white" />}
        </button>
        <span
          className={cn(
            "text-sm font-medium flex-1",
            task.completed && "line-through text-slate-400"
          )}
        >
          {task.name}
        </span>
      </div>

      {/* Priority Badge */}
      {task.priority && task.priority !== "NONE" && (
        <div className="mb-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS].bg,
              PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS].text
            )}
          >
            {PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS].label}
          </Badge>
        </div>
      )}

      {/* Bottom Row: Assignee & Due Date */}
      <div className="flex items-center justify-between">
        {/* Assignee */}
        {task.assignee ? (
          <Avatar className="h-6 w-6">
            <AvatarImage src={task.assignee.image || ""} />
            <AvatarFallback className="text-xs bg-amber-400 text-white">
              {task.assignee.name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
            <User className="w-3 h-3 text-slate-300" />
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-2 text-slate-500">
          {task._count.subtasks > 0 && (
            <span className="text-xs">
              {task.subtasks.filter((s) => s.completed).length}/
              {task._count.subtasks}
            </span>
          )}
          {task._count.comments > 0 && (
            <MessageSquare className="h-3 w-3" />
          )}
          {task._count.attachments > 0 && (
            <Paperclip className="h-3 w-3" />
          )}
          {task.dueDate && (
            <DueDateBadge dueDate={task.dueDate} completed={task.completed} />
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 w-72 cursor-grabbing">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
            task.completed ? "bg-black border-black" : "border-slate-300"
          )}
        >
          {task.completed && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{task.name}</p>
        </div>
        {task.assignee && (
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={task.assignee.image || ""} />
            <AvatarFallback className="text-xs bg-amber-400 text-white">
              {task.assignee.name?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
        )}
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
        "flex items-center gap-1 text-xs",
        isOverdue ? "text-black" : "text-slate-500",
        completed && "text-slate-400"
      )}
    >
      <Calendar className="h-3 w-3" />
      {label}
    </div>
  );
}
