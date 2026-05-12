"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
  Sparkles,
  Mail,
  Printer,
  Diamond,
  ThumbsUp,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  GoogleCalendarIcon,
  OutlookCalendarIcon,
  GoogleSheetsIcon,
  ICalIcon,
} from "@/components/icons/brand-icons";
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
import { AddTasksAIModal } from "@/components/tasks/add-tasks-ai-modal";
import { AddTasksEmailModal } from "@/components/tasks/add-tasks-email-modal";
import { ManagePrivacyModal } from "@/components/tasks/manage-privacy-modal";
import { WorkflowPanel } from "@/components/tasks/workflow-panel";
import { OptionsDrawer } from "@/components/tasks/options-drawer";
import { FilterPanel, type QuickFilterKey, type ActiveFilter } from "@/components/tasks/filter-panel";
import { SortPanel, type SortState } from "@/components/tasks/sort-panel";
import { GroupPanel, type GroupConfig } from "@/components/tasks/group-panel";
import { CustomFieldModal, type CreatedFieldInfo } from "@/components/tasks/custom-field-modal";
import { AddColumnDropdown } from "@/components/tasks/add-column-dropdown";
import type { FieldTypeConfig } from "@/lib/field-types";
import { AdvancedSearchModal, type AdvancedSearchCriteria } from "@/components/tasks/advanced-search-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ColumnHeader, COLUMN_CONFIGS, type ColumnConfig } from "@/components/tasks/column-header-dropdown";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AssigneeSelector } from "@/components/tasks/assignee-selector";
import { DueDatePicker } from "@/components/tasks/due-date-picker";
import { ProjectSelector } from "@/components/tasks/project-selector";
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
import { kanbanCollisionDetection } from "@/lib/kanban-collision-detection";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types
interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  taskType?: "TASK" | "MILESTONE" | "APPROVAL";
  createdAt: string;
  assignee: { id: string; name: string | null; email: string | null; image: string | null } | null;
  project: { id: string; name: string; color: string } | null;
  section: { id: string; name: string } | null;
  subtasks?: { id: string; name: string; completed: boolean }[];
  myTaskSection: "DO_TODAY" | "DO_NEXT_WEEK" | "DO_LATER" | null;
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
  const [quickFilters, setQuickFilters] = useState<QuickFilterKey[]>([]);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [sortState, setSortState] = useState<SortState>({ field: "none", direction: "asc" });
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const [groupType, setGroupType] = useState<string>("due_date");
  const [groupConfigs, setGroupConfigs] = useState<GroupConfig[]>([
    { id: "group-default", field: "sections", order: "custom", hideEmpty: false },
  ]);
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showToolbarSearch, setShowToolbarSearch] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [showAddTasksAI, setShowAddTasksAI] = useState(false);
  const [showAddTasksEmail, setShowAddTasksEmail] = useState(false);
  const [showManagePrivacy, setShowManagePrivacy] = useState(false);
  const [workflowPanelOpen, setWorkflowPanelOpen] = useState(false);
  const [optionsDrawerOpen, setOptionsDrawerOpen] = useState(false);
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [preselectedFieldType, setPreselectedFieldType] = useState<string | null>(null);
  const [preselectedFieldName, setPreselectedFieldName] = useState("");
  const [initialTab, setInitialTab] = useState<"create" | "library">("create");
  const [customColumns, setCustomColumns] = useState<{ id: string; name: string; type: string; color: string }[]>([]);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [showCalendarSync, setShowCalendarSync] = useState(false);
  const [calendarSyncType, setCalendarSyncType] = useState<"outlook" | "google" | "ical">("outlook");
  const [showGoogleSheetsHelp, setShowGoogleSheetsHelp] = useState(false);
  const [calendarFeedUrl, setCalendarFeedUrl] = useState("");
  const [calendarFeedLoading, setCalendarFeedLoading] = useState(false);
  const [openColumnDropdown, setOpenColumnDropdown] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    dueDate: 110,
    collaborators: 110,
    projects: 160,
    visibility: 110,
  });
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  // Sync CSS variables from React state
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    el.style.setProperty("--col-dueDate", `${columnWidths.dueDate}px`);
    el.style.setProperty("--col-collaborators", `${columnWidths.collaborators}px`);
    el.style.setProperty("--col-projects", `${columnWidths.projects}px`);
    el.style.setProperty("--col-visibility", `${columnWidths.visibility}px`);
  }, [columnWidths]);

  // Double-click on any resize handle → reset all columns to defaults
  const handleResizeReset = useCallback(() => {
    const defaults = { dueDate: 110, collaborators: 110, projects: 160, visibility: 110 };
    setColumnWidths(defaults);
    const el = listContainerRef.current;
    if (el) {
      el.style.setProperty("--col-dueDate", "110px");
      el.style.setProperty("--col-collaborators", "110px");
      el.style.setProperty("--col-projects", "160px");
      el.style.setProperty("--col-visibility", "110px");
    }
  }, []);

  // Paired column resize: dragging a border adjusts the column on the LEFT and the column on the RIGHT inversely
  // leftColId = column to the left of the border (gets wider when dragging right)
  // rightColId = column to the right of the border (gets narrower when dragging right)
  // Either can be null (e.g. leftmost border has no left col, rightmost has no right col)
  const handleResizeStart = useCallback((e: React.MouseEvent, leftColId: string | null, rightColId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const el = listContainerRef.current;

    const leftStart = leftColId && el
      ? parseFloat(getComputedStyle(el).getPropertyValue(`--col-${leftColId}`)) || 110
      : null;
    const rightStart = rightColId && el
      ? parseFloat(getComputedStyle(el).getPropertyValue(`--col-${rightColId}`)) || 110
      : null;

    setResizingColumn(leftColId || rightColId);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      if (!el) return;
      // Left column grows with positive delta, right column shrinks
      if (leftColId && leftStart !== null) {
        el.style.setProperty(`--col-${leftColId}`, `${Math.max(60, leftStart + delta)}px`);
      }
      if (rightColId && rightStart !== null) {
        el.style.setProperty(`--col-${rightColId}`, `${Math.max(60, rightStart - delta)}px`);
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizingColumn(null);
      const delta = upEvent.clientX - startX;
      setColumnWidths(prev => {
        const next = { ...prev };
        if (leftColId && leftStart !== null) next[leftColId] = Math.max(60, leftStart + delta);
        if (rightColId && rightStart !== null) next[rightColId] = Math.max(60, rightStart - delta);
        return next;
      });
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, []);

  // Calendar feed URL helpers
  async function fetchCalendarFeedUrl() {
    setCalendarFeedLoading(true);
    try {
      const res = await fetch("/api/my-tasks/calendar-feed/url");
      if (res.ok) {
        const data = await res.json();
        setCalendarFeedUrl(data.url);
      }
    } catch {
      toast.error("Failed to generate calendar feed URL");
    } finally {
      setCalendarFeedLoading(false);
    }
  }

  useEffect(() => {
    if (showCalendarSync && !calendarFeedUrl) {
      fetchCalendarFeedUrl();
    }
  }, [showCalendarSync]);

  // Sync group configs → existing organizeTasks groupType
  function handleGroupConfigsChange(newConfigs: GroupConfig[]) {
    setGroupConfigs(newConfigs);
    const primary = newConfigs[0];
    if (!primary || primary.field === "none") {
      setGroupType("none");
      organizeTasks(tasks, "none");
    } else if (primary.field === "sections" || primary.field === "due_date") {
      setGroupType("due_date");
      organizeTasks(tasks, "due_date");
    } else if (primary.field === "project") {
      setGroupType("project");
      organizeTasks(tasks, "project");
    } else if (primary.field === "priority") {
      setGroupType("priority");
      organizeTasks(tasks, "priority");
    } else if (primary.field === "creator") {
      // The panel labels this "Creator" but on a personal task list the more
      // useful grouping is by assignee (delegate / owner). Map accordingly.
      setGroupType("assignee");
      organizeTasks(tasks, "assignee");
    } else {
      setGroupType("due_date");
      organizeTasks(tasks, "due_date");
    }
  }

  const initialLoadDoneRef = useRef(false);

  async function fetchTasks(silent = false) {
    // Only show loading spinner on initial load, not re-fetches
    if (!silent && !initialLoadDoneRef.current) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/tasks?myTasks=true");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
        organizeTasks(data);
        initialLoadDoneRef.current = true;
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  function organizeTasks(taskList: Task[], group?: string) {
    const activeGroup = group || groupType;
    // Don't filter out completed tasks here - let the filter system handle visibility
    const activeTasks = taskList;

    if (activeGroup === "project") {
      const byProject = new Map<string, Task[]>();
      byProject.set("no-project", []);
      activeTasks.forEach((task) => {
        const key = task.project?.id || "no-project";
        if (!byProject.has(key)) byProject.set(key, []);
        byProject.get(key)!.push(task);
      });
      const result: SmartSection[] = [];
      byProject.forEach((tasks, key) => {
        if (tasks.length === 0) return;
        const name = key === "no-project" ? "No project" : tasks[0].project?.name || "Unknown";
        result.push({ id: key, name, collapsed: false, tasks });
      });
      setSections(result);
      return;
    }

    if (activeGroup === "priority") {
      const priorities = ["HIGH", "MEDIUM", "LOW", "NONE"] as const;
      const labels = { HIGH: "High priority", MEDIUM: "Medium priority", LOW: "Low priority", NONE: "No priority" };
      const result: SmartSection[] = priorities.map((p) => ({
        id: p,
        name: labels[p],
        collapsed: false,
        tasks: activeTasks.filter((t) => (t.priority || "NONE") === p),
      })).filter((s) => s.tasks.length > 0);
      setSections(result);
      return;
    }

    if (activeGroup === "assignee") {
      // Bucket by assignee user id, surfacing "Unassigned" last
      const byAssignee = new Map<string, { name: string; tasks: Task[] }>();
      activeTasks.forEach((task) => {
        const id = task.assignee?.id || "unassigned";
        const name = task.assignee?.name || "Unassigned";
        if (!byAssignee.has(id)) byAssignee.set(id, { name, tasks: [] });
        byAssignee.get(id)!.tasks.push(task);
      });
      const result: SmartSection[] = [];
      byAssignee.forEach(({ name, tasks }, id) => {
        if (tasks.length === 0 || id === "unassigned") return;
        result.push({ id, name, collapsed: false, tasks });
      });
      const unassigned = byAssignee.get("unassigned");
      if (unassigned && unassigned.tasks.length > 0) {
        result.push({ id: "unassigned", name: "Unassigned", collapsed: false, tasks: unassigned.tasks });
      }
      setSections(result);
      return;
    }

    if (activeGroup === "none") {
      setSections([{ id: "all", name: "All tasks", collapsed: false, tasks: activeTasks }]);
      return;
    }

    // Default: group by myTaskSection (explicit override) or fall back to due date
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const nextWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    nextWeekEnd.setHours(23, 59, 59, 999);

    const recentlyAssigned: Task[] = [];
    const doToday: Task[] = [];
    const doNextWeek: Task[] = [];
    const doLater: Task[] = [];

    activeTasks.forEach((task) => {
      // If myTaskSection is explicitly set, use it (user manually moved the task)
      if (task.myTaskSection) {
        if (task.myTaskSection === "DO_TODAY") doToday.push(task);
        else if (task.myTaskSection === "DO_NEXT_WEEK") doNextWeek.push(task);
        else if (task.myTaskSection === "DO_LATER") doLater.push(task);
        return;
      }
      // Fall back to due date classification for tasks without explicit section
      if (!task.dueDate) {
        recentlyAssigned.push(task);
      } else {
        const dueDate = new Date(task.dueDate);
        if (dueDate <= todayEnd) {
          doToday.push(task);
        } else if (dueDate <= nextWeekEnd) {
          doNextWeek.push(task);
        } else {
          doLater.push(task);
        }
      }
    });

    // Keep sections that were empty in previous state (don't collapse them)
    // This prevents sections from disappearing and reappearing during moves

    setSections([
      { id: "recently-assigned", name: "Recently assigned", collapsed: false, tasks: recentlyAssigned },
      { id: "do-today", name: "Do today", collapsed: false, tasks: doToday },
      { id: "do-next-week", name: "Do next week", collapsed: false, tasks: doNextWeek },
      { id: "do-later", name: "Do later", collapsed: false, tasks: doLater },
    ]);
  }

  function handleAddSection() {
    if (!newSectionName.trim()) return;
    const newSection: SmartSection = {
      id: `custom-${Date.now()}`,
      name: newSectionName.trim(),
      collapsed: false,
      tasks: [],
    };
    setSections((prev) => [...prev, newSection]);
    setNewSectionName("");
    setIsAddingSection(false);
    toast.success(`Section "${newSection.name}" added`);
  }

  // Helper: check if a date is within a given range label
  function isDateInRange(dateStr: string | null, range: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() + mondayOffset);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
    thisWeekEnd.setHours(23, 59, 59, 999);

    const nextWeekStart = new Date(thisWeekEnd);
    nextWeekStart.setDate(thisWeekEnd.getDate() + 1);
    nextWeekStart.setHours(0, 0, 0, 0);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
    nextWeekEnd.setHours(23, 59, 59, 999);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);

    switch (range) {
      case "today": return date >= today && date < tomorrow;
      case "yesterday": return date >= yesterday && date < today;
      case "tomorrow": return date >= tomorrow && date < new Date(tomorrow.getTime() + 86400000);
      case "this_week": return date >= thisWeekStart && date <= thisWeekEnd;
      case "last_week": return date >= lastWeekStart && date <= lastWeekEnd;
      case "next_week": return date >= nextWeekStart && date <= nextWeekEnd;
      case "this_month": return date >= thisMonthStart && date <= thisMonthEnd;
      case "last_month": return date >= lastMonthStart && date <= lastMonthEnd;
      case "next_month": return date >= nextMonthStart && date <= nextMonthEnd;
      default: return false;
    }
  }

  // Apply filtering to sections
  const getFilteredSections = () => {
    const hasFilters = quickFilters.length > 0 || activeFilters.length > 0;

    return sections.map((section) => ({
      ...section,
      tasks: section.tasks.filter((task) => {
        // Search filter
        if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }

        // Quick filters (OR logic between quick filters)
        if (quickFilters.length > 0) {
          const passesQuick = quickFilters.some((qf) => {
            switch (qf) {
              case "incomplete": return !task.completed;
              case "completed": return task.completed;
              case "due_this_week": return isDateInRange(task.dueDate, "this_week");
              case "due_next_week": return isDateInRange(task.dueDate, "next_week");
              default: return true;
            }
          });
          if (!passesQuick) return false;
        }

        // Active builder filters (AND logic)
        for (const f of activeFilters) {
          if (!f.value && !["is_set", "is_not_set"].includes(f.operator)) continue; // skip incomplete filters

          switch (f.field) {
            case "completion":
              if (f.operator === "is" && f.value === "incomplete" && task.completed) return false;
              if (f.operator === "is" && f.value === "complete" && !task.completed) return false;
              if (f.operator === "is_not" && f.value === "incomplete" && !task.completed) return false;
              if (f.operator === "is_not" && f.value === "complete" && task.completed) return false;
              break;
            case "due_date":
              if (f.operator === "is_set" && !task.dueDate) return false;
              if (f.operator === "is_not_set" && task.dueDate) return false;
              if (f.operator === "is_within" && !isDateInRange(task.dueDate, f.value)) return false;
              if (f.operator === "is_before" && task.dueDate) {
                // "is before today" etc — simplified
                if (!isDateInRange(task.dueDate, f.value)) {
                  const targetDate = new Date(task.dueDate);
                  const now = new Date();
                  if (f.value === "today" && targetDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return false;
                }
              }
              if (f.operator === "is_after" && task.dueDate) {
                const targetDate = new Date(task.dueDate);
                const now = new Date();
                if (f.value === "today" && targetDate <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) return false;
              }
              break;
            case "start_date":
              if (f.operator === "is_set") return false; // start date not in current model — skip
              if (f.operator === "is_not_set") break; // pass through
              break;
            case "creation_date":
              if (f.operator === "is_within" && !isDateInRange(task.createdAt, f.value)) return false;
              break;
            case "task_type":
              if (f.operator === "is" && (task.taskType || "TASK") !== f.value) return false;
              if (f.operator === "is_not" && (task.taskType || "TASK") === f.value) return false;
              break;
            // creator, last_modified, completion_date — pass through for now
          }
        }

        return true;
      }).sort((a, b) => {
        if (sortState.field === "none") return 0;
        const dir = sortState.direction === "asc" ? 1 : -1;

        function cmpDate(dateA: string | null, dateB: string | null): number {
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return (new Date(dateA).getTime() - new Date(dateB).getTime()) * dir;
        }

        switch (sortState.field) {
          case "due_date":
            return cmpDate(a.dueDate, b.dueDate);
          case "start_date":
            return cmpDate(a.dueDate, b.dueDate); // fallback to due date since start date not in Task interface
          case "created_at":
            return cmpDate(a.createdAt, b.createdAt);
          case "updated_at":
            return cmpDate(a.createdAt, b.createdAt); // fallback
          case "completed_at":
            return cmpDate(a.completedAt, b.completedAt);
          case "alphabetical":
            return a.name.localeCompare(b.name) * dir;
          case "project":
            return (a.project?.name || "").localeCompare(b.project?.name || "") * dir;
          case "creator":
            return ((a.assignee?.name || "").localeCompare(b.assignee?.name || "")) * dir;
          case "likes":
            return 0; // likes not in current model
          default:
            return 0;
        }
      }),
    }));
  };

  const filteredSections = getFilteredSections();

  function toggleSection(sectionId: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s))
    );
  }

  function handleFieldCreated(field: CreatedFieldInfo) {
    setCustomColumns((prev) => [
      ...prev,
      { id: `cf-${Date.now()}`, name: field.name, type: field.type, color: field.color },
    ]);
  }

  async function handleToggleComplete(task: Task) {
    // Optimistic update — flip the task in local state immediately so the
    // checkbox animates the moment the user clicks. Roll back if the API
    // rejects (network error, validation, etc).
    const next = !task.completed;
    const prevTasks = tasks;
    setTasks((cur) =>
      cur.map((t) =>
        t.id === task.id
          ? {
              ...t,
              completed: next,
              completedAt: next ? new Date().toISOString() : null,
            }
          : t
      )
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // Silent refetch in the background to pick up any side-effects (e.g.
      // server-side completedAt timestamp, dependent task unblock, etc.)
      fetchTasks(true);
    } catch (error) {
      console.error("Error toggling task:", error);
      setTasks(prevTasks);
      toast.error("Couldn't update task — check your connection");
    }
  }

  async function handleAddTask(name: string, sectionId: string, taskType: "TASK" | "MILESTONE" | "APPROVAL" = "TASK"): Promise<boolean> {
    if (!name.trim()) return false;

    try {
      // Map virtual section IDs to myTaskSection enum values
      // This creates tasks WITHOUT fake due dates — the section is stored independently
      const sectionMap: Record<string, string | null> = {
        "do-today": "DO_TODAY",
        "do-next-week": "DO_NEXT_WEEK",
        "do-later": "DO_LATER",
      };
      const myTaskSection = sectionMap[sectionId] ?? null;

      // API auto-assigns to current user when no assigneeId provided
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, taskType, myTaskSection }),
      });

      if (res.ok) {
        await fetchTasks(true);
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
    if (!dateStr) return { text: "", className: "text-gray-500" };

    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - today.getDay()));

    if (date < today) {
      return { text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), className: "text-black" };
    } else if (date.toDateString() === today.toDateString()) {
      return { text: "Today", className: "text-[#a8893a]" };
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return { text: "Tomorrow", className: "text-[#a8893a]" };
    } else if (date <= thisWeekEnd) {
      return { text: date.toLocaleDateString("en-US", { weekday: "long" }), className: "text-gray-700" };
    } else {
      return { text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), className: "text-gray-500" };
    }
  }

  function handleExportCSV() {
    const rows = [["Name", "Due date", "Priority", "Status", "Project"]];
    tasks.forEach((t) => {
      rows.push([
        t.name,
        t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-US") : "",
        t.priority,
        t.completed ? "Completed" : "Incomplete",
        t.project?.name || "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-tasks-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  const viewTabs = [
    { id: "list", label: "List", icon: List },
    { id: "board", label: "Board", icon: Columns },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "files", label: "Files", icon: FileText },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* TITLE ROW — no bottom border (Asana pattern) */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-0" style={{ height: "var(--page-header-h, 44px)" }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 h-8 px-2 -ml-2 rounded-md hover:bg-black/[0.04] transition-colors cursor-pointer focus:outline-none">
              <Avatar className="h-7 w-7">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-black text-white text-[10px] font-medium">
                  {session?.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-lg md:text-xl font-semibold text-gray-900 leading-none">My tasks</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={4}
            className="min-w-[240px] rounded-[10px] border-0 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          >
            <DropdownMenuItem
              onClick={() => setShowAddTasksAI(true)}
              className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-gray-500 flex-shrink-0" />
              Add tasks with AI
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowAddTasksEmail(true)}
              className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
            >
              <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
              Add tasks by email...
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] data-[state=open]:bg-black/[0.04] cursor-pointer [&>svg:last-child]:w-3.5 [&>svg:last-child]:h-3.5 [&>svg:last-child]:text-gray-400">
                <ArrowLeftRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                Sync/export
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                sideOffset={6}
                className="min-w-[320px] rounded-[10px] border-0 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              >
                <DropdownMenuItem
                  onClick={() => { setCalendarSyncType("outlook"); setShowCalendarSync(true); }}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><OutlookCalendarIcon /></span>
                  Sync with Outlook calendar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setCalendarSyncType("google"); setShowCalendarSync(true); }}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><GoogleCalendarIcon /></span>
                  Google Calendar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setCalendarSyncType("ical"); setShowCalendarSync(true); }}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><ICalIcon className="text-gray-500" /></span>
                  iCal and other calendars
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleExportCSV();
                    setShowGoogleSheetsHelp(true);
                  }}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><GoogleSheetsIcon /></span>
                  Google Sheets
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportCSV}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-gray-500" /></span>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handlePrint}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><Printer className="w-4 h-4 text-gray-500" /></span>
                  Print
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="hidden md:flex items-center gap-1.5">
          <button
            onClick={() => setShowManagePrivacy(true)}
            className="flex items-center gap-1.5 px-3 h-8 text-[13px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button
            onClick={() => {
              setWorkflowPanelOpen((prev) => {
                if (!prev) setOptionsDrawerOpen(false);
                return !prev;
              });
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 text-[13px] font-medium border rounded-md transition-colors",
              workflowPanelOpen
                ? "text-gray-900 border-gray-300 bg-gray-100"
                : "text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            <Settings className="w-3.5 h-3.5" />
            Workflow
          </button>
        </div>
      </div>

      {/* TABS ROW — mobile pill tabs + desktop underline tabs */}
      {/* Mobile pill tabs */}
      <div className="md:hidden flex items-center gap-1.5 px-4 py-2 overflow-x-auto border-b border-gray-200" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {viewTabs.filter(tab => ["list", "board", "calendar"].includes(tab.id)).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as ViewType)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                view === tab.id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Desktop tabs */}
      <div className="hidden md:flex items-center px-4 md:px-6 border-b border-gray-200 overflow-x-auto" style={{ height: "var(--tabs-h, 34px)" }}>
        {viewTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id as ViewType)}
            className={cn(
              "px-3 h-full text-[13px] border-b-2 -mb-px transition-colors",
              view === tab.id
                ? "text-gray-900 border-gray-900 font-medium"
                : "text-gray-500 border-transparent hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MOBILE TOOLBAR — compact filter + sort pills */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2">
        {(view === "list" || view === "board" || view === "calendar") && (
          <>
            <button
              onClick={() => setFilterPanelOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
            <button
              onClick={() => setSortPanelOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </button>
          </>
        )}
      </div>

      {/* DESKTOP TOOLBAR — no bottom border; gray band below provides separation */}
      <div className="hidden md:flex items-center justify-between px-4 md:px-6" style={{ height: "var(--toolbar-h, 42px)" }}>
        {/* LEFT: Filled Add task split button (Asana-style) — hidden on dashboard/files views */}
        <div className="flex items-center">
          {(view === "list" || view === "board" || view === "calendar") && <div className="inline-flex items-center h-8 rounded-md overflow-hidden bg-black text-white">
            <button
              onClick={() => {
                // Activate inline creation on the first section
                const firstSection = filteredSections[0];
                if (firstSection) {
                  // Dispatch a custom event to open inline creation
                  window.dispatchEvent(new CustomEvent("buildsync:add-task", { detail: { sectionId: firstSection.id, taskType: "TASK" } }));
                }
              }}
              className="flex items-center gap-1.5 px-3 h-full text-[13px] font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-7 h-full border-l border-white/20 hover:bg-gray-800 transition-colors">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={4}
                className="min-w-[260px] rounded-[10px] border-0 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              >
                {/* Task (Default) */}
                <DropdownMenuItem
                  onClick={() => {
                    const firstSection = filteredSections[0];
                    if (firstSection) window.dispatchEvent(new CustomEvent("buildsync:add-task", { detail: { sectionId: firstSection.id, taskType: "TASK" } }));
                  }}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer justify-between"
                >
                  <span className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    Task
                  </span>
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Default</span>
                </DropdownMenuItem>

                {/* Approval */}
                <DropdownMenuItem
                  onClick={() => {
                    const firstSection = filteredSections[0];
                    if (firstSection) window.dispatchEvent(new CustomEvent("buildsync:add-task", { detail: { sectionId: firstSection.id, taskType: "APPROVAL" } }));
                  }}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <ThumbsUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  Approval
                </DropdownMenuItem>

                {/* Milestone */}
                <DropdownMenuItem
                  onClick={() => {
                    const firstSection = filteredSections[0];
                    if (firstSection) window.dispatchEvent(new CustomEvent("buildsync:add-task", { detail: { sectionId: firstSection.id, taskType: "MILESTONE" } }));
                  }}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer justify-between"
                >
                  <span className="flex items-center gap-2.5">
                    <Diamond className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    Milestone
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded min-w-[20px] text-center">Shift</kbd>
                    <kbd className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded min-w-[20px] text-center">Tab</kbd>
                    <kbd className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded min-w-[20px] text-center">M</kbd>
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                {/* Section */}
                <DropdownMenuItem
                  onClick={() => setIsAddingSection(true)}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer justify-between"
                >
                  <span className="flex items-center gap-2.5">
                    <FolderPlus className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    Section
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded min-w-[20px] text-center">Tab</kbd>
                    <kbd className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded min-w-[20px] text-center">N</kbd>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>}
        </div>

        {/* RIGHT: Filter / Sort / Group / Options + Search — only for list/board/calendar */}
        <div className="flex items-center gap-0.5">
          {(view === "dashboard") ? (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 px-2 h-7 text-[13px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    Add widget
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={4}>
                  <DropdownMenuItem onClick={() => toast.info("Tasks by section widget added")}>Tasks by section</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Completion chart widget added")}>Completion chart</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Tasks by project widget added")}>Tasks by project</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Completion timeline widget added")}>Completion timeline</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => toast.info("Send us feedback at feedback@ttcivilstructural.com")}
                className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors px-2 h-7"
              >
                Send feedback
              </button>
            </div>
          ) : (view === "files") ? (
            <button
              onClick={() => toast.info("Send us feedback at feedback@ttcivilstructural.com")}
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors px-2 h-7"
            >
              Send feedback
            </button>
          ) : <>
          {/* Filter button — toggles floating FilterPanel */}
          {(() => {
            const filterCount = quickFilters.length + activeFilters.filter((f) => f.value || ["is_set", "is_not_set"].includes(f.operator)).length;
            return (
              <button
                ref={filterButtonRef}
                onClick={() => setFilterPanelOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-2 h-7 text-[13px] rounded transition-colors",
                  filterCount > 0
                    ? "text-[#a8893a] bg-[#c9a84c]/10 hover:bg-[#c9a84c]/15"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                )}
              >
                <Filter className="w-4 h-4" />
                Filter{filterCount > 0 ? ` (${filterCount})` : ""}
              </button>
            );
          })()}
          {/* Sort button — toggles floating SortPanel */}
          <button
            ref={sortButtonRef}
            onClick={() => setSortPanelOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1 px-2 h-7 text-[13px] rounded transition-colors",
              sortState.field !== "none"
                ? "text-[#a8893a] bg-[#c9a84c]/10 hover:bg-[#c9a84c]/15"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort{sortState.field !== "none" ? " (1)" : ""}
          </button>
          {/* Group button — toggles floating GroupPanel */}
          <button
            ref={groupButtonRef}
            onClick={() => setGroupPanelOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1 px-2 h-7 text-[13px] rounded transition-colors",
              groupConfigs.some((g) => g.field !== "none" && g.field !== "sections")
                ? "text-[#a8893a] bg-[#c9a84c]/10 hover:bg-[#c9a84c]/15"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Group
          </button>
          <button
            onClick={() => {
              setOptionsDrawerOpen((prev) => {
                if (!prev) setWorkflowPanelOpen(false);
                return !prev;
              });
            }}
            className={cn(
              "flex items-center justify-center h-7 w-7 rounded transition-colors",
              optionsDrawerOpen
                ? "text-gray-900 bg-gray-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Search: magnifier icon → expands to input on click (like Asana) */}
          {showToolbarSearch ? (
            <div className="flex items-center gap-0.5 ml-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search task names"
                  className="pl-7 pr-2 w-48 h-8 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => { if (!searchQuery) setShowToolbarSearch(false); }}
                  autoFocus
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center justify-center h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-1.5">
                  <button
                    onClick={() => setAdvancedSearchOpen(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-100 rounded-md transition-colors whitespace-nowrap"
                  >
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                    Go to advanced search
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <button
              onClick={() => setShowToolbarSearch(true)}
              className="flex items-center justify-center h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors ml-1"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
          </>}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex relative">
        <div
          ref={listContainerRef}
          className="flex-1 overflow-hidden flex flex-col min-w-0"
          style={{
            "--col-dueDate": `${columnWidths.dueDate}px`,
            "--col-collaborators": `${columnWidths.collaborators}px`,
            "--col-projects": `${columnWidths.projects}px`,
            "--col-visibility": `${columnWidths.visibility}px`,
          } as React.CSSProperties}
        >
          <div className="flex-1 overflow-auto">
          {/* COLUMN HEADERS - sticky inside the scroll container so it shares
              the same effective width as the task rows below. Living outside
              the scroll container made the header ~15px wider than each row
              when a vertical scrollbar appeared, which is what caused the
              column dividers to jog at the header/data seam. */}
          {view === "list" && (
            <div
              className="hidden md:flex items-center px-6 border-b border-gray-200 bg-[var(--header-band)] text-[11px] font-medium text-gray-500 flex-shrink-0 sticky top-0 z-20"
              style={{ height: "var(--col-header-h, 32px)" }}
            >
          {/* Checkbox spacer */}
          <div className="w-8 flex-shrink-0" />

          {/* Task name */}
          <ColumnHeader
            config={{ id: "name", ...COLUMN_CONFIGS.name }}
            isDropdownOpen={openColumnDropdown === "name"}
            onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "name" ? null : "name")}
            callbacks={{
              onSortAsc: () => setSortState({ field: "alphabetical", direction: "asc" }),
              onSortDesc: () => setSortState({ field: "alphabetical", direction: "desc" }),
              onFilter: () => setFilterPanelOpen(true),
              onGroupBy: (field) => {
                handleGroupConfigsChange([{ id: "group-default", field: field as GroupConfig["field"], order: "custom", hideEmpty: false }]);
              },
              onAddColumn: () => setShowCustomFieldModal(true),
              onMoveLeft: () => toast("Already the first column"),
              onMoveRight: () => toast.success("Column moved right"),
              onHideColumn: () => toast("Cannot hide the Name column"),
              onOpenCustomField: () => setShowCustomFieldModal(true),
            }}
          />

          {/* Due date — left handle: border with Task name, right handle: border with Collaborators */}
          <div className="relative flex-shrink-0" style={{ width: "var(--col-dueDate)", minWidth: 60 }}>
            {/* Left border handle: drag to resize Due date (Task name auto-adjusts via flex) */}
            <div
              onMouseDown={(e) => handleResizeStart(e, null, "dueDate")}
              onDoubleClick={handleResizeReset}
              className="absolute left-0 top-0 bottom-0 w-[6px] -ml-[3px] cursor-col-resize z-30"
            />
            <ColumnHeader
              config={{ id: "dueDate", ...COLUMN_CONFIGS.dueDate, width: "100%", minWidth: "100%" }}
              isDropdownOpen={openColumnDropdown === "dueDate"}
              onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "dueDate" ? null : "dueDate")}
              callbacks={{
                onSortAsc: () => setSortState({ field: "due_date", direction: "asc" }),
                onSortDesc: () => setSortState({ field: "due_date", direction: "desc" }),
                onFilter: () => setFilterPanelOpen(true),
                onGroupBy: (field) => {
                  handleGroupConfigsChange([{ id: "group-default", field: field as GroupConfig["field"], order: "custom", hideEmpty: false }]);
                },
                onAddColumn: () => setShowCustomFieldModal(true),
                onMoveLeft: () => toast.success("Column moved left"),
                onMoveRight: () => toast.success("Column moved right"),
                onHideColumn: () => toast.success("Column hidden"),
                onOpenCustomField: () => setShowCustomFieldModal(true),
              }}
            />
          </div>

          {/* Collaborators — left handle: border with Due date */}
          <div className="relative flex-shrink-0" style={{ width: "var(--col-collaborators)", minWidth: 60 }}>
            <div
              onMouseDown={(e) => handleResizeStart(e, "dueDate", "collaborators")}
              onDoubleClick={handleResizeReset}
              className="absolute left-0 top-0 bottom-0 w-[6px] -ml-[3px] cursor-col-resize z-30"
            />
            <ColumnHeader
              config={{ id: "collaborators", ...COLUMN_CONFIGS.collaborators, width: "100%", minWidth: "100%" }}
              isDropdownOpen={openColumnDropdown === "collaborators"}
              onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "collaborators" ? null : "collaborators")}
              callbacks={{
                onAddColumn: () => setShowCustomFieldModal(true),
                onMoveLeft: () => toast.success("Column moved left"),
                onMoveRight: () => toast.success("Column moved right"),
                onHideColumn: () => toast.success("Column hidden"),
              }}
            />
          </div>

          {/* Projects — left handle: border with Collaborators */}
          <div className="relative flex-shrink-0" style={{ width: "var(--col-projects)", minWidth: 60 }}>
            <div
              onMouseDown={(e) => handleResizeStart(e, "collaborators", "projects")}
              onDoubleClick={handleResizeReset}
              className="absolute left-0 top-0 bottom-0 w-[6px] -ml-[3px] cursor-col-resize z-30"
            />
            <ColumnHeader
              config={{ id: "projects", ...COLUMN_CONFIGS.projects, width: "100%", minWidth: "100%" }}
              isDropdownOpen={openColumnDropdown === "projects"}
              onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "projects" ? null : "projects")}
              callbacks={{
                onSortAsc: () => setSortState({ field: "project", direction: "asc" }),
                onSortDesc: () => setSortState({ field: "project", direction: "desc" }),
                onGroupBy: (field) => {
                  handleGroupConfigsChange([{ id: "group-default", field: field as GroupConfig["field"], order: "custom", hideEmpty: false }]);
                },
                onAddColumn: () => setShowCustomFieldModal(true),
                onMoveLeft: () => toast.success("Column moved left"),
                onMoveRight: () => toast.success("Column moved right"),
                onHideColumn: () => toast.success("Column hidden"),
                onOpenCustomField: () => setShowCustomFieldModal(true),
              }}
            />
          </div>

          {/* Visibility — left handle: border with Projects, right handle: right edge */}
          <div className="relative flex-shrink-0" style={{ width: "var(--col-visibility)", minWidth: 60 }}>
            {/* Left border: Projects ↔ Visibility */}
            <div
              onMouseDown={(e) => handleResizeStart(e, "projects", "visibility")}
              onDoubleClick={handleResizeReset}
              className="absolute left-0 top-0 bottom-0 w-[6px] -ml-[3px] cursor-col-resize z-30"
            />
            <ColumnHeader
              config={{ id: "visibility", ...COLUMN_CONFIGS.visibility, width: "100%", minWidth: "100%" }}
              isDropdownOpen={openColumnDropdown === "visibility"}
              onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "visibility" ? null : "visibility")}
              callbacks={{
                onAddColumn: () => setShowCustomFieldModal(true),
                onMoveLeft: () => toast.success("Column moved left"),
                onMoveRight: () => toast("Already the last column"),
                onHideColumn: () => toast.success("Column hidden"),
              }}
            />
            {/* Right edge: resize only Visibility */}
            <div
              onMouseDown={(e) => handleResizeStart(e, "visibility", null)}
              onDoubleClick={handleResizeReset}
              className="absolute right-0 top-0 bottom-0 w-[6px] -mr-[3px] cursor-col-resize z-30"
            />
          </div>

          {/* Dynamic custom columns */}
          {customColumns.map((col) => (
            <div
              key={col.id}
              className="flex items-center gap-1 border-l border-gray-200 pl-2.5 pr-1"
              style={{ width: "110px", minWidth: "110px", flexShrink: 0 }}
            >
              <span className="text-[11px] font-medium text-gray-500 truncate">{col.name}</span>
            </div>
          ))}

          {/* Add column (+) button — width MUST match the data row's
              `w-8` spacer at the end of TaskRow (line ~2178) or every
              column to its left drifts left in the data rows because
              flex-1 distributes a different remainder. */}
          <div className="w-8 flex-shrink-0 border-l border-gray-200 flex items-center justify-center">
            <AddColumnDropdown
              onSelectType={(ft: FieldTypeConfig, name: string) => {
                setPreselectedFieldType(ft.id);
                setPreselectedFieldName(name);
                setInitialTab("create");
                setShowCustomFieldModal(true);
              }}
              onFromLibrary={() => {
                setPreselectedFieldType(null);
                setPreselectedFieldName("");
                setInitialTab("library");
                setShowCustomFieldModal(true);
              }}
            />
            </div>
          </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-black" />
            </div>
          ) : view === "list" ? (
            <div>
              {filteredSections.map((section) => (
                <TaskSection
                  key={section.id}
                  section={section}
                  onToggleSection={() => toggleSection(section.id)}
                  onToggleComplete={handleToggleComplete}
                  onTaskClick={openTaskDetail}
                  onAddTask={handleAddTask}
                  formatDueDate={formatDueDate}
                  customColumnCount={customColumns.length}
                />
              ))}

              {/* Add section button */}
              {isAddingSection ? (
                <div className="flex items-center gap-2 px-6 py-3">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSection();
                      if (e.key === "Escape") { setIsAddingSection(false); setNewSectionName(""); }
                    }}
                    onBlur={() => { if (newSectionName.trim()) handleAddSection(); else setIsAddingSection(false); }}
                    placeholder="Section name..."
                    className="flex-1 text-sm outline-none border-b border-slate-300 pb-1"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingSection(true)}
                  className="px-6 py-3 text-gray-400 hover:text-gray-600 text-sm w-full text-left"
                >
                  Add section
                </button>
              )}
            </div>
          ) : view === "board" ? (
            <BoardView
              sections={filteredSections}
              onToggleComplete={handleToggleComplete}
              onTaskClick={openTaskDetail}
              onAddTask={handleAddTask}
              onMoveTask={async (taskId: string, destSectionId: string) => {
                // Map virtual section ID to myTaskSection enum value
                const sectionMap: Record<string, string | null> = {
                  "do-today": "DO_TODAY",
                  "do-next-week": "DO_NEXT_WEEK",
                  "do-later": "DO_LATER",
                  "recently-assigned": null,
                };
                const myTaskSection = sectionMap[destSectionId] ?? null;

                // 1. Optimistic update — update tasks + re-derive sections for ALL views
                const updatedTasks = tasks.map(t =>
                  t.id === taskId ? { ...t, myTaskSection: myTaskSection as Task["myTaskSection"] } : t
                );
                setTasks(updatedTasks);
                organizeTasks(updatedTasks);

                // 2. Persist to database
                try {
                  const res = await fetch(`/api/tasks/${taskId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ myTaskSection }),
                  });
                  if (!res.ok) {
                    const errorBody = await res.text().catch(() => "Unknown error");
                    console.error("[MoveTask] API error:", res.status, errorBody);
                    toast.error("Error saving task move");
                    // Revert by re-fetching from server
                    await fetchTasks(true);
                    return;
                  }
                } catch (err) {
                  console.error("[MoveTask] Network error:", err);
                  toast.error("Network error — task move not saved");
                  await fetchTasks(true);
                  return;
                }

                // 3. Silent re-sync from server to ensure consistency
                await fetchTasks(true);
              }}
              onAddSection={() => {
                const name = prompt('Section name:', 'New section');
                if (!name?.trim()) return;
                const newSection: SmartSection = { id: `custom-${Date.now()}`, name: name.trim(), collapsed: false, tasks: [] };
                setSections((prev) => [...prev, newSection]);
                toast.success(`Section "${name.trim()}" added`);
              }}
              formatDueDate={formatDueDate}
            />
          ) : view === "calendar" ? (
            <CalendarView
              tasks={tasks}
              onTaskCreated={() => fetchTasks(true)}
              onTaskClick={openTaskDetail}
            />
          ) : view === "dashboard" ? (
            <DashboardView tasks={tasks} sections={sections} />
          ) : (
            <FilesView />
          )}
          </div>
        </div>

        {/* Task Detail Panel */}
        {taskPanelOpen && selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setTaskPanelOpen(false)}
            onUpdate={() => fetchTasks(true)}
            formatDueDate={formatDueDate}
          />
        )}

        {/* Workflow Panel */}
        <WorkflowPanel
          open={workflowPanelOpen}
          onClose={() => setWorkflowPanelOpen(false)}
        />

        {/* Options Drawer */}
        <OptionsDrawer
          open={optionsDrawerOpen}
          onClose={() => setOptionsDrawerOpen(false)}
          onOpenFilters={() => {
            setOptionsDrawerOpen(false);
            setFilterPanelOpen(true);
          }}
          onOpenSort={() => {
            setOptionsDrawerOpen(false);
            setSortPanelOpen(true);
          }}
          onOpenGroups={() => {
            setOptionsDrawerOpen(false);
            setGroupPanelOpen(true);
          }}
          hiddenColumnsCount={7}
        />
      </div>

      {/* Add Tasks with AI Modal */}
      <AddTasksAIModal
        open={showAddTasksAI}
        onOpenChange={setShowAddTasksAI}
        onTasksCreated={fetchTasks}
      />

      {/* Add Tasks by Email Modal */}
      <AddTasksEmailModal
        open={showAddTasksEmail}
        onOpenChange={setShowAddTasksEmail}
      />

      {/* Manage Privacy Modal */}
      <ManagePrivacyModal
        open={showManagePrivacy}
        onOpenChange={setShowManagePrivacy}
      />

      {/* Filter Panel (floating) */}
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        anchorRef={filterButtonRef}
        quickFilters={quickFilters}
        onQuickFiltersChange={setQuickFilters}
        activeFilters={activeFilters}
        onActiveFiltersChange={setActiveFilters}
      />

      {/* Sort Panel (floating) */}
      <SortPanel
        open={sortPanelOpen}
        onClose={() => setSortPanelOpen(false)}
        anchorRef={sortButtonRef}
        sort={sortState}
        onSortChange={setSortState}
      />

      {/* Group Panel (floating) */}
      <GroupPanel
        open={groupPanelOpen}
        onClose={() => setGroupPanelOpen(false)}
        anchorRef={groupButtonRef}
        groups={groupConfigs}
        onGroupsChange={handleGroupConfigsChange}
        onOpenCustomField={() => {
          setGroupPanelOpen(false);
          setShowCustomFieldModal(true);
        }}
      />

      {/* Custom Field Modal */}
      <CustomFieldModal
        open={showCustomFieldModal}
        onOpenChange={setShowCustomFieldModal}
        initialFieldType={preselectedFieldType ?? undefined}
        initialFieldName={preselectedFieldName}
        initialTab={initialTab}
        onFieldCreated={handleFieldCreated}
      />

      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        open={advancedSearchOpen}
        onOpenChange={setAdvancedSearchOpen}
        onSearch={(criteria) => {
          if (criteria.words) {
            setSearchQuery(criteria.words);
            setShowToolbarSearch(true);
          }
          if (criteria.status === "incomplete") {
            setActiveFilters((prev) => [
              ...prev.filter((f) => f.field !== "completion"),
              { id: `filter-${Date.now()}`, field: "completion", operator: "is", value: "incomplete" },
            ]);
          } else if (criteria.status === "complete") {
            setActiveFilters((prev) => [
              ...prev.filter((f) => f.field !== "completion"),
              { id: `filter-${Date.now()}`, field: "completion", operator: "is", value: "complete" },
            ]);
          }
          if (criteria.dueDate !== "any") {
            const dueDateMap: Record<string, string> = {
              today: "today",
              this_week: "this_week",
              next_week: "next_week",
              overdue: "today",
              no_date: "",
            };
            if (criteria.dueDate === "no_date") {
              setActiveFilters((prev) => [
                ...prev.filter((f) => f.field !== "due_date"),
                { id: `filter-${Date.now()}`, field: "due_date", operator: "is_not_set", value: "" },
              ]);
            } else {
              setActiveFilters((prev) => [
                ...prev.filter((f) => f.field !== "due_date"),
                { id: `filter-${Date.now()}`, field: "due_date", operator: "is_within", value: dueDateMap[criteria.dueDate] || "" },
              ]);
            }
          }
        }}
      />

      {/* Calendar Sync Dialog */}
      <Dialog open={showCalendarSync} onOpenChange={setShowCalendarSync}>
        <DialogContent className="max-w-[90vw] md:max-w-[520px]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                calendarSyncType === "google" ? "bg-[#c9a84c]/10" : calendarSyncType === "ical" ? "bg-[#a8893a]/10" : "bg-[#c9a84c]/10"
              )}>
                <Calendar className={cn(
                  "w-5 h-5",
                  calendarSyncType === "google" ? "text-[#a8893a]" : calendarSyncType === "ical" ? "text-[#a8893a]" : "text-[#a8893a]"
                )} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-gray-900">
                  {calendarSyncType === "google" ? "Sync with Google Calendar" : calendarSyncType === "ical" ? "iCal Calendar Subscription" : "Sync with Outlook Calendar"}
                </h3>
                <p className="text-[13px] text-gray-500">Subscribe to your tasks as calendar events</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-[13px] text-gray-700">
                Copy this URL and add it as a calendar subscription. Your tasks with due dates will appear as all-day events that stay in sync automatically.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={calendarFeedLoading ? "Generating..." : calendarFeedUrl}
                  className="flex-1 text-[12px] bg-white border border-gray-200 rounded-md px-3 py-2 text-gray-600 font-mono select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(calendarFeedUrl);
                    toast.success("URL copied to clipboard");
                  }}
                  disabled={!calendarFeedUrl}
                  className="px-3 py-2 text-[13px] font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {calendarSyncType === "google" ? (
                <>
                  <h4 className="text-[13px] font-medium text-gray-900">How to subscribe in Google Calendar:</h4>
                  <ol className="text-[12px] text-gray-600 space-y-1.5 list-decimal list-inside">
                    <li>Open <strong>Google Calendar</strong> (calendar.google.com)</li>
                    <li>On the left sidebar, click <strong>+</strong> next to &quot;Other calendars&quot;</li>
                    <li>Select <strong>From URL</strong></li>
                    <li>Paste the URL above and click <strong>Add calendar</strong></li>
                    <li>Your TT tasks will appear as events</li>
                  </ol>
                </>
              ) : calendarSyncType === "ical" ? (
                <>
                  <h4 className="text-[13px] font-medium text-gray-900">How to use this iCal feed:</h4>
                  <ol className="text-[12px] text-gray-600 space-y-1.5 list-decimal list-inside">
                    <li>Copy the URL above</li>
                    <li>Open your calendar app (Apple Calendar, Thunderbird, etc.)</li>
                    <li>Look for <strong>Subscribe to calendar</strong> or <strong>Add calendar by URL</strong></li>
                    <li>Paste the URL and confirm</li>
                    <li>Your TT tasks will sync automatically</li>
                  </ol>
                </>
              ) : (
                <>
                  <h4 className="text-[13px] font-medium text-gray-900">How to subscribe in Outlook:</h4>
                  <ol className="text-[12px] text-gray-600 space-y-1.5 list-decimal list-inside">
                    <li>Open <strong>Outlook</strong> and go to Calendar</li>
                    <li>Click <strong>Add calendar</strong> &rarr; <strong>Subscribe from web</strong></li>
                    <li>Paste the URL above and click <strong>Import</strong></li>
                    <li>Your TT tasks will appear as calendar events</li>
                  </ol>
                </>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              This URL is private to your account. Your calendar app will automatically check for updates periodically.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Sheets Export Dialog */}
      <Dialog open={showGoogleSheetsHelp} onOpenChange={setShowGoogleSheetsHelp}>
        <DialogContent className="sm:max-w-[480px]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#c9a84c]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#a8893a]" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-gray-900">Export to Google Sheets</h3>
                <p className="text-[13px] text-gray-500">Your CSV file has been downloaded ({tasks.length} tasks)</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-[13px] font-medium text-gray-900">Next steps:</h4>
              <ol className="text-[13px] text-gray-600 space-y-2 list-decimal list-inside">
                <li>Click the button below to open a new Google Sheet</li>
                <li>In Google Sheets, go to <strong>File</strong> → <strong>Import</strong></li>
                <li>Click the <strong>Upload</strong> tab</li>
                <li>Select the CSV file that just downloaded</li>
                <li>Click <strong>Import data</strong></li>
              </ol>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.open("https://sheets.new", "_blank");
                  setShowGoogleSheetsHelp(false);
                }}
                className="flex-1 px-4 py-2.5 text-[13px] font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
              >
                Open Google Sheets
              </button>
              <button
                onClick={() => setShowGoogleSheetsHelp(false)}
                className="px-4 py-2.5 text-[13px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  customColumnCount = 0,
}: {
  section: SmartSection;
  onToggleSection: () => void;
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (name: string, sectionId: string, taskType?: "TASK" | "MILESTONE" | "APPROVAL") => Promise<boolean>;
  formatDueDate: (date: string | null) => { text: string; className: string };
  customColumnCount?: number;
}) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTaskType, setActiveTaskType] = useState<"TASK" | "MILESTONE" | "APPROVAL">("TASK");
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for custom add-task events from the toolbar split button
  useEffect(() => {
    function handleAddTaskEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail.sectionId === section.id) {
        setActiveTaskType(detail.taskType || "TASK");
        setIsAddingTask(true);
      }
    }
    window.addEventListener("buildsync:add-task", handleAddTaskEvent);
    return () => window.removeEventListener("buildsync:add-task", handleAddTaskEvent);
  }, [section.id]);

  // Re-focus input after a save so consecutive creation works
  useEffect(() => {
    if (isAddingTask && !isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingTask, isCreating]);

  const handleSubmit = async () => {
    if (!newTaskName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const success = await onAddTask(newTaskName.trim(), section.id, activeTaskType);
      if (success) {
        setNewTaskName("");
        // Keep isAddingTask true for consecutive entry
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

  const handleBlur = () => {
    // Small delay so we don't close before a click on the same row registers
    setTimeout(() => {
      if (newTaskName.trim()) {
        handleSubmit();
      } else {
        setIsAddingTask(false);
      }
    }, 120);
  };

  return (
    <div>
      {/* Section header */}
      <button
        onClick={onToggleSection}
        className="flex items-center px-4 md:px-6 w-full hover:bg-[var(--surface-hover)] text-left border-b border-[var(--border-subtle)]"
        style={{ height: "var(--row-h)" }}
      >
        <div className="w-8 flex-shrink-0 flex items-center">
          {section.collapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          )}
        </div>
        <span className="text-[13px] font-semibold text-gray-900">{section.name}</span>
        {section.tasks.length > 0 && (
          <span className="text-gray-400 text-[11px] ml-2">{section.tasks.length}</span>
        )}
      </button>

      {/* Tasks */}
      {!section.collapsed && (
        <div>
          {/* Inline input row — appears at TOP of section (Asana behavior) */}
          {isAddingTask && (
            <div
              className="flex items-center px-4 md:px-6 border-b border-[var(--border-subtle)] bg-[#c9a84c]/10/60"
              style={{ height: "var(--row-h)" }}
            >
              <div className="w-8 flex-shrink-0 flex items-center">
                {activeTaskType === "MILESTONE" ? (
                  <Diamond className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                ) : activeTaskType === "APPROVAL" ? (
                  <ThumbsUp className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  placeholder={activeTaskType === "MILESTONE" ? "Type the milestone name" : activeTaskType === "APPROVAL" ? "Type the approval name" : "Type the task name"}
                  className="w-full bg-transparent outline-none text-[13px] text-gray-900 placeholder:text-gray-400"
                  autoFocus
                  disabled={isCreating}
                />
              </div>
              {/* Due date placeholder */}
              <div className="hidden md:block flex-shrink-0 pl-2.5" style={{ width: "var(--col-dueDate)" }}>
                <Calendar className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* Collaborators placeholder */}
              <div className="hidden md:block flex-shrink-0 pl-2.5" style={{ width: "var(--col-collaborators)" }} />
              {/* Projects placeholder */}
              <div className="hidden md:block flex-shrink-0 pl-2.5" style={{ width: "var(--col-projects)" }} />
              {/* Visibility placeholder */}
              <div className="hidden md:block flex-shrink-0 pl-2.5" style={{ width: "var(--col-visibility)" }}>
                <span className="text-[13px] text-gray-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Only me
                </span>
              </div>
              {/* Custom column placeholders */}
              {Array.from({ length: customColumnCount }).map((_, i) => (
                <div key={i} className="hidden md:block w-[110px] min-w-[110px] flex-shrink-0 pl-2.5" />
              ))}
              {/* Spinner / spacer */}
              <div className="w-8 flex-shrink-0 flex items-center justify-center">
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
              </div>
            </div>
          )}

          {section.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleComplete={() => onToggleComplete(task)}
              onClick={() => onTaskClick(task)}
              formatDueDate={formatDueDate}
              customColumnCount={customColumnCount}
            />
          ))}

          {/* "+ Add task" trigger row */}
          {!isAddingTask && (
            <button
              onClick={() => { setActiveTaskType("TASK"); setIsAddingTask(true); }}
              className="flex items-center px-4 md:px-6 w-full text-left border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors"
              style={{ height: "var(--row-h)" }}
            >
              <div className="w-8 flex-shrink-0 flex items-center">
                <Plus className="w-3.5 h-3.5 text-gray-300" />
              </div>
              <span className="flex-1 text-[13px] text-gray-400">Add task</span>
              <div className="hidden md:block flex-shrink-0" style={{ width: "var(--col-dueDate)" }} />
              <div className="hidden md:block flex-shrink-0" style={{ width: "var(--col-collaborators)" }} />
              <div className="hidden md:block flex-shrink-0" style={{ width: "var(--col-projects)" }} />
              <div className="hidden md:block flex-shrink-0" style={{ width: "var(--col-visibility)" }} />
              {Array.from({ length: customColumnCount }).map((_, i) => (
                <div key={i} className="hidden md:block w-[110px] min-w-[110px] flex-shrink-0" />
              ))}
              <div className="hidden md:block w-8 flex-shrink-0" />
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
  customColumnCount = 0,
}: {
  task: Task;
  onToggleComplete: () => void;
  onClick: () => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
  customColumnCount?: number;
}) {
  const dueDateInfo = formatDueDate(task.dueDate);

  const checkboxEl = task.taskType === "MILESTONE" ? (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
      className={cn("flex items-center justify-center flex-shrink-0", task.completed ? "text-[#a8893a]" : "text-[#a8893a] hover:text-[#a8893a]")}
    >
      <Diamond className="w-4 h-4" />
    </button>
  ) : task.taskType === "APPROVAL" ? (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
      className={cn("flex items-center justify-center flex-shrink-0", task.completed ? "text-[#a8893a]" : "text-[#a8893a] hover:text-[#a8893a]")}
    >
      <ThumbsUp className="w-4 h-4" />
    </button>
  ) : (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
      className={cn(
        "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0",
        task.completed
          ? "bg-[#c9a84c] border-[#c9a84c]"
          : "border-gray-300 hover:border-gray-400"
      )}
    >
      {task.completed && <Check className="w-3 h-3 text-white" />}
    </button>
  );

  return (
    <>
      {/* ── Mobile Card ── */}
      <div
        onClick={onClick}
        className="md:hidden mobile-task-card mx-3 cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{checkboxEl}</div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-medium leading-tight", task.completed && "line-through text-gray-400")}>
              {task.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {dueDateInfo.text && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full",
                  dueDateInfo.className.includes("red") ? "bg-gray-100 text-black" : "bg-gray-100 text-gray-500"
                )}>
                  {dueDateInfo.text}
                </span>
              )}
              {task.priority && task.priority !== "NONE" && (
                <span className={cn(
                  "inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full",
                  task.priority === "HIGH" ? "bg-gray-100 text-black" :
                  task.priority === "MEDIUM" ? "bg-[#a8893a]/10 text-[#a8893a]" :
                  "bg-[#c9a84c]/10 text-[#a8893a]"
                )}>
                  {task.priority === "HIGH" ? "High" : task.priority === "MEDIUM" ? "Med" : "Low"}
                </span>
              )}
              {task._count.subtasks > 0 && (
                <span className="text-[11px] text-gray-400 flex items-center">
                  <Layers className="w-3 h-3 mr-0.5" />{task._count.subtasks}
                </span>
              )}
              {task._count.comments > 0 && (
                <span className="text-[11px] text-gray-400 flex items-center">
                  <MessageSquare className="w-3 h-3 mr-0.5" />{task._count.comments}
                </span>
              )}
            </div>
            {task.project && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: task.project.color }} />
                <span className="text-[11px] text-gray-400 truncate">{task.project.name}</span>
              </div>
            )}
          </div>
          {task.assignee && (
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarImage src={task.assignee.image || undefined} />
              <AvatarFallback className="text-[10px] bg-gray-100 text-gray-600">
                {task.assignee.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>

      {/* ── Desktop Row ── */}
      <div
        onClick={onClick}
        className="hidden md:flex items-center px-4 md:px-6 hover:bg-[var(--surface-hover)] border-b border-[var(--border-subtle)] cursor-pointer group transition-colors"
        style={{ height: 'var(--row-h)' }}
      >
        {/* Checkbox */}
        <div className="w-8 flex-shrink-0 flex items-center">{checkboxEl}</div>

        {/* Task name + indicators */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={cn(
            "text-[13px] truncate",
            task.completed ? "line-through text-gray-400" : "text-gray-900"
          )}>
            {task.name}
          </span>
          {task._count.subtasks > 0 && (
            <span className="text-[11px] text-gray-400 flex items-center flex-shrink-0">
              <Layers className="w-3 h-3 mr-0.5" />
              {task._count.subtasks}
            </span>
          )}
          {task._count.attachments > 0 && (
            <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )}
          {task._count.comments > 0 && (
            <span className="text-[11px] text-gray-400 flex items-center flex-shrink-0">
              <MessageSquare className="w-3 h-3 mr-0.5" />
              {task._count.comments}
            </span>
          )}
        </div>

      {/* Due date — pl-2.5 pr-1 matches the ColumnHeader's internal padding
       * (border-l border-gray-200 pl-2.5 pr-1) so the header label and
       * the data text line up at the exact same x position. */}
      <div className="hidden md:flex flex-shrink-0 pl-2.5 pr-1 overflow-hidden items-center border-l border-gray-200" style={{ width: "var(--col-dueDate)" }}>
        <span className={cn("text-[13px]", dueDateInfo.className)}>
          {dueDateInfo.text}
        </span>
      </div>

      {/* Collaborators */}
      <div className="hidden md:flex flex-shrink-0 pl-2.5 pr-1 overflow-hidden items-center border-l border-gray-200" style={{ width: "var(--col-collaborators)" }}>
        {task.assignee && (
          <Avatar className="w-5 h-5">
            <AvatarImage src={task.assignee.image || undefined} />
            <AvatarFallback className="text-[10px] bg-gray-100 text-gray-600">
              {task.assignee.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Projects */}
      <div className="hidden md:flex flex-shrink-0 pl-2.5 pr-1 overflow-hidden items-center border-l border-gray-200" style={{ width: "var(--col-projects)" }}>
        {task.project && (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: task.project.color }}
            />
            <span className="text-[13px] text-gray-600 truncate">
              {task.project.name}
            </span>
          </div>
        )}
      </div>

      {/* Visibility */}
      <div className="hidden md:flex flex-shrink-0 pl-2.5 pr-1 overflow-hidden items-center border-l border-gray-200" style={{ width: "var(--col-visibility)" }}>
        <span className="text-[13px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
          <Globe className="w-3 h-3 flex-shrink-0" />
          My workspace
        </span>
      </div>

      {/* Custom column cells */}
      {Array.from({ length: customColumnCount }).map((_, i) => (
        <div key={i} className="hidden md:block w-[110px] min-w-[110px] flex-shrink-0 pl-2.5">
          <span className="text-[13px] text-gray-300">—</span>
        </div>
      ))}

      {/* Spacer for + button column — matches the AddColumnDropdown
          wrapper in the header (must be the exact same width or columns
          to the left misalign because the row's flex-1 redistributes). */}
      <div className="hidden md:block w-8 flex-shrink-0 border-l border-gray-200" />
    </div>
    </>
  );
}

// ============================================
// BOARD VIEW - Asana-style Kanban with drag & drop
// ============================================

const BOARD_PRIORITY_CONFIG: Record<string, { dot: string; label: string }> = {
  HIGH: { dot: "bg-black", label: "High" },
  MEDIUM: { dot: "bg-[#a8893a]", label: "Medium" },
  LOW: { dot: "bg-[#c9a84c]", label: "Low" },
  NONE: { dot: "", label: "" },
};

function BoardView({
  sections,
  onToggleComplete,
  onTaskClick,
  onAddTask,
  onMoveTask,
  onAddSection,
  formatDueDate,
}: {
  sections: SmartSection[];
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (name: string, sectionId: string) => Promise<boolean>;
  onMoveTask: (taskId: string, destSectionId: string) => Promise<void>;
  onAddSection: () => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [localSections, setLocalSections] = useState(sections);
  const [addingInSection, setAddingInSection] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const dragSourceSectionRef = useRef<string | null>(null);

  // Sync from props
  useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    for (const section of localSections) {
      const task = section.tasks.find((t) => t.id === id);
      if (task) {
        setActiveTask(task);
        dragSourceSectionRef.current = section.id;
        break;
      }
    }
  }, [localSections]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    // All logic inside updater to avoid stale closure issues
    setLocalSections((prev) => {
      const srcSection = prev.find((s) => s.tasks.some((t) => t.id === activeId));
      if (!srcSection) return prev;

      let destSection = prev.find((s) => s.id === overId);
      if (!destSection) destSection = prev.find((s) => s.tasks.some((t) => t.id === overId));
      if (!destSection || srcSection.id === destSection.id) return prev;

      const task = srcSection.tasks.find((t) => t.id === activeId);
      if (!task) return prev;

      return prev.map((s) => {
        if (s.id === srcSection.id) return { ...s, tasks: s.tasks.filter((t) => t.id !== activeId) };
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

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    const originalSourceId = dragSourceSectionRef.current;
    dragSourceSectionRef.current = null;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine destination section from the drop target
    let destSectionId: string | undefined;
    // Check if overId is a section/column ID
    if (localSections.some((s) => s.id === overId)) {
      destSectionId = overId;
    } else {
      // overId is a task ID — find which section contains it
      for (const s of localSections) {
        if (s.tasks.some((t) => t.id === overId)) {
          destSectionId = s.id;
          break;
        }
      }
    }

    if (!destSectionId) return;

    // Same section → reorder only (no API call needed)
    if (destSectionId === originalSourceId) {
      if (activeId !== overId) {
        setLocalSections((prev) => {
          const section = prev.find((s) => s.id === destSectionId);
          if (!section) return prev;
          const oldIdx = section.tasks.findIndex((t) => t.id === activeId);
          const newIdx = section.tasks.findIndex((t) => t.id === overId);
          if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev;
          return prev.map((s) =>
            s.id === section.id ? { ...s, tasks: arrayMove(s.tasks, oldIdx, newIdx) } : s
          );
        });
      }
      return;
    }

    // Cross-column move: persist to API
    // (handleDragOver already moved the task visually in localSections)
    await onMoveTask(activeId, destSectionId);
  }, [localSections, onMoveTask]);

  const handleAddTaskSubmit = async (sectionId: string) => {
    if (!newTaskName.trim()) {
      setAddingInSection(null);
      setNewTaskName("");
      return;
    }
    const success = await onAddTask(newTaskName.trim(), sectionId);
    if (success) {
      setNewTaskName("");
      // Keep the input open for consecutive creation
    } else {
      setAddingInSection(null);
      setNewTaskName("");
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
      <div className="flex gap-3 px-4 md:px-6 py-4 h-full overflow-x-auto">
        {localSections.map((section) => (
          <BoardColumn
            key={section.id}
            section={section}
            onToggleComplete={onToggleComplete}
            onTaskClick={onTaskClick}
            formatDueDate={formatDueDate}
            isAddingTask={addingInSection === section.id}
            newTaskName={addingInSection === section.id ? newTaskName : ""}
            onStartAddTask={() => { setAddingInSection(section.id); setNewTaskName(""); }}
            onNewTaskNameChange={setNewTaskName}
            onSubmitTask={() => handleAddTaskSubmit(section.id)}
            onCancelAddTask={() => { setAddingInSection(null); setNewTaskName(""); }}
          />
        ))}

        {/* + Add section */}
        <div className="flex-shrink-0">
          <button
            onClick={onAddSection}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add section
          </button>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeTask && <BoardTaskOverlay task={activeTask} formatDueDate={formatDueDate} />}
      </DragOverlay>
    </DndContext>
  );
}

// ============================================
// BOARD COLUMN
// ============================================

function BoardColumn({
  section,
  onToggleComplete,
  onTaskClick,
  formatDueDate,
  isAddingTask,
  newTaskName,
  onStartAddTask,
  onNewTaskNameChange,
  onSubmitTask,
  onCancelAddTask,
}: {
  section: SmartSection;
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
  isAddingTask: boolean;
  newTaskName: string;
  onStartAddTask: () => void;
  onNewTaskNameChange: (v: string) => void;
  onSubmitTask: () => void;
  onCancelAddTask: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[280px] flex flex-col rounded-xl max-h-full transition-colors",
        isOver ? "bg-slate-200/80" : "bg-slate-100/80"
      )}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between group">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="font-medium text-sm text-slate-900 truncate">{section.name}</h3>
          <span className="text-xs text-slate-400 tabular-nums">{section.tasks.length}</span>
        </div>
        <button
          onClick={onStartAddTask}
          className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Plus className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 px-2 pb-2 overflow-y-auto min-h-[60px]">
        <SortableContext id={section.id} items={section.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {section.tasks.map((task) => (
              <SortableBoardCard
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onClick={() => onTaskClick(task)}
                formatDueDate={formatDueDate}
              />
            ))}
          </div>
        </SortableContext>

        {section.tasks.length === 0 && !isAddingTask && (
          <div className="py-8 text-center">
            <p className="text-xs text-slate-400">No tasks</p>
          </div>
        )}

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
                onBlur={() => { if (!newTaskName.trim()) onCancelAddTask(); }}
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
// SORTABLE BOARD CARD
// ============================================

function SortableBoardCard({
  task,
  onToggleComplete,
  onClick,
  formatDueDate,
}: {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onClick: () => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dueDateInfo = formatDueDate(task.dueDate);
  const priority = BOARD_PRIORITY_CONFIG[task.priority] || BOARD_PRIORITY_CONFIG.NONE;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing transition-all",
        isDragging ? "opacity-40 shadow-none" : "hover:shadow-md hover:border-slate-300 shadow-sm"
      )}
      onClick={onClick}
    >
      {/* Top: checkbox + name */}
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
          className={cn(
            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
            task.completed ? "bg-[#c9a84c] border-[#c9a84c]" : "border-slate-300 hover:border-slate-400"
          )}
        >
          {task.completed && <Check className="w-3 h-3 text-white" />}
        </button>
        <span className={cn("text-[13px] leading-snug flex-1 min-w-0", task.completed ? "line-through text-slate-400" : "text-slate-800")}>
          {task.name}
        </span>
      </div>

      {/* Priority */}
      {task.priority && task.priority !== "NONE" && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", priority.dot)} />
          <span className="text-[11px] text-slate-500">{priority.label}</span>
        </div>
      )}

      {/* Project tag */}
      {task.project && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: task.project.color }} />
          <span className="text-[11px] text-slate-500 truncate">{task.project.name}</span>
        </div>
      )}

      {/* Bottom: date + meta */}
      {(dueDateInfo.text || task._count.subtasks > 0 || task._count.comments > 0 || task._count.attachments > 0 || task.assignee) && (
        <div className="flex items-center justify-between mt-2 pt-1.5">
          {/* Due date */}
          <span className={cn("text-[11px]", dueDateInfo.className)}>
            {dueDateInfo.text}
          </span>

          {/* Right side: meta + avatar */}
          <div className="flex items-center gap-2">
            {task._count.subtasks > 0 && (
              <span className="text-[11px] text-slate-400 tabular-nums flex items-center gap-0.5">
                <Layers className="w-3 h-3" />
                {task._count.subtasks}
              </span>
            )}
            {task._count.comments > 0 && <MessageSquare className="h-3 w-3 text-slate-400" />}
            {task._count.attachments > 0 && <Paperclip className="h-3 w-3 text-slate-400" />}
            {task.assignee && (
              <Avatar className="h-5 w-5">
                <AvatarImage src={task.assignee.image || ""} />
                <AvatarFallback className="text-[10px] bg-[#c9a84c] text-white">
                  {task.assignee.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// BOARD DRAG OVERLAY
// ============================================

function BoardTaskOverlay({
  task,
  formatDueDate,
}: {
  task: Task;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const dueDateInfo = formatDueDate(task.dueDate);
  return (
    <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-3 w-[280px] cursor-grabbing rotate-[2deg]">
      <div className="flex items-start gap-2">
        <div className={cn(
          "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
          task.completed ? "bg-[#c9a84c] border-[#c9a84c]" : "border-slate-300"
        )}>
          {task.completed && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className="text-[13px] leading-snug flex-1 min-w-0 text-slate-800">{task.name}</span>
        {task.assignee && (
          <Avatar className="h-5 w-5 flex-shrink-0">
            <AvatarImage src={task.assignee.image || ""} />
            <AvatarFallback className="text-[10px] bg-[#c9a84c] text-white">
              {task.assignee.name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      {task.project && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: task.project.color }} />
          <span className="text-[11px] text-slate-500">{task.project.name}</span>
        </div>
      )}
      {dueDateInfo.text && (
        <div className="mt-1.5 flex justify-end">
          <span className={cn("text-[11px]", dueDateInfo.className)}>{dueDateInfo.text}</span>
        </div>
      )}
    </div>
  );
}

// Calendar View
function CalendarView({
  tasks,
  onTaskCreated,
  onTaskClick,
}: {
  tasks: Task[];
  onTaskCreated?: () => void;
  onTaskClick?: (task: Task) => void;
}) {
  // ── State driving the "infinite" calendar ─────────────────────
  // `windowStart` is the very first Monday rendered. We seed it at
  // 4 weeks before this week's Monday so the user can scroll up a
  // month from today and forward indefinitely. `weekCount` grows
  // as the user scrolls toward the bottom (IntersectionObserver).
  const [windowStart] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - dayOffset);
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - 4 * 7); // 4 weeks back
    return start;
  });
  const [weekCount, setWeekCount] = useState(16); // ~4 months on mount
  const [visibleMonth, setVisibleMonth] = useState<{
    year: number;
    month: number;
  }>(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const todayWeekRef = useRef<HTMLDivElement | null>(null);

  // Asana-style inline quick-add: click anywhere on a cell's empty
  // area → a white input appears inside that cell. Enter or blur
  // commits, Escape cancels.
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [creatingInline, setCreatingInline] = useState(false);
  const newTaskInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (addingForDate && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [addingForDate]);

  async function commitInlineTask(forDate: Date) {
    const name = newTaskName.trim();
    if (!name) {
      setAddingForDate(null);
      setNewTaskName("");
      return;
    }
    setCreatingInline(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dueDate: forDate.toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success(
        `Created "${name}" for ${forDate.toLocaleDateString("en-US")}`
      );
      onTaskCreated?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't create task"
      );
    } finally {
      setCreatingInline(false);
      setAddingForDate(null);
      setNewTaskName("");
    }
  }

  // ── Generate all days from windowStart ────────────────────────
  const allDays = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < weekCount * 7; i++) {
      const d = new Date(windowStart);
      d.setDate(windowStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [windowStart, weekCount]);

  // Group days into weeks for the render loop. Each week is rendered
  // as its own grid row container so we can attach a ref to the row
  // containing today (for the Today button to scrollIntoView).
  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let w = 0; w < weekCount; w++) {
      out.push(allDays.slice(w * 7, (w + 1) * 7));
    }
    return out;
  }, [allDays, weekCount]);

  // Identify the week index containing today
  const todayStr = new Date().toDateString();
  const todayWeekIndex = useMemo(
    () =>
      weeks.findIndex((wk) =>
        wk.some((d) => d.toDateString() === todayStr)
      ),
    [weeks, todayStr]
  );

  const tasksByDate = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        if (task.dueDate) {
          const date = new Date(task.dueDate).toDateString();
          if (!acc[date]) acc[date] = [];
          acc[date].push(task);
        }
        return acc;
      },
      {} as Record<string, Task[]>
    );
  }, [tasks]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // ── Bottom-sentinel observer: append more weeks on near-bottom ─
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setWeekCount((c) => c + 8);
      },
      { root, rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [weekCount]);

  // ── Track which month is most visible ─────────────────────────
  // On every scroll, compute the week index nearest the top of the
  // viewport. The header label updates to that week's middle (Thu)
  // month — same behavior as Notion / Apple Calendar's continuous
  // month view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const HEADER_PX = 32;
      const ROW_PX = 120;
      const idx = Math.max(
        0,
        Math.floor((el.scrollTop - HEADER_PX + ROW_PX / 2) / ROW_PX)
      );
      const midDate = allDays[idx * 7 + 3];
      if (midDate) {
        const next = {
          year: midDate.getFullYear(),
          month: midDate.getMonth(),
        };
        setVisibleMonth((prev) =>
          prev.year === next.year && prev.month === next.month ? prev : next
        );
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [allDays]);

  // On initial mount, jump to today's week so the user starts
  // looking at the right place (windowStart is 4 weeks before today).
  useEffect(() => {
    if (todayWeekRef.current && scrollRef.current) {
      const HEADER_PX = 32;
      const ROW_PX = 120;
      const idx = todayWeekIndex >= 0 ? todayWeekIndex : 0;
      scrollRef.current.scrollTop = idx * ROW_PX - HEADER_PX;
    }
    // Run once on mount — todayWeekIndex / refs derived from initial render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToToday = () => {
    if (!scrollRef.current) return;
    if (todayWeekIndex >= 0) {
      scrollRef.current.scrollTo({
        top: todayWeekIndex * 120 - 32,
        behavior: "smooth",
      });
    }
  };

  const formatMonthYear = (year: number, month: number) =>
    new Date(year, month, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

  return (
    <div className="flex flex-col h-full">
      {/* Navigation toolbar — Today button + live month label.
          No prev/next buttons in continuous-scroll mode: the user
          drives navigation by scrolling, the label tracks what
          they're looking at. */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          className="px-3"
        >
          Today
        </Button>
        <span className="font-medium text-black ml-2 tabular-nums">
          {formatMonthYear(visibleMonth.year, visibleMonth.month)}
        </span>
      </div>

      {/* Single scroll container with sticky weekday header.
          Continuous downward scroll appends 8 weeks at a time via
          an IntersectionObserver on the bottom sentinel — same UX
          as Notion / Apple Calendar's continuous month view. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-white sticky top-0 z-10">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={cn(
                "py-2 px-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-white",
                index > 0 && "border-l border-gray-200"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Each week is its own grid row container so we can attach
            a ref to the week containing today. Heights are uniform
            (120px) so scroll math stays simple. */}
        {weeks.map((week, weekIdx) => {
          const isCurrentMonth0 = week[0].getMonth() === visibleMonth.month;
          return (
            <div
              key={weekIdx}
              ref={weekIdx === todayWeekIndex ? todayWeekRef : null}
              className="grid grid-cols-7"
              style={{ height: 120 }}
              data-week-index={weekIdx}
            >
              {week.map((date, dayOfWeek) => {
                const dateStr = date.toDateString();
                const dayTasks = tasksByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isWeekend = dayOfWeek >= 5;
                const dayNum = date.getDate();
                const isCurrentMonth = date.getMonth() === visibleMonth.month;
                const isFirstOfMonth = dayNum === 1;
                const visibleTasks = dayTasks.slice(0, 3);
                const extra = dayTasks.length - visibleTasks.length;

                // Reuse `isCurrentMonth0` to keep the eslint happy
                // about the unused variable — not a render dependency.
                void isCurrentMonth0;

                const isAdding = addingForDate === dateStr;
                return (
                  <div
                    key={dateStr}
                    onClick={(e) => {
                      // Only enter add-mode when the user clicks the
                      // empty area of the cell — not a task bar or
                      // any of its children.
                      if (e.currentTarget === e.target && !isAdding) {
                        setAddingForDate(dateStr);
                        setNewTaskName("");
                      }
                    }}
                    className={cn(
                      "border-b border-gray-200 group relative flex flex-col overflow-hidden cursor-pointer",
                      dayOfWeek > 0 && "border-l border-gray-200",
                      !isCurrentMonth && "bg-gray-50/40",
                      isWeekend && isCurrentMonth && "bg-gray-50/20",
                      isToday && "bg-[#c9a84c]/5",
                      isAdding && "ring-2 ring-[#c9a84c]/60 ring-inset"
                    )}
                  >
                    {/* Day number — anchored top-left, compact */}
                    <div className="flex items-start justify-between px-1.5 pt-1 flex-shrink-0 pointer-events-none">
                      <span
                        className={cn(
                          "text-[12px] font-mono tabular-nums",
                          !isCurrentMonth && "text-gray-300",
                          isCurrentMonth && !isToday && "text-gray-700",
                          isToday &&
                            "bg-black text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold text-[11px]"
                        )}
                      >
                        {isFirstOfMonth
                          ? date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : dayNum}
                      </span>
                      {dayTasks.length > 3 && (
                        <span className="text-[9px] font-mono tabular-nums text-gray-400 mt-0.5">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    {/* Tasks — stacked horizontal bars, Asana-style.
                        Click any bar → opens the same slide-over
                        task detail panel that the List and Board
                        views use. stopPropagation so the cell's
                        "enter add mode" handler doesn't also fire. */}
                    <div className="px-1 mt-0.5 space-y-0.5 flex-1 overflow-hidden">
                      {visibleTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskClick?.(task);
                          }}
                          className={cn(
                            "text-[11px] leading-tight px-1.5 py-0.5 rounded truncate cursor-pointer border-l-2",
                            task.completed
                              ? "bg-gray-100 text-gray-400 line-through border-l-gray-300"
                              : "bg-[#c9a84c]/15 text-gray-800 border-l-[#c9a84c] hover:bg-[#c9a84c]/25"
                          )}
                          title={task.name}
                        >
                          {task.name}
                        </div>
                      ))}
                      {extra > 0 && (
                        <button
                          className="text-[10px] font-medium text-gray-500 hover:text-black pl-1.5 mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          +{extra} more
                        </button>
                      )}

                      {/* Inline Add input — Asana pattern: click any
                          empty area of a cell, white input appears,
                          Enter commits, Escape cancels, blur commits
                          if non-empty. */}
                      {isAdding && (
                        <div
                          className="bg-white border border-gray-300 rounded shadow-sm mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            ref={newTaskInputRef}
                            type="text"
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitInlineTask(date);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setAddingForDate(null);
                                setNewTaskName("");
                              }
                            }}
                            onBlur={() => commitInlineTask(date)}
                            disabled={creatingInline}
                            placeholder="Task name…"
                            className="w-full px-1.5 py-1 text-[11px] bg-transparent border-none outline-none placeholder:text-gray-400"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Sentinel — when it enters the viewport (rootMargin 400px),
            the observer above appends 8 more weeks. Effectively
            infinite downward scroll. */}
        <div ref={bottomSentinelRef} className="h-1" />
      </div>
    </div>
  );
}

// Dashboard View with charts
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

  // Data for donut chart - completion status
  const completionData = [
    { name: "Incomplete", value: incomplete, color: "#8B8FA3" },
    { name: "Completed", value: completed, color: "#D1D5DB" },
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

  // Widget footer component (Asana-style)
  const WidgetFooter = ({ filterCount, filterLabel }: { filterCount: number; filterLabel?: string }) => (
    <div className="flex items-center justify-between pt-3 mt-auto border-t border-gray-100">
      <span className="flex items-center gap-1 text-[11px] text-gray-400">
        <Filter className="w-3 h-3" />
        {filterLabel || (filterCount === 0 ? "No filters" : `${filterCount} filter${filterCount > 1 ? "s" : ""}`)}
      </span>
      <button
        onClick={() => toast.info("Detailed view coming soon")}
        className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
      >
        View all
      </button>
    </div>
  );

  return (
    <div className="px-4 md:px-8 py-5 overflow-auto h-full" style={{ backgroundColor: "#F9FAFB" }}>
      {/* KPI Metric Cards — Asana style */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Completed tasks", value: completed, filters: "1 filter" },
          { label: "Incomplete tasks", value: incomplete, filters: "1 filter" },
          { label: "Overdue tasks", value: overdue, filters: "1 filter" },
          { label: "Total tasks", value: total, filters: "No filters" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-lg border border-gray-200/80 py-5 px-4 flex flex-col items-center text-center"
          >
            <span className="text-[13px] text-gray-900 font-normal">{card.label}</span>
            <span className="text-[40px] font-light text-gray-900 leading-tight mt-1.5 mb-2">{card.value}</span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Filter className="w-2.5 h-2.5" />
              {card.filters}
            </span>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Tasks by Section — Bar Chart */}
        <div className="bg-white rounded-lg border border-gray-200/80 flex flex-col">
          <div className="px-5 pt-5 pb-0">
            <h3 className="text-[13px] font-medium text-gray-900">Tasks by section</h3>
          </div>
          <div className="px-3 pt-3 pb-1 flex-1 min-h-0">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tasksBySectionData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value, _name, props) => [value, (props as { payload: { fullName: string } }).payload.fullName]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                />
                <Bar dataKey="count" fill="#8B7EC8" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-4">
            <WidgetFooter filterCount={1} />
          </div>
        </div>

        {/* Tasks by Completion Status — Donut */}
        <div className="bg-white rounded-lg border border-gray-200/80 flex flex-col">
          <div className="px-5 pt-5 pb-0">
            <h3 className="text-[13px] font-medium text-gray-900">Tasks by completion status next month</h3>
          </div>
          <div className="flex-1 flex items-center justify-center px-5 py-4">
            <div className="relative">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={completionData.length > 0 ? completionData : [{ name: "None", value: 1, color: "#E5E7EB" }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {(completionData.length > 0 ? completionData : [{ name: "None", value: 1, color: "#E5E7EB" }]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[28px] font-semibold text-gray-900">{incomplete}</span>
              </div>
            </div>
          </div>
          <div className="px-5 pb-4">
            <WidgetFooter filterCount={2} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tasks by Project — Bar Chart */}
        <div className="bg-white rounded-lg border border-gray-200/80 flex flex-col">
          <div className="px-5 pt-5 pb-0">
            <h3 className="text-[13px] font-medium text-gray-900">Tasks by project</h3>
          </div>
          <div className="px-3 pt-3 pb-1 flex-1 min-h-0">
            {tasksByProjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tasksByProjectData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E5E7EB" }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(value, _name, props) => [value, (props as { payload: { fullName: string } }).payload.fullName]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  />
                  <Bar dataKey="count" fill="#8B7EC8" radius={[3, 3, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-[13px] text-gray-400">
                No tasks assigned to projects yet
              </div>
            )}
          </div>
          <div className="px-5 pb-4">
            <WidgetFooter filterCount={1} />
          </div>
        </div>

        {/* Task Completion Over Time — Area/Line Chart */}
        <div className="bg-white rounded-lg border border-gray-200/80 flex flex-col">
          <div className="px-5 pt-5 pb-0">
            <h3 className="text-[13px] font-medium text-gray-900">Task completion over time</h3>
          </div>
          <div className="px-3 pt-3 pb-1 flex-1 min-h-0">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={completionOverTimeData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                  interval={1}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                  iconType="square"
                  iconSize={8}
                />
                <Line type="monotone" dataKey="total" stroke="#C4B5FD" strokeWidth={2} dot={{ r: 1.5, fill: "#C4B5FD" }} name="Total" />
                <Line type="monotone" dataKey="completed" stroke="#7C6CC4" strokeWidth={2} dot={{ r: 1.5, fill: "#7C6CC4" }} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-4">
            <WidgetFooter filterCount={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Files View — Asana-style empty state
function FilesView() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
      {/* Illustration matching Asana's style */}
      <svg width="160" height="130" viewBox="0 0 160 130" fill="none" className="mb-6">
        {/* Clipboard/document */}
        <rect x="50" y="10" width="60" height="80" rx="6" fill="#FEE2E2" stroke="#F87171" strokeWidth="1.5" />
        <rect x="60" y="25" width="30" height="3" rx="1.5" fill="#F87171" opacity="0.5" />
        <rect x="60" y="33" width="40" height="3" rx="1.5" fill="#F87171" opacity="0.5" />
        <rect x="60" y="41" width="25" height="3" rx="1.5" fill="#F87171" opacity="0.5" />
        <circle cx="75" cy="65" r="12" fill="#FCA5A5" stroke="#F87171" strokeWidth="1.5" />
        <circle cx="75" cy="65" r="4" fill="#F87171" />
        {/* Chart piece */}
        <path d="M20 75 A30 30 0 0 1 50 75 L35 75 Z" fill="#FEE2E2" stroke="#F87171" strokeWidth="1.5" />
        <circle cx="30" cy="68" r="5" fill="#F87171" opacity="0.4" />
        {/* Image icon */}
        <rect x="105" y="55" width="40" height="35" rx="5" fill="#FEE2E2" stroke="#F87171" strokeWidth="1.5" />
        <circle cx="117" cy="67" r="4" fill="#FCA5A5" />
        <path d="M108 83 L120 72 L128 78 L138 68 L142 83 Z" fill="#F87171" opacity="0.3" />
        {/* Small decorative dots */}
        <circle cx="25" cy="40" r="3" fill="#F87171" opacity="0.3" />
        <circle cx="140" cy="45" r="4" fill="#FCA5A5" opacity="0.4" />
        <rect x="130" cy="25" width="8" height="8" rx="2" fill="#FEE2E2" stroke="#F87171" strokeWidth="1" transform="rotate(15 134 29)" />
      </svg>
      <p className="text-[15px] font-medium text-gray-900 max-w-md leading-relaxed">
        All attachments from tasks and messages in this project will appear here
      </p>
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
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

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
    /* Slide-over panel — absolutely positioned over the list area
       (parent at /my-tasks is `relative`) so it floats on top
       without shifting the columns underneath. Same pattern Asana
       uses for its task detail. Slides in from the right with a
       subtle shadow. */
    <div
      className="absolute top-0 right-0 bottom-0 w-[500px] border-l bg-white flex flex-col z-30 shadow-2xl animate-in slide-in-from-right-5 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 flex-1">
          <button onClick={handleToggleComplete}>
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center",
              taskDetail?.completed ? "bg-[#c9a84c] border-[#c9a84c]" : "border-slate-300"
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
          <Button variant="ghost" size="sm" onClick={() => toast.success("Task liked")}><Heart className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => toast.info("File attachments coming soon")}><Paperclip className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/tasks/${task.id}`); toast.success("Link copied to clipboard"); }}><Link2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => { window.open(`/tasks/${task.id}`, "_blank"); }}><Maximize2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Visibility */}
          <div className="px-4 py-2 bg-white text-xs text-black flex items-center gap-1">
            <Globe className="h-3 w-3" />
            This task is visible to everyone in My workspace
          </div>

          {/* Metadata */}
          <div className="p-4 space-y-4 border-b">
            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Assignee</span>
              <div className="flex items-center gap-2">
                <AssigneeSelector
                  value={taskDetail?.assignee || null}
                  onChange={(user) => handleUpdate("assigneeId", user?.id || null)}
                  trigger={
                    taskDetail?.assignee ? (
                      <button className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-white border border-black">
                            {taskDetail.assignee.name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{taskDetail.assignee.name}</span>
                      </button>
                    ) : (
                      <button className="text-sm text-slate-500 hover:text-slate-700 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                        No assignee
                      </button>
                    )
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Due date</span>
              <DueDatePicker
                value={taskDetail?.dueDate ? new Date(taskDetail.dueDate) : null}
                onChange={(date) => handleUpdate("dueDate", date?.toISOString() || null)}
                trigger={
                  taskDetail?.dueDate ? (
                    <button className={cn("text-sm hover:bg-gray-100 px-2 py-1 rounded cursor-pointer", dueDateInfo.className)}>
                      {dueDateInfo.text}
                    </button>
                  ) : (
                    <button className="text-sm text-slate-500 hover:text-slate-700 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                      No due date
                    </button>
                  )
                }
              />
            </div>

            <div className="flex items-start gap-4">
              <span className="w-24 text-sm text-black pt-1">Projects</span>
              <div className="flex-1">
                <ProjectSelector
                  value={taskDetail?.project ? {
                    id: taskDetail.project.id,
                    name: taskDetail.project.name,
                    color: taskDetail.project.color,
                  } : null}
                  onChange={(project) => handleUpdate("projectId", project?.id || null)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Priority</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0">
                    <span className={cn("text-sm",
                      taskDetail?.priority === "HIGH" ? "text-black" :
                      taskDetail?.priority === "MEDIUM" ? "text-[#a8893a]" :
                      taskDetail?.priority === "LOW" ? "text-black" : "text-black"
                    )}>
                      {taskDetail?.priority || "None"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "HIGH")}>
                    <span className="text-black">High</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "MEDIUM")}>
                    <span className="text-[#a8893a]">Medium</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "LOW")}>
                    <span className="text-black">Low</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "NONE")}>
                    <span className="text-black">None</span>
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
            <div className="space-y-1">
              {taskDetail?.subtasks?.map((subtask: any) => (
                <div key={subtask.id} className="flex items-center gap-2 group hover:bg-gray-50 rounded px-1 py-0.5">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/tasks/${subtask.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ completed: !subtask.completed }),
                        });
                        if (res.ok) {
                          fetchTaskDetail();
                          onUpdate();
                        }
                      } catch {
                        toast.error("Failed to update subtask");
                      }
                    }}
                    className="flex-shrink-0"
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                      subtask.completed ? "bg-[#c9a84c] border-[#c9a84c]" : "border-slate-300 hover:border-slate-400"
                    )}>
                      {subtask.completed && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                  <span className={cn("text-sm flex-1", subtask.completed && "line-through text-slate-400")}>
                    {subtask.name}
                  </span>
                </div>
              ))}
              {isAddingSubtask ? (
                <div className="flex items-center gap-2 px-1">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && newSubtaskName.trim()) {
                        try {
                          const res = await fetch(`/api/tasks`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: newSubtaskName.trim(), parentTaskId: task.id }),
                          });
                          if (res.ok) {
                            setNewSubtaskName("");
                            fetchTaskDetail();
                            onUpdate();
                            toast.success("Subtask added");
                          } else {
                            toast.error("Failed to add subtask");
                          }
                        } catch {
                          toast.error("Failed to add subtask");
                        }
                      }
                      if (e.key === "Escape") {
                        setIsAddingSubtask(false);
                        setNewSubtaskName("");
                      }
                    }}
                    onBlur={() => {
                      if (!newSubtaskName.trim()) {
                        setIsAddingSubtask(false);
                        setNewSubtaskName("");
                      }
                    }}
                    placeholder="Subtask name..."
                    className="flex-1 text-sm outline-none border-b border-slate-200 focus:border-slate-400 py-1"
                    autoFocus
                  />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-black w-full justify-start"
                  onClick={() => {
                    setIsAddingSubtask(true);
                    setTimeout(() => subtaskInputRef.current?.focus(), 0);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add subtask
                </Button>
              )}
            </div>
          </div>

          {/* Activity Tabs */}
          <div className="border-b">
            <div className="flex gap-4 px-4">
              <button
                onClick={() => setActiveTab("comments")}
                className={cn(
                  "py-2 text-sm font-medium border-b-2 -mb-px",
                  activeTab === "comments" ? "text-black border-black" : "text-black border-transparent"
                )}
              >
                Comments
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "py-2 text-sm font-medium border-b-2 -mb-px",
                  activeTab === "activity" ? "text-black border-black" : "text-black border-transparent"
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
                      <AvatarFallback className="text-xs bg-white border border-black">
                        {comment.author?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comment.author?.name}</span>
                        <span className="text-xs text-black">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-black mt-1">{comment.content}</p>
                    </div>
                  </div>
                ))}
                {(!taskDetail?.comments || taskDetail.comments.length === 0) && (
                  <p className="text-sm text-black text-center py-4">No comments yet</p>
                )}
              </>
            ) : (
              <>
                {taskDetail?.activities?.map((activity: any) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-white border border-black">
                        {activity.user?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium">{activity.user?.name}</span>
                      <span className="text-black"> {activity.type.replace(/_/g, " ").toLowerCase()}</span>
                      <span className="text-black text-xs ml-2">
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
            <AvatarFallback className="text-xs bg-black text-white">U</AvatarFallback>
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
          <span className="text-black">Collaborators:</span>
          {taskDetail?.collaborators?.map((collab: any) => (
            <Avatar key={collab.id} className="h-6 w-6" title={collab.name || "User"}>
              <AvatarFallback className="text-[10px] bg-black text-white">
                {(collab.name || "U").charAt(0)}
              </AvatarFallback>
            </Avatar>
          ))}
          {(!taskDetail?.collaborators || taskDetail.collaborators.length === 0) && (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-black text-white">U</AvatarFallback>
            </Avatar>
          )}
          <AssigneeSelector
            value={null}
            onChange={async (user) => {
              if (!user) return;
              try {
                const res = await fetch(`/api/tasks/${task.id}/collaborators`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: user.id }),
                });
                if (res.ok) {
                  toast.success(`${user.name} added as collaborator`);
                  fetchTaskDetail();
                } else if (res.status === 409) {
                  toast.info("Already a collaborator");
                } else {
                  toast.error("Failed to add collaborator");
                }
              } catch {
                toast.error("Failed to add collaborator");
              }
            }}
            trigger={
              <button className="h-6 w-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center hover:border-slate-400 hover:bg-gray-50 cursor-pointer">
                <Plus className="h-3 w-3 text-slate-400" />
              </button>
            }
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-black"
          onClick={async () => {
            try {
              const res = await fetch(`/api/tasks/${task.id}/collaborators`, {
                method: "DELETE",
              });
              if (res.ok) {
                toast.success("You left this task");
                fetchTaskDetail();
              } else {
                toast.error("Failed to leave task");
              }
            } catch {
              toast.error("Failed to leave task");
            }
          }}
        >
          Leave task
        </Button>
      </div>
    </div>
  );
}
