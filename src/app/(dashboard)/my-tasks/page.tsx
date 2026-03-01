"use client";

import { useEffect, useState, useRef } from "react";
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
import { CustomFieldModal } from "@/components/tasks/custom-field-modal";
import { AddColumnDropdown } from "@/components/tasks/add-column-dropdown";
import type { FieldTypeConfig } from "@/lib/field-types";
import { AdvancedSearchModal, type AdvancedSearchCriteria } from "@/components/tasks/advanced-search-modal";
import { ColumnHeader, COLUMN_CONFIGS, type ColumnConfig } from "@/components/tasks/column-header-dropdown";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [openColumnDropdown, setOpenColumnDropdown] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

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
      // Group by assignee (closest mapping)
      setGroupType("none");
      organizeTasks(tasks, "none");
    } else {
      setGroupType("due_date");
      organizeTasks(tasks, "due_date");
    }
  }

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

  function organizeTasks(taskList: Task[], group?: string) {
    const activeGroup = group || groupType;
    const activeTasks = taskList.filter((t) => !t.completed);

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
        const name = key === "no-project" ? "Sin proyecto" : tasks[0].project?.name || "Desconocido";
        result.push({ id: key, name, collapsed: false, tasks });
      });
      setSections(result);
      return;
    }

    if (activeGroup === "priority") {
      const priorities = ["HIGH", "MEDIUM", "LOW", "NONE"] as const;
      const labels = { HIGH: "Prioridad alta", MEDIUM: "Prioridad media", LOW: "Prioridad baja", NONE: "Sin prioridad" };
      const result: SmartSection[] = priorities.map((p) => ({
        id: p,
        name: labels[p],
        collapsed: false,
        tasks: activeTasks.filter((t) => (t.priority || "NONE") === p),
      })).filter((s) => s.tasks.length > 0);
      setSections(result);
      return;
    }

    if (activeGroup === "none") {
      setSections([{ id: "all", name: "Todas las tareas", collapsed: false, tasks: activeTasks }]);
      return;
    }

    // Default: group by due date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const recentlyAssigned: Task[] = [];
    const doToday: Task[] = [];
    const doNextWeek: Task[] = [];
    const doLater: Task[] = [];

    activeTasks.forEach((task) => {
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
      { id: "recently-assigned", name: "Asignadas recientemente", collapsed: false, tasks: recentlyAssigned },
      { id: "do-today", name: "Para hacer hoy", collapsed: false, tasks: doToday },
      { id: "do-next-week", name: "Para hacer la próxima semana", collapsed: false, tasks: doNextWeek },
      { id: "do-later", name: "Para hacer más tarde", collapsed: false, tasks: doLater },
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
    toast.success(`Sección "${newSection.name}" agregada`);
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

  async function handleAddTask(name: string, sectionId: string, taskType: "TASK" | "MILESTONE" | "APPROVAL" = "TASK"): Promise<boolean> {
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
        body: JSON.stringify({ name, dueDate, taskType }),
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
    if (!dateStr) return { text: "", className: "text-gray-500" };

    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - today.getDay()));

    if (date < today) {
      return { text: date.toLocaleDateString("es-ES", { month: "short", day: "numeric" }), className: "text-red-600" };
    } else if (date.toDateString() === today.toDateString()) {
      return { text: "Hoy", className: "text-green-600" };
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return { text: "Mañana", className: "text-yellow-600" };
    } else if (date <= thisWeekEnd) {
      return { text: date.toLocaleDateString("es-ES", { weekday: "long" }), className: "text-gray-700" };
    } else {
      return { text: date.toLocaleDateString("es-ES", { month: "short", day: "numeric" }), className: "text-gray-500" };
    }
  }

  function handleExportCSV() {
    const rows = [["Nombre", "Fecha de entrega", "Prioridad", "Estado", "Proyecto"]];
    tasks.forEach((t) => {
      rows.push([
        t.name,
        t.dueDate ? new Date(t.dueDate).toLocaleDateString("es-ES") : "",
        t.priority,
        t.completed ? "Completada" : "Sin completar",
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
    { id: "list", label: "Lista", icon: List },
    { id: "board", label: "Tablero", icon: Columns },
    { id: "calendar", label: "Calendario", icon: Calendar },
    { id: "dashboard", label: "Panel", icon: BarChart3 },
    { id: "files", label: "Archivos", icon: FileText },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* TITLE ROW — no bottom border (Asana pattern) */}
      <div className="flex items-center justify-between px-6" style={{ height: "var(--page-header-h, 44px)" }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 h-8 px-2 -ml-2 rounded-md hover:bg-black/[0.04] transition-colors cursor-pointer focus:outline-none">
              <Avatar className="h-7 w-7">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-black text-white text-[10px] font-medium">
                  {session?.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xl font-semibold text-gray-900 leading-none">Mis tareas</span>
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
              Agregar tareas por IA
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowAddTasksEmail(true)}
              className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
            >
              <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
              Agregar tareas por email...
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] data-[state=open]:bg-black/[0.04] cursor-pointer [&>svg:last-child]:w-3.5 [&>svg:last-child]:h-3.5 [&>svg:last-child]:text-gray-400">
                <ArrowLeftRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                Sincronizar/exportar
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                sideOffset={6}
                className="min-w-[320px] rounded-[10px] border-0 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              >
                <DropdownMenuItem
                  onClick={() => toast.info("Sincronización con el calendario de Outlook próximamente")}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><OutlookCalendarIcon /></span>
                  Sincronizar con el calendario de Outlook
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toast.info("Sincronización con Google Calendar próximamente")}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><GoogleCalendarIcon /></span>
                  Google Calendar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toast.info("Exportar a iCal próximamente")}
                  className="h-9 px-3 gap-2.5 text-[14px] font-normal text-gray-800 rounded-md hover:bg-black/[0.04] focus:bg-black/[0.04] cursor-pointer"
                >
                  <span className="w-6 flex items-center justify-center flex-shrink-0"><ICalIcon className="text-gray-500" /></span>
                  iCal y otros calendarios
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toast.info("Exportar a Google Sheets próximamente")}
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
                  Imprimir
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowManagePrivacy(true)}
            className="flex items-center gap-1.5 px-3 h-8 text-[13px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Compartir
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
            Flujo de trabajo
          </button>
        </div>
      </div>

      {/* TABS ROW — single border below separating from toolbar */}
      <div className="flex items-center px-6 border-b border-gray-200" style={{ height: "var(--tabs-h, 34px)" }}>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setView("list")}><List className="w-4 h-4 mr-2" />Vista de lista</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("board")}><Columns className="w-4 h-4 mr-2" />Vista de tablero</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("calendar")}><Calendar className="w-4 h-4 mr-2" />Vista de calendario</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("dashboard")}><BarChart3 className="w-4 h-4 mr-2" />Vista de panel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* TOOLBAR — no bottom border; gray band below provides separation */}
      <div className="flex items-center justify-between px-6" style={{ height: "var(--toolbar-h, 42px)" }}>
        {/* LEFT: Filled Add task split button (Asana-style) */}
        <div className="flex items-center">
          <div className="inline-flex items-center h-8 rounded-md overflow-hidden bg-black text-white">
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
              Agregar tarea
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
                    Tarea
                  </span>
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Predeterminado</span>
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
                  Aprobación
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
                    Hito
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
                    Sección
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded min-w-[20px] text-center">Tab</kbd>
                    <kbd className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded min-w-[20px] text-center">N</kbd>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* RIGHT: Filter / Sort / Group / Options + Search icon */}
        <div className="flex items-center gap-0.5">
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
                    ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                )}
              >
                <Filter className="w-4 h-4" />
                Filtrar{filterCount > 0 ? ` (${filterCount})` : ""}
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
                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <ArrowUpDown className="w-4 h-4" />
            Ordenar{sortState.field !== "none" ? " (1)" : ""}
          </button>
          {/* Group button — toggles floating GroupPanel */}
          <button
            ref={groupButtonRef}
            onClick={() => setGroupPanelOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1 px-2 h-7 text-[13px] rounded transition-colors",
              groupConfigs.some((g) => g.field !== "none" && g.field !== "sections")
                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Agrupar
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
                  placeholder="Buscar nombres de tareas"
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
                    Ir a la búsqueda avanzada
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
        </div>
      </div>

      {/* COLUMN HEADERS - Only show in List view */}
      {view === "list" && (
        <div
          className="flex items-center px-6 border-b border-gray-200 bg-[var(--header-band)] text-[11px] font-medium text-gray-500 sticky top-0 z-10"
          style={{ height: "var(--col-header-h, 32px)" }}
        >
          {/* Checkbox spacer */}
          <div className="w-8 flex-shrink-0" />

          {/* Nombre de la tarea */}
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
              onMoveLeft: () => toast("Ya es la primera columna"),
              onMoveRight: () => toast.success("Columna movida a la derecha"),
              onHideColumn: () => toast("No se puede ocultar la columna Nombre"),
              onOpenCustomField: () => setShowCustomFieldModal(true),
            }}
          />

          {/* Fecha de entrega */}
          <ColumnHeader
            config={{ id: "dueDate", ...COLUMN_CONFIGS.dueDate }}
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
              onMoveLeft: () => toast.success("Columna movida a la izquierda"),
              onMoveRight: () => toast.success("Columna movida a la derecha"),
              onHideColumn: () => toast.success("Columna ocultada"),
              onOpenCustomField: () => setShowCustomFieldModal(true),
            }}
          />

          {/* Colaboradores */}
          <ColumnHeader
            config={{ id: "collaborators", ...COLUMN_CONFIGS.collaborators }}
            isDropdownOpen={openColumnDropdown === "collaborators"}
            onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "collaborators" ? null : "collaborators")}
            callbacks={{
              onAddColumn: () => setShowCustomFieldModal(true),
              onMoveLeft: () => toast.success("Columna movida a la izquierda"),
              onMoveRight: () => toast.success("Columna movida a la derecha"),
              onHideColumn: () => toast.success("Columna ocultada"),
            }}
          />

          {/* Proyectos */}
          <ColumnHeader
            config={{ id: "projects", ...COLUMN_CONFIGS.projects }}
            isDropdownOpen={openColumnDropdown === "projects"}
            onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "projects" ? null : "projects")}
            callbacks={{
              onSortAsc: () => setSortState({ field: "project", direction: "asc" }),
              onSortDesc: () => setSortState({ field: "project", direction: "desc" }),
              onGroupBy: (field) => {
                handleGroupConfigsChange([{ id: "group-default", field: field as GroupConfig["field"], order: "custom", hideEmpty: false }]);
              },
              onAddColumn: () => setShowCustomFieldModal(true),
              onMoveLeft: () => toast.success("Columna movida a la izquierda"),
              onMoveRight: () => toast.success("Columna movida a la derecha"),
              onHideColumn: () => toast.success("Columna ocultada"),
              onOpenCustomField: () => setShowCustomFieldModal(true),
            }}
          />

          {/* Visibilidad */}
          <ColumnHeader
            config={{ id: "visibility", ...COLUMN_CONFIGS.visibility }}
            isDropdownOpen={openColumnDropdown === "visibility"}
            onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "visibility" ? null : "visibility")}
            callbacks={{
              onAddColumn: () => setShowCustomFieldModal(true),
              onMoveLeft: () => toast.success("Columna movida a la izquierda"),
              onMoveRight: () => toast("Ya es la última columna"),
              onHideColumn: () => toast.success("Columna ocultada"),
            }}
          />

          {/* Add column (+) button */}
          <div className="flex-shrink-0 border-l border-gray-300/40">
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

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex">
        <div className={cn("flex-1 overflow-auto", taskPanelOpen && "pr-0")}>
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
                    placeholder="Nombre de la sección..."
                    className="flex-1 text-sm outline-none border-b border-slate-300 pb-1"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingSection(true)}
                  className="px-6 py-3 text-gray-400 hover:text-gray-600 text-sm w-full text-left"
                >
                  Agregar sección
                </button>
              )}
            </div>
          ) : view === "board" ? (
            <BoardView
              sections={sections}
              onToggleComplete={handleToggleComplete}
              onTaskClick={openTaskDetail}
              onAddTask={handleAddTask}
              onAddSection={() => {
                const name = prompt('Nombre de la sección:', 'Nueva sección');
                if (!name?.trim()) return;
                const newSection: SmartSection = { id: `custom-${Date.now()}`, name: name.trim(), collapsed: false, tasks: [] };
                setSections((prev) => [...prev, newSection]);
                toast.success(`Sección "${name.trim()}" agregada`);
              }}
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
  onAddTask: (name: string, sectionId: string, taskType?: "TASK" | "MILESTONE" | "APPROVAL") => Promise<boolean>;
  formatDueDate: (date: string | null) => { text: string; className: string };
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
        className="flex items-center px-6 w-full hover:bg-[var(--surface-hover)] text-left border-b border-[var(--border-subtle)]"
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
              className="flex items-center px-6 border-b border-[var(--border-subtle)] bg-blue-50/60"
              style={{ height: "var(--row-h)" }}
            >
              <div className="w-8 flex-shrink-0 flex items-center">
                {activeTaskType === "MILESTONE" ? (
                  <Diamond className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : activeTaskType === "APPROVAL" ? (
                  <ThumbsUp className="w-4 h-4 text-orange-500 flex-shrink-0" />
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
                  placeholder={activeTaskType === "MILESTONE" ? "Escribe el nombre del hito" : activeTaskType === "APPROVAL" ? "Escribe el nombre de la aprobación" : "Escribe el nombre de la tarea"}
                  className="w-full bg-transparent outline-none text-[13px] text-gray-900 placeholder:text-gray-400"
                  autoFocus
                  disabled={isCreating}
                />
              </div>
              {/* Due date placeholder */}
              <div className="w-[110px] min-w-[110px] flex-shrink-0 pl-2.5 group/due">
                <Calendar className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover/due:opacity-100 transition-opacity" />
              </div>
              {/* Collaborators placeholder */}
              <div className="w-[110px] min-w-[110px] flex-shrink-0 pl-2.5" />
              {/* Projects placeholder */}
              <div className="w-[160px] min-w-[160px] flex-shrink-0 pl-2.5" />
              {/* Visibility placeholder */}
              <div className="w-[110px] min-w-[110px] flex-shrink-0 pl-2.5">
                <span className="text-[13px] text-gray-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Solo yo
                </span>
              </div>
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
            />
          ))}

          {/* "+ Add task" trigger row */}
          {!isAddingTask && (
            <button
              onClick={() => { setActiveTaskType("TASK"); setIsAddingTask(true); }}
              className="flex items-center px-6 w-full text-left border-b border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors"
              style={{ height: "var(--row-h)" }}
            >
              <div className="w-8 flex-shrink-0 flex items-center">
                <Plus className="w-3.5 h-3.5 text-gray-300" />
              </div>
              <span className="flex-1 text-[13px] text-gray-400">Agregar tarea</span>
              <div className="w-[110px] min-w-[110px] flex-shrink-0" />
              <div className="w-[110px] min-w-[110px] flex-shrink-0" />
              <div className="w-[160px] min-w-[160px] flex-shrink-0" />
              <div className="w-[110px] min-w-[110px] flex-shrink-0" />
              <div className="w-8 flex-shrink-0" />
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
      className="flex items-center px-6 hover:bg-[var(--surface-hover)] border-b border-[var(--border-subtle)] cursor-pointer group transition-colors"
      style={{ height: 'var(--row-h)' }}
    >
      {/* Checkbox / type icon */}
      <div className="w-8 flex-shrink-0 flex items-center">
        {task.taskType === "MILESTONE" ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
            className={cn("flex items-center justify-center flex-shrink-0", task.completed ? "text-green-500" : "text-green-600 hover:text-green-700")}
          >
            <Diamond className="w-4 h-4" />
          </button>
        ) : task.taskType === "APPROVAL" ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
            className={cn("flex items-center justify-center flex-shrink-0", task.completed ? "text-green-500" : "text-orange-500 hover:text-orange-600")}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
            className={cn(
              "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
              task.completed
                ? "bg-green-500 border-green-500"
                : "border-gray-300 hover:border-gray-400"
            )}
          >
            {task.completed && <Check className="w-3 h-3 text-white" />}
          </button>
        )}
      </div>

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

      {/* Due date */}
      <div className="w-[110px] min-w-[110px] flex-shrink-0 pl-2.5">
        <span className={cn("text-[13px]", dueDateInfo.className)}>
          {dueDateInfo.text}
        </span>
      </div>

      {/* Collaborators */}
      <div className="w-[110px] min-w-[110px] flex-shrink-0 pl-2.5">
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
      <div className="w-[160px] min-w-[160px] flex-shrink-0 pl-2.5">
        {task.project && (
          <div className="flex items-center gap-1.5">
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
      <div className="w-[110px] min-w-[110px] flex-shrink-0 pl-2.5">
        <span className="text-[13px] text-gray-400 flex items-center gap-1">
          <Globe className="w-3 h-3" />
          Mi espacio de trabajo
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
  onAddSection,
  formatDueDate,
}: {
  sections: SmartSection[];
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (name: string, sectionId: string) => Promise<boolean>;
  onAddSection: () => void;
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
        <button className="flex items-center gap-2 px-4 py-2 text-black hover:text-slate-700 hover:bg-white rounded-lg w-full" onClick={onAddSection}>
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Agregar sección</span>
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
              <span className="text-xs text-black bg-white px-2 py-0.5 rounded-full">
                {taskCount}
              </span>
            )}
          </div>
          <button className="p-1 hover:bg-white border border-black rounded" onClick={() => toast.info("Opciones de sección próximamente")}>
            <MoreHorizontal className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Progress bar */}
        {taskCount > 0 && (
          <div className="mt-2 h-1 bg-white border border-black rounded-full overflow-hidden">
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
              placeholder="Escribe el nombre de la tarea..."
              className="w-full text-sm outline-none"
              autoFocus
              disabled={isCreating}
            />
          </Card>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 text-black hover:text-slate-700 py-1 w-full"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Agregar tarea</span>
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
                    task.completed && "line-through text-black"
                  )}>
                    {task.name}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={cn("text-xs", dueDateInfo.className)}>
                      {dueDateInfo.text}
                    </span>
                    <div className="flex items-center gap-1 text-black">
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
                      <span className="text-xs text-black truncate">
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
            className="flex items-center gap-2 text-black hover:text-black py-1 w-full"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Agregar tarea</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Calendar View
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
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
    return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Navigation toolbar */}
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
          Hoy
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="font-medium text-black ml-2">
          {formatMonthYear(currentDate)}
        </span>
      </div>

      {/* Week header - Monday start, weekend narrower */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_0.7fr_0.7fr] border-b">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={cn(
              "py-2 text-center text-xs font-medium text-black uppercase border-r last:border-r-0",
              index >= 5 && "bg-white"
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
                !isCurrentMonth && "bg-white/50",
                isWeekend && "bg-white/30"
              )}
            >
              {/* Day number */}
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "text-sm",
                    !isCurrentMonth && "text-slate-300",
                    isToday && "bg-black text-white rounded-full w-6 h-6 flex items-center justify-center font-medium"
                  )}
                >
                  {isFirstOfMonth && isCurrentMonth
                    ? date.toLocaleDateString("es-ES", { month: "short", day: "numeric" })
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
                    className="text-xs p-1 bg-white border rounded shadow-sm truncate cursor-pointer hover:bg-white"
                    title={task.name}
                  >
                    {task.name}
                  </div>
                ))}
                {dayTasks.length > 2 && (
                  <span className="text-xs text-black pl-1">
                    +{dayTasks.length - 2} más
                  </span>
                )}
              </div>

              {/* Add task on hover */}
              <button
                className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 text-xs text-black hover:text-black flex items-center gap-0.5 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  const name = prompt('Nombre de la tarea:');
                  if (name?.trim()) {
                    toast.success(`Tarea "${name.trim()}" agregada para ${date.toLocaleDateString("es-ES")}`);
                  }
                }}
              >
                <Plus className="w-3 h-3" />
                Agregar
              </button>
            </div>
          );
        })}
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

  // Data for donut chart - completion status (minimalistic colors)
  const completionData = [
    { name: "Sin completar", value: incomplete, color: "#94A3B8" }, // slate-400
    { name: "Completadas", value: completed, color: "#CBD5E1" }, // slate-300
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Agregar widget
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => toast.info('Widget de tareas por sección agregado')}>Tareas por sección</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Widget de gráfico de finalización agregado')}>Gráfico de finalización</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Widget de tareas por proyecto agregado')}>Tareas por proyecto</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Widget de línea de tiempo agregado')}>Línea de tiempo de finalización</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => window.open("mailto:feedback@buildsync.com", "_blank")}>
          Enviar comentarios
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-sm text-black">Tareas completadas</p>
          <p className="text-4xl font-light text-black mt-2">{completed}</p>
          <div className="flex items-center justify-center mt-3 text-xs text-black">
            <Filter className="w-3 h-3 mr-1" />
            1 filtro
          </div>
        </Card>
        <Card className="p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-sm text-black">Tareas sin completar</p>
          <p className="text-4xl font-light text-black mt-2">{incomplete}</p>
          <div className="flex items-center justify-center mt-3 text-xs text-black">
            <Filter className="w-3 h-3 mr-1" />
            1 filtro
          </div>
        </Card>
        <Card className="p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-sm text-black">Tareas atrasadas</p>
          <p className="text-4xl font-light text-black mt-2">{overdue}</p>
          <div className="flex items-center justify-center mt-3 text-xs text-black">
            <Filter className="w-3 h-3 mr-1" />
            1 filtro
          </div>
        </Card>
        <Card className="p-4 text-center hover:shadow-md transition-shadow">
          <p className="text-sm text-black">Total de tareas</p>
          <p className="text-4xl font-light text-black mt-2">{total}</p>
          <div className="flex items-center justify-center mt-3 text-xs text-black">
            <Filter className="w-3 h-3 mr-1" />
            Sin filtros
          </div>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Tasks by Section */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-black mb-4">Tareas por sección</h3>
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
            <div className="flex items-center text-xs text-black">
              <Filter className="w-3 h-3 mr-1" />
              1 filtro
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6">
              Ver todo
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </Card>

        {/* Tasks by Completion Status (Donut) */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-black mb-4">Tareas por estado de finalización</h3>
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
                <span className="text-2xl font-semibold text-black">{incomplete}</span>
              </div>
            </div>
            <div className="ml-6 space-y-2">
              {completionData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-black">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <div className="flex items-center text-xs text-black">
              <Filter className="w-3 h-3 mr-1" />
              2 filtros
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6">
              Ver todo
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Tasks by Project */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-black mb-4">Tareas por proyecto</h3>
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
            <div className="h-[200px] flex items-center justify-center text-sm text-black">
              Aún no hay tareas asignadas a proyectos
            </div>
          )}
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <div className="flex items-center text-xs text-black">
              <Filter className="w-3 h-3 mr-1" />
              1 filtro
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6">
              Ver todo
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </Card>

        {/* Task Completion Over Time */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-black mb-4">Finalización de tareas a lo largo del tiempo</h3>
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
                name="Total de tareas"
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#CBD5E1"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Completadas"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <div className="flex items-center text-xs text-black">
              <Filter className="w-3 h-3 mr-1" />
              2 filtros
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6">
              Ver todo
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
      <h3 className="font-medium text-black">Aún no hay archivos</h3>
      <p className="text-sm text-black mt-1">Los archivos adjuntos a tus tareas aparecerán aquí</p>
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
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Visibility */}
          <div className="px-4 py-2 bg-white text-xs text-black flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Esta tarea es visible para todos en Mi espacio de trabajo
          </div>

          {/* Metadata */}
          <div className="p-4 space-y-4 border-b">
            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Responsable</span>
              <div className="flex items-center gap-2">
                {taskDetail?.assignee ? (
                  <>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-white border border-black">
                        {taskDetail.assignee.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{taskDetail.assignee.name}</span>
                  </>
                ) : (
                  <span className="text-sm text-black">Sin responsable</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Fecha de entrega</span>
              <span className={cn("text-sm", dueDateInfo.className)}>
                {dueDateInfo.text || "Sin fecha de entrega"}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Proyectos</span>
              {taskDetail?.project ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: taskDetail.project.color }} />
                  <span className="text-sm">{taskDetail.project.name}</span>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="text-black h-auto p-0">+ Agregar a proyecto</Button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Prioridad</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0">
                    <span className={cn("text-sm",
                      taskDetail?.priority === "HIGH" ? "text-black" :
                      taskDetail?.priority === "MEDIUM" ? "text-amber-600" :
                      taskDetail?.priority === "LOW" ? "text-black" : "text-black"
                    )}>
                      {taskDetail?.priority || "None"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "HIGH")}>
                    <span className="text-black">Alta</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "MEDIUM")}>
                    <span className="text-amber-600">Media</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "LOW")}>
                    <span className="text-black">Baja</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "NONE")}>
                    <span className="text-black">Ninguna</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Description */}
          <div className="p-4 border-b">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Descripción</h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== taskDetail?.description && handleUpdate("description", description)}
              placeholder="¿De qué se trata esta tarea?"
              className="w-full p-2 text-sm border rounded-md resize-none min-h-[80px] outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {/* Subtasks */}
          <div className="p-4 border-b">
            <h4 className="text-sm font-medium text-slate-700 mb-2">
              Subtareas ({taskDetail?.subtasks?.length || 0})
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
                  <span className={cn("text-sm", subtask.completed && "line-through text-black")}>
                    {subtask.name}
                  </span>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-black w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Agregar subtarea
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
                  activeTab === "comments" ? "text-black border-black" : "text-black border-transparent"
                )}
              >
                Comentarios
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "py-2 text-sm font-medium border-b-2 -mb-px",
                  activeTab === "activity" ? "text-black border-black" : "text-black border-transparent"
                )}
              >
                Toda la actividad
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
                  <p className="text-sm text-black text-center py-4">Aún no hay comentarios</p>
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
            placeholder="Agregar un comentario..."
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
          <span className="text-black">Colaboradores:</span>
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-black text-white">U</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="text-black">Abandonar tarea</Button>
      </div>
    </div>
  );
}
