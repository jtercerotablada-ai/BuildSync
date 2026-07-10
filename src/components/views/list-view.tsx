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
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { dueDateToLocalMidnight } from "@/lib/date-only";
import { toast } from "sonner";
import { AddColumnDropdown } from "@/components/tasks/add-column-dropdown";
import { ColumnHeader } from "@/components/tasks/column-header-dropdown";
import { CustomFieldModal } from "@/components/tasks/custom-field-modal";
import { EditableCustomFieldCell } from "@/components/tasks/editable-custom-field-cell";
import { BuiltinFieldCell } from "@/components/tasks/builtin-field-cell";
import { DueDatePicker } from "@/components/tasks/due-date-picker";
import { formatRangeLabel } from "@/lib/task-helpers";
import type { FieldTypeConfig, BuiltinFieldConfig } from "@/lib/field-types";
import { BUILTIN_FIELDS } from "@/lib/field-types";
import { useUiState } from "@/hooks/use-ui-state";
import { readTimeTracking, formatDays } from "@/lib/duration";

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
    | "PERCENTAGE"
    // Fase 3 — Asana-parity types.
    | "REFERENCE"
    | "FORMULA"
    | "TIMER"
    | "TIME_TRACKING"
    | "ROLLUP";
  options: CustomFieldOption[] | null;
  isRequired: boolean;
}
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
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
  completedAt?: string | null;
  dueDate: string | null;
  // Optional start date for the Asana-style range picker. When both
  // startDate and dueDate are set the row shows "May 14 – 27"; when
  // only dueDate is set it falls back to the legacy single-date pill.
  startDate?: string | null;
  // Source columns for the Asana "Show more" built-in extras.
  createdAt?: string;
  updatedAt?: string;
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
  /** Task creator — backs the "Created by" built-in column. */
  creator?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  subtasks: { id: string; completed: boolean }[];
  /** Dependencies (this task is blocked by these) — Asana "Blocked by". */
  dependencies?: { blockingTask: { id: string; name: string; completed: boolean } }[];
  /** Dependents (these tasks are blocked by this one) — Asana "Blocks". */
  dependents?: { dependentTask: { id: string; name: string; completed: boolean } }[];
  /** Tags worn by this task — Asana "Tags" column. */
  taskTags?: { tag: { id: string; name: string; color: string } }[];
  _count: {
    subtasks: number;
    comments: number;
    attachments: number;
    // Backs the "Likes" built-in column. Optional so cached/legacy
    // pages that didn't select it still typecheck (column shows 0).
    likes?: number;
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
  /** True when the toolbar has an active search/filter/sort, so the
   *  displayed order is NOT the section's canonical order. Drag-reorder
   *  is disabled in that state — otherwise persisting the filtered/sorted
   *  view would overwrite the real task positions. */
  reorderDisabled?: boolean;
}

// Distinct per-level colors so High/Medium/Low read at a glance —
// matches the PriorityTag palette used in the detail panel/modal.
const PRIORITY_COLORS = {
  NONE: "",
  LOW: "bg-[#e1eefc] text-[#274a73] border border-[#c5dbf5]",
  MEDIUM: "bg-[#fbeed3] text-[#7a5b1b] border border-[#e7d5a3]",
  HIGH: "bg-[#fce4e4] text-[#a8323a] border border-[#f3c4c4]",
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
  reorderDisabled = false,
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
  // Pinned built-in extras for this project — Asana's "Show more"
  // columns (Tags, Blocked by, Blocks, Created by, etc.). Persisted
  // per-user + per-project via useUiState (server-backed) so the choice
  // survives reload + device. We store the ids and rebuild the config
  // from BUILTIN_FIELDS on read.
  // Priority isn't offered here because it's already a hardcoded
  // column to the left of Status.
  const { value: pinnedBuiltinIds, setValue: setPinnedBuiltinIds } =
    useUiState<string[]>(`projectListBuiltins:${projectId}`, []);
  const pinnedBuiltins = useMemo(
    () =>
      pinnedBuiltinIds
        .map((id) => BUILTIN_FIELDS.find((b) => b.id === id))
        .filter((b): b is BuiltinFieldConfig => Boolean(b)),
    [pinnedBuiltinIds]
  );

  // Hidden custom-field columns (per-user + per-project). Hiding a column
  // is non-destructive — the field + its values stay; it just drops out of
  // this view and can be re-added from the "+" (Add column) menu.
  const { value: hiddenCustomFieldIds, setValue: setHiddenCustomFieldIds } =
    useUiState<string[]>(`projectListHiddenFields:${projectId}`, []);
  const visibleCustomFieldDefs = useMemo(
    () => customFieldDefs.filter((f) => !hiddenCustomFieldIds.includes(f.id)),
    [customFieldDefs, hiddenCustomFieldIds]
  );
  const hiddenCustomFieldDefs = useMemo(
    () => customFieldDefs.filter((f) => hiddenCustomFieldIds.includes(f.id)),
    [customFieldDefs, hiddenCustomFieldIds]
  );
  // Which column header dropdown is open (id-keyed, single-open).
  const [openColHeaderId, setOpenColHeaderId] = useState<string | null>(null);

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

  // "Delete field" from a column header dropdown — unlinks the custom
  // field from the project (removes the column + its values everywhere).
  const handleDeleteCustomField = useCallback(
    async (field: CustomFieldDef) => {
      if (
        !confirm(
          `Delete the "${field.name}" field from this project? This removes the column and its values for every task.`
        )
      )
        return;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/custom-fields/${field.linkId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setHiddenCustomFieldIds((prev) => prev.filter((id) => id !== field.id));
        reloadCustomFields();
        toast.success("Field deleted");
      } catch {
        toast.error("Couldn't delete the field");
      }
    },
    [projectId, reloadCustomFields, setHiddenCustomFieldIds]
  );

  // Optimistically reflect an inline custom-field edit in the local value
  // map so the per-section SUMA footer updates immediately (before the
  // refetch that picks up server-recomputed FORMULA/ROLLUP columns).
  const handleCustomFieldChange = useCallback(
    (taskId: string, fieldId: string, next: unknown) => {
      setCustomFieldValues((prev) => ({
        ...prev,
        [taskId]: { ...(prev[taskId] ?? {}), [fieldId]: next },
      }));
    },
    []
  );

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
    const customCols = visibleCustomFieldDefs.map(() => "140px").join(" ");
    const builtinCols = pinnedBuiltins
      .map((b) => `${b.defaultWidth}px`)
      .join(" ");
    return `48px 1fr 140px 130px 90px 90px${customCols ? ` ${customCols}` : ""}${
      builtinCols ? ` ${builtinCols}` : ""
    } 40px`;
  }, [visibleCustomFieldDefs, pinnedBuiltins]);

  // Drag & drop state — same pattern as my-tasks ListDndProvider.
  // localSections is the optimistic source of truth during a drag so
  // the user sees the task land in the new position before the server
  // round-trip completes. handleDragOver mutates it cross-section;
  // handleDragEnd commits the final position to the server.
  const [localSections, setLocalSections] = useState<Section[]>(sections);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const isDraggingRef = useRef(false);
  const dragSourceSectionRef = useRef<string | null>(null);
  // Prevents a double-submit (two Enters) from creating duplicate tasks.
  const isAddingTaskRef = useRef(false);

  // Sync from server props — but never clobber an in-flight drag.
  useEffect(() => {
    if (isDraggingRef.current) return;
    setLocalSections(sections);
  }, [sections]);

  // Auto-expand sections that appear after mount (e.g. one just created
  // via "Add section", surfaced by router.refresh). Without this, a new
  // section renders collapsed and its "Add task" menu item is a no-op
  // because the inline input lives inside the expanded branch.
  useEffect(() => {
    setExpandedSections((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const s of sections) {
        if (!next.has(s.id)) {
          next.add(s.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sections]);

  // Prune multi-select to only tasks still visible. ListView renders the
  // FILTERED sections, so after selecting rows and then typing a search or
  // toggling a filter, hidden-but-selected ids would otherwise remain in
  // the set and be swept into a bulk action (including destructive delete)
  // the user can no longer see.
  useEffect(() => {
    const visible = new Set(sections.flatMap((s) => s.tasks.map((t) => t.id)));
    setSelectedTasks((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
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
    if (reorderDisabled) return;
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
  }, [localSections, reorderDisabled]);

  // Mid-drag updater that runs entirely inside setLocalSections so
  // there are no stale closure reads of localSections. This is the
  // exact pattern that makes the my-tasks list drag visually fluid
  // across columns without the dreaded bounce-back.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (reorderDisabled) return;
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
  }, [reorderDisabled]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (reorderDisabled) return;
      const { active, over } = event;
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

      // Position the dragged task at the row it was dropped ON, for BOTH
      // same-section reorders and cross-section moves. handleDragOver has
      // already inserted a cross-section task at its ENTRY index; without
      // this correction the persisted order would keep it there instead of
      // where the user actually released it.
      let workingSections = localSections;
      if (overId !== destSectionId) {
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
    [localSections, sections, router, reorderDisabled]
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
    // Guard against a second Enter firing while the first POST is still in
    // flight (newTaskName is only cleared after the round-trip resolves),
    // which would create duplicate rows.
    if (isAddingTaskRef.current) return;
    isAddingTaskRef.current = true;

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          projectId,
          sectionId,
          // Project tasks stay unassigned (Asana parity); the server would
          // otherwise auto-assign to the creator, which is only wanted for
          // projectless My-Tasks rows.
          assigneeId: null,
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
    } finally {
      isAddingTaskRef.current = false;
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
    } else if (field === "startDate") {
      // Asana-style range: the picker calls this alongside dueDate
      // so we accept null to clear the start when the user removes
      // the left edge of the range.
      body.startDate = value || null;
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
    const date = dueDateToLocalMidnight(dueDate);
    return isPast(date) && !isToday(date);
  };
  const formatMobileDate = (dueDate: string) => {
    const date = dueDateToLocalMidnight(dueDate);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  return (
    <div className="flex flex-col h-full">
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
      {/* Shared overflow-auto container so the header AND the rows
          share the same scrollbar-deducted width. The header sits
          `sticky top-0` inside, so `1fr` resolves to the same pixel
          value everywhere — column dividers align top-to-bottom. */}
      <div className="flex-1 overflow-auto">
      {/* ========================================= */}
      {/* COLUMN HEADERS - ONLY ONCE AT THE TOP    */}
      {/* ========================================= */}
      <div className="sticky top-0 bg-white border-b border-[#e6e9ef] z-10">
        <div
          // Header keeps per-cell `[&>*+*]:border-l` because the
          // sticky header (z-10) sits above the ghost overlay (z-0)
          // and its bg-white would otherwise hide the overlay lines
          // in the header row. This is the only place we still draw
          // vertical dividers via per-cell borders — every other
          // body cell defers to the overlay.
          className="hidden md:grid px-6 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider [&>*]:px-2 [&>*+*]:border-l [&>*+*]:border-[#e6e9ef] [&>*]:flex [&>*]:items-center"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={allSelected}
              onClick={toggleSelectAll}
              className="rounded"
            />
          </div>
          {/* Header labels only — sorting is driven from the toolbar
              Sort menu in project-content, so these cells intentionally
              carry no click affordance (no cursor-pointer / chevron) to
              avoid signalling a click-to-sort that doesn't exist here. */}
          <div className="flex items-center gap-1">Name</div>
          <div className="flex items-center gap-1">Assignee</div>
          <div className="flex items-center gap-1">Due date</div>
          <div className="flex items-center gap-1">Priority</div>
          <div className="flex items-center gap-1">Status</div>
          {/* Custom field columns — Asana-style header dropdown (⌄) with
              Hide column / Delete field, same as the My Tasks list. */}
          {visibleCustomFieldDefs.map((field) => (
            <ColumnHeader
              key={field.id}
              config={{
                id: field.id,
                label: field.name,
                sortable: false,
                filterable: false,
                groupable: false,
                isFirst: true,
              }}
              isDropdownOpen={openColHeaderId === field.id}
              onDropdownToggle={() =>
                setOpenColHeaderId(
                  openColHeaderId === field.id ? null : field.id
                )
              }
              callbacks={{
                onAddColumn: () => setCustomFieldModalOpen(true),
                onHideColumn: () =>
                  setHiddenCustomFieldIds((prev) =>
                    prev.includes(field.id) ? prev : [...prev, field.id]
                  ),
                onDeleteField: () => handleDeleteCustomField(field),
              }}
            />
          ))}
          {/* Built-in extra columns — same header dropdown; built-ins can
              be hidden but not deleted (no onDeleteField). */}
          {pinnedBuiltins.map((b) => (
            <ColumnHeader
              key={b.id}
              config={{
                id: b.id,
                label: b.label,
                sortable: false,
                filterable: false,
                groupable: false,
                isFirst: true,
              }}
              isDropdownOpen={openColHeaderId === b.id}
              onDropdownToggle={() =>
                setOpenColHeaderId(openColHeaderId === b.id ? null : b.id)
              }
              callbacks={{
                onAddColumn: () => setCustomFieldModalOpen(true),
                onHideColumn: () =>
                  setPinnedBuiltinIds((prev) =>
                    prev.filter((id) => id !== b.id)
                  ),
              }}
            />
          ))}
          {/* Add column button — now supports both custom field types
              AND Asana's built-in extras ("Show more" in the dropdown).
              Priority is excluded because it's already a hardcoded
              column to the left of Status. */}
          <AddColumnDropdown
            activeBuiltinIds={[
              "priority", // suppress — already a column
              ...pinnedBuiltins.map((b) => b.id),
            ]}
            hiddenFields={hiddenCustomFieldDefs.map((f) => ({
              id: f.id,
              label: f.name,
            }))}
            onReshowField={(id) =>
              setHiddenCustomFieldIds((prev) => prev.filter((x) => x !== id))
            }
            onSelectType={(ft: FieldTypeConfig, name: string) => {
              setPreselectedFieldType(ft.id);
              setPreselectedFieldName(name);
              setInitialTab("create");
              setCustomFieldModalOpen(true);
            }}
            onSelectBuiltin={(b) => {
              setPinnedBuiltinIds((prev) =>
                prev.includes(b.id) ? prev : [...prev, b.id]
              );
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

        {localSections.map((section) => (
          <div key={section.id} className="border-b border-[#e6e9ef]">
            {/* Section Header — naturally clean (no per-cell borders
                so no vertical gridlines pass through). Per Juan's rule:
                gridlines divide tasks, NOT section headings. */}
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
                  <DropdownMenuItem onClick={() => {
                    // Expand first — the inline add-task input only renders
                    // inside the expanded branch, so on a collapsed section
                    // this click would otherwise do nothing visible.
                    setExpandedSections((prev) => {
                      if (prev.has(section.id)) return prev;
                      const next = new Set(prev);
                      next.add(section.id);
                      return next;
                    });
                    setAddingTaskInSection(section.id);
                  }}>
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
              <DroppableSectionBody sectionId={section.id}>
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
                    customFieldDefs={visibleCustomFieldDefs}
                    customFieldValuesForTask={customFieldValues[task.id] ?? {}}
                    pinnedBuiltins={pinnedBuiltins}
                    gridTemplate={gridTemplate}
                    reorderDisabled={reorderDisabled}
                    onCustomFieldChange={handleCustomFieldChange}
                    onCustomFieldCommitted={reloadCustomFieldValues}
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
                  {/* Per-column SUMA — Asana shows "SUMA X.X" at the
                      bottom of NUMBER / CURRENCY / PERCENTAGE / FORMULA
                      / ROLLUP columns aggregating every visible row.
                      We mirror that: walk the section's tasks, sum the
                      numeric value, render in the cell aligned with
                      the column header. Empty/non-numeric columns
                      render a blank placeholder so the grid stays
                      aligned. */}
                  {visibleCustomFieldDefs.map((f) => {
                    // Time tracking: total estimated vs actual DAYS for the
                    // section — the PM's phase-level "Σ actual / estimated".
                    if (f.type === "TIME_TRACKING") {
                      let est = 0;
                      let act = 0;
                      let any = false;
                      for (const t of section.tasks) {
                        const { estimatedDays, actualDays } = readTimeTracking(
                          customFieldValues[t.id]?.[f.id]
                        );
                        if (estimatedDays != null) {
                          est += estimatedDays;
                          any = true;
                        }
                        if (actualDays != null) {
                          act += actualDays;
                          any = true;
                        }
                      }
                      if (!any) {
                        return <div key={f.id} className="hidden md:block" />;
                      }
                      const over = act > est && est > 0;
                      return (
                        <div
                          key={f.id}
                          className="hidden md:flex items-center justify-end gap-1 pr-2 text-[11px] text-slate-400"
                          title="Σ actual / estimated days"
                        >
                          <span className="font-medium tracking-wide">&#931;</span>
                          <span
                            className={cn(
                              "tabular-nums font-medium",
                              over ? "text-rose-600" : "text-slate-700"
                            )}
                          >
                            {formatDays(act)}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span className="tabular-nums text-slate-500">
                            {formatDays(est)}
                          </span>
                        </div>
                      );
                    }
                    const numericTypes = new Set([
                      "NUMBER",
                      "CURRENCY",
                      "PERCENTAGE",
                      "FORMULA",
                      "ROLLUP",
                    ]);
                    if (!numericTypes.has(f.type)) {
                      return <div key={f.id} className="hidden md:block" />;
                    }
                    let sum = 0;
                    let any = false;
                    for (const t of section.tasks) {
                      const raw = customFieldValues[t.id]?.[f.id];
                      if (raw == null) continue;
                      let n: number;
                      if (typeof raw === "number") n = raw;
                      else if (
                        typeof raw === "object" &&
                        raw !== null &&
                        "result" in raw &&
                        typeof (raw as { result?: unknown }).result === "number"
                      ) {
                        n = (raw as { result: number }).result;
                      } else {
                        const parsed = Number(raw);
                        if (!Number.isFinite(parsed)) continue;
                        n = parsed;
                      }
                      sum += n;
                      any = true;
                    }
                    return (
                      <div
                        key={f.id}
                        className="hidden md:flex items-center justify-end gap-1 pr-2 text-[11px] text-slate-400"
                      >
                        {any && (
                          <>
                            <span className="font-medium tracking-wide uppercase">
                              Suma
                            </span>
                            <span className="tabular-nums text-slate-700 font-medium">
                              {f.type === "CURRENCY"
                                ? new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 2,
                                  }).format(sum)
                                : f.type === "PERCENTAGE"
                                ? `${sum.toFixed(1)}%`
                                : sum.toLocaleString("en-US", {
                                    maximumFractionDigits: 2,
                                  })}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div className="hidden md:block"></div>
                </div>
              </DroppableSectionBody>
              </SortableContext>
            )}
          </div>
        ))}

        {/* Project-level time totals — estimated vs actual DAYS across the
            whole project, with variance. The PM's "are we over budget on
            effort?" line. Only shown when a Time-tracking field has data. */}
        {(() => {
          const ttFields = customFieldDefs.filter(
            (f) => f.type === "TIME_TRACKING"
          );
          if (ttFields.length === 0) return null;
          const rows = ttFields
            .map((f) => {
              let est = 0;
              let act = 0;
              let any = false;
              for (const section of localSections) {
                for (const t of section.tasks) {
                  const { estimatedDays, actualDays } = readTimeTracking(
                    customFieldValues[t.id]?.[f.id]
                  );
                  if (estimatedDays != null) {
                    est += estimatedDays;
                    any = true;
                  }
                  if (actualDays != null) {
                    act += actualDays;
                    any = true;
                  }
                }
              }
              return { f, est, act, any };
            })
            .filter((r) => r.any);
          if (rows.length === 0) return null;
          return (
            <div className="px-3 md:px-6 py-2.5 border-t border-[#e6e9ef] bg-slate-50/60 flex flex-wrap items-center gap-x-6 gap-y-1.5">
              {rows.map(({ f, est, act }) => {
                const over = act > est && est > 0;
                const variance = act - est;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span className="font-medium text-slate-600">{f.name}</span>
                    <span className="text-slate-400">estimated</span>
                    <span className="tabular-nums font-medium text-slate-700">
                      {formatDays(est)}
                    </span>
                    <span className="text-slate-400">· actual</span>
                    <span
                      className={cn(
                        "tabular-nums font-medium",
                        over ? "text-rose-600" : "text-slate-700"
                      )}
                    >
                      {formatDays(act)}
                    </span>
                    {est > 0 && (
                      <span
                        className={cn(
                          "tabular-nums text-[11px] px-1.5 py-0.5 rounded",
                          over
                            ? "bg-rose-50 text-rose-600"
                            : "bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {variance > 0 ? "+" : ""}
                        {formatDays(variance)} ({((variance / est) * 100).toFixed(0)}
                        %)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Add Section Button — naturally clean (action row, not a task) */}
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
            className="text-white hover:bg-slate-700 gap-1.5 h-7 text-xs"
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
  const date = dueDateToLocalMidnight(dueDate);
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
// Registers each section's task area as a droppable container so tasks
// can be dropped into an EMPTY section. Without this, the only droppables
// are task rows (via useSortable), so a section with zero tasks has no
// drop target and kanbanCollisionDetection can never resolve it.
function DroppableSectionBody({
  sectionId,
  children,
}: {
  sectionId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: sectionId });
  return <div ref={setNodeRef}>{children}</div>;
}

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
  /** Asana "Show more" built-in extras pinned in the header — Tags,
   *  Blocked by, Blocks, Completion date, Last modified, Creation
   *  date, Created by. Rendered to the right of custom fields. */
  pinnedBuiltins: BuiltinFieldConfig[];
  /** CSS gridTemplateColumns string the row should use so the row
   *  aligns with the header. */
  gridTemplate: string;
  /** When true, the row can't be drag-reordered (a filter/sort is active). */
  reorderDisabled?: boolean;
  /** Reflects an inline custom-field edit in the parent value map. */
  onCustomFieldChange?: (taskId: string, fieldId: string, next: unknown) => void;
  /** Refetches custom-field values after a successful inline save. */
  onCustomFieldCommitted?: () => void;
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
  pinnedBuiltins,
  gridTemplate,
  reorderDisabled = false,
  onCustomFieldChange,
  onCustomFieldCommitted,
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: reorderDisabled });

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
          Per-cell `[&>*+*]:border-l` lives ON THE ROW DIRECTLY —
          the only path that's 100% deterministic across browsers
          and immune to stacking-context bugs. Adds a left border
          to every cell except the first (the checkbox cell),
          which gives vertical dividers between columns. Section
          headers don't use this class so they stay naturally
          clean (no lines passing through). */}
      <div
        className="hidden md:grid px-6 py-2 hover:bg-slate-50 cursor-pointer items-center border-t border-[#e6e9ef] group [&>*]:px-2 [&>*+*]:border-l [&>*+*]:border-[#e6e9ef] [&>*]:min-w-0"
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

        {/* Due Date — Asana-style range picker. Opens a popover with
            two date fields (start + due) instead of a single native
            date input. Persists both edges through saveInlineEdit so
            the row instantly reflects "May 14 – 27" when set. */}
        <div onClick={(e) => e.stopPropagation()}>
          <DueDatePicker
            startDate={task.startDate ? dueDateToLocalMidnight(task.startDate) : null}
            dueDate={task.dueDate ? dueDateToLocalMidnight(task.dueDate) : null}
            onChange={(start, due) => {
              const startStr = start ? format(start, "yyyy-MM-dd") : null;
              const dueStr = due ? format(due, "yyyy-MM-dd") : null;
              saveInlineEdit(task.id, "startDate", startStr);
              saveInlineEdit(task.id, "dueDate", dueStr);
            }}
            trigger={
              <div className="cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1">
                {task.startDate || task.dueDate ? (
                  task.startDate && task.dueDate ? (
                    // Range present → "May 14 – 27" pill matching
                    // task-helpers.formatRangeLabel output.
                    <div
                      className={cn(
                        "flex items-center gap-1 text-sm",
                        !task.completed &&
                          task.dueDate &&
                          isPast(dueDateToLocalMidnight(task.dueDate)) &&
                          !isToday(dueDateToLocalMidnight(task.dueDate))
                          ? "text-black"
                          : "text-slate-600",
                        task.completed && "text-slate-400"
                      )}
                    >
                      <Calendar className="h-3 w-3" />
                      {formatRangeLabel(
                        dueDateToLocalMidnight(task.startDate),
                        dueDateToLocalMidnight(task.dueDate),
                        format(dueDateToLocalMidnight(task.dueDate), "MMM d")
                      )}
                    </div>
                  ) : task.dueDate ? (
                    // Due only → existing badge keeps "Today"/"Tomorrow"
                    // relative phrasing.
                    <DueDateBadge
                      dueDate={task.dueDate}
                      completed={task.completed}
                    />
                  ) : (
                    // Start only → "From May 14"
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Calendar className="h-3 w-3" />
                      {formatRangeLabel(
                        dueDateToLocalMidnight(task.startDate!),
                        null,
                        ""
                      )}
                    </div>
                  )
                ) : (
                  <span className="text-slate-400 text-sm">---</span>
                )}
              </div>
            }
          />
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
                    isPast(dueDateToLocalMidnight(task.dueDate)) &&
                    !isToday(dueDateToLocalMidnight(task.dueDate))
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
            Click-to-edit via EditableCustomFieldCell (DROPDOWN /
            MULTI_SELECT pop a picker, TEXT/NUMBER opens an inline
            input, DATE opens a date popover, etc.). Read-only types
            (PEOPLE/REFERENCE/FORMULA/TIMER/TIME_TRACKING/ROLLUP)
            still render via the underlying CustomFieldCell. */}
        {customFieldDefs.map((field) => (
          <div
            key={field.id}
            className="overflow-hidden flex items-center"
            onClick={(e) => e.stopPropagation()}
            title={field.name}
          >
            <EditableCustomFieldCell
              taskId={task.id}
              fieldId={field.id}
              type={field.type}
              options={field.options}
              value={customFieldValuesForTask[field.id] ?? null}
              onChange={(next) =>
                onCustomFieldChange?.(task.id, field.id, next)
              }
              onCommitted={onCustomFieldCommitted}
            />
          </div>
        ))}

        {/* Built-in extra value cells — Asana "Show more" picks. The
            BuiltinFieldCell maps the column id to the right Task
            field and handles its own formatting (chips, pills,
            avatars, dates). Priority + Tags include inline editors. */}
        {pinnedBuiltins.map((b) => (
          <div
            key={b.id}
            className="overflow-hidden flex items-center"
            onClick={(e) => e.stopPropagation()}
            title={b.label}
          >
            <BuiltinFieldCell
              builtinId={b.id}
              task={{
                id: task.id,
                priority: task.priority as "NONE" | "LOW" | "MEDIUM" | "HIGH",
                startDate: task.startDate ?? null,
                completedAt: task.completedAt ?? null,
                createdAt: task.createdAt || "",
                updatedAt: task.updatedAt || "",
                creator: task.creator,
                dependencies: task.dependencies,
                dependents: task.dependents,
                taskTags: task.taskTags,
                _count: task._count,
              }}
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
