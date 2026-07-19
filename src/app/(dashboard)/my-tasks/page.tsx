"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
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
  Download,
  UserPlus2,
  ListPlus,
  Copy,
  CornerUpRight,
  CheckSquare,
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
import { FilterPanel, type QuickFilterKey, type ActiveFilter, type CompletedWindow } from "@/components/tasks/filter-panel";
import { SortPanel, type SortState } from "@/components/tasks/sort-panel";
import { GroupPanel, type GroupConfig } from "@/components/tasks/group-panel";
import { CustomFieldModal, type CreatedFieldInfo } from "@/components/tasks/custom-field-modal";
import { CustomFieldsSection } from "@/components/tasks/custom-fields-section";
import {
  renderCommentContent,
  buildCommentContent,
  MentionInput,
  type MentionCandidate,
} from "@/components/tasks/comment-content";
import { UploadToTaskDialog } from "@/components/tasks/upload-to-task-dialog";
import { AddColumnDropdown } from "@/components/tasks/add-column-dropdown";
import { BuiltinFieldCell } from "@/components/tasks/builtin-field-cell";
import { EditableCustomFieldCell } from "@/components/tasks/editable-custom-field-cell";
import { useUiState } from "@/hooks/use-ui-state";
import type { FieldTypeConfig } from "@/lib/field-types";
import { AdvancedSearchModal, type AdvancedSearchCriteria } from "@/components/tasks/advanced-search-modal";
import { FileViewerModal } from "@/components/files/file-viewer-modal";
import { downloadFile } from "@/lib/download";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ColumnHeader, COLUMN_CONFIGS, type ColumnConfig } from "@/components/tasks/column-header-dropdown";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AssigneeSelector } from "@/components/tasks/assignee-selector";
import { DueDatePicker } from "@/components/tasks/due-date-picker";
import { ProjectSelector } from "@/components/tasks/project-selector";
import { DependenciesPicker } from "@/components/tasks/dependencies-picker";
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
import { dueDateToLocalMidnight, startOfLocalDay, daysFromToday } from "@/lib/date-only";
import { notifyTaskMutated } from "@/lib/task-events";
import { readTimeTracking, formatDays, parseDaysInput } from "@/lib/duration";
import { toast } from "sonner";

// Types
/** Metadata for a dynamic column in the My Tasks list view. Covers
 *  BOTH user-created custom fields AND the built-in extras Asana
 *  surfaces under "Show more" (Priority, Tags, Blocked by, Blocks,
 *  Completion date, Last modified, Creation date, Created by). When
 *  `builtin` is set the cell renders from Task fields; otherwise from
 *  CustomFieldValue. */
// The Prisma CustomFieldType enum values the editable custom-field cell
// accepts. Kept in sync with EditableCustomFieldCell's `type` prop.
type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "DROPDOWN"
  | "MULTI_SELECT"
  | "PEOPLE"
  | "CHECKBOX"
  | "CURRENCY"
  | "PERCENTAGE"
  | "REFERENCE"
  | "FORMULA"
  | "TIMER"
  | "TIME_TRACKING"
  | "ROLLUP";

export interface ListColumn {
  id: string;
  name: string;
  type: string;
  color: string;
  builtin?: string;
  width?: number;
  // For personal custom-field columns created from the My Tasks
  // toolbar: the seeded options (DROPDOWN / MULTI_SELECT) so the
  // editable cell can render its picker without an extra fetch.
  options?: { id: string; label: string; color?: string }[] | null;
}

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  startDate: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  taskType?: "TASK" | "MILESTONE" | "APPROVAL";
  position?: number;
  createdAt: string;
  // Last-modified timestamp — surfaced as a built-in column in the
  // Asana-parity list view ("Last modified"). Prisma auto-includes
  // it, the API just returns the row.
  updatedAt: string;
  assignee: { id: string; name: string | null; email: string | null; image: string | null } | null;
  // Created by — built-in column ("Created by" in Asana). The
  // /api/tasks endpoint already includes the creator relation.
  creator?: { id: string; name: string | null; email: string | null; image: string | null } | null;
  // Collaborators — for the "Collaborators" list column (Asana shows
  // collaborators here, not the assignee). Shaped from the API's
  // collaborators.include (each row is { user: {...} }).
  collaborators?: {
    user: { id: string; name: string | null; image: string | null };
  }[];
  project: {
    id: string;
    name: string;
    color: string;
    type?: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT" | null;
    gate?:
      | "PRE_DESIGN"
      | "DESIGN"
      | "PERMITTING"
      | "CONSTRUCTION"
      | "CLOSEOUT"
      | null;
    // Project privacy → drives the Visibility column (PRIVATE ⇒ Lock /
    // "Only me"; WORKSPACE ⇒ Globe / "My workspace").
    visibility?: "PRIVATE" | "WORKSPACE" | null;
  } | null;
  section: { id: string; name: string } | null;
  subtasks?: { id: string; name: string; completed: boolean }[];
  // Dependencies (Asana "Blocked by") — tasks that must finish
  // before this one can start. Shaped from TaskDependency.blockingTask.
  dependencies?: { blockingTask: { id: string; name: string; completed: boolean } }[];
  // Dependents (Asana "Blocks") — tasks that are waiting on THIS
  // one. Shaped from TaskDependency.dependentTask.
  dependents?: { dependentTask: { id: string; name: string; completed: boolean } }[];
  // Tags worn by this task (Asana "Tags" column). Workspace-scoped
  // so any task in the user's workspace can carry any tag from the
  // shared library.
  taskTags?: {
    tag: { id: string; name: string; color: string };
  }[];
  // Custom field values keyed by fieldId. The field metadata is
  // embedded so CustomFieldCell can render with type + options
  // without an extra fetch. `value` is a Prisma Json — shape depends
  // on the field's type.
  customFieldValues?: {
    fieldId: string;
    value: unknown;
    field: {
      id: string;
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
        | "REFERENCE"
        | "FORMULA"
        | "TIMER"
        | "TIME_TRACKING"
        | "ROLLUP";
      options: unknown;
    };
  }[];
  myTaskSection: "RECENTLY_ASSIGNED" | "DO_TODAY" | "DO_NEXT_WEEK" | "DO_LATER" | null;
  _count: { subtasks: number; comments: number; attachments: number; likes?: number };
}

interface SmartSection {
  id: string;
  name: string;
  collapsed: boolean;
  tasks: Task[];
}

type ViewType = "list" | "board" | "calendar" | "dashboard" | "files";

/** A user-owned personal section as persisted in uiState.myTasks. */
interface PersonalSection {
  id: string;
  name: string;
  order: number;
}

// The 4 Asana-default personal sections. IDs are kept STABLE and match
// the ids organizeTasks emitted before this change so section-collapse
// persistence + drag maps keep working, and so the DB `myTaskSection`
// enum back-compat mapping below still resolves.
const DEFAULT_PERSONAL_SECTIONS: PersonalSection[] = [
  { id: "recently-assigned", name: "Recently assigned", order: 0 },
  { id: "do-today", name: "Do today", order: 1 },
  { id: "do-next-week", name: "Do next week", order: 2 },
  { id: "do-later", name: "Do later", order: 3 },
];

// Bridge between the stable default section ids and the DB
// `myTaskSection` enum. Used to (a) seed a task's section from its
// persisted enum value when it has no uiState mapping yet (back-compat)
// and (b) mirror moves onto the 4 defaults back into the enum column so
// existing DB-driven state stays coherent.
const SECTION_ID_TO_ENUM: Record<string, string> = {
  "recently-assigned": "RECENTLY_ASSIGNED",
  "do-today": "DO_TODAY",
  "do-next-week": "DO_NEXT_WEEK",
  "do-later": "DO_LATER",
};
const ENUM_TO_SECTION_ID: Record<string, string> = {
  RECENTLY_ASSIGNED: "recently-assigned",
  DO_TODAY: "do-today",
  DO_NEXT_WEEK: "do-next-week",
  DO_LATER: "do-later",
};
// The 4 default section ids — used to gate delete (defaults can't be
// deleted, only renamed) in the section header menu.
const DEFAULT_SECTION_ID_SET = new Set(
  DEFAULT_PERSONAL_SECTIONS.map((s) => s.id)
);

// ── Dashboard widget catalog (dsh-01) ───────────────────────────────
// Fixed set of widgets the user can toggle on the Dashboard view. Every
// entry maps to a chart/KPI DashboardView already renders from the
// client-side task set — no new API. `kind` groups KPIs vs. charts so the
// layout can keep KPIs in the top strip and charts in the 2-col grid.
type DashboardWidgetId =
  | "completed"
  | "incomplete"
  | "overdue"
  | "total"
  | "by-section"
  | "completion-donut"
  | "by-project"
  | "over-time";
const DASHBOARD_WIDGETS: {
  id: DashboardWidgetId;
  label: string;
  kind: "kpi" | "chart";
}[] = [
  { id: "completed", label: "Completed tasks", kind: "kpi" },
  { id: "incomplete", label: "Incomplete tasks", kind: "kpi" },
  { id: "overdue", label: "Overdue tasks", kind: "kpi" },
  { id: "total", label: "Total tasks", kind: "kpi" },
  { id: "by-section", label: "Tasks by section", kind: "chart" },
  { id: "completion-donut", label: "Completion status (next month)", kind: "chart" },
  { id: "by-project", label: "Tasks by project", kind: "chart" },
  { id: "over-time", label: "Task completion over time", kind: "chart" },
];
// Default = every widget enabled (matches the pre-dsh-01 fixed layout), so
// a returning user with no persisted selection sees no change.
const DEFAULT_DASHBOARD_WIDGET_IDS: string[] = DASHBOARD_WIDGETS.map(
  (w) => w.id
);

// Canonical order of the 4 original built-in list columns (col-02). The
// stored uiState.myTasks.columnOrder is reconciled against this so a
// missing / stale entry can never drop or duplicate a column.
const CANONICAL_COLUMN_ORDER = [
  "dueDate",
  "collaborators",
  "projects",
  "visibility",
] as const;

/** Reconcile a persisted column order against the canonical set: keep the
 *  user's ordering for known ids, drop unknown ids, and append any
 *  canonical id the stored order is missing (defensive against schema
 *  drift / partial writes). Always returns exactly the 4 known ids. */
function reconcileColumnOrder(stored: string[] | undefined): string[] {
  const known = new Set<string>(CANONICAL_COLUMN_ORDER);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of stored ?? []) {
    if (known.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }
  for (const id of CANONICAL_COLUMN_ORDER) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}

// Resolve a dnd-kit `over.id` to a section id during a SECTION-reorder
// drag. The over target may be a section-header sortable ("section:<id>"),
// a section droppable (bare "<id>"), or a task row nested in a section —
// all three map to the containing section.
function resolveSectionIdFromOver(
  sections: SmartSection[],
  overId: string
): string | null {
  if (overId.startsWith("section:")) return overId.slice("section:".length);
  if (sections.some((s) => s.id === overId)) return overId;
  const owner = sections.find((s) => s.tasks.some((t) => t.id === overId));
  return owner?.id ?? null;
}

/**
 * Extract a comparable value (number or string) from a task's custom
 * field value for the given fieldId — used by the column-based sort
 * (col-03). Numbers/currency/percentage compare numerically; dates as
 * ISO strings (lexicographic order == chronological); option-based
 * fields (DROPDOWN/MULTI_SELECT) resolve to the option LABEL(s) so the
 * sort matches what the cell renders; everything else coerces to string.
 * Returns null/"" when the task has no value for the field.
 */
function customFieldSortValue(task: Task, fieldId: string): number | string {
  const cfv = task.customFieldValues?.find((v) => v.fieldId === fieldId);
  if (!cfv || cfv.value === null || cfv.value === undefined) return "";
  const type = cfv.field?.type;
  const raw = cfv.value;

  if (type === "NUMBER" || type === "CURRENCY" || type === "PERCENTAGE") {
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isNaN(n) ? "" : n;
  }

  if (type === "DROPDOWN" || type === "MULTI_SELECT") {
    // options is a Json array of { id, label }. `raw` is an option id
    // (DROPDOWN) or an array of ids (MULTI_SELECT). Resolve to labels.
    const options = Array.isArray(cfv.field?.options)
      ? (cfv.field!.options as { id: string; label: string }[])
      : [];
    const labelFor = (id: unknown) =>
      options.find((o) => o.id === id)?.label ?? String(id ?? "");
    if (Array.isArray(raw)) return raw.map(labelFor).join(", ");
    return labelFor(raw);
  }

  // DATE / TEXT / others → string coercion (ISO dates sort chronologically).
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  return "";
}

export default function MyTasksPage() {
  const { data: session } = useSession();
  const [view, setView] = useState<ViewType>("list");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  // Non-null when the last task fetch failed — surfaces a compact
  // error + retry block instead of silently showing an empty list.
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  // Bumped whenever an attachment is uploaded or removed inside the
  // slide-over. Files tab watches this and refetches so newly added
  // attachments show up immediately when the user switches tabs.
  const [attachmentsVersion, setAttachmentsVersion] = useState(0);
  const [sections, setSections] = useState<SmartSection[]>([]);
  const [quickFilters, setQuickFilters] = useState<QuickFilterKey[]>([]);
  // Sub-select for the "Completed" quick filter (Asana parity). Defaults
  // to "all"; persisted in uiState alongside the other view controls.
  const [completedWindow, setCompletedWindow] = useState<CompletedWindow>("all");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  // Assignee-name filters from the Advanced Search modal (free-text
  // names, matched case-insensitively against task.assignee.name).
  const [assigneeNameFilters, setAssigneeNameFilters] = useState<string[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [sortState, setSortState] = useState<SortState>({ field: "none", direction: "asc" });
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  // Default primary grouping is the Asana-parity personal "sections"
  // (user-owned buckets), not the old date-driven "due_date". Sections
  // now render from the user's own list; due_date remains a separate
  // selectable grouping for users who prefer auto-bucketing by date.
  const [groupType, setGroupType] = useState<string>("sections");
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
  const [showCalendarSync, setShowCalendarSync] = useState(false);
  const [calendarSyncType, setCalendarSyncType] = useState<"outlook" | "google" | "ical">("outlook");
  const [showGoogleSheetsHelp, setShowGoogleSheetsHelp] = useState(false);
  const [calendarFeedUrl, setCalendarFeedUrl] = useState("");
  /** Asana-parity delete-field confirmation. `col` is null when closed;
   *  when the user clicks "Delete field" on a custom column header,
   *  setDeleteFieldDialog({ col }) opens the modal and the actual
   *  removal runs only after the user confirms in the dialog. */
  const [deleteFieldDialog, setDeleteFieldDialog] = useState<{
    col: ListColumn | null;
  }>({ col: null });
  const [calendarFeedLoading, setCalendarFeedLoading] = useState(false);
  const [openColumnDropdown, setOpenColumnDropdown] = useState<string | null>(null);

  // Per-user UI preferences — server-backed via useUiState so they
  // follow the user across devices/browsers. We bundle the my-tasks
  // prefs into one uiState sub-key ("myTasks") for atomic reads/writes.
  // `customColumns` was added in Fase 2A so the user's pinned built-in
  // extras (and eventually custom fields) survive reload + device.
  interface MyTasksUiState {
    columnWidths: Record<string, number>;
    hiddenColumns: string[];
    // Order of the 4 original built-in columns (col-02). Ids:
    // "dueDate" | "collaborators" | "projects" | "visibility". Missing /
    // legacy state defaults to the canonical order. Custom columns keep
    // their own ordering inside `customColumns` (they always render after
    // these four, as in Asana).
    columnOrder?: string[];
    viewIcon: string;
    viewName: string;
    customColumns?: ListColumn[];
    // Persisted view controls (Fase — survive reload + follow device).
    quickFilters?: QuickFilterKey[];
    // Time window for the "Completed" quick filter (Asana sub-select).
    completedWindow?: CompletedWindow;
    activeFilters?: ActiveFilter[];
    assigneeNameFilters?: string[];
    sortState?: SortState;
    groupType?: string;
    groupConfigs?: GroupConfig[];
    collapsedSectionIds?: string[];
    // ── User-defined personal sections (Asana "My Tasks" model) ──
    // The real, user-owned sections list. Seeded on first hydration
    // with the 4 defaults (ids kept stable: 'recently-assigned',
    // 'do-today', 'do-next-week', 'do-later') so collapse persistence
    // and the legacy myTaskSection back-compat mapping keep working.
    // `order` drives render order (drag-to-reorder writes it).
    sections?: { id: string; name: string; order: number }[];
    // taskId → sectionId. Ids only (LEAN — the preferences route caps
    // the stored payload at ~32KB). A task with no entry here falls
    // back to its DB `myTaskSection` (back-compat) or 'recently-assigned'.
    taskSections?: Record<string, string>;
    // ── Calendar zoom (cal-01) ──
    // "month" = continuous-scroll month grid (default). "weeks" = one
    // tall week per viewport with larger bars. One short string.
    calendarZoom?: "month" | "weeks";
    // ── Dashboard widgets (dsh-01) ──
    // Ordered list of widget ids the user has enabled, selecting from the
    // fixed catalog that already exists (see DASHBOARD_WIDGETS). Undefined
    // means "all default widgets" so returning users see no change.
    dashboardWidgets?: string[];
  }
  const DEFAULT_MY_TASKS_UI: MyTasksUiState = {
    columnWidths: {
      dueDate: 110,
      collaborators: 110,
      projects: 160,
      visibility: 110,
    },
    hiddenColumns: [],
    viewIcon: "📋",
    viewName: "List",
    customColumns: [],
  };
  const {
    value: myTasksUi,
    setValue: setMyTasksUi,
    isHydrated: myTasksUiHydrated,
  } = useUiState<MyTasksUiState>("myTasks", DEFAULT_MY_TASKS_UI);

  // Adapter shims so the rest of the component reads/writes individual
  // pieces as it did before; under the hood they all hit one payload.
  //
  // customColumns now reads from / writes through useUiState so the
  // user's pinned columns survive reload AND follow them across
  // devices/browsers (same store as columnWidths + hiddenColumns).
  // The discriminator stays on each column: optional `builtin` key
  // means it renders from Task fields, otherwise from CustomFieldValue.
  const customColumns = useMemo(
    () => (myTasksUi.customColumns ?? []) as ListColumn[],
    [myTasksUi.customColumns]
  );
  const setCustomColumns = useCallback(
    (
      next:
        | ListColumn[]
        | ((prev: ListColumn[]) => ListColumn[])
    ) => {
      setMyTasksUi((prev) => {
        const current = (prev.customColumns ?? []) as ListColumn[];
        const resolved =
          typeof next === "function"
            ? (next as (p: ListColumn[]) => ListColumn[])(current)
            : next;
        return { ...prev, customColumns: resolved };
      });
    },
    [setMyTasksUi]
  );

  // ── Built-in column order (col-02) ────────────────────────────────
  // The 4 original built-ins render in this order in BOTH the grid
  // templates and the header/row cells, so a Move-left/right swap here
  // reorders everything in lock-step. Reconciled against the canonical
  // set so a partial/stale write can't drop or duplicate a column.
  const columnOrder = useMemo(
    () => reconcileColumnOrder(myTasksUi.columnOrder),
    [myTasksUi.columnOrder]
  );
  // Swap a built-in column one slot left (-1) or right (+1). No-op at the
  // ends. Persists through useUiState so it survives reload + device.
  const moveBuiltinColumn = useCallback(
    (colId: string, dir: -1 | 1) => {
      setMyTasksUi((prev) => {
        const order = reconcileColumnOrder(prev.columnOrder);
        const idx = order.indexOf(colId);
        const target = idx + dir;
        if (idx === -1 || target < 0 || target >= order.length) return prev;
        const next = [...order];
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...prev, columnOrder: next };
      });
    },
    [setMyTasksUi]
  );
  // The built-in columns that are actually visible, in user order. Drives
  // both the grid templates and the header/row cell render order.
  const visibleBuiltinOrder = useMemo(() => {
    const hidden = new Set(myTasksUi.hiddenColumns ?? []);
    return columnOrder.filter((id) => !hidden.has(id));
  }, [columnOrder, myTasksUi.hiddenColumns]);

  const columnWidths = useMemo(
    () => ({ ...DEFAULT_MY_TASKS_UI.columnWidths, ...(myTasksUi.columnWidths ?? {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myTasksUi.columnWidths]
  );
  const setColumnWidths = useCallback(
    (next: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
      setMyTasksUi((prev) => {
        const merged = { ...DEFAULT_MY_TASKS_UI.columnWidths, ...(prev.columnWidths ?? {}) };
        const resolved =
          typeof next === "function"
            ? (next as (p: Record<string, number>) => Record<string, number>)(merged)
            : next;
        return { ...prev, columnWidths: resolved };
      });
    },
    [setMyTasksUi]
  );

  const hiddenColumns = useMemo(
    () => new Set<string>(myTasksUi.hiddenColumns ?? []),
    [myTasksUi.hiddenColumns]
  );
  const toggleColumnVisibility = useCallback(
    (colId: string) => {
      setMyTasksUi((prev) => {
        const cur = new Set(prev.hiddenColumns ?? []);
        if (cur.has(colId)) cur.delete(colId);
        else cur.add(colId);
        return { ...prev, hiddenColumns: Array.from(cur) };
      });
    },
    [setMyTasksUi]
  );

  // ── Personal sections (user-owned buckets) ─────────────────────
  // Derived from uiState.myTasks.sections, always seeded with the 4
  // defaults so a brand-new user (empty uiState) still sees Recently
  // assigned / Do today / Do next week / Do later. Sorted by `order`
  // so drag-to-reorder persists. This is the single source of truth
  // the "sections" grouping, list add-section, board columns, and the
  // detail-pane dropdown all read from.
  const personalSections = useMemo<PersonalSection[]>(() => {
    const stored = myTasksUi.sections;
    const base =
      stored && stored.length > 0 ? stored : DEFAULT_PERSONAL_SECTIONS;
    return [...base].sort((a, b) => a.order - b.order);
  }, [myTasksUi.sections]);

  // taskId → sectionId overrides (ids only, lean).
  const taskSectionMap = useMemo<Record<string, string>>(
    () => myTasksUi.taskSections ?? {},
    [myTasksUi.taskSections]
  );

  // Persist the sections array (create / rename / delete / reorder).
  const setPersonalSections = useCallback(
    (
      next:
        | PersonalSection[]
        | ((prev: PersonalSection[]) => PersonalSection[])
    ) => {
      setMyTasksUi((prev) => {
        const current =
          prev.sections && prev.sections.length > 0
            ? prev.sections
            : DEFAULT_PERSONAL_SECTIONS;
        const resolved =
          typeof next === "function"
            ? (next as (p: PersonalSection[]) => PersonalSection[])(current)
            : next;
        return { ...prev, sections: resolved };
      });
    },
    [setMyTasksUi]
  );

  // Write a taskId → sectionId mapping (or clear it with null).
  const setTaskSection = useCallback(
    (taskId: string, sectionId: string | null) => {
      setMyTasksUi((prev) => {
        const cur = { ...(prev.taskSections ?? {}) };
        if (sectionId === null) delete cur[taskId];
        else cur[taskId] = sectionId;
        return { ...prev, taskSections: cur };
      });
    },
    [setMyTasksUi]
  );

  // ── Calendar zoom (cal-01) ── direct-persist shim, same pattern as
  // viewIcon: reads from uiState, writes straight through. Defaults to the
  // continuous-scroll month grid. No hydrate/persist gating needed — there's
  // no parallel useState mirror to clobber.
  const calendarZoom: "month" | "weeks" = myTasksUi.calendarZoom ?? "month";
  const setCalendarZoom = useCallback(
    (next: "month" | "weeks") =>
      setMyTasksUi((prev) => ({ ...prev, calendarZoom: next })),
    [setMyTasksUi]
  );

  // ── Dashboard widgets (dsh-01) ── ids-only, lean. Undefined means the
  // full default set (see DASHBOARD_WIDGETS) so returning users are
  // unaffected. Toggling writes the enabled-id array straight through.
  const dashboardWidgets: string[] =
    myTasksUi.dashboardWidgets ?? DEFAULT_DASHBOARD_WIDGET_IDS;
  const setDashboardWidgets = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setMyTasksUi((prev) => {
        const current = prev.dashboardWidgets ?? DEFAULT_DASHBOARD_WIDGET_IDS;
        const resolved =
          typeof next === "function"
            ? (next as (p: string[]) => string[])(current)
            : next;
        return { ...prev, dashboardWidgets: resolved };
      });
    },
    [setMyTasksUi]
  );

  // viewIcon uses null-vs-undefined distinction (not falsy fallback)
  // so an intentional clear ("") survives reloads. The server may store
  // "" or omit the key entirely; only the latter falls back to default.
  const viewIcon =
    myTasksUi.viewIcon === undefined ? DEFAULT_MY_TASKS_UI.viewIcon : myTasksUi.viewIcon;
  const setViewIcon = useCallback(
    (next: string) => setMyTasksUi((prev) => ({ ...prev, viewIcon: next })),
    [setMyTasksUi]
  );
  const viewName =
    myTasksUi.viewName && myTasksUi.viewName.trim()
      ? myTasksUi.viewName
      : DEFAULT_MY_TASKS_UI.viewName;
  const setViewName = useCallback(
    (next: string) => setMyTasksUi((prev) => ({ ...prev, viewName: next })),
    [setMyTasksUi]
  );

  // ─── Persisted view controls (filter / sort / group / collapse) ──
  // These stay as plain useState for in-session behavior, but hydrate
  // from useUiState once and write back on change so they survive
  // reload and follow the user across devices — mirroring how
  // columnWidths / customColumns already persist.
  //
  // Section-collapse lives here too: a persisted list of section ids
  // the user has collapsed. organizeTasks always emits collapsed:false;
  // getFilteredSections overlays this set so the collapse survives
  // re-derivation and reload.
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);

  // Set the moment the user touches ANY view control this session. Once
  // set, we stop re-applying the persisted payload so we never clobber
  // an in-session edit — even when the authoritative server value lands
  // after the (possibly stale) localStorage cache. Wrapped setters below
  // flip this; hydration itself does NOT.
  const hasUserAdjustedViewControlsRef = useRef(false);
  const markViewControlsAdjusted = useCallback(() => {
    hasUserAdjustedViewControlsRef.current = true;
  }, []);

  // User-action wrappers around the raw view-control setters. Every
  // USER-initiated change flows through one of these so it marks the
  // session as "adjusted" (stops the server-value re-apply from
  // clobbering the edit). Hydration keeps using the raw setters.
  const setSortStateUser = useCallback(
    (next: SortState | ((prev: SortState) => SortState)) => {
      markViewControlsAdjusted();
      setSortState(next);
    },
    [markViewControlsAdjusted]
  );
  const setQuickFiltersUser = useCallback(
    (next: QuickFilterKey[] | ((prev: QuickFilterKey[]) => QuickFilterKey[])) => {
      markViewControlsAdjusted();
      setQuickFilters(next);
    },
    [markViewControlsAdjusted]
  );
  const setCompletedWindowUser = useCallback(
    (next: CompletedWindow) => {
      markViewControlsAdjusted();
      setCompletedWindow(next);
    },
    [markViewControlsAdjusted]
  );
  const setActiveFiltersUser = useCallback(
    (next: ActiveFilter[] | ((prev: ActiveFilter[]) => ActiveFilter[])) => {
      markViewControlsAdjusted();
      setActiveFilters(next);
    },
    [markViewControlsAdjusted]
  );
  const setAssigneeNameFiltersUser = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      markViewControlsAdjusted();
      setAssigneeNameFilters(next);
    },
    [markViewControlsAdjusted]
  );

  // Tracks that we've applied the persisted payload at least once, which
  // gates the persist-write effect below so we don't write defaults over
  // the freshly-loaded values before hydration has run.
  const viewControlsHydratedRef = useRef(false);

  // Re-apply persisted view controls whenever the underlying useUiState
  // value changes — this covers BOTH the initial localStorage-cache
  // hydration AND the later cache→server transition (new device /
  // cleared cache, where the authoritative DB value only arrives after
  // the GET resolves). We stop as soon as the user has manually changed
  // a control this session so in-session edits are never clobbered.
  useEffect(() => {
    if (!myTasksUiHydrated) return;
    if (hasUserAdjustedViewControlsRef.current) return;
    viewControlsHydratedRef.current = true;
    if (myTasksUi.quickFilters) setQuickFilters(myTasksUi.quickFilters);
    if (myTasksUi.completedWindow) setCompletedWindow(myTasksUi.completedWindow);
    if (myTasksUi.activeFilters) setActiveFilters(myTasksUi.activeFilters);
    if (myTasksUi.assigneeNameFilters)
      setAssigneeNameFilters(myTasksUi.assigneeNameFilters);
    if (myTasksUi.sortState) setSortState(myTasksUi.sortState);
    if (myTasksUi.groupConfigs) setGroupConfigs(myTasksUi.groupConfigs);
    if (myTasksUi.groupType) {
      // Migration: before real personal sections existed, the primary
      // group field "sections" was ALIASED to groupType "due_date". A
      // returning user therefore has groupConfigs[0].field === "sections"
      // but a persisted groupType of "due_date". Honor the panel's field
      // (the real intent) so they land on the new personal-sections view
      // instead of date-bucketing. Users who explicitly chose Due date
      // have groupConfigs[0].field === "due_date" and are unaffected.
      const primaryField = myTasksUi.groupConfigs?.[0]?.field;
      if (myTasksUi.groupType === "due_date" && primaryField === "sections") {
        setGroupType("sections");
      } else {
        setGroupType(myTasksUi.groupType);
      }
    }
    if (myTasksUi.collapsedSectionIds)
      setCollapsedSectionIds(myTasksUi.collapsedSectionIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTasksUiHydrated, myTasksUi]);

  // Persist view-control changes back to the store. Gated on hydration
  // so we don't write the defaults over the freshly-loaded values
  // before hydration has run.
  useEffect(() => {
    if (!viewControlsHydratedRef.current) return;
    setMyTasksUi((prev) => ({
      ...prev,
      quickFilters,
      completedWindow,
      activeFilters,
      assigneeNameFilters,
      sortState,
      groupType,
      groupConfigs,
      collapsedSectionIds,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quickFilters,
    completedWindow,
    activeFilters,
    assigneeNameFilters,
    sortState,
    groupType,
    groupConfigs,
    collapsedSectionIds,
  ]);

  // Re-derive sections whenever the underlying tasks OR the active
  // grouping change. This keeps the rendered sections in lock-step with
  // `groupType` after: a fetch refresh (tasks change), a hydration that
  // restores a persisted groupType different from the default, and a
  // user re-group. Under the "sections" grouping it must ALSO re-run
  // when the user's personal-section list or the taskId→section map
  // change (rename / add / delete / reorder / detail-pane move) so the
  // buckets restructure without a task refetch. Without the `tasks` dep
  // the initial fetch's organizeTasks call (which runs with the
  // mount-render groupType closure) would leave stale buckets on screen
  // while the control shows the restored grouping. Guarded on
  // tasks.length so we don't wipe sections to empty during hydration.
  useEffect(() => {
    if (tasks.length === 0) return;
    organizeTasks(tasks, groupType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, groupType, groupConfigs, personalSections, taskSectionMap]);

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

  // ─────────────────────────────────────────────────────────────
  // SHARED TASK GRID DEFINITION
  // ─────────────────────────────────────────────────────────────
  // One single grid-template-columns string that the header (still
  // flex, with its resize handles + ColumnHeader dropdowns), every
  // TaskRow (also flex), and the background-divider overlay all
  // resolve to the same column boundaries.
  //
  // The string is composed from the SAME column widths the flex
  // layouts use (`columnWidths` state, user-resizable) so:
  //   - Resizing a column updates both the flex cells AND the
  //     overlay's grid in the same render cycle.
  //   - Hidden columns are skipped IDENTICALLY in both the flex
  //     header / row markup and this template, so the cell counts
  //     stay matched.
  //   - Custom columns and the "+" spacer at the end are included
  //     so the overlay's rightmost line aligns with the "+" header.
  //
  // The overlay is the only consumer that genuinely needs CSS Grid
  // (the lines come from grid-cell border-l). The header/rows keep
  // their flex structure to preserve resize handles, dnd-kit
  // listeners, and the ColumnHeader dropdowns — they already used
  // these same widths via --col-* CSS vars so converting them too
  // would be churn without behavior change.
  // CRITICAL: composed from CSS var() references, NOT from the
  // `columnWidths` state. During a column drag, handleResizeStart
  // updates the --col-* CSS variables on every mousemove for instant
  // visual feedback, but it only commits to React state at mouseup.
  // If this template stringified the pixel values from state, the
  // overlay's grid would freeze during the drag while the header /
  // row cells (which read var(--col-*) directly) flowed underneath,
  // breaking the divider alignment until the user released the mouse.
  // Using var() here means the browser re-evaluates the grid on
  // every CSS var change → dividers move with the column in real
  // time, zero React re-renders during the drag.
  const taskGridTemplate = useMemo(() => {
    const cols: string[] = ["1fr"]; // Name (matches flex-1)
    // Built-in tracks emitted in the user's column order (col-02).
    for (const id of visibleBuiltinOrder) cols.push(`var(--col-${id})`);
    for (const c of customColumns) cols.push(`${c.width || 110}px`);
    cols.push("32px"); // "+" column (matches w-8)
    return cols.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleBuiltinOrder, customColumns.length]);

  // Row-level grid template — matches what the header + TaskRow use
  // when laid out as CSS Grid (not Flex). Includes the leading
  // GripVertical spacer + checkbox columns the data row has before
  // the Task name cell. This is the SAME pattern src/components/views
  // /list-view.tsx uses with `[&>*+*]:border-l` — the project list
  // view that renders crisp borders at every DPR/zoom because grid
  // tracks align deterministically to the pixel grid (flex with
  // per-cell border-l + overflow-hidden hits sub-pixel drift). The
  // author of list-view.tsx documented the choice: "the only path
  // that's 100% deterministic across browsers and immune to
  // stacking-context bugs."
  const rowGridTemplate = useMemo(() => {
    // First cell is a COMBINED slot: Grip (16px) + Checkbox (32px) +
    // Task name (≥260px, flexes). Grouping them as a single grid
    // child means the [&>*+*]:border-l pattern won't draw unwanted
    // verticals between Grip↔Checkbox and Checkbox↔Name — the FIRST
    // border appears between this combined cell and the next column
    // (Due date). Matches the project list view's "1 first cell +
    // data cells" pattern in src/components/views/list-view.tsx.
    const cols: string[] = [
      "minmax(308px, 1fr)", // 16 + 32 + 260 = 308 min; flexes
    ];
    // Built-in tracks in the user's column order (col-02).
    for (const id of visibleBuiltinOrder) cols.push(`var(--col-${id})`);
    for (const c of customColumns) cols.push(`${c.width || 110}px`);
    cols.push("32px"); // + Add column spacer
    return cols.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleBuiltinOrder, customColumns]);


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
  // Resize handler for custom + built-in extra columns whose width
  // lives directly on the ListColumn (not in the --col-* CSS vars
  // that the original built-ins use). Reads col.width as starting
  // point, updates the in-memory column synchronously on every
  // mousemove via setCustomColumns (React batches into one re-render
  // per frame). Commits to useUiState on mouseup. Same min-width
  // floor (60) as the original handler.
  const handleResizeCustomCol = useCallback(
    (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startCol = customColumns.find((c) => c.id === colId);
      const startWidth = startCol?.width ?? 110;

      const onMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(60, startWidth + delta);
        setCustomColumns((prev) =>
          prev.map((c) => (c.id === colId ? { ...c, width: nextWidth } : c))
        );
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [customColumns, setCustomColumns]
  );

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

  // Sync group configs → organizeTasks groupType. Every GroupField now
  // has a real bucketing branch in organizeTasks, so the primary field
  // maps 1:1 to a groupType string (no more silent fall-through to
  // due_date). `sections`/`project`/`priority` keep their existing drag
  // semantics; the date/creator fields bucket read-only.
  function handleGroupConfigsChange(newConfigs: GroupConfig[]) {
    markViewControlsAdjusted();
    setGroupConfigs(newConfigs);
    const primary = newConfigs[0];
    const field = !primary ? "none" : primary.field;
    // GroupField values match the organizeTasks groupType strings 1:1
    // for: sections, due_date, start_date, created_at, updated_at,
    // completed_at, creator, project, priority, none.
    setGroupType(field);
    organizeTasks(tasks, field);
  }

  const initialLoadDoneRef = useRef(false);

  // Drop taskSections mappings for tasks that are no longer present in
  // the latest fetch, keeping the persisted uiState payload lean (the
  // preferences route caps stored JSON ~32KB). Only PATCHes when the map
  // actually shrank. Guarded on hydration so we don't prune a map we
  // haven't loaded from the server yet.
  function pruneTaskSections(latest: Task[]) {
    if (!myTasksUiHydrated) return;
    const stored = myTasksUi.taskSections;
    if (!stored) return;
    const liveIds = new Set(latest.map((t) => t.id));
    const kept: Record<string, string> = {};
    let changed = false;
    for (const [taskId, sectionId] of Object.entries(stored)) {
      if (liveIds.has(taskId)) kept[taskId] = sectionId;
      else changed = true;
    }
    if (changed) {
      setMyTasksUi((prev) => ({ ...prev, taskSections: kept }));
    }
  }

  async function fetchTasks(silent = false) {
    // Only show loading spinner on initial load, not re-fetches
    if (!silent && !initialLoadDoneRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/tasks?myTasks=true");
      if (res.ok) {
        const data = (await res.json()) as Task[];
        setTasks(data);
        // Prune taskSections entries whose task is no longer in the fetch
        // (deleted / no longer assigned) so the stored uiState payload
        // stays lean under the ~32KB preferences cap. Only writes when
        // something actually changed to avoid a needless PATCH.
        pruneTaskSections(data);
        // Always derive sections against the CURRENT grouping — never
        // the mount-render closure. The [tasks, groupType] effect will
        // also re-run, but doing it here keeps the first paint correct.
        organizeTasks(data, groupType);
        initialLoadDoneRef.current = true;
      } else {
        setError(`Couldn't load your tasks (HTTP ${res.status})`);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setError("Couldn't load your tasks — check your connection");
    } finally {
      setLoading(false);
    }
  }

  function organizeTasks(
    taskList: Task[],
    group?: string,
    // Optional taskId→sectionId overrides applied ON TOP of the persisted
    // taskSectionMap. The persisted map lags a tick behind a move (it
    // flushes through useUiState), so a just-moved task passes its new
    // mapping here for a correct optimistic re-render.
    sectionOverrides?: Record<string, string>
  ) {
    const activeGroup = group || groupType;
    // Don't filter out completed tasks here - let the filter system handle visibility
    const activeTasks = taskList;

    // Position-then-createdAt sort — position is what intra-section
    // drag-reorder writes, so this makes the dropped order persist.
    const sortFn = (a: Task, b: Task) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    // ── Personal sections (user-owned buckets) — the DEFAULT grouping ──
    // Bucket each task by its uiState taskSections[id] override. Tasks
    // without an override seed from their DB myTaskSection enum (so
    // pre-existing DB state and freshly-created tasks that set the enum
    // still land correctly); everything else falls to Recently assigned.
    // Unlike project/priority groupings, EMPTY user sections still render
    // (Asana always shows the personal sections, even empty ones).
    if (activeGroup === "sections") {
      const buckets = new Map<string, Task[]>();
      const validIds = new Set(personalSections.map((s) => s.id));
      personalSections.forEach((s) => buckets.set(s.id, []));
      const fallbackId = personalSections[0]?.id ?? "recently-assigned";

      activeTasks.forEach((task) => {
        let sid = sectionOverrides?.[task.id] ?? taskSectionMap[task.id];
        // No explicit uiState mapping → seed from the DB enum for
        // back-compat with tasks the user placed before this model.
        if (!sid && task.myTaskSection) {
          sid = ENUM_TO_SECTION_ID[task.myTaskSection];
        }
        // Unmapped or pointing at a section the user has since deleted →
        // Recently assigned (matches Asana's "newly assigned lands here").
        if (!sid || !validIds.has(sid)) sid = fallbackId;
        if (!buckets.has(sid)) buckets.set(sid, []);
        buckets.get(sid)!.push(task);
      });

      const result: SmartSection[] = personalSections.map((s) => ({
        id: s.id,
        name: s.name,
        collapsed: false,
        tasks: (buckets.get(s.id) ?? []).sort(sortFn),
      }));
      setSections(result);
      return;
    }

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

    // ── Real "Created by" grouping (tb-02) ────────────────────────
    // Bucket by the task's CREATOR (distinct from the assignee grouping
    // above). The creator relation is included by the API.
    if (activeGroup === "creator") {
      const primaryCfg = groupConfigs[0];
      const byCreator = new Map<string, { name: string; tasks: Task[] }>();
      activeTasks.forEach((task) => {
        const id = task.creator?.id || "no-creator";
        const name = task.creator?.name || "Unknown";
        if (!byCreator.has(id)) byCreator.set(id, { name, tasks: [] });
        byCreator.get(id)!.tasks.push(task);
      });
      let result: SmartSection[] = [];
      byCreator.forEach(({ name, tasks }, id) => {
        result.push({ id, name, collapsed: false, tasks: tasks.sort(sortFn) });
      });
      // Order: default (custom) keeps insertion order; asc/desc sort by
      // the creator name.
      if (primaryCfg?.order === "asc") {
        result.sort((a, b) => a.name.localeCompare(b.name));
      } else if (primaryCfg?.order === "desc") {
        result.sort((a, b) => b.name.localeCompare(a.name));
      }
      // hideEmpty is moot here (every bucket has ≥1 task) but honor it
      // defensively.
      if (primaryCfg?.hideEmpty) {
        result = result.filter((s) => s.tasks.length > 0);
      }
      setSections(result);
      return;
    }

    // ── Date-driven groupings (tb-02): start / creation / last-modified
    // / completion date. Buckets by calendar proximity using date-only
    // helpers so a task due "today" is never mis-bucketed by timezone.
    // Honors the primary GroupConfig's order (asc/desc reverse the bucket
    // sequence) and hideEmpty (drop empty buckets). The `due_date`
    // grouping keeps its dedicated myTaskSection-aware branch below.
    const DATE_FIELD_MAP: Record<string, (t: Task) => string | null> = {
      start_date: (t) => t.startDate,
      created_at: (t) => t.createdAt,
      updated_at: (t) => t.updatedAt,
      completed_at: (t) => t.completedAt,
    };
    if (DATE_FIELD_MAP[activeGroup]) {
      const getDate = DATE_FIELD_MAP[activeGroup];
      const primaryCfg = groupConfigs[0];
      // Bucket definitions in natural (past → future) order. daysFromToday
      // is negative in the past, 0 today, positive in the future.
      const overdue: Task[] = [];
      const today: Task[] = [];
      const thisWeek: Task[] = [];
      const nextWeek: Task[] = [];
      const later: Task[] = [];
      const noDate: Task[] = [];
      activeTasks.forEach((task) => {
        const d = getDate(task);
        if (!d) {
          noDate.push(task);
          return;
        }
        const delta = daysFromToday(d);
        if (delta < 0) overdue.push(task);
        else if (delta === 0) today.push(task);
        else if (delta <= 7) thisWeek.push(task);
        else if (delta <= 14) nextWeek.push(task);
        else later.push(task);
      });
      let buckets: SmartSection[] = [
        { id: "grp-past", name: "Earlier", collapsed: false, tasks: overdue },
        { id: "grp-today", name: "Today", collapsed: false, tasks: today },
        { id: "grp-this-week", name: "This week", collapsed: false, tasks: thisWeek },
        { id: "grp-next-week", name: "Next week", collapsed: false, tasks: nextWeek },
        { id: "grp-later", name: "Later", collapsed: false, tasks: later },
        { id: "grp-none", name: "No date", collapsed: false, tasks: noDate },
      ].map((b) => ({ ...b, tasks: b.tasks.sort(sortFn) }));
      // Ascending = natural order (already). Descending = reverse the
      // time buckets but always keep "No date" last.
      if (primaryCfg?.order === "desc") {
        const noneBucket = buckets[buckets.length - 1];
        buckets = [...buckets.slice(0, -1).reverse(), noneBucket];
      }
      if (primaryCfg?.hideEmpty) {
        buckets = buckets.filter((b) => b.tasks.length > 0);
      } else {
        // Even without hideEmpty, drop the "No date" bucket when empty so
        // it doesn't clutter a fully-dated list.
        buckets = buckets.filter((b) => b.id !== "grp-none" || b.tasks.length > 0);
      }
      setSections(buckets);
      return;
    }

    if (activeGroup === "none") {
      setSections([{ id: "all", name: "All tasks", collapsed: false, tasks: activeTasks }]);
      return;
    }

    // Default: group by myTaskSection (explicit override) or fall back to due date
    const recentlyAssigned: Task[] = [];
    const doToday: Task[] = [];
    const doNextWeek: Task[] = [];
    const doLater: Task[] = [];

    activeTasks.forEach((task) => {
      // If myTaskSection is explicitly set, honor it. This includes
      // RECENTLY_ASSIGNED — user-pinned to Recently assigned even if
      // the task has a dueDate that would otherwise auto-bucket it
      // into Do today/next week/later.
      if (task.myTaskSection) {
        if (task.myTaskSection === "RECENTLY_ASSIGNED") recentlyAssigned.push(task);
        else if (task.myTaskSection === "DO_TODAY") doToday.push(task);
        else if (task.myTaskSection === "DO_NEXT_WEEK") doNextWeek.push(task);
        else if (task.myTaskSection === "DO_LATER") doLater.push(task);
        return;
      }
      // Fall back to due date classification for tasks without explicit
      // section. daysFromToday normalizes the UTC-midnight due date to the
      // local calendar day, so a task due tomorrow doesn't leak into "Do
      // today" (and a task due today never lands in "Do later") the way a
      // raw `new Date(dueDate) <= todayEnd` comparison did west of UTC.
      if (!task.dueDate) {
        recentlyAssigned.push(task);
      } else {
        const delta = daysFromToday(task.dueDate);
        if (delta <= 0) {
          doToday.push(task);
        } else if (delta <= 7) {
          doNextWeek.push(task);
        } else {
          doLater.push(task);
        }
      }
    });

    // Sort each bucket by position then createdAt (shared sortFn defined
    // at the top of organizeTasks).
    recentlyAssigned.sort(sortFn);
    doToday.sort(sortFn);
    doNextWeek.sort(sortFn);
    doLater.sort(sortFn);

    // Keep sections that were empty in previous state (don't collapse them)
    // This prevents sections from disappearing and reappearing during moves
    let dueBuckets: SmartSection[] = [
      { id: "recently-assigned", name: "Recently assigned", collapsed: false, tasks: recentlyAssigned },
      { id: "do-today", name: "Do today", collapsed: false, tasks: doToday },
      { id: "do-next-week", name: "Do next week", collapsed: false, tasks: doNextWeek },
      { id: "do-later", name: "Do later", collapsed: false, tasks: doLater },
    ];
    // Honor the primary GroupConfig's order/hideEmpty only when the user
    // explicitly picked the Due date grouping (not the sections default,
    // which shares this block). This keeps drag semantics intact for the
    // personal-sections path while giving the Due date grouping parity.
    if (activeGroup === "due_date") {
      const primaryCfg = groupConfigs[0];
      if (primaryCfg?.order === "desc") dueBuckets = [...dueBuckets].reverse();
      if (primaryCfg?.hideEmpty) {
        dueBuckets = dueBuckets.filter((b) => b.tasks.length > 0);
      }
    }
    setSections(dueBuckets);
  }

  // Create a persisted user-owned section. Appends to uiState.myTasks.
  // sections with the next order value so it survives reload + follows
  // the user across devices. Returns the new section id (used by the
  // Board add-section which prompts inline).
  function createPersonalSection(rawName: string): string | null {
    const name = rawName.trim();
    if (!name) return null;
    const id = `custom-${Date.now()}`;
    setPersonalSections((prev) => {
      const nextOrder =
        prev.reduce((max, s) => Math.max(max, s.order), -1) + 1;
      return [...prev, { id, name, order: nextOrder }];
    });
    toast.success(`Section "${name}" added`);
    return id;
  }

  function handleAddSection() {
    if (!newSectionName.trim()) return;
    createPersonalSection(newSectionName);
    setNewSectionName("");
    setIsAddingSection(false);
  }

  // Rename a persisted section in place (id stays stable so collapse
  // state + task mappings are untouched).
  function handleRenameSection(sectionId: string, rawName: string) {
    const name = rawName.trim();
    if (!name) return;
    setPersonalSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, name } : s))
    );
  }

  // Delete a persisted section: reassign its mapped tasks to Recently
  // assigned (both in the uiState map AND, for tasks whose enum pointed
  // at this section, by clearing/reseating the enum via PATCH), then
  // drop the section from the list. The 4 defaults can't be deleted.
  async function handleDeleteSection(sectionId: string) {
    if (sectionId in SECTION_ID_TO_ENUM) {
      toast.info("Default sections can't be deleted");
      return;
    }

    // Drop the section AND every taskSections mapping that pointed at it
    // in a single uiState write. The affected tasks then have no mapping
    // and no enum (custom sections never set one), so organizeTasks
    // seeds them into Recently assigned automatically. One atomic write
    // keeps the map + list consistent.
    setMyTasksUi((prev) => {
      const nextMap = { ...(prev.taskSections ?? {}) };
      for (const [tid, sid] of Object.entries(nextMap)) {
        if (sid === sectionId) delete nextMap[tid];
      }
      const curSections =
        prev.sections && prev.sections.length > 0
          ? prev.sections
          : DEFAULT_PERSONAL_SECTIONS;
      return {
        ...prev,
        taskSections: nextMap,
        sections: curSections.filter((s) => s.id !== sectionId),
      };
    });

    toast.success("Section deleted");
  }

  // Persist a reordered section list (drag-to-reorder). Renumbers
  // `order` from the dropped sequence so it survives reload.
  function handleReorderSections(orderedIds: string[]) {
    setPersonalSections((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((s): s is PersonalSection => Boolean(s))
        .map((s, idx) => ({ ...s, order: idx }));
      // Preserve any sections not present in orderedIds (defensive)
      const seen = new Set(orderedIds);
      const rest = prev
        .filter((s) => !seen.has(s.id))
        .map((s, idx) => ({ ...s, order: reordered.length + idx }));
      return [...reordered, ...rest];
    });
  }

  // Helper: check if a date is within a given range label
  function isDateInRange(
    dateStr: string | null,
    range: string,
    // Due/start dates are UTC-midnight, date-only values: normalize them to
    // the local calendar day so every quick/builder filter buckets by the
    // day the user sees, not a timezone-shifted one. createdAt/updatedAt/
    // completedAt are real wall-clock timestamps — pass dateOnly=false to
    // compare them as-is.
    dateOnly: boolean = true
  ): boolean {
    if (!dateStr) return false;
    const date = dateOnly ? dueDateToLocalMidnight(dateStr) : new Date(dateStr);
    const today = startOfLocalDay();

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
      // Overdue = strictly before the start of today. Completion is
      // handled by the caller (a completed task isn't "overdue").
      case "overdue": return date < today;
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
  // Apply the filter + sort overlay to ANY section array. Extracted so
  // the List view (grouped by the active groupType) and the Board/Calendar
  // views (always grouped by personal sections — see buildPersonalSections)
  // share one filter/sort implementation. `source` defaults to the
  // groupType-derived `sections` state for the List path.
  const applyFiltersAndSort = (source: SmartSection[]) => {
    const hasFilters = quickFilters.length > 0 || activeFilters.length > 0;

    return source.map((section) => ({
      ...section,
      // Overlay the persisted collapse state so a collapsed section
      // stays collapsed across re-derivation (organizeTasks) + reload.
      collapsed: collapsedSectionIds.includes(section.id),
      tasks: section.tasks.filter((task) => {
        // Search filter
        if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }

        // Assignee-name filter (from Advanced Search). OR logic across
        // the entered names; a task passes if its assignee name matches
        // any of them (case-insensitive substring).
        if (assigneeNameFilters.length > 0) {
          const assigneeName = (task.assignee?.name || "").toLowerCase();
          const matches = assigneeNameFilters.some((n) =>
            assigneeName.includes(n.toLowerCase())
          );
          if (!matches) return false;
        }

        // Quick filters (OR logic between quick filters)
        if (quickFilters.length > 0) {
          const passesQuick = quickFilters.some((qf) => {
            switch (qf) {
              case "incomplete": return !task.completed;
              case "completed": {
                if (!task.completed) return false;
                // Asana's Completed sub-select: further gate on WHEN the
                // task was completed. "all" (or a missing completedAt)
                // passes everything.
                if (completedWindow === "all" || !task.completedAt) return true;
                const daysAgo = -daysFromToday(task.completedAt); // >=0 in the past
                switch (completedWindow) {
                  case "today": return daysAgo === 0;
                  case "yesterday": return daysAgo === 1;
                  case "1w": return daysAgo >= 0 && daysAgo <= 7;
                  case "2w": return daysAgo >= 0 && daysAgo <= 14;
                  case "3w": return daysAgo >= 0 && daysAgo <= 21;
                  default: return true;
                }
              }
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
              if (f.operator === "is_within") {
                if (!isDateInRange(task.dueDate, f.value)) return false;
                // A completed task is never "overdue".
                if (f.value === "overdue" && task.completed) return false;
              }
              if (f.operator === "is_before" && task.dueDate) {
                // "is before today" etc — simplified. daysFromToday folds
                // the UTC-midnight due date onto the local calendar day so
                // the comparison isn't off by one west of UTC.
                if (!isDateInRange(task.dueDate, f.value)) {
                  if (f.value === "today" && daysFromToday(task.dueDate) >= 0) return false;
                }
              }
              if (f.operator === "is_after" && task.dueDate) {
                if (f.value === "today" && daysFromToday(task.dueDate) <= 0) return false;
              }
              break;
            case "start_date":
              // startDate IS on the Task model now — honor the operators.
              if (f.operator === "is_set" && !task.startDate) return false;
              if (f.operator === "is_not_set" && task.startDate) return false;
              if (f.operator === "is_within" && !isDateInRange(task.startDate, f.value)) return false;
              break;
            case "creation_date":
              if (f.operator === "is_within" && !isDateInRange(task.createdAt, f.value, false)) return false;
              break;
            case "task_type":
              if (f.operator === "is" && (task.taskType || "TASK") !== f.value) return false;
              if (f.operator === "is_not" && (task.taskType || "TASK") === f.value) return false;
              break;
            case "creator":
              // Value "me" resolves to the signed-in user; any other value
              // is treated as a creator id (Advanced Search may supply one).
              {
                const targetId = f.value === "me" ? session?.user?.id : f.value;
                if (!targetId) break;
                const creatorId = task.creator?.id ?? null;
                if (f.operator === "is" && creatorId !== targetId) return false;
                if (f.operator === "is_not" && creatorId === targetId) return false;
              }
              break;
            case "last_modified":
              if (f.operator === "is_within" && !isDateInRange(task.updatedAt, f.value, false)) return false;
              break;
            case "completion_date":
              if (f.operator === "is_set" && !task.completedAt) return false;
              if (f.operator === "is_not_set" && task.completedAt) return false;
              if (f.operator === "is_within" && !isDateInRange(task.completedAt, f.value, false)) return false;
              break;
          }
        }

        return true;
      }).sort((a, b) => {
        // No active sort: keep the position/section order organizeTasks
        // established. A columnId (pinned built-in / custom field) sort
        // overrides the panel `field`.
        if (sortState.field === "none" && !sortState.columnId) return 0;
        const dir = sortState.direction === "asc" ? 1 : -1;

        function cmpDate(dateA: string | null, dateB: string | null): number {
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1; // nulls sort last regardless of direction
          if (!dateB) return -1;
          return (new Date(dateA).getTime() - new Date(dateB).getTime()) * dir;
        }
        function cmpStr(x: string, y: string): number {
          if (!x && !y) return 0;
          if (!x) return 1;
          if (!y) return -1;
          return x.localeCompare(y) * dir;
        }
        function cmpNum(x: number | null, y: number | null): number {
          if (x === null && y === null) return 0;
          if (x === null) return 1;
          if (y === null) return -1;
          return (x - y) * dir;
        }
        // HIGH > MEDIUM > LOW > NONE for ascending-by-severity intuition.
        const PRIORITY_RANK: Record<string, number> = {
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
          NONE: 0,
        };

        // ── col-03: sort by a pinned column (built-in extra or custom
        // field). Dispatched before the panel `field` switch. ──────────
        if (sortState.columnId) {
          const cid = sortState.columnId;
          switch (cid) {
            case "priority":
              return cmpNum(
                PRIORITY_RANK[a.priority || "NONE"],
                PRIORITY_RANK[b.priority || "NONE"]
              );
            case "start_date":
              return cmpDate(a.startDate, b.startDate);
            case "completed_at":
              return cmpDate(a.completedAt, b.completedAt);
            case "updated_at":
              return cmpDate(a.updatedAt, b.updatedAt);
            case "created_at":
              return cmpDate(a.createdAt, b.createdAt);
            case "creator":
              return cmpStr(a.creator?.name || "", b.creator?.name || "");
            case "tags":
              return cmpStr(
                (a.taskTags || []).map((t) => t.tag.name).join(", "),
                (b.taskTags || []).map((t) => t.tag.name).join(", ")
              );
            case "likes":
              return cmpNum(a._count.likes ?? 0, b._count.likes ?? 0);
            case "blocked_by":
              return cmpNum(
                a.dependencies?.length ?? 0,
                b.dependencies?.length ?? 0
              );
            case "blocks":
              return cmpNum(
                a.dependents?.length ?? 0,
                b.dependents?.length ?? 0
              );
            default: {
              // Real custom-field column: compare by the extracted value.
              const va = customFieldSortValue(a, cid);
              const vb = customFieldSortValue(b, cid);
              if (typeof va === "number" || typeof vb === "number") {
                return cmpNum(
                  typeof va === "number" ? va : null,
                  typeof vb === "number" ? vb : null
                );
              }
              return cmpStr(String(va ?? ""), String(vb ?? ""));
            }
          }
        }

        switch (sortState.field) {
          case "due_date":
            return cmpDate(a.dueDate, b.dueDate);
          case "start_date":
            return cmpDate(a.startDate, b.startDate);
          case "created_at":
            return cmpDate(a.createdAt, b.createdAt);
          case "updated_at":
            return cmpDate(a.updatedAt, b.updatedAt);
          case "completed_at":
            return cmpDate(a.completedAt, b.completedAt);
          case "alphabetical":
            return a.name.localeCompare(b.name) * dir;
          case "project":
            return (a.project?.name || "").localeCompare(b.project?.name || "") * dir;
          case "creator":
            return cmpStr(a.creator?.name || "", b.creator?.name || "");
          case "likes":
            return cmpNum(a._count.likes ?? 0, b._count.likes ?? 0);
          default:
            return 0;
        }
      }),
    }));
  };

  // List view: filter/sort the groupType-derived `sections` state.
  const getFilteredSections = () => applyFiltersAndSort(sections);

  // Bucket tasks into the user's personal sections, INDEPENDENT of the
  // active List groupType. This mirrors the `activeGroup === "sections"`
  // branch of organizeTasks but is pure (no setState), so the Board and
  // Calendar can always operate on personal sections even when the List
  // is grouped by project/priority/assignee/due date. Keeping the two in
  // lock-step is what makes handleMoveTaskToSection's personal-section
  // branch, the board's Add-section, and the detail-pane section dropdown
  // all agree on a single source of truth.
  const buildPersonalSections = (taskList: Task[]): SmartSection[] => {
    const sortFn = (a: Task, b: Task) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };
    const buckets = new Map<string, Task[]>();
    const validIds = new Set(personalSections.map((s) => s.id));
    personalSections.forEach((s) => buckets.set(s.id, []));
    const fallbackId = personalSections[0]?.id ?? "recently-assigned";
    taskList.forEach((task) => {
      let sid = taskSectionMap[task.id];
      if (!sid && task.myTaskSection) {
        sid = ENUM_TO_SECTION_ID[task.myTaskSection];
      }
      if (!sid || !validIds.has(sid)) sid = fallbackId;
      if (!buckets.has(sid)) buckets.set(sid, []);
      buckets.get(sid)!.push(task);
    });
    return personalSections.map((s) => ({
      id: s.id,
      name: s.name,
      collapsed: false,
      tasks: (buckets.get(s.id) ?? []).sort(sortFn),
    }));
  };

  const filteredSections = getFilteredSections();

  // Board / Calendar always render personal sections, then apply the same
  // filter/sort overlay (so filters + sort still take effect on those
  // views). When the List is already grouped by sections this equals
  // `filteredSections`; when it isn't, the Board no longer inherits the
  // List's project/priority/etc. buckets.
  const personalSectionsForBoard =
    groupType === "sections"
      ? filteredSections
      : applyFiltersAndSort(buildPersonalSections(tasks));

  function toggleSection(sectionId: string) {
    markViewControlsAdjusted();
    // Toggle in the persisted collapsed-id set (drives the `collapsed`
    // overlay in getFilteredSections + survives reload).
    setCollapsedSectionIds((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  }

  // Map the UI's field-type ids to the Prisma CustomFieldType enum the
  // personal custom-field endpoint expects. Mirrors the same map in
  // CustomFieldModal so a field created from the My Tasks toolbar
  // persists with the correct type and its cells render/edit properly.
  const UI_TO_PRISMA_FIELD_TYPE: Record<string, string> = {
    text: "TEXT",
    number: "NUMBER",
    date: "DATE",
    single_select: "DROPDOWN",
    multi_select: "MULTI_SELECT",
    checkbox: "CHECKBOX",
    people: "PEOPLE",
    currency: "CURRENCY",
    percentage: "PERCENTAGE",
    reference: "REFERENCE",
    formula: "FORMULA",
    timer: "TIMER",
    time_tracking: "TIME_TRACKING",
    rollup: "ROLLUP",
  };

  async function handleFieldCreated(field: CreatedFieldInfo) {
    // Project-scoped path: the modal already persisted the field and
    // handed back the real CustomFieldDefinition id + the Prisma type.
    // Use them directly so the value lookup in TaskRow matches.
    if (field.id) {
      const columnId = field.id;
      setCustomColumns((prev) => {
        if (prev.some((c) => c.id === columnId)) return prev; // idempotent
        return [
          ...prev,
          { id: columnId, name: field.name, type: field.type, color: field.color },
        ];
      });
      return;
    }

    // Personal ("My Tasks") path: the modal only fired a cosmetic
    // callback. Persist a REAL personal CustomFieldDefinition (no
    // ProjectCustomField link) so per-task values can actually save.
    // `field.type` here is a UI type id (e.g. "text") — map it to the
    // Prisma enum the endpoint expects.
    const prismaType = UI_TO_PRISMA_FIELD_TYPE[field.type];
    if (!prismaType) {
      toast.error("This field type isn't supported yet");
      return;
    }
    try {
      const res = await fetch("/api/my-tasks/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: field.name, type: prismaType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      const columnId: string = created.id;
      // Carry the Prisma type + any seeded options on the column so
      // EditableCustomFieldCell renders/edits with the right editor.
      const options = created.options ?? null;
      setCustomColumns((prev) => {
        if (prev.some((c) => c.id === columnId)) return prev; // idempotent
        return [
          ...prev,
          {
            id: columnId,
            name: created.name ?? field.name,
            type: created.type ?? prismaType,
            color: field.color,
            options,
          },
        ];
      });
    } catch (err) {
      console.error("Create personal custom field error:", err);
      toast.error("Couldn't create the field");
    }
  }

  // Move a task into a user-owned personal section. Persistence lives in
  // uiState (taskSections map), NOT the tasks table — except that for the
  // 4 default sections we ALSO mirror the DB myTaskSection enum (back-
  // compat with pre-existing state + the enum fallback in organizeTasks),
  // and for a custom section we clear the enum so a stale value can't
  // drag the task back to a default bucket on a fresh device. Used by
  // BOTH the List/Board sections-grouping drag AND the detail-pane
  // section dropdown (which works regardless of the active grouping).
  async function moveTaskToPersonalSection(
    taskId: string,
    destSectionId: string
  ) {
    const destIsValid = personalSections.some((s) => s.id === destSectionId);
    if (!destIsValid) {
      toast.info("Can't move to that section");
      return;
    }
    // Persist the mapping to uiState (debounced PATCH via useUiState).
    setTaskSection(taskId, destSectionId);

    // Optimistic re-render: pass the new mapping as an override so the
    // card lands in the destination now, before uiState flushes. Also
    // reflect the enum on the in-memory task for the default sections
    // so it stays consistent if the grouping recomputes.
    const enumForDest = SECTION_ID_TO_ENUM[destSectionId] ?? null;
    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            myTaskSection: enumForDest as Task["myTaskSection"],
          }
        : t
    );
    setTasks(updatedTasks);
    // Only re-derive when the sections grouping is on screen; under other
    // groupings this move has no visible bucket effect.
    if (groupType === "sections") {
      organizeTasks(updatedTasks, "sections", { [taskId]: destSectionId });
    }

    // Back-compat DB write: default sections → set the enum; custom
    // sections → clear it. Failure here is non-fatal (uiState already
    // holds the authoritative mapping), so we only log.
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ myTaskSection: enumForDest }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("Move task (section enum sync) error:", err);
    }
  }

  // Shared cross-grouping move handler for the List + Board drag-drop.
  // The destination section id means different things depending on the
  // active grouping, so we translate it into the correct PATCH before
  // touching the DB. Getting this wrong (the old code always wrote
  // myTaskSection) corrupted state under Project/Priority/Assignee
  // groupings — it failed to move AND wiped any prior myTaskSection.
  async function handleMoveTaskToSection(
    taskId: string,
    destSectionId: string
  ) {
    // ── Personal-sections grouping (the default) ──────────────────
    if (groupType === "sections") {
      await moveTaskToPersonalSection(taskId, destSectionId);
      return;
    }

    // Build the PATCH body for the active grouping. `null` body means
    // "don't issue a corrupting PATCH" (e.g. group=none / unknown).
    let patch: Record<string, unknown> | null = null;
    // Optimistic mutation applied to the in-memory task.
    let applyOptimistic: (t: Task) => Task = (t) => t;

    if (groupType === "project") {
      const projectId = destSectionId === "no-project" ? null : destSectionId;
      patch = { projectId };
      // organizeTasks buckets by task.project?.id, so the optimistic
      // task MUST carry the destination project id (not the old
      // relation) or the card re-renders in its old bucket until the
      // refetch. Reuse an existing task's project relation for name/
      // color when available; otherwise stub minimally — the silent
      // refetch fills in the real metadata moments later.
      const existingProject = projectId
        ? tasks.find((t) => t.project?.id === projectId)?.project
        : null;
      const destName =
        sections.find((s) => s.id === destSectionId)?.name ?? "Unknown";
      applyOptimistic = (t) =>
        t.id === taskId
          ? {
              ...t,
              // Clear the relation when moving to "No project"; otherwise
              // carry a stub with the new id so it buckets correctly now.
              project: projectId
                ? existingProject ?? {
                    id: projectId,
                    name: destName,
                    color: "#94a3b8",
                  }
                : null,
            }
          : t;
    } else if (groupType === "priority") {
      // Priority buckets are keyed by the enum value itself (see
      // organizeTasks: ids are "HIGH" | "MEDIUM" | "LOW" | "NONE").
      const priority = destSectionId as Task["priority"];
      patch = { priority };
      applyOptimistic = (t) =>
        t.id === taskId ? { ...t, priority } : t;
    } else if (groupType === "assignee") {
      const assigneeId =
        destSectionId === "unassigned" ? null : destSectionId;
      patch = { assigneeId };
      // organizeTasks buckets by task.assignee?.id, so carry the
      // destination assignee id on the optimistic task or it renders in
      // its old bucket until the refetch. Reuse an existing task's
      // assignee relation for name/email/image when we have one; else
      // stub with the destination section name.
      const existingAssignee = assigneeId
        ? tasks.find((t) => t.assignee?.id === assigneeId)?.assignee
        : null;
      const destName =
        sections.find((s) => s.id === destSectionId)?.name ?? null;
      applyOptimistic = (t) =>
        t.id === taskId
          ? {
              ...t,
              assignee: assigneeId
                ? existingAssignee ?? {
                    id: assigneeId,
                    name: destName,
                    email: null,
                    image: null,
                  }
                : null,
            }
          : t;
    } else if (groupType === "due_date") {
      // Default My-tasks grouping: map the 4 due-date section ids to
      // the myTaskSection enum.
      const sectionMap: Record<string, string> = {
        "recently-assigned": "RECENTLY_ASSIGNED",
        "do-today": "DO_TODAY",
        "do-next-week": "DO_NEXT_WEEK",
        "do-later": "DO_LATER",
      };
      if (!(destSectionId in sectionMap)) {
        toast.info("Can't drop here in this grouping");
        return;
      }
      const myTaskSection = sectionMap[destSectionId];
      patch = { myTaskSection };
      applyOptimistic = (t) =>
        t.id === taskId
          ? {
              ...t,
              myTaskSection: myTaskSection as Task["myTaskSection"],
            }
          : t;
    }

    // group=none / unknown → no meaningful destination; bail without a
    // corrupting write. Nothing moved optimistically, so no revert.
    if (!patch) return;

    const updatedTasks = tasks.map(applyOptimistic);
    setTasks(updatedTasks);
    organizeTasks(updatedTasks, groupType);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchTasks(true);
    } catch (err) {
      console.error("Move task error:", err);
      toast.error("Couldn't move task — reverting");
      fetchTasks(true);
    }
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
      notifyTaskMutated(task.id);
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
      // Map the DEFAULT personal-section ids to the myTaskSection enum.
      // Custom user sections have no enum — the created task is mapped
      // into uiState.taskSections after we learn its id (below). This
      // creates tasks WITHOUT fake due dates — the section is stored
      // independently.
      const myTaskSection = SECTION_ID_TO_ENUM[sectionId] ?? null;
      // A custom section id (not one of the 4 defaults) — remember it so
      // we can write the taskId→sectionId mapping once the task exists.
      const isCustomSection =
        sectionId &&
        !(sectionId in SECTION_ID_TO_ENUM) &&
        personalSections.some((s) => s.id === sectionId);

      // API auto-assigns to current user when no assigneeId provided
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, taskType, myTaskSection }),
      });

      if (res.ok) {
        // Map the new task into a custom section (uiState) so it lands
        // there instead of falling back to Recently assigned. Default
        // sections are already covered by the myTaskSection enum above.
        if (isCustomSection) {
          try {
            const created = await res.json();
            if (created?.id) setTaskSection(created.id, sectionId);
          } catch {
            // Response body already consumed / not JSON — the refetch
            // below still shows the task (in Recently assigned); harmless.
          }
        }
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

    // Due dates arrive as UTC-midnight timestamps; normalize to the local
    // midnight of that calendar day (date-only.ts) so a task due "today"
    // never reads as overdue for viewers west of UTC.
    const date = dueDateToLocalMidnight(dateStr);
    const today = startOfLocalDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - today.getDay()));

    // Whole calendar days from today to the due date (negative = overdue,
    // 0 = today). Drives the overdue branch so "due today" is never past due.
    const delta = daysFromToday(dateStr);

    if (delta < 0) {
      // PMI/AEC convention: overdue items get a count of working days
      // overdue, not just the past date. Reads as "Overdue · 3 days"
      // so it surfaces severity at a glance.
      const days = -delta;
      return {
        text: days === 1 ? "Overdue · 1 day" : `Overdue · ${days} days`,
        className: "text-black font-medium",
      };
    } else if (delta === 0) {
      return { text: "Today", className: "text-[#a8893a]" };
    } else if (delta === 1) {
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
        t.dueDate ? dueDateToLocalMidnight(t.dueDate).toLocaleDateString("en-US") : "",
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
    <div className="h-full flex flex-col bg-background relative">
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
        {viewTabs.map((tab) => {
          // The "list" tab adopts the user's customized icon + name from
          // the Options drawer. Other tabs keep their built-in label.
          const isListTab = tab.id === "list";
          const label = isListTab ? viewName : tab.label;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as ViewType)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-full text-[13px] border-b-2 -mb-px transition-colors",
                view === tab.id
                  ? "text-gray-900 border-gray-900 font-medium"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              )}
            >
              {/* Gate the icon on `isHydrated` so we never paint the
                  default 📋 while the server prefs are still loading.
                  Without this gate, a user who cleared their icon sees
                  the default flash on every page open before it
                  disappears — the bug Juan reported repeatedly. */}
              {isListTab && myTasksUiHydrated && viewIcon && (
                <span className="text-[14px] leading-none">{viewIcon}</span>
              )}
              {label}
            </button>
          );
        })}
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
          {/* Dashboard and Files used to render an "Add widget"
              dropdown + "Send feedback" link in this slot, but both
              were stubs (the dashboard's widgets are fixed; the
              feedback button just opened a toast). Removed until
              backed by real flows so the toolbar reflects only what
              actually works. */}
          {view === "dashboard" || view === "files" ? null : <>
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
              sortState.field !== "none" || sortState.columnId
                ? "text-[#a8893a] bg-[#c9a84c]/10 hover:bg-[#c9a84c]/15"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort{sortState.field !== "none" || sortState.columnId ? " (1)" : ""}
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
              "flex items-center gap-1 px-2 h-7 text-[13px] rounded transition-colors",
              optionsDrawerOpen
                ? "text-gray-900 bg-gray-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <MoreHorizontal className="w-4 h-4" />
            Options
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
            // --row-h was referenced by data row + section header +
            // Add task rows but NEVER defined on any ancestor, so
            // height: var(--row-h) resolved to "" and the rows
            // collapsed to their content height. That's why Juan saw
            // the vertical column borders disappear at section
            // headers + Add task rows when scrolled — only data rows
            // had min-h-[40px] to backstop. Defining it once here
            // covers every row that style-references it.
            "--row-h": "40px",
          } as React.CSSProperties}
        >
          <div className="flex-1 overflow-auto relative bg-white">
          {/* COLUMN HEADERS - sticky inside the scroll container so it shares
              the same effective width as the task rows below. Living outside
              the scroll container made the header ~15px wider than each row
              when a vertical scrollbar appeared, which is what caused the
              column dividers to jog at the header/data seam. */}
          {view === "list" && (
            <div
              // CSS Grid header + Asana-exact border. Same dark
              // #404244 color as the data row below — verified via
              // DevTools on Asana's My Tasks. Light grays (slate-400
              // and lighter) become invisible at DPR 1.25 + browser
              // zoom != 67% due to sub-pixel anti-aliasing.
              className="tt-grid-divider-row tt-grid-header hidden md:grid items-center px-6 text-[11px] font-medium text-gray-500 flex-shrink-0 sticky top-0 z-20"
              style={{
                height: "var(--col-header-h, 32px)",
                gridTemplateColumns: rowGridTemplate,
              }}
            >
          {/* COMBINED FIRST CELL — mirrors the data row's combined
              Grip + Checkbox + Task name slot. Internal flex preserves
              the original visual; the wrapper itself is ONE grid child
              so the row's [&>*+*]:border-l only adds vertical dividers
              from Due date onward. */}
          <div className="flex items-center min-w-0">
            {/* Grip-handle spacer — matches the row's hidden
                GripVertical (w-4 -ml-1 mr-1). */}
            <div className="w-4 -ml-1 mr-1 flex-shrink-0" aria-hidden="true" />

            {/* Checkbox spacer (w-8). */}
            <div className="w-8 flex-shrink-0" />

            {/* Task name. */}
            <ColumnHeader
              config={{ id: "name", ...COLUMN_CONFIGS.name }}
              isDropdownOpen={openColumnDropdown === "name"}
              onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === "name" ? null : "name")}
              callbacks={{
                onSortAsc: () => setSortStateUser({ field: "alphabetical", direction: "asc" }),
                onSortDesc: () => setSortStateUser({ field: "alphabetical", direction: "desc" }),
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
          </div>

          {/* Built-in column headers (Due date / Collaborators /
              Projects / Visibility) rendered in the user's order (col-02).
              The resize handle pairs each column with its LEFT neighbor in
              the current order (null for the first, whose left boundary is
              the Name column); the last one also gets a right-edge handle.
              Move-left/right swap ids in columnOrder → grid template +
              header + row cells all reflow together. */}
          {visibleBuiltinOrder.map((colId, idx) => {
            const prevId = idx > 0 ? visibleBuiltinOrder[idx - 1] : null;
            const isLast = idx === visibleBuiltinOrder.length - 1;
            const cfg = COLUMN_CONFIGS[colId as keyof typeof COLUMN_CONFIGS];
            if (!cfg) return null;
            // Per-column context actions (sort/group) — only the columns
            // whose COLUMN_CONFIGS declares them sortable/groupable expose
            // the actions.
            const contextCallbacks: Record<string, () => void> = {};
            if (colId === "dueDate") {
              contextCallbacks.onSortAsc = () => setSortStateUser({ field: "due_date", direction: "asc" });
              contextCallbacks.onSortDesc = () => setSortStateUser({ field: "due_date", direction: "desc" });
            } else if (colId === "projects") {
              contextCallbacks.onSortAsc = () => setSortStateUser({ field: "project", direction: "asc" });
              contextCallbacks.onSortDesc = () => setSortStateUser({ field: "project", direction: "desc" });
            }
            return (
              <div key={colId} className="relative flex items-center pl-2.5 pr-1">
                {/* Left-edge resize handle: pairs with the left neighbor. */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, prevId, colId)}
                  onDoubleClick={handleResizeReset}
                  className="absolute left-0 top-0 bottom-0 w-[6px] -ml-[3px] cursor-col-resize z-30"
                />
                <ColumnHeader
                  config={{ id: colId, ...cfg, width: "100%", minWidth: "100%", isFirst: true }}
                  isDropdownOpen={openColumnDropdown === colId}
                  onDropdownToggle={() => setOpenColumnDropdown(openColumnDropdown === colId ? null : colId)}
                  callbacks={{
                    ...contextCallbacks,
                    onFilter: cfg.filterable ? () => setFilterPanelOpen(true) : undefined,
                    onGroupBy: cfg.groupable
                      ? (field) => {
                          handleGroupConfigsChange([{ id: "group-default", field: field as GroupConfig["field"], order: "custom", hideEmpty: false }]);
                        }
                      : undefined,
                    onAddColumn: () => setShowCustomFieldModal(true),
                    // Real reorder now (col-02): swap in columnOrder.
                    onMoveLeft: () =>
                      idx === 0
                        ? toast("Already the first column")
                        : moveBuiltinColumn(colId, -1),
                    onMoveRight: () =>
                      isLast
                        ? toast("Already the last column")
                        : moveBuiltinColumn(colId, 1),
                    onHideColumn: () => {
                      toggleColumnVisibility(colId);
                      toast.success("Column hidden");
                    },
                    onOpenCustomField: () => setShowCustomFieldModal(true),
                  }}
                />
                {/* Right-edge handle on the last built-in resizes it alone. */}
                {isLast && (
                  <div
                    onMouseDown={(e) => handleResizeStart(e, colId, null)}
                    onDoubleClick={handleResizeReset}
                    className="absolute right-0 top-0 bottom-0 w-[6px] -mr-[3px] cursor-col-resize z-30"
                  />
                )}
              </div>
            );
          })}

          {/* Dynamic custom columns — use the same ColumnHeader
              dropdown the built-in columns use, so every column gets
              the full Asana-parity menu (Edit / Sort / Filter / Group
              / Add / Move / Hide / Delete). The X-button hover we had
              before only offered "remove" — Juan flagged that all
              column headers should have the same dropdown like Asana. */}
          {customColumns.map((col) => {
            const isBuiltin = !!col.builtin;
            return (
              <div
                key={col.id}
                // Width comes from the grid template; border comes from
                // the row's [&>*+*]:border-l. Wrapper only needs
                // `relative` (for the absolute resize handle) +
                // `flex items-center` for vertical centering.
                className="relative flex items-center gap-1 pl-2.5 pr-1"
              >
                {/* Resize handle — absolute overlay at the left edge,
                    same pattern as the built-in Due date/Collaborators
                    /etc handles. Dragging updates col.width directly
                    so the header + data row + Add task placeholder all
                    re-render at the new width together (they all read
                    from the same customColumns array). */}
                <div
                  onMouseDown={(e) => handleResizeCustomCol(e, col.id)}
                  className="absolute left-0 top-0 bottom-0 w-[6px] -ml-[3px] cursor-col-resize z-30"
                />
                <ColumnHeader
                  config={{
                    id: col.id,
                    label: col.name,
                    sortable: true,
                    filterable: !isBuiltin,
                    groupable: false,
                    width: "100%",
                    minWidth: "100%",
                    // isFirst:true suppresses ColumnHeader's internal
                    // `border-l border-gray-200 pl-2.5 pr-1`. The
                    // parent wrapper above already has the darker
                    // border-[#404244] — Juan flagged the doble línea
                    // (slate-200 + slate-400) before this fix.
                    isFirst: true,
                  }}
                  isDropdownOpen={openColumnDropdown === col.id}
                  onDropdownToggle={() =>
                    setOpenColumnDropdown(
                      openColumnDropdown === col.id ? null : col.id
                    )
                  }
                  callbacks={{
                    // Sort by this pinned column. Built-ins use their
                    // builtin id (e.g. "priority", "start_date"); custom
                    // fields use the CustomFieldDefinition id (col.id).
                    // getFilteredSections dispatches on sortState.columnId.
                    onSortAsc: () =>
                      setSortStateUser({
                        field: "none",
                        direction: "asc",
                        columnId: col.builtin ?? col.id,
                      }),
                    onSortDesc: () =>
                      setSortStateUser({
                        field: "none",
                        direction: "desc",
                        columnId: col.builtin ?? col.id,
                      }),
                    onFilter: () => setFilterPanelOpen(true),
                    onAddColumn: () => setShowCustomFieldModal(true),
                    onMoveLeft: () => {
                      setCustomColumns((prev) => {
                        const idx = prev.findIndex((c) => c.id === col.id);
                        if (idx <= 0) return prev;
                        const next = [...prev];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        return next;
                      });
                    },
                    onMoveRight: () => {
                      setCustomColumns((prev) => {
                        const idx = prev.findIndex((c) => c.id === col.id);
                        if (idx < 0 || idx >= prev.length - 1) return prev;
                        const next = [...prev];
                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                        return next;
                      });
                    },
                    // Hide = unpin from the list. For built-ins this
                    // is the only destructive action available (they
                    // live on the Task model, can't be deleted).
                    onHideColumn: () => {
                      setCustomColumns((prev) =>
                        prev.filter((c) => c.id !== col.id)
                      );
                      toast.success("Column hidden");
                    },
                    // Edit field — opens the CustomFieldModal in edit
                    // mode for custom fields. Built-ins route to the
                    // task detail panel where the source field lives.
                    onEditField: isBuiltin
                      ? undefined
                      : () => {
                          setShowCustomFieldModal(true);
                          toast(
                            "Editor will pre-load this field in the next pass."
                          );
                        },
                    // Delete field — RED bottom action. Custom only.
                    // Opens the Asana-parity confirm dialog; actual
                    // removal happens after the user confirms inside
                    // the modal (see deleteFieldDialog JSX below).
                    onDeleteField: isBuiltin
                      ? undefined
                      : () => setDeleteFieldDialog({ col }),
                  }}
                />
              </div>
            );
          })}

          {/* Add column (+) button — width comes from the trailing
              "32px" in the grid template (matches the data row's
              spacer). Border comes from the row's [&>*+*]:border-l. */}
          <div className="flex items-center justify-center">
            <AddColumnDropdown
              activeBuiltinIds={customColumns
                .map((c) => c.builtin)
                .filter((b): b is string => !!b)}
              onSelectType={(ft: FieldTypeConfig, name: string) => {
                // Asana parity: picking "Time tracking" in Asana skips
                // the config modal entirely and auto-adds a compound
                // pair of columns (estimated + actual). Mirror that —
                // pin both cosmetic columns so the user can see them
                // immediately. Full DB persistence (creating real
                // CustomFieldDefinitions) ships when the user attaches
                // them to a project in the next pass.
                if (ft.id === "time_tracking") {
                  setCustomColumns((prev) => {
                    const next = [...prev];
                    if (!next.some((c) => c.id === "tt-estimated")) {
                      next.push({
                        id: "tt-estimated",
                        name: "Estimated time",
                        type: "TIME_TRACKING",
                        color: "#404244",
                        width: 120,
                      });
                    }
                    if (!next.some((c) => c.id === "tt-actual")) {
                      next.push({
                        id: "tt-actual",
                        name: "Actual time",
                        type: "TIME_TRACKING",
                        color: "#404244",
                        width: 120,
                      });
                    }
                    return next;
                  });
                  toast.success("Time tracking columns added");
                  return;
                }
                setPreselectedFieldType(ft.id);
                setPreselectedFieldName(name);
                setInitialTab("create");
                setShowCustomFieldModal(true);
              }}
              onSelectBuiltin={(b) => {
                // Built-in columns skip the CustomFieldModal entirely
                // (no schema row needed — they read existing Task
                // fields). Just append to customColumns with the
                // discriminator and Asana surfaces the new column on
                // the next render. Dedupe defensively in case the
                // dropdown's `activeBuiltinIds` check missed.
                setCustomColumns((prev) => {
                  if (prev.some((c) => c.builtin === b.id)) return prev;
                  return [
                    ...prev,
                    {
                      id: `builtin-${b.id}`,
                      name: b.label,
                      type: "__BUILTIN__",
                      color: "#6f7782",
                      builtin: b.id,
                      width: b.defaultWidth,
                    },
                  ];
                });
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
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <p className="text-sm text-gray-700">{error}</p>
              <button
                type="button"
                onClick={() => fetchTasks()}
                className="mt-3 inline-flex items-center h-8 px-3 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md"
              >
                Retry
              </button>
            </div>
          ) : view === "list" ? (
            <>
            <ListDndProvider
              sections={filteredSections}
              onToggleSection={toggleSection}
              onToggleComplete={handleToggleComplete}
              onTaskClick={openTaskDetail}
              onAddTask={handleAddTask}
              formatDueDate={formatDueDate}
              customColumnCount={customColumns.length}
              customColumns={customColumns}
              hiddenColumns={hiddenColumns}
              builtinOrder={columnOrder}
              rowGridTemplate={rowGridTemplate}
              // Section rename/delete/reorder are only meaningful under
              // the personal-"sections" grouping.
              manageSections={groupType === "sections"}
              defaultSectionIds={DEFAULT_SECTION_ID_SET}
              onRenameSection={handleRenameSection}
              onDeleteSection={handleDeleteSection}
              onReorderSections={handleReorderSections}
              onReorderTasks={async (sectionId, orderedTaskIds) => {
                // Optimistic: re-number positions on the in-memory
                // tasks so the next re-render keeps the dragged order.
                // Spacing of 1000 leaves room for future inserts
                // between any two adjacent items without renumbering.
                const positionMap = new Map<string, number>();
                orderedTaskIds.forEach((id, idx) =>
                  positionMap.set(id, idx * 1000)
                );
                const updatedTasks = tasks.map((t) =>
                  positionMap.has(t.id)
                    ? { ...t, position: positionMap.get(t.id)! }
                    : t
                );
                setTasks(updatedTasks);
                organizeTasks(updatedTasks, groupType);
                try {
                  // Persist via parallel per-task PATCH. Cheap for
                  // typical section sizes; if this grows we'll add a
                  // batch /api/tasks/reorder endpoint.
                  await Promise.all(
                    orderedTaskIds.map((id, idx) =>
                      fetch(`/api/tasks/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ position: idx * 1000 }),
                      })
                    )
                  );
                  fetchTasks(true);
                } catch (err) {
                  console.error("Reorder error:", err);
                  toast.error("Couldn't save the new order");
                  fetchTasks(true);
                }
                void sectionId;
              }}
              onMoveTask={handleMoveTaskToSection}
            />
            <div>
              {/* Add section button — naturally clean (no per-cell
                  borders so no vertical lines). */}
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
            </>
          ) : view === "board" ? (
            <BoardView
              // Board is ALWAYS the personal sections (Asana behavior),
              // independent of the List view's active groupType. Columns
              // come from the personal-section bucketing, and a move
              // always relocates the task between personal sections —
              // never a project/priority/assignee PATCH.
              sections={personalSectionsForBoard}
              onToggleComplete={handleToggleComplete}
              onTaskClick={openTaskDetail}
              onAddTask={handleAddTask}
              onMoveTask={moveTaskToPersonalSection}
              onAddSection={(name) => {
                // Persist to uiState.myTasks.sections so the column
                // survives reload + follows the user across devices.
                // Name comes from BoardView's inline input (no prompt()).
                createPersonalSection(name);
              }}
              onReorderTasks={async (sectionId, orderedTaskIds) => {
                // Same persistence pattern List view uses — re-number
                // positions for every task in the section, parallel
                // PATCHes. Server respects orderBy position so the
                // new order survives refetch + reloads.
                const positionMap = new Map<string, number>();
                orderedTaskIds.forEach((id, idx) =>
                  positionMap.set(id, idx * 1000)
                );
                const updatedTasks = tasks.map((t) =>
                  positionMap.has(t.id)
                    ? { ...t, position: positionMap.get(t.id)! }
                    : t
                );
                setTasks(updatedTasks);
                organizeTasks(updatedTasks, groupType);
                try {
                  await Promise.all(
                    orderedTaskIds.map((id, idx) =>
                      fetch(`/api/tasks/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ position: idx * 1000 }),
                      })
                    )
                  );
                  fetchTasks(true);
                } catch (err) {
                  console.error("Board reorder error:", err);
                  toast.error("Couldn't save the new order");
                  fetchTasks(true);
                }
                void sectionId;
              }}
              formatDueDate={formatDueDate}
            />
          ) : view === "calendar" ? (
            <CalendarView
              // Same task universe regardless of the List grouping —
              // derive from personal sections + the shared filter overlay
              // so the calendar never inherits a project/priority bucketing.
              tasks={personalSectionsForBoard.flatMap((s) => s.tasks)}
              onTaskCreated={() => fetchTasks(true)}
              onTaskClick={openTaskDetail}
              zoom={calendarZoom}
              onZoomChange={setCalendarZoom}
            />
          ) : view === "dashboard" ? (
            <DashboardView
              // Dashboard mirrors My Tasks personal sections (its
              // "tasks by section" chart), not the List's transient
              // grouping — same source of truth as Board/Calendar.
              tasks={personalSectionsForBoard.flatMap((s) => s.tasks)}
              sections={personalSectionsForBoard}
              activeFilterCount={
                quickFilters.length +
                activeFilters.length +
                (searchQuery.trim() ? 1 : 0)
              }
              widgets={dashboardWidgets}
              onToggleWidget={(id) =>
                setDashboardWidgets((prev) =>
                  prev.includes(id)
                    ? prev.filter((w) => w !== id)
                    : [...prev, id]
                )
              }
              onDrillDown={(target) => {
                // dsh-02: apply the matching filter through the same
                // user-setters the toolbar uses (so persistence + the
                // user-adjusted guard behave identically), then jump to
                // the List view.
                if (target === "completed") {
                  setQuickFiltersUser(["completed"]);
                  setActiveFiltersUser([]);
                } else if (target === "incomplete") {
                  setQuickFiltersUser(["incomplete"]);
                  setActiveFiltersUser([]);
                } else if (target === "overdue") {
                  // Overdue has no quick-filter key — express it as a
                  // builder filter (due_date is_within overdue). The
                  // filter path already excludes completed tasks for this
                  // value, matching the KPI count.
                  setQuickFiltersUser([]);
                  setActiveFiltersUser([
                    {
                      id: `overdue-${Date.now()}`,
                      field: "due_date",
                      operator: "is_within",
                      value: "overdue",
                    },
                  ]);
                } else {
                  // "all" — clear filters to show the full list.
                  setQuickFiltersUser([]);
                  setActiveFiltersUser([]);
                }
                setView("list");
              }}
            />
          ) : (
            <FilesView
              refreshKey={attachmentsVersion}
              onTaskClick={(taskId) => {
                const t = tasks.find((tk) => tk.id === taskId);
                if (t) openTaskDetail(t);
              }}
            />
          )}
          </div>
        </div>

        {/* Workflow Panel */}
        <WorkflowPanel
          open={workflowPanelOpen}
          onClose={() => setWorkflowPanelOpen(false)}
        />

        {/* Options Drawer */}
        <OptionsDrawer
          open={optionsDrawerOpen}
          onClose={() => setOptionsDrawerOpen(false)}
          viewIcon={viewIcon}
          onViewIconChange={setViewIcon}
          viewName={viewName}
          onViewNameChange={setViewName}
          hiddenColumns={hiddenColumns}
          onToggleColumn={toggleColumnVisibility}
          activeFilters={activeFilters}
          onActiveFiltersChange={setActiveFiltersUser}
          sort={sortState}
          onSortChange={setSortStateUser}
          groups={groupConfigs}
          onGroupsChange={handleGroupConfigsChange}
        />
      </div>

      {/* Task Detail Panel — lifted out of the list container so it
          extends full-page-height (covers the right side of the title
          row + tabs + toolbar) like Asana, instead of starting below
          the toolbar. Positions against the outer wrapper's `relative`. */}
      {taskPanelOpen && selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setTaskPanelOpen(false)}
          onUpdate={() => fetchTasks(true)}
          onAttachmentsChange={() => setAttachmentsVersion((v) => v + 1)}
          formatDueDate={formatDueDate}
          // Personal-section dropdown (Asana parity: sits by Assignee).
          personalSections={personalSections}
          currentSectionId={
            taskSectionMap[selectedTask.id] ??
            (selectedTask.myTaskSection
              ? ENUM_TO_SECTION_ID[selectedTask.myTaskSection]
              : null) ??
            personalSections[0]?.id ??
            "recently-assigned"
          }
          onMoveToSection={(sectionId) =>
            moveTaskToPersonalSection(selectedTask.id, sectionId)
          }
        />
      )}

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
        onQuickFiltersChange={setQuickFiltersUser}
        completedWindow={completedWindow}
        onCompletedWindowChange={setCompletedWindowUser}
        activeFilters={activeFilters}
        onActiveFiltersChange={setActiveFiltersUser}
      />

      {/* Sort Panel (floating) */}
      <SortPanel
        open={sortPanelOpen}
        onClose={() => setSortPanelOpen(false)}
        anchorRef={sortButtonRef}
        sort={sortState}
        onSortChange={setSortStateUser}
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
          // Assignees: apply the entered names as an assignee-name
          // filter (empty array clears it).
          setAssigneeNameFiltersUser(criteria.assignees ?? []);
          if (criteria.status === "incomplete") {
            setActiveFiltersUser((prev) => [
              ...prev.filter((f) => f.field !== "completion"),
              { id: `filter-${Date.now()}`, field: "completion", operator: "is", value: "incomplete" },
            ]);
          } else if (criteria.status === "complete") {
            setActiveFiltersUser((prev) => [
              ...prev.filter((f) => f.field !== "completion"),
              { id: `filter-${Date.now()}`, field: "completion", operator: "is", value: "complete" },
            ]);
          }
          if (criteria.dueDate !== "any") {
            const dueDateMap: Record<string, string> = {
              today: "today",
              this_week: "this_week",
              next_week: "next_week",
              overdue: "overdue",
              no_date: "",
            };
            if (criteria.dueDate === "no_date") {
              setActiveFiltersUser((prev) => [
                ...prev.filter((f) => f.field !== "due_date"),
                { id: `filter-${Date.now()}`, field: "due_date", operator: "is_not_set", value: "" },
              ]);
            } else {
              setActiveFiltersUser((prev) => [
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

      {/* Delete field confirmation — Asana-parity modal. Opens when the
          user picks "Delete field" on a custom column header dropdown.
          Title quotes the field name; body explains the consequence
          (existing values kept, editing disabled, rules break);
          destructive action is red. */}
      <Dialog
        open={!!deleteFieldDialog.col}
        onOpenChange={(open) => {
          if (!open) setDeleteFieldDialog({ col: null });
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-gray-900">
              {deleteFieldDialog.col
                ? `Delete the ${deleteFieldDialog.col.name} field from My tasks?`
                : ""}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-600 leading-relaxed pt-2">
              This will remove the field from My tasks. Existing values on
              tasks will be kept, but won&apos;t be editable. Rules or
              automations using this field will stop working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <button
              onClick={() => setDeleteFieldDialog({ col: null })}
              className="px-4 py-2 text-[13px] font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const col = deleteFieldDialog.col;
                if (!col) return;
                setCustomColumns((prev) =>
                  prev.filter((c) => c.id !== col.id)
                );
                toast.success(`Field "${col.name}" deleted`);
                setDeleteFieldDialog({ col: null });
              }}
              className="px-4 py-2 text-[13px] font-medium text-white bg-[#d1485a] hover:bg-[#b93b4c] rounded-md transition-colors"
            >
              {deleteFieldDialog.col
                ? `Delete ${deleteFieldDialog.col.name}`
                : "Delete"}
            </button>
          </DialogFooter>
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
  customColumns = [],
  hiddenColumns = new Set(),
  builtinOrder = CANONICAL_COLUMN_ORDER as unknown as string[],
  rowGridTemplate,
  manageable = false,
  isDefaultSection = false,
  onRenameSection,
  onDeleteSection,
}: {
  section: SmartSection;
  onToggleSection: () => void;
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (name: string, sectionId: string, taskType?: "TASK" | "MILESTONE" | "APPROVAL") => Promise<boolean>;
  formatDueDate: (date: string | null) => { text: string; className: string };
  customColumnCount?: number;
  customColumns?: ListColumn[];
  hiddenColumns?: Set<string>;
  /** Order of the 4 built-in columns (col-02). */
  builtinOrder?: string[];
  /** CSS grid template the TaskRow uses — same value passed to the
   *  header so every row aligns to the same column tracks. */
  rowGridTemplate?: string;
  /** True only under the "sections" grouping — enables the hover "…"
   *  menu (Rename / Delete) + drag-to-reorder handle on the header. */
  manageable?: boolean;
  /** One of the 4 Asana defaults — rename allowed, delete blocked. */
  isDefaultSection?: boolean;
  onRenameSection?: (sectionId: string, name: string) => void;
  onDeleteSection?: (sectionId: string) => void;
}) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // Section-header management (rename inline / delete) + reorder handle.
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(section.name);
  const [showSectionMenu, setShowSectionMenu] = useState(false);
  const sectionMenuBtnRef = useRef<HTMLButtonElement>(null);
  const sectionMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close the section "…" menu on outside click.
  useEffect(() => {
    if (!showSectionMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        sectionMenuRef.current && !sectionMenuRef.current.contains(e.target as Node) &&
        sectionMenuBtnRef.current && !sectionMenuBtnRef.current.contains(e.target as Node)
      ) {
        setShowSectionMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSectionMenu]);

  // Focus + select the rename input when it opens.
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(section.name);
      requestAnimationFrame(() => renameInputRef.current?.select());
    }
  }, [isRenaming, section.name]);

  // Make the section header a sortable item so it can be dragged to
  // reorder (only wired when `manageable`). Uses a distinct id namespace
  // ("section:<id>") so the parent DndContext can tell a section drag
  // from a task-row drag in its handlers.
  const sortableId = `section:${section.id}`;
  const {
    attributes: sectionDragAttributes,
    listeners: sectionDragListeners,
    setNodeRef: setSectionSortableRef,
    transform: sectionTransform,
    transition: sectionTransition,
    isDragging: sectionIsDragging,
  } = useSortable({ id: sortableId, disabled: !manageable });
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

  // Droppable target for the whole section so dragging a task into
  // an empty section still has somewhere to land.
  const { setNodeRef: setSectionDroppableRef, isOver } = useDroppable({
    id: section.id,
  });

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== section.name) {
      onRenameSection?.(section.id, trimmed);
    }
    setIsRenaming(false);
  };

  return (
    <div
      // Sortable ref carries the section-reorder transform; the droppable
      // ref (nested) keeps task-into-section drops working. Both refs are
      // needed, so compose them onto adjacent elements.
      ref={setSectionSortableRef}
      style={{
        transform: CSS.Transform.toString(sectionTransform),
        transition: sectionTransition,
      }}
      className={cn(sectionIsDragging && "relative z-10 opacity-90")}
    >
    <div
      ref={setSectionDroppableRef}
      className={cn(
        "transition-colors",
        isOver && "bg-[#c9a84c]/5"
      )}
    >
      {/* Section header — uses the SAME grid template as TaskRow so
          vertical column dividers continue through it uninterrupted
          (Juan's "unified grid" rule, May 2026). Combined first cell
          holds the chevron + section name + count; remaining cells
          are empty grid items that exist only so the grid generates
          their column tracks (and therefore the verticals).
          Wrapped in a group so the drag handle + "…" menu fade in on
          hover without disturbing the grid track alignment. */}
      <div className="group relative">
        <button
          onClick={onToggleSection}
          className="tt-grid-divider-row hidden md:grid items-center px-4 md:px-6 w-full text-left hover:bg-[var(--surface-hover)]"
          style={{ height: "var(--row-h)", gridTemplateColumns: rowGridTemplate }}
        >
          {/* Combined first cell — chevron + section name + count.
              Mirrors the data row's combined Grip + Checkbox + Task
              name slot so the chevron lines up with the row checkbox. */}
          <div className="flex items-center min-w-0">
            <div className="w-4 -ml-1 mr-1 flex-shrink-0" aria-hidden="true" />
            <div className="w-8 flex-shrink-0 flex items-center">
              {section.collapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </div>
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                  if (e.key === "Escape") { e.preventDefault(); setIsRenaming(false); }
                }}
                onBlur={commitRename}
                className="text-[13px] font-semibold text-gray-900 bg-white border border-[#c9a84c] rounded px-1 py-0 outline-none min-w-0"
                autoFocus
              />
            ) : (
              <span className="text-[13px] font-semibold text-gray-900 truncate">{section.name}</span>
            )}
            {!isRenaming && section.tasks.length > 0 && (
              <span className="text-gray-400 text-[11px] ml-2 flex-shrink-0">{section.tasks.length}</span>
            )}
          </div>
          {/* Empty grid cells — one per visible column. They exist
              ONLY so the grid renders their tracks and the verticals
              from tt-grid-divider-row > * + * are drawn through this
              row, matching the data rows above/below. */}
          {!hiddenColumns.has("dueDate") && <div />}
          {!hiddenColumns.has("collaborators") && <div />}
          {!hiddenColumns.has("projects") && <div />}
          {!hiddenColumns.has("visibility") && <div />}
          {(customColumns.length > 0
            ? customColumns
            : Array.from({ length: customColumnCount }, (_, i) => ({ id: `phc-${i}` } as { id: string })))
            .map((col, i) => (
              <div key={(col as { id?: string }).id ?? `phc-${i}`} />
            ))}
          {/* + spacer cell to match the 32px tail in rowGridTemplate */}
          <div />
        </button>

        {/* Manage affordances (sections grouping only): drag handle on
            the far left, "…" menu on the right. Absolutely positioned so
            they don't add grid tracks that would break divider alignment. */}
        {manageable && !isRenaming && (
          <>
            <button
              type="button"
              aria-label="Reorder section"
              {...sectionDragAttributes}
              {...sectionDragListeners}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-1 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-4 h-6 cursor-grab text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:block">
              <button
                ref={sectionMenuBtnRef}
                type="button"
                aria-label="Section options"
                onClick={(e) => { e.stopPropagation(); setShowSectionMenu((v) => !v); }}
                className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showSectionMenu && (
                <div
                  ref={sectionMenuRef}
                  className="absolute right-0 top-[calc(100%+4px)] bg-white rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 py-1 z-50 min-w-[160px]"
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowSectionMenu(false); setIsRenaming(true); }}
                    className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-gray-700 hover:bg-black/[0.04] cursor-pointer text-left"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    Rename section
                  </button>
                  {!isDefaultSection && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowSectionMenu(false); onDeleteSection?.(section.id); }}
                      className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-[#b3261e] hover:bg-black/[0.04] cursor-pointer text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete section
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tasks */}
      {!section.collapsed && (
        <SortableContext
          id={section.id}
          items={section.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* Inline input row — appears at TOP of section (Asana behavior).
              Uses the same grid template as TaskRow so verticals continue
              through it. Empty cells exist purely as grid tracks. */}
          {isAddingTask && (
            <div
              className="tt-grid-divider-row hidden md:grid items-center px-4 md:px-6 bg-[#c9a84c]/5"
              style={{ height: "var(--row-h)", gridTemplateColumns: rowGridTemplate }}
            >
              {/* Combined first cell — spacer + type icon + input */}
              <div className="flex items-center min-w-0">
                <div className="w-4 -ml-1 mr-1 flex-shrink-0" aria-hidden="true" />
                <div className="w-8 flex-shrink-0 flex items-center">
                  {activeTaskType === "MILESTONE" ? (
                    <Diamond className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                  ) : activeTaskType === "APPROVAL" ? (
                    <ThumbsUp className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  placeholder={activeTaskType === "MILESTONE" ? "Type the milestone name" : activeTaskType === "APPROVAL" ? "Type the approval name" : "Type the task name"}
                  className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-gray-900 placeholder:text-gray-400"
                  autoFocus
                  disabled={isCreating}
                />
              </div>
              {/* Empty grid cells — same shape as TaskRow + section header */}
              {!hiddenColumns.has("dueDate") && <div />}
              {!hiddenColumns.has("collaborators") && <div />}
              {!hiddenColumns.has("projects") && <div />}
              {!hiddenColumns.has("visibility") && <div />}
              {(customColumns.length > 0
                ? customColumns
                : Array.from({ length: customColumnCount }, (_, i) => ({ id: `phc-${i}` } as { id: string })))
                .map((col, i) => (
                  <div key={(col as { id?: string }).id ?? `phc-${i}`} />
                ))}
              {/* + spacer with spinner */}
              <div className="flex items-center justify-center">
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
              customColumns={customColumns}
              hiddenColumns={hiddenColumns}
              builtinOrder={builtinOrder}
              rowGridTemplate={rowGridTemplate}
            />
          ))}

          {/* "+ Add task" trigger row — uses unified grid so verticals
              continue uninterrupted into the next section. */}
          {!isAddingTask && (
            <button
              onClick={() => { setActiveTaskType("TASK"); setIsAddingTask(true); }}
              className="tt-grid-divider-row hidden md:grid items-center px-4 md:px-6 w-full text-left hover:bg-[var(--surface-hover)] transition-colors"
              style={{ height: "var(--row-h)", gridTemplateColumns: rowGridTemplate }}
            >
              {/* Combined first cell — Plus icon + "Add task" label */}
              <div className="flex items-center min-w-0">
                <div className="w-4 -ml-1 mr-1 flex-shrink-0" aria-hidden="true" />
                <div className="w-8 flex-shrink-0 flex items-center">
                  <Plus className="w-3.5 h-3.5 text-gray-300" />
                </div>
                <span className="text-[13px] text-gray-400 truncate">Add task</span>
              </div>
              {/* Empty grid cells — same shape as TaskRow + section header */}
              {!hiddenColumns.has("dueDate") && <div />}
              {!hiddenColumns.has("collaborators") && <div />}
              {!hiddenColumns.has("projects") && <div />}
              {!hiddenColumns.has("visibility") && <div />}
              {(customColumns.length > 0
                ? customColumns
                : Array.from({ length: customColumnCount }, (_, i) => ({ id: `phc-${i}` } as { id: string })))
                .map((col, i) => (
                  <div key={(col as { id?: string }).id ?? `phc-${i}`} />
                ))}
              {/* + spacer cell */}
              <div />
            </button>
          )}
        </SortableContext>
      )}
    </div>
    </div>
  );
}

/**
 * Drag-and-drop wrapper for the List view.
 *
 * dnd-kit doesn't visually move a sortable item across containers
 * for you — it just reports drag events. If a drop ends inside the
 * same SortableContext the item started in, dnd-kit's CSS transform
 * is reverted, which looks exactly like the item snapping back to
 * its original position.
 *
 * The trick (same one Board uses internally) is to maintain a local
 * copy of the sections + tasks and mutate it during onDragOver so
 * the item already lives in the destination container by the time
 * the drop fires. Then dnd-kit happily commits the drop and the
 * parent's onMoveTask persists to the server.
 */
function ListDndProvider({
  sections,
  onMoveTask,
  onReorderTasks,
  onToggleSection,
  onToggleComplete,
  onTaskClick,
  onAddTask,
  formatDueDate,
  customColumnCount,
  customColumns,
  hiddenColumns,
  builtinOrder,
  rowGridTemplate,
  manageSections = false,
  defaultSectionIds,
  onRenameSection,
  onDeleteSection,
  onReorderSections,
}: {
  sections: SmartSection[];
  onMoveTask: (taskId: string, destSectionId: string) => Promise<void> | void;
  /** Persist a new in-section order. The orderedTaskIds is the full
   *  task id list for the section in its new sequence. */
  onReorderTasks: (
    sectionId: string,
    orderedTaskIds: string[]
  ) => Promise<void> | void;
  onToggleSection: (sectionId: string) => void;
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (
    name: string,
    sectionId: string,
    taskType?: "TASK" | "MILESTONE" | "APPROVAL"
  ) => Promise<boolean>;
  formatDueDate: (date: string | null) => { text: string; className: string };
  customColumnCount: number;
  customColumns?: ListColumn[];
  hiddenColumns?: Set<string>;
  /** Order of the 4 built-in columns (col-02) — forwarded to every row
   *  so the data cells render in the same order as the header/grid. */
  builtinOrder?: string[];
  /** CSS grid template the TaskSection forwards to each TaskRow so
   *  every data row uses the same column tracks as the header. */
  rowGridTemplate?: string;
  /** True under the "sections" grouping — enables section rename/delete
   *  menus + drag-to-reorder handles on section headers. */
  manageSections?: boolean;
  /** Ids of the 4 Asana defaults (rename allowed, delete blocked). */
  defaultSectionIds?: Set<string>;
  onRenameSection?: (sectionId: string, name: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  /** Persist a reordered section sequence (section ids in new order). */
  onReorderSections?: (orderedSectionIds: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Local mirror of the section/task structure. Updated during drag
  // so the item visually lands in its destination container while
  // the user is still dragging. Synced back from the parent's
  // `sections` prop whenever the parent re-renders.
  const [localSections, setLocalSections] = useState<SmartSection[]>(sections);
  // The task being dragged — drives the DragOverlay ghost so dnd-kit
  // can move it cleanly between SortableContexts without the actual
  // TaskRow node having to translate.
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  // True while a SECTION header (id "section:<id>") is being dragged, so
  // the task-move handlers stay out of the way and we reorder sections.
  const draggingSectionRef = useRef(false);

  useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  // Pattern matches BoardView exactly: read localSections from
  // closure with [localSections] in deps, so the callback is
  // recreated whenever the dragOver-driven state changes. This way
  // handleDragEnd sees the latest container assignments.
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      // Section-reorder drag — don't set an activeTask (no row ghost).
      if (id.startsWith("section:")) {
        draggingSectionRef.current = true;
        return;
      }
      draggingSectionRef.current = false;
      for (const s of localSections) {
        const task = s.tasks.find((t) => t.id === id);
        if (task) {
          setActiveTask(task);
          dragSourceRef.current = s.id;
          break;
        }
      }
    },
    [localSections]
  );

  /**
   * Handles BOTH cross-section moves AND intra-section reorders
   * during the live drag. Cross-section: pull the task from source,
   * insert at the target row's index in destination. Intra-section:
   * arrayMove within the same section so the gap follows the cursor.
   */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // Section-reorder drag: arrayMove the sections themselves so the
    // headers reflow live under the cursor. The active id is always
    // "section:<id>"; the over id may be another header sortable
    // ("section:<id>"), a section droppable (bare "<id>"), or a task row
    // inside a section — resolve all three to the destination section.
    if (activeId.startsWith("section:")) {
      const srcId = activeId.slice("section:".length);
      setLocalSections((prev) => {
        const dstId = resolveSectionIdFromOver(prev, overId);
        if (!dstId) return prev;
        const oldIdx = prev.findIndex((s) => s.id === srcId);
        const newIdx = prev.findIndex((s) => s.id === dstId);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
      return;
    }

    // A task dragged over a SECTION HEADER resolves to that header's
    // sortable id ("section:<id>"); normalize it to the bare section id
    // so the destination lookup below still finds the section.
    const overSectionId = overId.startsWith("section:")
      ? overId.slice("section:".length)
      : overId;

    setLocalSections((prev) => {
      const srcSection = prev.find((s) =>
        s.tasks.some((t) => t.id === activeId)
      );
      if (!srcSection) return prev;

      let destSection = prev.find((s) => s.id === overSectionId);
      if (!destSection) {
        destSection = prev.find((s) => s.tasks.some((t) => t.id === overSectionId));
      }
      if (!destSection) return prev;

      // Same-section reorder: move the active task to the index of
      // the over-task. arrayMove keeps the rest in order and lets
      // useSortable animate the shift via its transform/transition.
      if (srcSection.id === destSection.id) {
        const oldIdx = srcSection.tasks.findIndex((t) => t.id === activeId);
        const newIdx = srcSection.tasks.findIndex((t) => t.id === overId);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev;
        return prev.map((s) =>
          s.id === srcSection.id
            ? { ...s, tasks: arrayMove(s.tasks, oldIdx, newIdx) }
            : s
        );
      }

      const task = srcSection.tasks.find((t) => t.id === activeId);
      if (!task) return prev;

      return prev.map((s) => {
        if (s.id === srcSection.id) {
          return { ...s, tasks: s.tasks.filter((t) => t.id !== activeId) };
        }
        if (s.id === destSection!.id) {
          const idx = s.tasks.findIndex((t) => t.id === overId);
          const next = [...s.tasks];
          if (idx >= 0) next.splice(idx, 0, task);
          else next.push(task);
          return { ...s, tasks: next };
        }
        return s;
      });
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const src = dragSourceRef.current;
      const wasSectionDrag = draggingSectionRef.current;
      setActiveTask(null);
      dragSourceRef.current = null;
      draggingSectionRef.current = false;

      // Section-reorder drag: persist the new section order. localSections
      // already reflects the live arrayMove from handleDragOver.
      if (wasSectionDrag) {
        onReorderSections?.(localSections.map((s) => s.id));
        return;
      }

      if (!over) return;

      const activeId = String(active.id);
      const rawOverId = String(over.id);
      // A drop onto a section header resolves to "section:<id>" — strip
      // the prefix so the destination lookup matches the bare section id.
      const overId = rawOverId.startsWith("section:")
        ? rawOverId.slice("section:".length)
        : rawOverId;

      // Resolve destination from CLOSURE localSections — recreated
      // by useCallback when localSections changes, so by the time
      // handleDragEnd fires it has the post-dragOver state.
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

      if (!destSectionId || !src) return;

      if (src === destSectionId) {
        // Same-section reorder: persist new order.
        if (activeId === overId) return; // dropped on itself, no change
        const section = localSections.find((s) => s.id === destSectionId);
        if (!section) return;
        const orderedIds = section.tasks.map((t) => t.id);
        await onReorderTasks(destSectionId, orderedIds);
        return;
      }

      // Cross-section move: persist the section change, THEN
      // renumber positions in the destination so the moved row
      // lands at its drop index — not stuck at its source-section
      // position value, which could be 0 (top) or some other stale
      // number that puts the row in the wrong slot.
      await onMoveTask(activeId, destSectionId);
      const destSection = localSections.find((s) => s.id === destSectionId);
      if (destSection) {
        const orderedIds = destSection.tasks.map((t) => t.id);
        await onReorderTasks(destSectionId, orderedIds);
      }
    },
    [localSections, onMoveTask, onReorderTasks, onReorderSections]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      {/* Section headers are sortable so they can be dragged to reorder.
          The context is keyed by "section:<id>" ids so it never collides
          with the per-section task SortableContexts nested inside. */}
      <SortableContext
        items={localSections.map((s) => `section:${s.id}`)}
        strategy={verticalListSortingStrategy}
      >
      {localSections.map((section) => (
        <TaskSection
          key={section.id}
          section={section}
          onToggleSection={() => onToggleSection(section.id)}
          onToggleComplete={onToggleComplete}
          onTaskClick={onTaskClick}
          onAddTask={onAddTask}
          formatDueDate={formatDueDate}
          customColumnCount={customColumnCount}
          customColumns={customColumns}
          hiddenColumns={hiddenColumns}
          builtinOrder={builtinOrder}
          rowGridTemplate={rowGridTemplate}
          manageable={manageSections}
          isDefaultSection={defaultSectionIds?.has(section.id) ?? false}
          onRenameSection={onRenameSection}
          onDeleteSection={onDeleteSection}
        />
      ))}
      </SortableContext>
      {/* DragOverlay — rendered via portal to document.body. The
          parent /my-tasks tree wraps everything in flex-1
          overflow-hidden containers, which would otherwise clip the
          ghost when the cursor moves off the visible area. The portal
          lifts the ghost out of that subtree so it tracks the cursor
          relative to the viewport (the pattern the official dnd-kit
          multi-container example uses). */}
      {typeof window !== "undefined" &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeTask && (
              <TaskRowOverlay
                task={activeTask}
                formatDueDate={formatDueDate}
              />
            )}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}

/**
 * Ghost rendering of a TaskRow that follows the cursor during drag.
 * Same visual language as the real row but with a strong shadow and
 * a tiny tilt so it reads as "in motion." Lives in DragOverlay's
 * portal so it's free of the source row's clipping container.
 */
function TaskRowOverlay({
  task,
  formatDueDate,
}: {
  task: Task;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const dueDateInfo = formatDueDate(task.dueDate);
  const checkboxEl =
    task.taskType === "MILESTONE" ? (
      <Diamond className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
    ) : task.taskType === "APPROVAL" ? (
      <ThumbsUp className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
    ) : (
      <div
        className={cn(
          "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0",
          task.completed
            ? "bg-[#c9a84c] border-[#c9a84c]"
            : "border-gray-300"
        )}
      >
        {task.completed && <Check className="w-3 h-3 text-white" />}
      </div>
    );

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xl rotate-[1deg] min-w-[420px] max-w-[640px] cursor-grabbing">
      {checkboxEl}
      <span
        className={cn(
          "text-[13px] truncate flex-1",
          task.completed ? "line-through text-gray-400" : "text-gray-900"
        )}
      >
        {task.name}
      </span>
      {dueDateInfo.text && (
        <span
          className={cn(
            "text-[11px] flex-shrink-0 ml-2",
            dueDateInfo.className
          )}
        >
          {dueDateInfo.text}
        </span>
      )}
      {task.assignee && (
        <Avatar className="h-5 w-5 flex-shrink-0 ml-1">
          <AvatarImage src={task.assignee.image || undefined} />
          <AvatarFallback className="text-[10px] bg-[#c9a84c] text-white">
            {task.assignee.name?.[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

// Task Row Component
// Inline-editable cell for the My-Tasks "Estimated time" / "Actual time"
// columns. Both columns write to the SAME Time-tracking custom field on
// the task (estimatedDays / actualDays), preserving the other side. For a
// task whose value doesn't exist yet, the field id is resolved lazily from
// the task's project on first edit.
function MyTasksTimeCell({
  task,
  side,
}: {
  task: Task;
  side: "estimated" | "actual";
}) {
  const ttv = task.customFieldValues?.find(
    (v) => v.field?.type === "TIME_TRACKING"
  );
  const parsed = readTimeTracking(ttv?.value);
  const current = side === "estimated" ? parsed.estimatedDays : parsed.actualDays;
  const other = side === "estimated" ? parsed.actualDays : parsed.estimatedDays;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current == null ? "" : String(current));
  const [optimistic, setOptimistic] = useState<number | null | undefined>(
    undefined
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOptimistic(undefined);
    setDraft(current == null ? "" : String(current));
  }, [current]);

  const shown = optimistic !== undefined ? optimistic : current;

  async function resolveFieldId(): Promise<string | null> {
    if (ttv?.fieldId) return ttv.fieldId;
    const pid = task.project?.id;
    if (!pid) return null;
    try {
      const res = await fetch(`/api/projects/${pid}/custom-fields`);
      if (!res.ok) return null;
      const defs: { id: string; type: string }[] = await res.json();
      return (
        (Array.isArray(defs)
          ? defs.find((d) => d.type === "TIME_TRACKING")
          : null
        )?.id ?? null
      );
    } catch {
      return null;
    }
  }

  async function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : parseDaysInput(trimmed);
    if (trimmed !== "" && next === null) {
      setDraft(shown == null ? "" : String(shown));
      return;
    }
    if (next === (shown ?? null)) return;
    setBusy(true);
    const fieldId = await resolveFieldId();
    if (!fieldId) {
      toast.error("This task's project has no time-tracking field");
      setBusy(false);
      setDraft(shown == null ? "" : String(shown));
      return;
    }
    const value =
      side === "estimated"
        ? { estimatedDays: next, actualDays: other }
        : { estimatedDays: other, actualDays: next };
    try {
      const res = await fetch(
        `/api/tasks/${task.id}/custom-fields/${fieldId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        }
      );
      if (!res.ok) throw new Error();
      setOptimistic(next);
    } catch {
      toast.error("Couldn't save time");
      setDraft(shown == null ? "" : String(shown));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            setDraft(shown == null ? "" : String(shown));
            setEditing(false);
          }
        }}
        placeholder="0"
        className="w-full bg-transparent outline-none text-[13px] text-slate-700 tabular-nums px-1 py-0.5 rounded focus:bg-slate-50"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(shown == null ? "" : String(shown));
        setEditing(true);
      }}
      className="w-full text-left text-[13px] text-slate-600 tabular-nums hover:bg-slate-50 rounded px-1 py-0.5"
      title="Enter days (e.g. 3, 0.5) — or 4h / 2w"
    >
      {busy ? (
        "…"
      ) : shown != null ? (
        formatDays(shown)
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </button>
  );
}

function TaskRow({
  task,
  onToggleComplete,
  onClick,
  formatDueDate,
  customColumnCount = 0,
  customColumns = [],
  hiddenColumns = new Set(),
  builtinOrder = CANONICAL_COLUMN_ORDER as unknown as string[],
  rowGridTemplate,
}: {
  task: Task;
  onToggleComplete: () => void;
  onClick: () => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
  customColumnCount?: number;
  customColumns?: ListColumn[];
  hiddenColumns?: Set<string>;
  /** Order of the 4 built-in columns (col-02). */
  builtinOrder?: string[];
  /** CSS grid-template-columns string computed once by the parent so
   *  every row + the sticky header all align to the SAME track widths.
   *  Required for the inherited [&>*+*]:border-l pattern to render
   *  borders at deterministic X positions across rows (the flex
   *  approach we used before had per-cell sub-pixel offsets that
   *  broke at DPR 1.25 / zoom !== 67%). */
  rowGridTemplate?: string;
}) {
  const dueDateInfo = formatDueDate(task.dueDate);

  // Inline rename — double-click the name to swap in an input, Enter
  // or blur commits via PATCH, Escape reverts. We use a local draft
  // state so the new name is visible immediately while the parent
  // refetches on its own cadence.
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(task.name);
  useEffect(() => {
    setNameDraft(task.name);
  }, [task.name]);
  async function commitRename() {
    const next = nameDraft.trim();
    setIsEditingName(false);
    if (!next || next === task.name) {
      setNameDraft(task.name);
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      toast.error("Couldn't rename task");
      setNameDraft(task.name);
    }
  }

  // Sortable wiring — drag handle lives on the row itself; pointer
  // events on the checkbox / name still work because dnd-kit only
  // activates a drag past the activation distance (6px in the
  // ListDndProvider).
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  // When this row is the actively-dragged one, hide the real row
  // entirely (the DragOverlay portal renders the ghost). Leaving even
  // partial opacity on the source caused two visible rows during the
  // drag — the floating ghost and the dimmed original — which read
  // as a "snap back" the moment the ghost faded out on drop.
  const dragStyle: React.CSSProperties = isDragging
    ? { opacity: 0, transition }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

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
                {task.project.type && (
                  <span
                    className="text-[8px] font-mono font-semibold uppercase tracking-wider px-1 py-px rounded bg-gray-100 text-gray-600 flex-shrink-0"
                    title={`Project type: ${task.project.type}`}
                  >
                    {projectTypeShort(task.project.type)}
                  </span>
                )}
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

      {/* ── Desktop Row ──
          dnd-kit listeners go on the whole row (same pattern Board
          uses on SortableBoardCard). The PointerSensor's 5px
          activation distance means a quick click still opens the
          slide-over while a real drag motion starts the sortable
          drag. Putting the listeners only on the (opacity-0) grip
          handle made the drag impossible to initiate: the SVG
          target was invisible until hover, and the browser's
          native text-selection beat dnd-kit to the pointerdown.
          The grip stays as a hover-only visual hint, but it no
          longer owns the drag — the row does. */}
      <div
        ref={setNodeRef}
        style={{
          ...dragStyle,
          height: "var(--row-h)",
          gridTemplateColumns: rowGridTemplate,
        }}
        {...attributes}
        {...listeners}
        onClick={onClick}
        // CSS Grid + Asana-exact border technique. Verified via
        // DevTools on app.asana.com/my-tasks (May 2026):
        //   Asana applies `border: 0.909091px solid rgb(64, 66, 68)`
        //   on every SpreadsheetCell — note the DARK color (#404244),
        //   almost black, not the slate-400 light gray we used
        //   before. The "secret" is that the color must be dark
        //   enough to survive the browser's sub-pixel anti-aliasing
        //   at HiDPI displays. Light grays (#94a3b8 etc.) get
        //   blended into the background at DPR 1.25 + zoom != 67%
        //   and become invisible. Dark grays render visibly even
        //   when the physical width is below 1px.
        //
        //   We use `border-l` (1px solid #404244) on every child
        //   except the first combined cell, plus a `border-b` on
        //   the row itself for horizontal dividers.
        className="tt-grid-divider-row hidden md:grid items-center px-4 md:px-6 hover:bg-[var(--surface-hover)] cursor-pointer group transition-colors select-none"
      >
        {/* COMBINED FIRST CELL: Grip + Checkbox + Task name + indicators.
            Internal flex layout (16 + 32 + flex-1) preserves the
            original visual; the wrapper itself is ONE grid child so the
            row's [&>*+*]:border-l only adds vertical dividers from
            Due date onward (not between Grip↔Checkbox↔Name). */}
        <div className="flex items-center min-w-0">
          {/* Drag hint — visible on hover. Pure decoration now: the
              whole row is draggable, the icon just shows the user the
              row CAN be dragged. */}
          <div
            className="w-4 -ml-1 mr-1 flex items-center justify-center flex-shrink-0 text-gray-300 opacity-0 group-hover:opacity-100"
            aria-hidden="true"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Checkbox */}
          <div className="w-8 flex-shrink-0 flex items-center">{checkboxEl}</div>

          {/* Task name + indicators. */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
          {isEditingName ? (
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setNameDraft(task.name);
                  setIsEditingName(false);
                }
              }}
              onBlur={commitRename}
              autoFocus
              className="flex-1 min-w-0 text-[13px] bg-transparent outline-none border-b-2 border-[#c9a84c] px-0.5 -my-0.5 text-gray-900"
            />
          ) : (
            <span
              className={cn(
                "text-[13px] truncate",
                task.completed ? "line-through text-gray-400" : "text-gray-900"
              )}
              onDoubleClick={(e) => {
                // Asana parity: double-click jumps into rename. Single
                // click stays as "open panel" via the row onClick.
                // stopPropagation prevents the row click + the dnd-kit
                // drag from firing on this gesture.
                e.stopPropagation();
                setIsEditingName(true);
              }}
            >
              {nameDraft}
            </span>
          )}
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
        </div>

      {/* Built-in column cells, rendered in the user's column order
       * (col-02). Border + width come from the row's CSS Grid template +
       * the inherited [&>*+*]:border-l class on the row parent — each
       * cell is just padding + content. The order here matches the header
       * + grid template because all three read from the same builtinOrder
       * / visibleBuiltinOrder derived from columnOrder. */}
      {builtinOrder
        .filter((colId) => !hiddenColumns.has(colId))
        .map((colId) => {
          if (colId === "dueDate") {
            return (
              <div key="dueDate" className="hidden md:flex pl-2.5 pr-1 overflow-hidden items-center">
                <span className={cn("text-[13px] truncate", dueDateInfo.className)}>
                  {formatDueColumnLabel(task.startDate, task.dueDate, dueDateInfo.text)}
                </span>
              </div>
            );
          }
          if (colId === "collaborators") {
            // Asana parity: shows COLLABORATORS, not the assignee. Up to 3
            // stacked avatars + a +N overflow.
            const collabs = task.collaborators ?? [];
            return (
              <div key="collaborators" className="hidden md:flex pl-2.5 pr-1 overflow-hidden items-center">
                {collabs.length > 0 && (
                  <div className="flex items-center">
                    <div className="flex -space-x-1.5">
                      {collabs.slice(0, 3).map((c) => (
                        <Avatar key={c.user.id} className="w-5 h-5 ring-1 ring-white">
                          <AvatarImage src={c.user.image || undefined} />
                          <AvatarFallback className="text-[10px] bg-gray-100 text-gray-600">
                            {c.user.name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {collabs.length > 3 && (
                      <span className="ml-1 text-[11px] text-gray-400">
                        +{collabs.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          }
          if (colId === "projects") {
            return (
              <div key="projects" className="hidden md:flex pl-2.5 pr-1 overflow-hidden items-center">
                {task.project && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: task.project.color }}
                    />
                    <span className="text-[13px] text-gray-600 truncate">
                      {task.project.name}
                    </span>
                    {task.project.type && (
                      <span
                        className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1 py-px rounded bg-gray-100 text-gray-600 flex-shrink-0"
                        title={`Project type: ${task.project.type}`}
                      >
                        {projectTypeShort(task.project.type)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          }
          if (colId === "visibility") {
            const isPrivate =
              !task.project || task.project.visibility === "PRIVATE";
            return (
              <div key="visibility" className="hidden md:flex pl-2.5 pr-1 overflow-hidden items-center">
                {isPrivate ? (
                  <span className="text-[13px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
                    <Lock className="w-3 h-3 flex-shrink-0" />
                    Only me
                  </span>
                ) : (
                  <span className="text-[13px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
                    <Globe className="w-3 h-3 flex-shrink-0" />
                    My workspace
                  </span>
                )}
              </div>
            );
          }
          return null;
        })}

      {/* Custom column cells — render real data for built-ins; for
          regular custom fields we still show a dash for now (Fase 2
          will fetch CustomFieldValue per task and render via
          CustomFieldCell). The column array is preferred when present;
          we keep `customColumnCount` as a fallback for callers that
          haven't been threaded yet. */}
      {(customColumns.length > 0
        ? customColumns
        : (Array.from({ length: customColumnCount }, (_, i) => ({
            id: `placeholder-${i}`,
            name: "",
            type: "",
            color: "",
            width: 110,
          })) as ListColumn[])
      ).map((col) => {
        // For non-builtin columns (real CustomFieldDefinition), look
        // up the value embedded on the task. The field definition
        // ships alongside so CustomFieldCell can render with the
        // correct type + options without an extra fetch.
        // Border + width come from the row's grid template + the
        // inherited [&>*+*]:border-l class.
        // My-Tasks "Estimated time" / "Actual time" columns are backed by
        // the task's real Time-tracking custom field (from whatever project
        // it lives in). Inline-editable: edits one side, preserves the other.
        if (col.id === "tt-estimated" || col.id === "tt-actual") {
          return (
            <div
              key={col.id}
              className="hidden md:flex items-center pl-2.5 pr-1 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <MyTasksTimeCell
                task={task}
                side={col.id === "tt-estimated" ? "estimated" : "actual"}
              />
            </div>
          );
        }
        const cfv = !col.builtin
          ? task.customFieldValues?.find((v) => v.fieldId === col.id)
          : undefined;
        // Legacy `cf-`-prefixed columns came from earlier cosmetic
        // testing and have no real CustomFieldDefinition behind them,
        // so their values can never persist — render an empty cell.
        const isLegacyCosmetic = !col.builtin && col.id.startsWith("cf-");
        // Field type + options: prefer the value's embedded definition
        // (present once a value exists), else fall back to what the
        // column itself carries (personal fields created this session).
        const fieldType = (cfv?.field.type ??
          col.type) as CustomFieldType;
        const fieldOptions =
          (cfv?.field.options as
            | { id: string; label: string; color?: string }[]
            | null
            | undefined) ??
          col.options ??
          null;
        return (
          <div
            key={col.id}
            className="hidden md:flex items-center pl-2.5 pr-1 overflow-hidden"
          >
            {col.builtin ? (
              <BuiltinFieldCell builtinId={col.builtin} task={task} />
            ) : isLegacyCosmetic ? null : (
              // Always render the editable cell for real personal /
              // project custom fields — even with no value yet — so the
              // user can fill an empty cell. It PATCHes the value route
              // and does its own optimistic update.
              <EditableCustomFieldCell
                taskId={task.id}
                fieldId={col.id}
                type={fieldType}
                options={fieldOptions}
                value={cfv?.value ?? null}
              />
            )}
          </div>
        );
      })}

      {/* Spacer for + button column — matches the AddColumnDropdown
          wrapper in the header. Width comes from the grid template
          ("32px" at the end of rowGridTemplate), border comes from the
          row container's [&>*+*]:border-l pattern. */}
      <div className="hidden md:block" />
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
  onReorderTasks,
  onAddSection,
  formatDueDate,
}: {
  sections: SmartSection[];
  onToggleComplete: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (name: string, sectionId: string) => Promise<boolean>;
  onMoveTask: (taskId: string, destSectionId: string) => Promise<void>;
  /** Persist a new in-section order. Same contract as List view. */
  onReorderTasks: (sectionId: string, orderedTaskIds: string[]) => Promise<void> | void;
  /** Create a persisted personal section from an inline-typed name. */
  onAddSection: (name: string) => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [localSections, setLocalSections] = useState(sections);
  const [addingInSection, setAddingInSection] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  // Inline "Add section" — mirrors the List view's isAddingSection input
  // instead of a blocking window.prompt(). Enter/blur commits, Escape cancels.
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const dragSourceSectionRef = useRef<string | null>(null);

  const commitAddSection = () => {
    const name = newSectionName.trim();
    if (name) onAddSection(name);
    setNewSectionName("");
    setIsAddingSection(false);
  };

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

    // Same column → persist new order. handleDragOver already
    // mutated localSections, so the current order in destSection
    // reflects what the user dropped.
    if (destSectionId === originalSourceId) {
      if (activeId !== overId) {
        const section = localSections.find((s) => s.id === destSectionId);
        if (section) {
          const orderedIds = section.tasks.map((t) => t.id);
          await onReorderTasks(destSectionId, orderedIds);
        }
      }
      return;
    }

    // Cross-column move: persist the section change, then renumber
    // positions in the destination column so the moved card lands
    // where the user dropped it (not at the default position=0).
    await onMoveTask(activeId, destSectionId);
    const destSection = localSections.find((s) => s.id === destSectionId);
    if (destSection) {
      const orderedIds = destSection.tasks.map((t) => t.id);
      await onReorderTasks(destSectionId, orderedIds);
    }
  }, [localSections, onMoveTask, onReorderTasks]);

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
      {/* No h-full and no overflow on this row: columns grow with their
          content (Asana behavior), and the outer page scroll container
          (the `flex-1 overflow-auto` ancestor that wraps every view)
          handles both vertical AND horizontal scroll when needed. */}
      <div className="flex gap-3 px-4 md:px-6 py-4 items-start">
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

        {/* + Add section — inline input column (no window.prompt). Matches
            the List view's add-section affordance and persists through the
            same createPersonalSection path so the new column survives
            reload + follows the user across devices. */}
        <div className="flex-shrink-0">
          {isAddingSection ? (
            <div className="w-[280px] rounded-xl bg-slate-100/80 px-3 py-3">
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAddSection();
                  if (e.key === "Escape") { setIsAddingSection(false); setNewSectionName(""); }
                }}
                onBlur={commitAddSection}
                placeholder="Section name..."
                className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none border-b border-slate-300 pb-1 placeholder:text-slate-400"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => { setIsAddingSection(true); setNewSectionName(""); }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add section
            </button>
          )}
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
        // No max-h-full — the gray background grows with the cards
        // instead of being clipped to the viewport. Matches Asana.
        "flex-shrink-0 w-[280px] flex flex-col rounded-xl transition-colors",
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

      {/* Cards — no flex-1 / overflow-y-auto so the column's height
          tracks the cards inside it. Long columns get scrolled by the
          page-level container above, not by an internal scrollbar. */}
      <div className="px-2 pb-2 min-h-[60px]">
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

      {/* Project tag — with engineering-discipline badge */}
      {task.project && (
        <div className="mt-2 flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-sm flex-shrink-0"
            style={{ backgroundColor: task.project.color }}
          />
          <span className="text-[11px] text-slate-500 truncate">
            {task.project.name}
          </span>
          {task.project.type && (
            <span
              className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1 py-px rounded bg-gray-100 text-gray-600 flex-shrink-0"
              title={`Project type: ${task.project.type}`}
            >
              {projectTypeShort(task.project.type)}
            </span>
          )}
        </div>
      )}

      {/* Bottom: date + meta */}
      {(dueDateInfo.text || task._count.subtasks > 0 || task._count.comments > 0 || task._count.attachments > 0 || task.assignee) && (
        <div className="flex items-center justify-between mt-2 pt-1.5">
          {/* Due date — first-class start–due range ("Today - Jul 8"). */}
          <span className={cn("text-[11px]", dueDateInfo.className)}>
            {formatDueColumnLabel(task.startDate, task.dueDate, dueDateInfo.text)}
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
  zoom,
  onZoomChange,
}: {
  tasks: Task[];
  onTaskCreated?: () => void;
  onTaskClick?: (task: Task) => void;
  /** cal-01: "month" = continuous month grid; "weeks" = one tall week
   *  per viewport with larger bars. Persisted in the parent's uiState. */
  zoom: "month" | "weeks";
  onZoomChange: (z: "month" | "weeks") => void;
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

  // ── Drag-to-reschedule ────────────────────────────────────────
  // HTML5 drag API (no extra deps). Source: each task bar in the
  // foreground overlay. Targets: each day cell in the background.
  // On drop we PATCH the task, preserving duration when both
  // startDate and dueDate exist; otherwise just move the anchor
  // we have. Refetch via onTaskCreated callback.
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, task: Task) {
    setDraggingTaskId(task.id);
    e.dataTransfer.setData("application/x-task-id", task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverDate(null);
  }

  function handleDayDragOver(e: React.DragEvent, dateStr: string) {
    if (!draggingTaskId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== dateStr) setDragOverDate(dateStr);
  }

  async function handleDayDrop(e: React.DragEvent, dropDate: Date) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("application/x-task-id");
    setDraggingTaskId(null);
    setDragOverDate(null);
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Mid-day anchor avoids the date flipping under daylight-saving
    // or near-midnight edits across timezones.
    const noon = new Date(dropDate);
    noon.setHours(12, 0, 0, 0);

    const oldDue = task.dueDate ? new Date(task.dueDate) : null;
    const oldStart = task.startDate ? new Date(task.startDate) : null;

    const body: { dueDate?: string | null; startDate?: string | null } = {};
    if (oldStart && oldDue) {
      // Preserve duration: shift both dates by the same delta as
      // the dueDate move. Otherwise dragging a 5-day task would
      // collapse it to a 1-day task at the drop date.
      const oldDueNoon = new Date(oldDue);
      oldDueNoon.setHours(12, 0, 0, 0);
      const deltaMs = noon.getTime() - oldDueNoon.getTime();
      body.dueDate = noon.toISOString();
      body.startDate = new Date(oldStart.getTime() + deltaMs).toISOString();
    } else if (oldStart && !oldDue) {
      // Only a start date — drop sets the new start.
      body.startDate = noon.toISOString();
    } else {
      body.dueDate = noon.toISOString();
    }

    // Compare against existing to avoid a no-op PATCH that
    // pessimistically refetches.
    const sameDue =
      (body.dueDate ?? null) ===
      (task.dueDate ? new Date(task.dueDate).toISOString() : null);
    const sameStart =
      (body.startDate ?? null) ===
      (task.startDate ? new Date(task.startDate).toISOString() : null);
    if (sameDue && sameStart) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onTaskCreated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't reschedule task"
      );
    }
  }

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

  /**
   * Convert (start, due) → list of bar segments PER WEEK with lane
   * assignment. Each segment knows which week it lives in, what
   * column it starts on (0=Mon..6=Sun), how many columns it spans,
   * what stacking lane (row within the week) it occupies, and
   * whether it clips at either edge of the week (for visual
   * continuation hint).
   *
   * - Tasks with only dueDate render as a 1-cell bar at the dueDate.
   * - Tasks with start AND due span all cells from start to due
   *   (inclusive), wrapping across week boundaries with one bar
   *   segment per affected week.
   * - Within a week, lanes are assigned greedily so bars never
   *   overlap horizontally (longest segments get lowest lanes).
   */
  type BarSegment = {
    task: Task;
    weekIdx: number;
    colStart: number;
    colSpan: number;
    lane: number;
    clipsLeft: boolean;
    clipsRight: boolean;
  };

  const segmentsByWeek = useMemo(() => {
    const out: BarSegment[][] = weeks.map(() => []);
    const dayMs = 86400000;

    for (const task of tasks) {
      if (!task.dueDate && !task.startDate) continue;
      // Fold each UTC-midnight due/start date onto the LOCAL midnight of its
      // own calendar day (date-only.ts). Using local getters on a raw
      // `new Date(task.dueDate)` shifted the day west of UTC, rendering bars
      // one column early; dueDateToLocalMidnight keeps the bar on the day
      // the user picked regardless of timezone or DST.
      const due = dueDateToLocalMidnight(task.dueDate ?? task.startDate!);
      const start = dueDateToLocalMidnight(task.startDate ?? task.dueDate!);

      // Cheap skip: if the range falls entirely outside the rendered
      // window, no segments at all.
      if (allDays.length === 0) continue;
      if (
        due.getTime() < allDays[0].getTime() ||
        start.getTime() > allDays[allDays.length - 1].getTime()
      ) {
        continue;
      }

      for (let w = 0; w < weeks.length; w++) {
        const weekStart = weeks[w][0]; // Monday 00:00 local
        const weekEnd = new Date(weeks[w][6]);
        weekEnd.setHours(23, 59, 59, 999);
        // No overlap with this week → skip
        if (due.getTime() < weekStart.getTime()) continue;
        if (start.getTime() > weekEnd.getTime()) continue;

        const segStart =
          start.getTime() < weekStart.getTime() ? weekStart : start;
        const segEndDate = due.getTime() > weekEnd.getTime() ? weeks[w][6] : due;
        const colStart = Math.round(
          (segStart.getTime() - weekStart.getTime()) / dayMs
        );
        const colEnd = Math.round(
          (segEndDate.getTime() - weekStart.getTime()) / dayMs
        );
        out[w].push({
          task,
          weekIdx: w,
          colStart: Math.max(0, Math.min(6, colStart)),
          colSpan: Math.max(1, Math.min(7 - colStart, colEnd - colStart + 1)),
          lane: 0,
          clipsLeft: start.getTime() < weekStart.getTime(),
          clipsRight: due.getTime() > weekEnd.getTime(),
        });
      }
    }

    // Lane assignment per week (greedy interval scheduling).
    // Sort matches Asana's calendar: multi-day (start AND end) ranges
    // first ordered longest→shortest, single-day tasks come after.
    // This pushes the highest-information bars to the top lanes and
    // lets single-day pills fall into "+N more" when space is tight.
    for (const list of out) {
      list.sort((a, b) => {
        const aMulti = a.colSpan > 1 ? 0 : 1;
        const bMulti = b.colSpan > 1 ? 0 : 1;
        if (aMulti !== bMulti) return aMulti - bMulti;
        if (a.colSpan !== b.colSpan) return b.colSpan - a.colSpan;
        if (a.colStart !== b.colStart) return a.colStart - b.colStart;
        return a.task.id.localeCompare(b.task.id);
      });
      const lanes: BarSegment[][] = [];
      for (const seg of list) {
        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
          const overlapsAny = lanes[i].some(
            (existing) =>
              !(
                seg.colStart + seg.colSpan <= existing.colStart ||
                seg.colStart >= existing.colStart + existing.colSpan
              )
          );
          if (!overlapsAny) {
            lanes[i].push(seg);
            seg.lane = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          lanes.push([seg]);
          seg.lane = lanes.length - 1;
        }
      }
    }

    return out;
  }, [tasks, weeks, allDays]);

  const isWeeksZoom = zoom === "weeks";

  /** Hard cap on how many lanes a single week can show before
   *  overflow collapses to the "+N more" popover. Bumped from 4 to
   *  6 now that rows can grow tall to fit them — most weeks will
   *  use 0-3 lanes anyway, and busy weeks no longer get clipped.
   *  cal-01: Weeks zoom gives each week a full viewport, so it can
   *  afford far more lanes before overflowing. */
  const MAX_LANES = isWeeksZoom ? 20 : 6;

  // Pixel constants for the per-week layout. Used by the dynamic
  // height calc AND by the scroll math below — keep them in sync.
  // LANE_PX = actual bar height (text + padding) + gap-y-0.5 (2px).
  // A bar is text[11px] × leading-snug ≈ 15 + py-[3px]×2 = 21px,
  // plus 2px gap, so 22 is the safe lane stride. ROW_BOTTOM gives a
  // bit of breathing room beneath the last item. Weeks zoom uses a
  // taller lane stride (bigger bars) and a tall ROW_MIN so one week
  // fills the viewport.
  const DAY_HEADER_PX = isWeeksZoom ? 36 : 28; // day-number row height
  const LANE_PX = isWeeksZoom ? 30 : 22;
  const ROW_BOTTOM_PX = 10;
  const ROW_MIN_PX = isWeeksZoom ? 560 : 92;

  /**
   * Per-week height — grows with how many lanes that week actually
   * uses. We don't just take the global max lane: each column might
   * have its own +N more pill sitting at (column's last bar lane + 1),
   * so we walk each column and track the deepest grid row that
   * column needs. The week height = the deepest row across all
   * columns. This guarantees neither bars nor +N more pills ever
   * clip out the bottom.
   */
  const weekHeights = useMemo(() => {
    return weeks.map((_, idx) => {
      const segs = segmentsByWeek[idx] || [];
      const visibleSegs = segs.filter((s) => s.lane < MAX_LANES);
      const hasOverflowByDay: Record<number, boolean> = {};
      for (const s of segs) {
        if (s.lane >= MAX_LANES) {
          for (let d = s.colStart; d < s.colStart + s.colSpan; d++) {
            hasOverflowByDay[d] = true;
          }
        }
      }
      let maxRow = -1; // deepest grid row (0-indexed) used anywhere
      for (let day = 0; day < 7; day++) {
        let columnMaxLane = -1;
        for (const s of visibleSegs) {
          if (
            s.colStart <= day &&
            s.colStart + s.colSpan > day &&
            s.lane > columnMaxLane
          ) {
            columnMaxLane = s.lane;
          }
        }
        // +N more for this column would land at columnMaxLane + 1
        const columnRow = hasOverflowByDay[day]
          ? columnMaxLane + 1
          : columnMaxLane;
        if (columnRow > maxRow) maxRow = columnRow;
      }
      if (maxRow < 0) return ROW_MIN_PX;
      const content = DAY_HEADER_PX + (maxRow + 1) * LANE_PX + ROW_BOTTOM_PX;
      return Math.max(ROW_MIN_PX, content);
    });
    // MAX_LANES/DAY_HEADER_PX/LANE_PX/ROW_MIN_PX all derive from `zoom`, so
    // the heights must recompute when the user flips Weeks ↔ Month.
  }, [weeks, segmentsByWeek, MAX_LANES, DAY_HEADER_PX, LANE_PX, ROW_BOTTOM_PX, ROW_MIN_PX]);

  /** Cumulative offset of each week from the top of the grid — used
   *  by the visible-month scroll listener and goToToday to navigate
   *  weeks of variable height. */
  const weekOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < weekHeights.length; i++) {
      offsets.push(acc);
      acc += weekHeights[i];
    }
    return offsets;
  }, [weekHeights]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Weekend compression (Asana parity — spec item 6): the 5 weekday
  // tracks (Mon–Fri) are full width, the 2 weekend tracks (Sat, Sun) are
  // compressed to ~half width. Shared by the sticky weekday header, the
  // background day-cell grid, and the absolutely-positioned bar overlay
  // so all three stay column-aligned. Because bar placement uses grid
  // LINE numbers (`gridColumn: colStart+1 / span colSpan`), not track
  // widths, the existing colStart/colSpan math needs no change — a bar
  // over Sat/Sun simply renders narrower. Order is Mon→Sun to match the
  // 0=Mon..6=Sun column indexing used throughout the calendar.
  const WEEKEND_GRID_COLUMNS =
    "repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 0.55fr))";

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
  // With dynamic row heights, week N is no longer at `N * ROW_PX` —
  // we walk the prefix-sum offsets to find which week's top edge
  // crosses the current scrollTop. The label tracks that week's
  // middle (Thursday) so half-visible months tip past the threshold
  // smoothly.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const HEADER_PX = 32;
      const target = el.scrollTop - HEADER_PX;
      // Find the last week whose top is <= target (binary search would
      // be tidier but linear is fine for the few-hundred weeks we ever
      // render at once).
      let idx = 0;
      for (let i = 0; i < weekOffsets.length; i++) {
        if (weekOffsets[i] <= target) idx = i;
        else break;
      }
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
  }, [allDays, weekOffsets]);

  // On initial mount, jump to today's week.
  useEffect(() => {
    if (todayWeekRef.current && scrollRef.current) {
      const HEADER_PX = 32;
      const idx = todayWeekIndex >= 0 ? todayWeekIndex : 0;
      scrollRef.current.scrollTop = (weekOffsets[idx] ?? 0) - HEADER_PX;
    }
    // Run once on mount — refs and offsets derived from initial render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToToday = () => {
    if (!scrollRef.current) return;
    if (todayWeekIndex >= 0) {
      const HEADER_PX = 32;
      scrollRef.current.scrollTo({
        top: (weekOffsets[todayWeekIndex] ?? 0) - HEADER_PX,
        behavior: "smooth",
      });
    }
  };

  // cal-03: prev/next month chevrons around Today. Find the first week
  // index whose middle day (Thursday) lands in the target month, then
  // scroll to that week's offset. Forward navigation naturally extends the
  // window via the bottom-sentinel observer as we scroll; back-navigation
  // is clamped to the rendered window (windowStart is a fixed 4 weeks back)
  // — an accepted v1 limitation noted in the plan.
  const scrollToWeek = (idx: number) => {
    if (!scrollRef.current || idx < 0) return;
    const HEADER_PX = 32;
    scrollRef.current.scrollTo({
      top: (weekOffsets[idx] ?? 0) - HEADER_PX,
      behavior: "smooth",
    });
  };
  const firstWeekIndexOfMonth = (year: number, month: number): number => {
    // Normalize the (year, month) pair so month over/underflow rolls the year.
    const target = new Date(year, month, 1);
    const ty = target.getFullYear();
    const tm = target.getMonth();
    for (let w = 0; w < weeks.length; w++) {
      const mid = allDays[w * 7 + 3];
      if (mid && mid.getFullYear() === ty && mid.getMonth() === tm) return w;
    }
    return -1;
  };
  const goToPrevMonth = () => {
    const idx = firstWeekIndexOfMonth(visibleMonth.year, visibleMonth.month - 1);
    if (idx >= 0) scrollToWeek(idx);
    else scrollToWeek(0); // clamp to the top of the rendered window
  };
  const goToNextMonth = () => {
    const idx = firstWeekIndexOfMonth(visibleMonth.year, visibleMonth.month + 1);
    if (idx >= 0) {
      scrollToWeek(idx);
    } else {
      // Not rendered yet — grow the window; the scroll listener will catch
      // up as more weeks mount. Jump to the current bottom meanwhile.
      setWeekCount((c) => c + 8);
      scrollToWeek(weeks.length - 1);
    }
  };

  const formatMonthYear = (year: number, month: number) =>
    new Date(year, month, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

  return (
    <div className="flex flex-col h-full">
      {/* Navigation toolbar — "< Today >" cluster + live month label
          (cal-03), and a Weeks|Month zoom toggle on the right (cal-01).
          The label still tracks whatever week the user scrolls to. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevMonth}
            aria-label="Previous month"
            className="h-8 w-8 flex items-center justify-center rounded-md border border-input text-gray-600 hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="px-3"
          >
            Today
          </Button>
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="Next month"
            className="h-8 w-8 flex items-center justify-center rounded-md border border-input text-gray-600 hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="font-medium text-black ml-2 tabular-nums">
            {formatMonthYear(visibleMonth.year, visibleMonth.month)}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-end">
          {/* Weeks | Month segmented toggle (cal-01) — persisted zoom. */}
          <div className="inline-flex items-center rounded-md border border-input p-0.5 bg-white">
            <button
              type="button"
              onClick={() => onZoomChange("weeks")}
              className={cn(
                "px-2.5 py-1 text-[12px] rounded-[5px] transition-colors",
                zoom === "weeks"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              Weeks
            </button>
            <button
              type="button"
              onClick={() => onZoomChange("month")}
              className={cn(
                "px-2.5 py-1 text-[12px] rounded-[5px] transition-colors",
                zoom === "month"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Single scroll container with sticky weekday header.
          Continuous downward scroll appends 8 weeks at a time via
          an IntersectionObserver on the bottom sentinel — same UX
          as Notion / Apple Calendar's continuous month view. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className="grid border-b border-gray-200 bg-white sticky top-0 z-10"
          style={{ gridTemplateColumns: WEEKEND_GRID_COLUMNS }}
        >
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

        {/* Each week is rendered in two layers:
            (a) BACKGROUND — the 7 day cells (borders, weekend tint,
                today highlight, click-to-add hit target, day number)
            (b) FOREGROUND — task bars positioned via grid spanning,
                pointer-events:none on the wrapper so click-through
                works on empty cell space; individual bars re-enable
                pointer-events.
            Tasks that span multiple days span multiple columns. Tasks
            that cross week boundaries get one segment per affected
            week with clipsLeft/clipsRight flags trimming the rounded
            corners on the cut side. */}
        {weeks.map((week, weekIdx) => {
          const weekSegments = segmentsByWeek[weekIdx] || [];
          const visibleSegments = weekSegments.filter((s) => s.lane < MAX_LANES);
          // Track BOTH the count and the actual task list per day so
          // the "+N more" pill can open a popover listing the hidden
          // tasks instead of being a dead button.
          const hiddenByDay: Record<number, number> = {};
          const hiddenTasksByDay: Record<number, Task[]> = {};
          for (const s of weekSegments) {
            if (s.lane >= MAX_LANES) {
              for (let d = s.colStart; d < s.colStart + s.colSpan; d++) {
                hiddenByDay[d] = (hiddenByDay[d] || 0) + 1;
                if (!hiddenTasksByDay[d]) hiddenTasksByDay[d] = [];
                // Dedupe — a segment spanning multiple days shouldn't
                // appear multiple times in one day's list.
                if (!hiddenTasksByDay[d].some((t) => t.id === s.task.id)) {
                  hiddenTasksByDay[d].push(s.task);
                }
              }
            }
          }

          // Which column (0-6) is the user adding into within this
          // week, and what lane (row in the bar overlay) should the
          // new-task input occupy? The cap is MAX_LANES (not
          // MAX_LANES - 1) so when a column is fully packed the
          // input gets its own extra row below the existing bars —
          // never overlapping them.
          const addingDayIndex = addingForDate
            ? week.findIndex((d) => d.toDateString() === addingForDate)
            : -1;
          let addingLane = 0;
          if (addingDayIndex >= 0) {
            let maxLane = -1;
            for (const seg of visibleSegments) {
              if (
                seg.colStart <= addingDayIndex &&
                seg.colStart + seg.colSpan > addingDayIndex
              ) {
                if (seg.lane > maxLane) maxLane = seg.lane;
              }
            }
            addingLane = maxLane + 1;
          }

          return (
            <div
              key={weekIdx}
              ref={weekIdx === todayWeekIndex ? todayWeekRef : null}
              className="relative border-b border-gray-200"
              style={{ height: weekHeights[weekIdx] ?? ROW_MIN_PX }}
              data-week-index={weekIdx}
            >
              {/* Background cells — borders, tint, today, add-mode */}
              <div
                className="grid h-full"
                style={{ gridTemplateColumns: WEEKEND_GRID_COLUMNS }}
              >
                {week.map((date, dayOfWeek) => {
                  const dateStr = date.toDateString();
                  const isToday = dateStr === todayStr;
                  const isWeekend = dayOfWeek >= 5;
                  const dayNum = date.getDate();
                  const isCurrentMonth = date.getMonth() === visibleMonth.month;
                  const isFirstOfMonth = dayNum === 1;
                  const isAdding = addingForDate === dateStr;
                  const hiddenCount = hiddenByDay[dayOfWeek] || 0;

                  const isDropTarget = dragOverDate === dateStr;
                  return (
                    <div
                      key={dateStr}
                      onClick={(e) => {
                        if (e.currentTarget === e.target && !isAdding) {
                          setAddingForDate(dateStr);
                          setNewTaskName("");
                        }
                      }}
                      onDragOver={(e) => handleDayDragOver(e, dateStr)}
                      onDragLeave={() => {
                        if (dragOverDate === dateStr) setDragOverDate(null);
                      }}
                      onDrop={(e) => handleDayDrop(e, date)}
                      className={cn(
                        "relative cursor-pointer h-full",
                        dayOfWeek > 0 && "border-l border-gray-200",
                        !isCurrentMonth && "bg-gray-50/40",
                        isWeekend && isCurrentMonth && "bg-gray-50/20",
                        isToday && "bg-[#c9a84c]/5",
                        isAdding && "ring-2 ring-[#c9a84c]/60 ring-inset",
                        isDropTarget && "ring-2 ring-[#c9a84c] ring-inset bg-[#c9a84c]/10"
                      )}
                    >
                      {/* Day number — bumped padding so the digit
                          isn't kissing the cell edge. */}
                      <div className="px-2 pt-1.5 pointer-events-none">
                        <span
                          className={cn(
                            "text-[12px] font-mono tabular-nums inline-block",
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
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bars overlay — uses CSS grid spanning so a 3-day task
                  becomes a single wide pill across 3 columns. The inline
                  add-task input also lives in this grid (positioned to
                  the right column and the next free lane) so it slots
                  in as "the next bar" instead of floating at the cell
                  bottom — Asana behavior. */}
              <div
                className="absolute inset-x-0 grid gap-y-0.5 pointer-events-none"
                // top matches the day-number row; gridAutoRows pins each
                // lane to LANE_PX-minus-gap so the bar stride equals the
                // stride weekHeights assumes (keeps overlay + cell heights
                // in lock-step across both zoom levels). gridTemplateColumns
                // MUST match the background grid (compressed weekends) so a
                // bar over a weekend column lands exactly over its day cell.
                style={{ top: DAY_HEADER_PX, paddingLeft: 2, paddingRight: 2, gridAutoRows: `${LANE_PX - 2}px`, gridTemplateColumns: WEEKEND_GRID_COLUMNS }}
              >
                {visibleSegments.map((seg) => {
                  const isBeingDragged = draggingTaskId === seg.task.id;
                  return (
                  <div
                    key={`${seg.task.id}-${weekIdx}-${seg.colStart}`}
                    style={{
                      gridColumn: `${seg.colStart + 1} / span ${seg.colSpan}`,
                      gridRow: seg.lane + 1,
                    }}
                    className="px-px min-w-0 pointer-events-none"
                  >
                    <button
                      draggable
                      onDragStart={(e) => handleDragStart(e, seg.task)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick?.(seg.task);
                      }}
                      title={seg.task.name}
                      className={cn(
                        // Compact, slightly rounded — bar feel, not
                        // pill feel. Matches Asana density. Weeks zoom
                        // uses a slightly larger bar to fill the taller lane.
                        "w-full block text-left leading-snug truncate cursor-grab active:cursor-grabbing pointer-events-auto font-medium transition-colors",
                        isWeeksZoom ? "text-[13px] px-2 py-[5px]" : "text-[11px] px-1.5 py-[3px]",
                        // Rounded corners trim on the side that's
                        // clipped (visual continuation hint).
                        !seg.clipsLeft && "rounded-l-sm",
                        !seg.clipsRight && "rounded-r-sm",
                        seg.task.completed
                          ? "bg-gray-200 text-gray-500 line-through"
                          : "bg-[#c9a84c] text-white hover:bg-[#a8893a]",
                        // Fade the source while it's being dragged so
                        // the user perceives a "lift".
                        isBeingDragged && "opacity-40"
                      )}
                    >
                      {seg.task.name}
                    </button>
                  </div>
                  );
                })}

                {/* +N more pills — one per column with overflow,
                    sitting in the bar overlay grid right after that
                    column's last visible bar. Lives in the grid (not
                    absolute on the cell) so it can never be covered
                    by the bottom bar. Each one is its own popover
                    listing the hidden tasks for that day. */}
                {week.map((date, dayOfWeek) => {
                  const count = hiddenByDay[dayOfWeek];
                  if (!count) return null;
                  // Lane right after this column's deepest visible bar
                  let columnMaxLane = -1;
                  for (const seg of visibleSegments) {
                    if (
                      seg.colStart <= dayOfWeek &&
                      seg.colStart + seg.colSpan > dayOfWeek &&
                      seg.lane > columnMaxLane
                    ) {
                      columnMaxLane = seg.lane;
                    }
                  }
                  return (
                    <div
                      key={`more-${weekIdx}-${dayOfWeek}`}
                      style={{
                        gridColumn: `${dayOfWeek + 1} / span 1`,
                        gridRow: columnMaxLane + 2,
                      }}
                      className="px-px min-w-0 pointer-events-auto"
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="px-1.5 py-[2px] text-[10px] font-medium text-gray-500 hover:text-black hover:bg-gray-100 rounded-sm"
                          >
                            +{count} more
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-64 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-3 py-2 border-b">
                            <p className="text-xs font-semibold text-black">
                              {date.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {count} hidden{" "}
                              {count === 1 ? "task" : "tasks"}
                            </p>
                          </div>
                          <ul className="max-h-64 overflow-y-auto py-1">
                            {(hiddenTasksByDay[dayOfWeek] || []).map((t) => (
                              <li key={t.id}>
                                <button
                                  onClick={() => onTaskClick?.(t)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <span
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-sm flex-shrink-0",
                                      t.completed
                                        ? "bg-gray-300"
                                        : "bg-[#c9a84c]"
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "text-[12px] truncate flex-1",
                                      t.completed
                                        ? "text-gray-400 line-through"
                                        : "text-black"
                                    )}
                                  >
                                    {t.name}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })}

                {/* Inline Add input — appears as the next bar in the
                    target column's lane stack. Same dimensions as a
                    task bar so the visual rhythm doesn't break. */}
                {addingDayIndex >= 0 && (
                  <div
                    style={{
                      gridColumn: `${addingDayIndex + 1} / span 1`,
                      gridRow: addingLane + 1,
                    }}
                    className="px-px min-w-0 pointer-events-auto"
                  >
                    <div
                      className="w-full bg-white border border-[#c9a84c] rounded-sm shadow-sm"
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
                            commitInlineTask(week[addingDayIndex]);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setAddingForDate(null);
                            setNewTaskName("");
                          }
                        }}
                        onBlur={() => commitInlineTask(week[addingDayIndex])}
                        disabled={creatingInline}
                        placeholder="Task name…"
                        className="w-full px-1.5 py-[3px] text-[11px] leading-snug bg-transparent border-none outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                )}
              </div>
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
function DashboardView({
  tasks,
  sections,
  activeFilterCount = 0,
  widgets,
  onToggleWidget,
  onDrillDown,
}: {
  tasks: Task[];
  sections: SmartSection[];
  /** How many quick filters + custom filters + search are active on
   *  the parent page. The dashboard reflects them in every widget
   *  footer so the user knows the numbers are filtered. */
  activeFilterCount?: number;
  /** Ids of the enabled widgets (dsh-01), in catalog order. */
  widgets: string[];
  /** Toggle a widget id on/off (persists in the parent's uiState). */
  onToggleWidget: (id: string) => void;
  /** Apply a quick filter (or "overdue") and jump to the List view
   *  (dsh-02 "View all"). */
  onDrillDown: (target: "completed" | "incomplete" | "overdue" | "all") => void;
}) {
  const [widgetGalleryOpen, setWidgetGalleryOpen] = useState(false);
  const enabled = useMemo(() => new Set(widgets), [widgets]);

  const completed = tasks.filter((t) => t.completed).length;
  const incomplete = tasks.filter((t) => !t.completed).length;
  // Overdue = incomplete AND its due calendar day is strictly before today.
  // daysFromToday folds the UTC-midnight due date onto the local day so a
  // task due TODAY is never counted overdue (violated the date-only rule
  // before, when `new Date(t.dueDate) < new Date()` flagged it west of UTC).
  const overdue = tasks.filter((t) => !t.completed && t.dueDate && daysFromToday(t.dueDate) < 0).length;
  const total = tasks.length;

  // Data for bar chart - tasks by section
  const tasksBySectionData = sections.map((section) => ({
    name: section.name.length > 12 ? section.name.substring(0, 12) + "..." : section.name,
    fullName: section.name,
    count: section.tasks.length,
  }));

  // Data for donut chart — completion status for the UPCOMING MONTH
  // (dsh-03). Scope to tasks whose due day is today..+30 days
  // (daysFromToday, date-only) so the donut mirrors Asana's "completion
  // status for the upcoming month" rather than the all-time split.
  // Undated incomplete tasks are excluded (they have no upcoming due day).
  const nextMonthTasks = tasks.filter(
    (t) => t.dueDate && daysFromToday(t.dueDate) >= 0 && daysFromToday(t.dueDate) <= 30
  );
  const nextMonthCompleted = nextMonthTasks.filter((t) => t.completed).length;
  const nextMonthIncomplete = nextMonthTasks.filter((t) => !t.completed).length;
  const completionData = [
    { name: "Incomplete", value: nextMonthIncomplete, color: "#8B8FA3" },
    { name: "Completed", value: nextMonthCompleted, color: "#D1D5DB" },
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

  // Widget footer (Asana-style): the active-filter readout on the left,
  // and a real "View all" link on the right (dsh-02) that applies the
  // matching filter and jumps to the List view. `drill` picks which
  // filter to apply; omit it for a plain readout footer.
  const WidgetFooter = ({
    filterCount,
    filterLabel,
    drill,
  }: {
    filterCount: number;
    filterLabel?: string;
    drill?: "completed" | "incomplete" | "overdue" | "all";
  }) => (
    <div className="flex items-center justify-between pt-3 mt-auto border-t border-gray-100">
      <span className="flex items-center gap-1 text-[11px] text-gray-400">
        <Filter className="w-3 h-3" />
        {filterLabel || (filterCount === 0 ? "No filters" : `${filterCount} filter${filterCount > 1 ? "s" : ""}`)}
      </span>
      {drill ? (
        <button
          type="button"
          onClick={() => onDrillDown(drill)}
          className="text-[11px] text-[#6f7782] hover:text-black hover:underline"
        >
          View all
        </button>
      ) : (
        <span className="text-[11px] text-gray-400 font-mono tabular-nums">
          {total} task{total === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );

  // KPI card catalog keyed by widget id — value, and the drill-down
  // target its "View all" applies (dsh-02). Rendered only when enabled.
  const kpiCards: {
    id: string;
    label: string;
    value: number;
    drill: "completed" | "incomplete" | "overdue" | "all";
  }[] = [
    { id: "completed", label: "Completed tasks", value: completed, drill: "completed" },
    { id: "incomplete", label: "Incomplete tasks", value: incomplete, drill: "incomplete" },
    { id: "overdue", label: "Overdue tasks", value: overdue, drill: "overdue" },
    { id: "total", label: "Total tasks", value: total, drill: "all" },
  ];
  const visibleKpis = kpiCards.filter((c) => enabled.has(c.id));
  // Which chart widgets are on — drives whether each chart row renders and
  // whether a whole row collapses (so we don't leave an empty grid gap).
  const showBySection = enabled.has("by-section");
  const showDonut = enabled.has("completion-donut");
  const showByProject = enabled.has("by-project");
  const showOverTime = enabled.has("over-time");
  const anyWidgetOn = visibleKpis.length > 0 || showBySection || showDonut || showByProject || showOverTime;

  return (
    <div className="px-4 md:px-8 py-5 overflow-auto h-full" style={{ backgroundColor: "#F9FAFB" }}>
      {/* Dashboard header — Add widget gallery (dsh-01). Toggling an id
          persists in the parent's uiState.myTasks.dashboardWidgets. */}
      <div className="flex items-center justify-end mb-4">
        <Popover open={widgetGalleryOpen} onOpenChange={setWidgetGalleryOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add widget
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-0">
            <div className="px-3 py-2 border-b">
              <p className="text-xs font-semibold text-black">Widgets</p>
              <p className="text-[10px] text-gray-500">Toggle what appears on your dashboard</p>
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {DASHBOARD_WIDGETS.map((w) => {
                const on = enabled.has(w.id);
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => onToggleWidget(w.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50"
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                          on ? "bg-black border-black" : "border-gray-300"
                        )}
                      >
                        {on && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="text-[12px] text-gray-800 flex-1">{w.label}</span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">{w.kind}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      {/* Empty state — every widget turned off. */}
      {!anyWidgetOn && (
        <div className="bg-white rounded-lg border border-gray-200/80 py-16 flex flex-col items-center text-center text-gray-400">
          <BarChart3 className="w-8 h-8 mb-3 text-gray-300" />
          <p className="text-[13px]">No widgets yet</p>
          <p className="text-[11px] mt-1">Use “Add widget” to build your dashboard</p>
        </div>
      )}

      {/* KPI Metric Cards — Asana style. Clickable: a click applies the
          matching filter and jumps to the List view (dsh-02). */}
      {visibleKpis.length > 0 && (
      <div className="grid grid-cols-4 gap-3 mb-5">
        {visibleKpis.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onDrillDown(card.drill)}
            className="bg-white rounded-lg border border-gray-200/80 py-5 px-4 flex flex-col items-center text-center hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <span className="text-[13px] text-gray-900 font-normal">{card.label}</span>
            <span className="text-[40px] font-light text-gray-900 leading-tight mt-1.5 mb-2 font-mono tabular-nums">{card.value}</span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Filter className="w-2.5 h-2.5" />
              {activeFilterCount === 0
                ? "No filters"
                : `${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""}`}
            </span>
          </button>
        ))}
      </div>
      )}

      {/* Charts Row 1 */}
      {(showBySection || showDonut) && (
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Tasks by Section — Bar Chart */}
        {showBySection && (
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
            <WidgetFooter filterCount={activeFilterCount} drill="all" />
          </div>
        </div>
        )}

        {/* Completion Status (next month) — Donut (dsh-03). Scoped to the
            upcoming 30 days so it mirrors Asana's upcoming-month widget. */}
        {showDonut && (
        <div className="bg-white rounded-lg border border-gray-200/80 flex flex-col">
          <div className="px-5 pt-5 pb-0">
            <h3 className="text-[13px] font-medium text-gray-900">Completion status (next month)</h3>
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
                <span className="text-[28px] font-semibold text-gray-900">{nextMonthIncomplete}</span>
              </div>
            </div>
          </div>
          <div className="px-5 pb-4">
            <WidgetFooter filterCount={activeFilterCount} filterLabel="Due in the next 30 days" />
          </div>
        </div>
        )}
      </div>
      )}

      {/* Charts Row 2 */}
      {(showByProject || showOverTime) && (
      <div className="grid grid-cols-2 gap-3">
        {/* Tasks by Project — Bar Chart */}
        {showByProject && (
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
            <WidgetFooter filterCount={activeFilterCount} drill="all" />
          </div>
        </div>
        )}

        {/* Task Completion Over Time — Area/Line Chart */}
        {showOverTime && (
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
            <WidgetFooter filterCount={activeFilterCount} drill="all" />
          </div>
        </div>
        )}
      </div>
      )}
    </div>
  );
}

// Files View — Asana-style empty state
interface FileItem {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  task: {
    id: string;
    name: string;
    completed: boolean;
    project: { id: string; name: string; color: string } | null;
  } | null;
  uploader: { id: string; name: string | null; image: string | null } | null;
}

type FileTypeFilter = "all" | "images" | "pdf" | "docs" | "other";

function FilesView({
  onTaskClick,
  refreshKey = 0,
}: {
  onTaskClick?: (taskId: string) => void;
  /** Bumped by the parent whenever an attachment was uploaded or
   *  removed elsewhere (e.g. inside the task slide-over). */
  refreshKey?: number;
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>("all");
  // In-app file viewer (clicking a card opens it instead of new tab)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // Local refresh tick so the dialog can trigger a re-fetch without
  // having to thread a callback up to the parent's refreshKey.
  const [localRefreshTick, setLocalRefreshTick] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/my-tasks/files")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setFiles(data.files || []);
      })
      .catch(() => !cancelled && setFiles([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey, localRefreshTick]);

  const filtered = useMemo(() => {
    return files.filter((f) => {
      // Type filter
      if (typeFilter !== "all") {
        const isImage = f.mimeType.startsWith("image/");
        const isPdf = f.mimeType === "application/pdf";
        const isDoc =
          f.mimeType.includes("word") ||
          f.mimeType.includes("excel") ||
          f.mimeType.includes("spreadsheet") ||
          f.mimeType.includes("presentation") ||
          f.mimeType === "text/plain";
        if (typeFilter === "images" && !isImage) return false;
        if (typeFilter === "pdf" && !isPdf) return false;
        if (typeFilter === "docs" && !isDoc) return false;
        if (typeFilter === "other" && (isImage || isPdf || isDoc)) return false;
      }
      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          (f.task?.name || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [files, search, typeFilter]);

  const typeCounts = useMemo(() => {
    const c = { all: files.length, images: 0, pdf: 0, docs: 0, other: 0 };
    for (const f of files) {
      const isImage = f.mimeType.startsWith("image/");
      const isPdf = f.mimeType === "application/pdf";
      const isDoc =
        f.mimeType.includes("word") ||
        f.mimeType.includes("excel") ||
        f.mimeType.includes("spreadsheet") ||
        f.mimeType.includes("presentation") ||
        f.mimeType === "text/plain";
      if (isImage) c.images++;
      else if (isPdf) c.pdf++;
      else if (isDoc) c.docs++;
      else c.other++;
    }
    return c;
  }, [files]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border flex items-center justify-center mb-4">
            <Paperclip className="h-7 w-7 text-gray-300" />
          </div>
          <p className="text-[15px] font-medium text-gray-900 max-w-md leading-relaxed">
            No files yet
          </p>
          <p className="text-sm text-gray-500 max-w-md leading-relaxed mt-1">
            Attachments uploaded to any task assigned to you (or created
            by you) will appear here.
          </p>
          <button
            type="button"
            onClick={() => setUploadDialogOpen(true)}
            className="mt-5 inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Upload a file
          </button>
        </div>
        <UploadToTaskDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUploaded={() => setLocalRefreshTick((t) => t + 1)}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-b bg-white">
        <div className="flex items-center gap-1">
          {(
            [
              { id: "all" as const, label: "All", count: typeCounts.all },
              { id: "images" as const, label: "Images", count: typeCounts.images },
              { id: "pdf" as const, label: "PDF", count: typeCounts.pdf },
              { id: "docs" as const, label: "Docs", count: typeCounts.docs },
              { id: "other" as const, label: "Other", count: typeCounts.other },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors flex items-center gap-1.5",
                typeFilter === t.id
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "tabular-nums text-[10px] font-mono",
                  typeFilter === t.id ? "text-white/70" : "text-gray-400"
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              type="search"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-full sm:w-56 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => setUploadDialogOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-black hover:bg-gray-800 rounded-md flex-shrink-0"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Upload
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">
            No files match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {filtered.map((f, i) => (
              <FileCard
                key={f.id}
                file={f}
                onOpenTask={onTaskClick}
                onOpen={() => setViewerIndex(i)}
              />
            ))}
          </div>
        )}
      </div>

      {viewerIndex !== null && filtered[viewerIndex] && (
        <FileViewerModal
          files={filtered}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onOpenTask={onTaskClick}
        />
      )}

      <UploadToTaskDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploaded={() => setLocalRefreshTick((t) => t + 1)}
      />
    </div>
  );
}

function FileCard({
  file,
  onOpenTask,
  onOpen,
}: {
  file: FileItem;
  onOpenTask?: (taskId: string) => void;
  onOpen?: () => void;
}) {
  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "";

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await downloadFile(file.url, file.name);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't download file"
      );
    }
  }

  return (
    <div className="group relative border rounded-xl bg-white overflow-hidden hover:border-gray-400 hover:shadow-sm transition-all">
      {/* Hover-revealed actions: download */}
      <button
        type="button"
        onClick={handleDownload}
        className="absolute top-2 right-2 z-10 h-7 w-7 inline-flex items-center justify-center rounded-md bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-black transition-opacity"
        title="Download"
        aria-label={`Download ${file.name}`}
      >
        <Download className="h-3.5 w-3.5" />
      </button>

      {/* Preview — click opens in-app viewer instead of new tab */}
      <button
        type="button"
        onClick={onOpen}
        className="block w-full aspect-[4/3] relative bg-gray-50 border-b overflow-hidden cursor-zoom-in"
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="w-14 h-16 rounded-md bg-white border flex items-center justify-center mb-1.5 shadow-sm">
              <span
                className={cn(
                  "text-[10px] font-mono font-bold tracking-wider",
                  isPdf ? "text-[#a8893a]" : "text-gray-500"
                )}
              >
                {ext.slice(0, 4)}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-gray-400">
              {isPdf ? "PDF document" : "File"}
            </span>
          </div>
        )}
      </button>

      {/* Meta */}
      <div className="px-3 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left text-[12px] font-medium text-black truncate hover:underline"
          title={file.name}
        >
          {file.name}
        </button>
        {file.task && (
          <button
            onClick={(e) => {
              e.preventDefault();
              if (file.task) onOpenTask?.(file.task.id);
            }}
            className="mt-1 w-full text-left inline-flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-black truncate"
          >
            {file.task.project && (
              <span
                className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: file.task.project.color }}
              />
            )}
            <span className="truncate">{file.task.name}</span>
          </button>
        )}
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-400 font-mono tabular-nums">
          <span>{formatFileSize(file.size)}</span>
          <span>
            {new Date(file.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Three-letter discipline abbreviation for a project's type. Matches
 * the convention engineering firms use on drawing title blocks — DES
 * for design, CON for construction, REC for recertification, PRM for
 * permit work. Short enough to fit in a chip next to the project name
 * without truncating it.
 */
function projectTypeShort(
  type: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT"
): string {
  switch (type) {
    case "CONSTRUCTION":
      return "CON";
    case "DESIGN":
      return "DES";
    case "RECERTIFICATION":
      return "REC";
    case "PERMIT":
      return "PRM";
  }
}

/**
 * Compact label for the project's current lifecycle gate. The full
 * enum is verbose ("PRE_DESIGN", "PERMITTING") so we ship a short
 * version that reads cleanly in a chip without dominating the row.
 */
function formatGateShort(
  gate:
    | "PRE_DESIGN"
    | "DESIGN"
    | "PERMITTING"
    | "CONSTRUCTION"
    | "CLOSEOUT"
): string {
  switch (gate) {
    case "PRE_DESIGN":
      return "Pre-design";
    case "DESIGN":
      return "Design";
    case "PERMITTING":
      return "Permitting";
    case "CONSTRUCTION":
      return "Construction";
    case "CLOSEOUT":
      return "Closeout";
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Renders a Mon DD label for a single date, or "Mon DD – Mon DD" for
 * a range. Returns the fallback (formatted "due" string from
 * formatDueDate) when only a due is set, so the existing relative
 * phrasing ("Today", "Tomorrow", "Yesterday") is preserved for
 * single-date tasks.
 */
function formatRangeLabel(
  start: Date | null,
  due: Date | null,
  singleFallback: string
): string {
  if (!start && due) return singleFallback;
  if (start && !due) {
    return `From ${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  }
  if (start && due) {
    const sameYear = start.getFullYear() === due.getFullYear();
    const startStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
    });
    const dueStr = due.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
    });
    // Same-day range collapses to single date for compactness.
    if (start.toDateString() === due.toDateString()) return startStr;
    return `${startStr} – ${dueStr}`;
  }
  return "";
}

/**
 * List-column variant of the range label matching Asana's "Today - Jul 8"
 * pattern: the DUE end keeps the relative phrasing already computed by
 * formatDueDate ("Today", "Tomorrow", "Overdue · N days", a weekday, or
 * "Mon DD"), while the START is shown as an absolute "Mon DD" — unless it
 * is today/tomorrow/yesterday, in which case it uses the relative word.
 * Falls back to just the due label when no start date is present, so
 * single-date tasks render exactly as before.
 */
function formatDueColumnLabel(
  startStr: string | null,
  dueStr: string | null,
  dueRelative: string
): string {
  if (!startStr) return dueRelative;
  const start = dueDateToLocalMidnight(startStr);
  // Relative word for the start, if within ±1 day of today.
  const startDelta = daysFromToday(startStr);
  let startLabel: string;
  if (startDelta === 0) startLabel = "Today";
  else if (startDelta === 1) startLabel = "Tomorrow";
  else if (startDelta === -1) startLabel = "Yesterday";
  else
    startLabel = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  // No due date → "From <start>".
  if (!dueStr) return `From ${startLabel}`;
  const due = dueDateToLocalMidnight(dueStr);
  // Same calendar day → collapse to the single due label.
  if (start.toDateString() === due.toDateString()) return dueRelative;
  return `${startLabel} – ${dueRelative}`;
}

// ─── TaskDetailPanel helpers ──────────────────────────────

/**
 * Small ghost-style icon button used in the panel's top action row.
 * Matches Asana's quiet header chrome — no border, light hover.
 */
// forwardRef + props-spread is REQUIRED so this button works as a
// `DropdownMenuTrigger asChild` child. Radix injects onClick + ref +
// aria-* attrs onto the child element; without forwardRef the menu
// silently never opens.
const ActionIconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function ActionIconButton({ children, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        "flex items-center justify-center h-7 w-7 rounded-md text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
});

/**
 * Asana-style property row: fixed-width gray label on the left, value
 * on the right, subtle bottom divider. Optional `accessory` slot sits
 * between the label and the value (used by Projects for the count).
 */
function PropertyRow({
  label,
  accessory,
  children,
}: {
  label: string;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 min-h-9 py-1.5 border-b border-[#eeeeee] last:border-b-0">
      <div className="w-[120px] flex-shrink-0 flex items-center gap-1.5 pt-1">
        <span className="text-[12px] text-[#6f7782]">{label}</span>
        {accessory}
      </div>
      <div className="flex-1 min-w-0 flex items-center min-h-[28px]">
        {children}
      </div>
    </div>
  );
}

/**
 * Small colored pill for the Priority value. Matches the "tag" look
 * Asana uses for custom-field enumerations.
 */
function PriorityTag({ value }: { value: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    HIGH: { label: "High", bg: "bg-[#fce4e4]", text: "text-[#a8323a]" },
    MEDIUM: { label: "Medium", bg: "bg-[#fbeed3]", text: "text-[#7a5b1b]" },
    LOW: { label: "Low", bg: "bg-[#e1eefc]", text: "text-[#274a73]" },
  };
  const conf = config[value] || { label: value, bg: "bg-[#f3f4f6]", text: "text-[#1e1f21]" };
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium", conf.bg, conf.text)}>
      {conf.label}
    </span>
  );
}

// Dependency type values are constrained by the Prisma enum.
type DependencyTypeStr =
  | "FINISH_TO_START"
  | "START_TO_START"
  | "FINISH_TO_FINISH"
  | "START_TO_FINISH";

const DEPENDENCY_TYPE_META: Record<
  DependencyTypeStr,
  { short: string; label: string }
> = {
  FINISH_TO_START: { short: "FS", label: "Finish-to-Start" },
  START_TO_START: { short: "SS", label: "Start-to-Start" },
  FINISH_TO_FINISH: { short: "FF", label: "Finish-to-Finish" },
  START_TO_FINISH: { short: "SF", label: "Start-to-Finish" },
};

/**
 * One row in the Dependencies list — matches Asana's layout:
 *
 *   ⊗ Blocked by · FS ▾   ◉ Task name…   May 28 – Jun 5   ✕
 *
 * The "Blocked by · TYPE" pill opens a dropdown to change the
 * dependency type. The whole chip wraps gracefully on narrow widths.
 */
function DependencyChip({
  dependency,
  taskId,
  onChanged,
  onRemove,
}: {
  dependency: {
    id: string;
    type: DependencyTypeStr;
    blockingTask: {
      id: string;
      name: string;
      completed: boolean;
      startDate: string | null;
      dueDate: string | null;
    };
  };
  taskId: string;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const { id, type, blockingTask: bt } = dependency;
  const meta = DEPENDENCY_TYPE_META[type] ?? DEPENDENCY_TYPE_META.FINISH_TO_START;
  const start = bt.startDate ? new Date(bt.startDate) : null;
  const due = bt.dueDate ? new Date(bt.dueDate) : null;
  const dateLabel = formatRangeLabel(
    start,
    due,
    due ? due.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
  );

  async function changeType(next: DependencyTypeStr) {
    if (next === type) return;
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/dependencies?id=${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: next }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Dependency type updated");
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update dependency"
      );
    }
  }

  return (
    <div className="group flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] -ml-1.5 px-1.5 py-1 rounded hover:bg-[#f9fafb]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1 text-[#6f7782] hover:text-[#1e1f21] cursor-pointer">
            <ArrowLeftRight className="h-3 w-3 -rotate-90" />
            <span>Blocked by</span>
            <span className="text-[#9aa0a6]">·</span>
            <span className="font-medium tabular-nums">{meta.short}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {(Object.keys(DEPENDENCY_TYPE_META) as DependencyTypeStr[]).map(
            (k) => (
              <DropdownMenuItem
                key={k}
                onClick={() => changeType(k)}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-[13px]">
                  {DEPENDENCY_TYPE_META[k].label}
                </span>
                <span className="text-[11px] text-[#6f7782] font-medium tabular-nums">
                  {DEPENDENCY_TYPE_META[k].short}
                </span>
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="inline-flex items-center gap-1.5 min-w-0">
        <div
          className={cn(
            "w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0",
            bt.completed
              ? "bg-[#c9a84c] border-[#c9a84c]"
              : "border-[#c4c7cf]"
          )}
        >
          {bt.completed && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
        <span
          className={cn(
            "truncate max-w-[180px]",
            bt.completed ? "text-[#9aa0a6] line-through" : "text-[#1e1f21]"
          )}
          title={bt.name}
        >
          {bt.name}
        </span>
      </div>

      {dateLabel && (
        <>
          <span className="text-[#9aa0a6]">·</span>
          <span className="text-[#6f7782] whitespace-nowrap">{dateLabel}</span>
        </>
      )}

      <button
        onClick={onRemove}
        className="ml-auto opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
        aria-label={`Remove dependency on ${bt.name}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// Task Detail Panel
function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onAttachmentsChange,
  formatDueDate,
  personalSections = [],
  currentSectionId = null,
  onMoveToSection,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
  /** Fired when attachments are added or removed so the parent can
   *  invalidate any cached attachment view (e.g. the Files tab). */
  onAttachmentsChange?: () => void;
  formatDueDate: (date: string | null) => { text: string; className: string };
  /** User-owned personal sections for the My Tasks section dropdown
   *  (Asana parity: sits right beside the Assignee row). */
  personalSections?: PersonalSection[];
  /** The section this task currently sits in (id). */
  currentSectionId?: string | null;
  /** Move this task to another personal section (persists via uiState). */
  onMoveToSection?: (sectionId: string) => void | Promise<void>;
}) {
  // Project-section dropdown state (det-03): the linked project's own
  // sections, fetched lazily when the pane shows a project.
  const [projectSections, setProjectSections] = useState<
    { id: string; name: string }[]
  >([]);
  const [taskDetail, setTaskDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description || "");
  const [activeTab, setActiveTab] = useState<"comments" | "activity">("comments");
  const [newComment, setNewComment] = useState("");
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  // Asana-style "Mostrar las dependencias finalizadas" — completed
  // blockers hide by default; clicking the link reveals them inline.
  const [showCompletedDeps, setShowCompletedDeps] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // In-app file viewer (click a thumbnail to open without leaving)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // Comment composer: pending files attached to the next comment.
  // They aren't uploaded until the user submits the comment so
  // cancelling doesn't waste a Blob slot.
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  // Viewer state for clicking an attachment inline inside a comment.
  // We render the comment's attachments[] list when the user opens it.
  const [commentViewer, setCommentViewer] = useState<{
    files: any[];
    index: number;
  } | null>(null);
  // @-mention typeahead (mirrors the shared task detail panel).
  const [mentionCandidates, setMentionCandidates] = useState<
    MentionCandidate[]
  >([]);
  const [stagedMentions, setStagedMentions] = useState<MentionCandidate[]>([]);

  useEffect(() => {
    const pid = taskDetail?.project?.id;
    if (!pid) {
      setMentionCandidates([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${pid}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        if (cancelled || !Array.isArray(rows)) return;
        const seen = new Set<string>();
        const list: MentionCandidate[] = [];
        for (const row of rows as {
          user?: {
            id: string;
            name: string | null;
            email: string | null;
            image: string | null;
          };
        }[]) {
          const u = row?.user;
          if (!u?.id || seen.has(u.id)) continue;
          seen.add(u.id);
          list.push({
            id: u.id,
            name: u.name ?? null,
            email: u.email ?? null,
            image: u.image ?? null,
          });
        }
        setMentionCandidates(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskDetail?.project?.id]);

  async function handleAttachmentUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/tasks/${task.id}/attachments`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        okCount++;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `${file.name}: ${err.message}`
            : `${file.name}: upload failed`
        );
      }
    }
    if (okCount > 0) {
      toast.success(
        `Uploaded ${okCount} file${okCount === 1 ? "" : "s"}`
      );
      await fetchTaskDetail();
      onUpdate();
      onAttachmentsChange?.();
    }
    setUploading(false);
    // Reset the input so re-selecting the same file works
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAttachmentDelete(attachmentId: string) {
    if (!confirm("Remove this attachment?")) return;
    try {
      const res = await fetch(
        `/api/tasks/${task.id}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Attachment removed");
      await fetchTaskDetail();
      onUpdate();
      onAttachmentsChange?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove attachment"
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MORE OPTIONS — actions wired from the "..." dropdown in the
  // panel header. Mirror of the shared TaskDetailPanel component
  // so /my-tasks and project pages have identical menus.
  // ─────────────────────────────────────────────────────────────

  function handleAddSubtaskFromMenu() {
    setIsAddingSubtask(true);
    setTimeout(() => {
      subtaskInputRef.current?.focus();
      subtaskInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  async function handleConvertTo(
    newType: "TASK" | "MILESTONE" | "APPROVAL"
  ) {
    await handleUpdate("taskType", newType);
    toast.success(
      newType === "MILESTONE"
        ? "Converted to milestone"
        : newType === "APPROVAL"
          ? "Converted to approval gate"
          : "Converted to task"
    );
  }

  async function handleDuplicateTask() {
    try {
      const res = await fetch(`/api/tasks/${task.id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Task duplicated");
      onUpdate();
    } catch {
      toast.error("Failed to duplicate task");
    }
  }

  function handlePrintTask() {
    window.print();
  }

  async function handleDeleteTask() {
    if (
      !confirm(
        "Delete this task? This will permanently remove the task, its subtasks, comments, and attachments. This cannot be undone."
      )
    )
      return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Task deleted");
      onUpdate();
      onClose();
    } catch {
      toast.error("Failed to delete task");
    }
  }

  async function handleDependencyRemove(dependencyId: string) {
    try {
      const res = await fetch(
        `/api/tasks/${task.id}/dependencies?id=${dependencyId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Dependency removed");
      await fetchTaskDetail();
      onUpdate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove dependency"
      );
    }
  }

  useEffect(() => {
    fetchTaskDetail();
    // Reset the comment draft on task switch — this panel also stays
    // mounted across task changes, so staged mentions / typed text must
    // not leak into the next task's comment.
    setNewComment("");
    setStagedMentions([]);
    setPendingCommentFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // det-03: fetch the linked project's sections so the Projects row can
  // offer a project-section dropdown (Asana shows this inline). Cleared
  // when the task has no project. The project detail endpoint already
  // returns its sections ordered by position.
  const linkedProjectId: string | null = taskDetail?.project?.id ?? null;
  useEffect(() => {
    if (!linkedProjectId) {
      setProjectSections([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${linkedProjectId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const secs = Array.isArray(data?.sections)
          ? data.sections.map((s: { id: string; name: string }) => ({
              id: s.id,
              name: s.name,
            }))
          : [];
        setProjectSections(secs);
      } catch {
        // Non-fatal — the dropdown just won't render its options.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedProjectId]);

  async function fetchTaskDetail() {
    setLoading(true);
    try {
      const [res, likeRes] = await Promise.all([
        fetch(`/api/tasks/${task.id}`),
        fetch(`/api/tasks/${task.id}/like`),
      ]);
      if (res.ok) {
        const data = await res.json();
        setTaskDetail(data);
        setName(data.name);
        setDescription(data.description || "");
      }
      if (likeRes.ok) {
        const likeData = await likeRes.json();
        setLiked(Boolean(likeData.liked));
      }
    } catch (error) {
      console.error("Error fetching task detail:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const prev = liked;
    setLiked(!prev);
    try {
      const res = await fetch(`/api/tasks/${task.id}/like`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setLiked(Boolean(data.liked));
      // Refresh the list so the "Likes" column count reflects the change.
      onUpdate();
    } catch {
      setLiked(prev);
      toast.error("Failed to update like");
    } finally {
      setLikeBusy(false);
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
    // Accept comments that are just attachments (no text body) so the
    // user can drop a screenshot without having to caption it. But
    // require at least one of the two.
    const hasText = newComment.trim().length > 0;
    const hasFiles = pendingCommentFiles.length > 0;
    if (!hasText && !hasFiles) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Persist a single non-breaking space when the user attached
          // a file with no caption — the API requires non-empty content.
          // Confirmed @-mentions are wrapped in the data-user-id spans
          // the server parses for MENTIONED notifications.
          content: hasText ? buildCommentContent(newComment, stagedMentions) : " ",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const created = await res.json();

      // Upload each pending file with the new comment's id so the
      // attachments render inline under the message instead of as
      // free-floating files on the task.
      let attachmentsUploaded = 0;
      for (const file of pendingCommentFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("commentId", created.id);
        try {
          const upRes = await fetch(
            `/api/tasks/${task.id}/attachments`,
            { method: "POST", body: fd }
          );
          if (!upRes.ok) {
            const upErr = await upRes.json().catch(() => ({}));
            throw new Error(upErr.error || `HTTP ${upRes.status}`);
          }
          attachmentsUploaded++;
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `${file.name}: ${err.message}`
              : `${file.name}: upload failed`
          );
        }
      }

      setNewComment("");
      setStagedMentions([]);
      setPendingCommentFiles([]);
      if (commentFileInputRef.current) commentFileInputRef.current.value = "";
      await fetchTaskDetail();
      if (attachmentsUploaded > 0) {
        onUpdate();
        onAttachmentsChange?.();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't post comment"
      );
    } finally {
      setPostingComment(false);
    }
  }

  function handleCommentFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Block anything > 10 MB up front so the user gets an instant
    // error instead of finding out after they hit Send.
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: exceeds 10 MB limit`);
        continue;
      }
      ok.push(f);
    }
    setPendingCommentFiles((prev) => [...prev, ...ok]);
    // Reset the input so picking the same file twice in a row works.
    if (commentFileInputRef.current) commentFileInputRef.current.value = "";
  }

  const dueDateInfo = formatDueDate(taskDetail?.dueDate);

  return (
    /* Slide-over panel — absolutely positioned over the list area
       (parent at /my-tasks is `relative`) so it floats on top
       without shifting the columns underneath. Same pattern Asana
       uses for its task detail. Slides in from the right with a
       subtle shadow. */
    <div
      className="absolute top-0 right-0 bottom-0 w-[500px] border-l border-[#e8e8e8] bg-white flex flex-col z-30 shadow-[-12px_0_32px_-12px_rgba(0,0,0,0.06)] animate-in slide-in-from-right-5 duration-200 text-[#1e1f21]"
    >
      {/* ── Top action row ─────────────────────────────────────
          Left: Mark-complete pill (Asana style — turns green when
          complete). Right: heart / paperclip / link / expand /
          more / close. Title intentionally NOT in this row. */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0">
        <button
          onClick={handleToggleComplete}
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-medium border transition-colors",
            taskDetail?.completed
              ? "bg-[#e6f4ea] text-[#207544] border-transparent hover:bg-[#d6ecde]"
              : "text-[#6f7782] border-[#e8e8e8] hover:bg-[#f3f4f6] hover:text-[#1e1f21]"
          )}
        >
          <Check
            className={cn(
              "h-3.5 w-3.5",
              taskDetail?.completed ? "text-[#207544]" : "text-[#9aa0a6]"
            )}
          />
          {taskDetail?.completed ? "Completed" : "Mark complete"}
        </button>
        <div className="flex items-center gap-0.5 text-[#6f7782]">
          {/* Hidden file input — clicked programmatically by the
              Paperclip button. Accepts multiple files at once;
              each upload hits /api/tasks/:id/attachments which
              persists to Vercel Blob and creates a DB row. */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleAttachmentUpload}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          />
          <ActionIconButton
            onClick={handleToggleLike}
            disabled={likeBusy}
            title={liked ? "Unlike" : "Like"}
            className={cn(liked && "text-[#c9a84c]")}
          >
            <Heart
              className={cn(
                "h-[15px] w-[15px]",
                liked && "fill-current"
              )}
            />
          </ActionIconButton>
          <ActionIconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file"
          >
            {uploading ? (
              <Loader2 className="h-[15px] w-[15px] animate-spin" />
            ) : (
              <Paperclip className="h-[15px] w-[15px]" />
            )}
          </ActionIconButton>
          <ActionIconButton
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/tasks/${task.id}`);
              toast.success("Link copied to clipboard");
            }}
            title="Copy link"
          >
            <Link2 className="h-[15px] w-[15px]" />
          </ActionIconButton>
          <ActionIconButton
            onClick={() => window.open(`/tasks/${task.id}`, "_blank")}
            title="Open full task"
          >
            <Maximize2 className="h-[15px] w-[15px]" />
          </ActionIconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionIconButton title="More options">
                <MoreHorizontal className="h-[15px] w-[15px]" />
              </ActionIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px]">
              <DropdownMenuItem onClick={handleAddSubtaskFromMenu}>
                <ListPlus className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span className="flex-1">Add subtask</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span className="flex-1">Attach files</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/tasks/${task.id}`
                  );
                  toast.success("Link copied to clipboard");
                }}
              >
                <Link2 className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span className="flex-1">Copy task link</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CornerUpRight className="mr-2 h-4 w-4 text-[#6f7782]" />
                  <span>Convert to</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => handleConvertTo("TASK")}
                    disabled={
                      !taskDetail?.taskType ||
                      taskDetail.taskType === "TASK"
                    }
                  >
                    <CheckSquare className="mr-2 h-4 w-4 text-[#6f7782]" />
                    Task
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleConvertTo("MILESTONE")}
                    disabled={taskDetail?.taskType === "MILESTONE"}
                  >
                    <Diamond
                      className="mr-2 h-4 w-4"
                      fill="#c9a84c"
                      color="#c9a84c"
                    />
                    Milestone
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleConvertTo("APPROVAL")}
                    disabled={taskDetail?.taskType === "APPROVAL"}
                  >
                    <ThumbsUp
                      className="mr-2 h-4 w-4"
                      fill="#c9a84c"
                      color="#c9a84c"
                    />
                    Approval gate
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={handleDuplicateTask}>
                <Copy className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span>Duplicate task</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintTask}>
                <Printer className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span>Print</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDeleteTask}
                className="text-[#c91111] focus:text-[#c91111] focus:bg-[#fbe9e9]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete task</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ActionIconButton onClick={onClose} title="Close">
            <X className="h-[15px] w-[15px]" />
          </ActionIconButton>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Overdue strip — only when the task is past due AND not
              already completed. Same monochrome+gold treatment as
              the rest of the slide-over, just slightly louder so it
              registers as a flag rather than decoration. */}
          {taskDetail?.dueDate &&
            !taskDetail.completed &&
            // daysFromToday folds the UTC-midnight due date onto the local
            // calendar day: strictly-negative means past due. A task due
            // TODAY (0) is never flagged overdue here (date-only rule).
            daysFromToday(taskDetail.dueDate) < 0 && (
              <div className="px-4 py-2 bg-black text-white text-[12px] font-medium flex items-center gap-2 border-b border-black">
                <Flag className="h-3.5 w-3.5 text-[#c9a84c] flex-shrink-0" />
                {(() => {
                  const days = -daysFromToday(taskDetail.dueDate);
                  return `Overdue · ${days} day${days === 1 ? "" : "s"} past due`;
                })()}
              </div>
            )}

          {/* ── Visibility bar (full-width gray) ─────────────── */}
          {(() => {
            // Prefer the freshly-fetched detail project, fall back to the
            // list task's project. Projectless / PRIVATE-project tasks are
            // "Only me"; WORKSPACE-project tasks are workspace-visible.
            const proj = taskDetail?.project ?? task.project;
            const isPrivate = !proj || proj.visibility === "PRIVATE";
            return (
              <div className="px-5 h-9 bg-[#f6f7f8] text-[12px] text-[#6f7782] flex items-center gap-1.5">
                {isPrivate ? (
                  <>
                    <Lock className="h-3 w-3" />
                    This task is visible only to you
                  </>
                ) : (
                  <>
                    <Globe className="h-3 w-3" />
                    This task is visible to everyone in My workspace
                  </>
                )}
              </div>
            );
          })()}

          {/* ── Task title (below visibility bar) ────────────── */}
          <div className="px-5 pt-4 pb-3 flex items-start gap-2">
            {/* Task-type glyph — milestone and approval get a small
                gold icon so the type is legible without opening a
                dropdown. Regular tasks stay clean. */}
            {taskDetail?.taskType === "MILESTONE" && (
              <Diamond
                className="h-5 w-5 text-[#c9a84c] flex-shrink-0 mt-1"
                fill="#c9a84c"
                aria-label="Milestone"
              />
            )}
            {taskDetail?.taskType === "APPROVAL" && (
              <ThumbsUp
                className="h-5 w-5 text-[#c9a84c] flex-shrink-0 mt-1"
                aria-label="Approval"
              />
            )}
            <textarea
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== taskDetail?.name && handleUpdate("name", name)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              rows={1}
              className="flex-1 min-w-0 text-[22px] font-semibold leading-snug bg-transparent outline-none resize-none placeholder:text-[#9aa0a6] text-[#1e1f21]"
              placeholder="Task name"
            />
          </div>

          {/* ── Blocked badge ───────────────────────────────────
              Renders only when the task has at least one incomplete
              blocker. Real PM tools (Asana, MS Project, ClickUp) flag
              this as a hard signal so the assignee knows they cannot
              actually start the work yet. */}
          {(() => {
            const blockerCount =
              taskDetail?.dependencies?.filter(
                (d: { blockingTask: { completed: boolean } }) =>
                  !d.blockingTask.completed
              ).length ?? 0;
            if (blockerCount === 0 || taskDetail?.completed) return null;
            return (
              <div className="px-5 pb-1 -mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#fbeed3] text-[#7a5b1b]">
                  <Flag className="w-3 h-3" />
                  Blocked
                  {blockerCount > 1 ? ` · ${blockerCount}` : ""}
                </span>
              </div>
            );
          })()}

          {/* ── Property rows (Asana-style compact) ──────────── */}
          <div className="px-5 pb-2">
            <PropertyRow label="Assignee">
              <AssigneeSelector
                value={taskDetail?.assignee || null}
                onChange={(user) => handleUpdate("assigneeId", user?.id || null)}
                trigger={
                  taskDetail?.assignee ? (
                    <button className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-[#1e1f21] text-white">
                          {taskDetail.assignee.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[13px] text-[#1e1f21]">{taskDetail.assignee.name}</span>
                    </button>
                  ) : (
                    <button className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] cursor-pointer">
                      <UserPlus2 className="h-3.5 w-3.5" />
                      No assignee
                    </button>
                  )
                }
              />
            </PropertyRow>

            {/* Personal-section dropdown (Asana parity: sits right by the
                Assignee row). Moves this task between the user's My Tasks
                sections; persistence + optimistic bucketing are handled
                by the parent's onMoveToSection. */}
            {personalSections.length > 0 && onMoveToSection && (
              <PropertyRow label="Section">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#1e1f21] hover:bg-[#f3f4f6] cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5 text-[#6f7782]" />
                      {personalSections.find((s) => s.id === currentSectionId)
                        ?.name ?? "Recently assigned"}
                      <ChevronDown className="h-3 w-3 text-[#9aa0a6]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {personalSections.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={() => {
                          if (s.id !== currentSectionId) onMoveToSection(s.id);
                        }}
                        className="text-[13px]"
                      >
                        {s.id === currentSectionId && (
                          <Check className="h-3.5 w-3.5 text-[#6f7782]" />
                        )}
                        <span className={s.id === currentSectionId ? "font-medium" : ""}>
                          {s.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </PropertyRow>
            )}

            <PropertyRow label="Due date">
              <DueDatePicker
                startDate={taskDetail?.startDate ? new Date(taskDetail.startDate) : null}
                dueDate={taskDetail?.dueDate ? new Date(taskDetail.dueDate) : null}
                onChange={async (start, due) => {
                  // ONE PATCH with both fields — not two parallel ones.
                  // Two PATCHes each trigger their own refetch and the
                  // GETs race; whichever GET resolves last wins, which
                  // can silently drop one of the two new values.
                  try {
                    const res = await fetch(`/api/tasks/${task.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        startDate: start?.toISOString() || null,
                        dueDate: due?.toISOString() || null,
                      }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    // Surface cascade so the user knows we shifted
                    // downstream tasks instead of silently moving them.
                    const payload = (await res.json()) as {
                      cascadeShifts?: { taskName: string }[];
                    };
                    const shifts = payload?.cascadeShifts ?? [];
                    if (shifts.length === 1) {
                      toast.success(`Shifted dependent "${shifts[0].taskName}"`);
                    } else if (shifts.length > 1) {
                      toast.success(`Shifted ${shifts.length} dependent tasks`);
                    }
                    await fetchTaskDetail();
                    onUpdate();
                  } catch (err) {
                    console.error("Error saving date range:", err);
                    toast.error("Couldn't save the date range");
                  }
                }}
                trigger={
                  // ONE button regardless of state. Conditional children
                  // would change the element's React identity on every
                  // update and Radix would close the popover.
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[13px] hover:bg-[#f3f4f6] cursor-pointer",
                      taskDetail?.dueDate || taskDetail?.startDate
                        ? "text-[#1e1f21]"
                        : "text-[#6f7782] hover:text-[#1e1f21]"
                    )}
                  >
                    {!(taskDetail?.dueDate || taskDetail?.startDate) && (
                      <Calendar className="h-3.5 w-3.5" />
                    )}
                    {taskDetail?.dueDate || taskDetail?.startDate
                      ? formatRangeLabel(
                          // Fold onto the local calendar day so the label
                          // matches the day the user picked west of UTC.
                          taskDetail?.startDate ? dueDateToLocalMidnight(taskDetail.startDate) : null,
                          taskDetail?.dueDate ? dueDateToLocalMidnight(taskDetail.dueDate) : null,
                          dueDateInfo.text
                        )
                      : "No due date"}
                  </button>
                }
              />
            </PropertyRow>

            {(() => {
              type DepRow = {
                id: string;
                type: DependencyTypeStr;
                blockingTask: {
                  id: string;
                  name: string;
                  completed: boolean;
                  startDate: string | null;
                  dueDate: string | null;
                };
              };
              const allDeps: DepRow[] = taskDetail?.dependencies ?? [];
              const activeDeps = allDeps.filter((d) => !d.blockingTask.completed);
              const completedDeps = allDeps.filter((d) => d.blockingTask.completed);
              return (
                <PropertyRow
                  label="Dependencies"
                  accessory={
                    activeDeps.length > 0 && (
                      <span className="text-[11px] text-[#6f7782] tabular-nums">
                        {activeDeps.length}
                      </span>
                    )
                  }
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
                    {activeDeps.map((dep) => (
                      <DependencyChip
                        key={dep.id}
                        dependency={dep}
                        taskId={task.id}
                        onChanged={() => {
                          fetchTaskDetail();
                          onUpdate();
                        }}
                        onRemove={() => handleDependencyRemove(dep.id)}
                      />
                    ))}
                    {showCompletedDeps &&
                      completedDeps.map((dep) => (
                        <DependencyChip
                          key={dep.id}
                          dependency={dep}
                          taskId={task.id}
                          onChanged={() => {
                            fetchTaskDetail();
                            onUpdate();
                          }}
                          onRemove={() => handleDependencyRemove(dep.id)}
                        />
                      ))}
                    <DependenciesPicker
                      taskId={task.id}
                      existingBlockingTaskIds={allDeps.map(
                        (d) => d.blockingTask.id
                      )}
                      onAdded={() => {
                        fetchTaskDetail();
                        onUpdate();
                      }}
                      trigger={
                        <button className="-ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#3b82f6] hover:bg-[#f3f4f6] hover:underline cursor-pointer text-left w-fit">
                          Add dependencies
                        </button>
                      }
                    />
                    {completedDeps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCompletedDeps((v) => !v)}
                        className="-ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#3b82f6] hover:bg-[#f3f4f6] hover:underline cursor-pointer text-left w-fit"
                      >
                        {showCompletedDeps
                          ? `Hide completed dependencies (${completedDeps.length})`
                          : `Show completed dependencies (${completedDeps.length})`}
                      </button>
                    )}
                  </div>
                </PropertyRow>
              );
            })()}

            <PropertyRow
              label="Projects"
              accessory={
                taskDetail?.project && (
                  <span className="text-[11px] text-[#6f7782] tabular-nums">1</span>
                )
              }
            >
              <div className="flex-1 min-w-0">
                <ProjectSelector
                  value={
                    taskDetail?.project
                      ? {
                          id: taskDetail.project.id,
                          name: taskDetail.project.name,
                          color: taskDetail.project.color,
                        }
                      : null
                  }
                  onChange={(project) => handleUpdate("projectId", project?.id || null)}
                />
                {/* Engineering meta on the linked project — discipline
                    type (CON/DES/REC/PRM) and current lifecycle gate
                    (Pre-design → Closeout) — surfaced inline so the
                    user doesn't have to navigate to the project page
                    to know which stage they're working in. */}
                {taskDetail?.project && (taskDetail.project.type || taskDetail.project.gate) && (
                  <div className="mt-1 flex items-center gap-1.5">
                    {taskDetail.project.type && (
                      <span
                        className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[#6f7782]"
                        title={`Project type: ${taskDetail.project.type}`}
                      >
                        {projectTypeShort(taskDetail.project.type)}
                      </span>
                    )}
                    {taskDetail.project.gate && (
                      <span
                        className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#c9a84c]/15 text-[#a8893a]"
                        title={`Lifecycle gate: ${taskDetail.project.gate}`}
                      >
                        {formatGateShort(taskDetail.project.gate)}
                      </span>
                    )}
                  </div>
                )}
                {/* det-03: project-section dropdown — which SECTION of the
                    linked project this task sits in. Asana shows this
                    inline on the project row. PATCHes { sectionId } via
                    handleUpdate (already accepted by /api/tasks/:id). */}
                {taskDetail?.project && projectSections.length > 0 && (
                  <div className="mt-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[12px] text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] cursor-pointer"
                        >
                          <Layers className="h-3 w-3" />
                          {taskDetail?.section?.name ?? "No section"}
                          <ChevronDown className="h-3 w-3 text-[#9aa0a6]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[180px]">
                        {projectSections.map((s) => (
                          <DropdownMenuItem
                            key={s.id}
                            onClick={() => {
                              if (s.id !== taskDetail?.section?.id) {
                                handleUpdate("sectionId", s.id);
                              }
                            }}
                            className="text-[13px]"
                          >
                            {s.id === taskDetail?.section?.id && (
                              <Check className="h-3.5 w-3.5 text-[#6f7782]" />
                            )}
                            <span className={s.id === taskDetail?.section?.id ? "font-medium" : ""}>
                              {s.name}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </PropertyRow>

            <PropertyRow label="Priority">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="-ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer"
                  >
                    {taskDetail?.priority && taskDetail.priority !== "NONE" ? (
                      <PriorityTag value={taskDetail.priority} />
                    ) : (
                      <span className="text-[13px] text-[#6f7782]">No priority</span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "HIGH")}>
                    <PriorityTag value="HIGH" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "MEDIUM")}>
                    <PriorityTag value="MEDIUM" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "LOW")}>
                    <PriorityTag value="LOW" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdate("priority", "NONE")}>
                    <span className="text-[13px] text-[#6f7782]">No priority</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PropertyRow>

            {/* Project's custom fields — schema-defined + per-task
                values rendered with type-appropriate editors. Hidden
                automatically when the project has no custom fields. */}
            <CustomFieldsSection
              taskId={task.id}
              projectId={taskDetail?.project?.id ?? null}
              values={taskDetail?.customFieldValues ?? []}
              onChanged={() => {
                fetchTaskDetail();
                onUpdate();
              }}
            />
          </div>

          {/* ── Description (inline, no card) ────────────────── */}
          <div className="px-5 pt-3 pb-4">
            <h4 className="text-[12px] font-medium text-[#6f7782] mb-1.5">Description</h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== taskDetail?.description && handleUpdate("description", description)}
              placeholder="What is this task about?"
              rows={2}
              className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none placeholder:text-[#9aa0a6] text-[#1e1f21] focus:bg-[#f9fafb] focus:rounded-md focus:px-2 focus:py-1 transition-[background-color] -mx-0"
            />
          </div>

          {/* ── Attachments (Asana-style minimal rows) ───────── */}
          <div className="px-5 pt-3 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <h4 className="text-[12px] font-medium text-[#6f7782]">
                Attachments {taskDetail?.attachments?.length > 0 && `(${taskDetail.attachments.length})`}
              </h4>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center justify-center h-4 w-4 rounded text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] disabled:opacity-50"
                title="Add attachment"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {!taskDetail?.attachments || taskDetail.attachments.length === 0 ? null : (
              <ul className="space-y-0.5 -mx-2">
                {taskDetail.attachments.map(
                  (
                    a: {
                      id: string;
                      name: string;
                      url: string;
                      size: number;
                      mimeType: string;
                      createdAt: string;
                    },
                    i: number
                  ) => {
                    const isImage = a.mimeType.startsWith("image/");
                    return (
                      <li
                        key={a.id}
                        className="group flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[#f3f4f6]"
                      >
                        <button
                          type="button"
                          onClick={() => setViewerIndex(i)}
                          className="h-6 w-6 flex-shrink-0 rounded overflow-hidden bg-[#f3f4f6] flex items-center justify-center cursor-zoom-in"
                          aria-label={`Open ${a.name}`}
                        >
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                          ) : (
                            <Paperclip className="h-3 w-3 text-[#6f7782]" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewerIndex(i)}
                          className="flex-1 min-w-0 text-left cursor-zoom-in flex items-baseline gap-1.5"
                        >
                          <span className="text-[13px] text-[#1e1f21] truncate group-hover:underline">
                            {a.name}
                          </span>
                          <span className="text-[11px] text-[#9aa0a6] tabular-nums whitespace-nowrap">
                            {formatFileSize(a.size)} ·{" "}
                            {new Date(a.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              try {
                                await downloadFile(a.url, a.name);
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Couldn't download file"
                                );
                              }
                            }}
                            className="p-1 text-[#9aa0a6] hover:text-[#1e1f21]"
                            aria-label={`Download ${a.name}`}
                            title="Download"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleAttachmentDelete(a.id)}
                            className="p-1 text-[#9aa0a6] hover:text-[#1e1f21]"
                            aria-label="Remove attachment"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </li>
                    );
                  }
                )}
              </ul>
            )}
          </div>

          {/* ── Subtasks (Asana-style minimal) ───────────────── */}
          <div className="px-5 pt-3 pb-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <h4 className="text-[12px] font-medium text-[#6f7782]">
                Subtasks {taskDetail?.subtasks?.length > 0 && `(${taskDetail.subtasks.length})`}
              </h4>
              <button
                onClick={() => {
                  setIsAddingSubtask(true);
                  setTimeout(() => subtaskInputRef.current?.focus(), 0);
                }}
                className="flex items-center justify-center h-4 w-4 rounded text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21]"
                title="Add subtask"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0">
              {taskDetail?.subtasks?.map((subtask: any) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 group py-1.5 border-b border-[#eeeeee] last:border-b-0"
                >
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
                    <div
                      className={cn(
                        "w-[15px] h-[15px] rounded-full border flex items-center justify-center transition-colors",
                        subtask.completed
                          ? "bg-[#c9a84c] border-[#c9a84c]"
                          : "border-[#c4c7cf] hover:border-[#1e1f21]"
                      )}
                    >
                      {subtask.completed && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </button>
                  <span
                    className={cn(
                      "text-[13px] flex-1",
                      subtask.completed ? "line-through text-[#9aa0a6]" : "text-[#1e1f21]"
                    )}
                  >
                    {subtask.name}
                  </span>
                </div>
              ))}
              {isAddingSubtask ? (
                <div className="flex items-center gap-2 py-1.5 border-b border-[#eeeeee]">
                  <div className="w-[15px] h-[15px] rounded-full border border-[#c4c7cf] flex-shrink-0" />
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
                            body: JSON.stringify({
                              name: newSubtaskName.trim(),
                              parentTaskId: task.id,
                            }),
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
                    placeholder="Type a subtask name"
                    className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6]"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  className="flex items-center gap-2 py-1.5 w-full text-left text-[13px] text-[#6f7782] hover:text-[#1e1f21]"
                  onClick={() => {
                    setIsAddingSubtask(true);
                    setTimeout(() => subtaskInputRef.current?.focus(), 0);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add subtask
                </button>
              )}
            </div>
          </div>

          {/* ── Activity tabs ────────────────────────────────── */}
          <div className="border-t border-[#e8e8e8] mt-2">
            <div className="flex gap-5 px-5">
              <button
                onClick={() => setActiveTab("comments")}
                className={cn(
                  "py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                  activeTab === "comments"
                    ? "text-[#1e1f21] border-[#1e1f21]"
                    : "text-[#6f7782] border-transparent hover:text-[#1e1f21]"
                )}
              >
                Comments
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                  activeTab === "activity"
                    ? "text-[#1e1f21] border-[#1e1f21]"
                    : "text-[#6f7782] border-transparent hover:text-[#1e1f21]"
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
                {taskDetail?.comments?.map((comment: any) => {
                  const atts = (comment.attachments ?? []) as Array<{
                    id: string;
                    name: string;
                    url: string;
                    mimeType: string;
                    size: number;
                    createdAt: string;
                  }>;
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-white border border-black">
                          {comment.author?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{comment.author?.name}</span>
                          <span className="text-xs text-black">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {comment.content && comment.content.trim() && (
                          <p className="text-sm text-black mt-1 whitespace-pre-wrap break-words">
                            {renderCommentContent(comment.content)}
                          </p>
                        )}
                        {atts.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-1.5 max-w-md">
                            {atts.map((a, i) => {
                              const isImg = a.mimeType.startsWith("image/");
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() =>
                                    setCommentViewer({ files: atts, index: i })
                                  }
                                  className={cn(
                                    "group flex items-center gap-2 border rounded-md p-1.5 bg-white hover:border-gray-400 hover:bg-gray-50 text-left transition-colors",
                                    isImg && "flex-col items-stretch p-0 overflow-hidden"
                                  )}
                                  title={a.name}
                                >
                                  {isImg ? (
                                    <>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={a.url}
                                        alt={a.name}
                                        className="w-full h-24 object-cover"
                                      />
                                      <div className="px-2 py-1">
                                        <p className="text-[10px] font-medium text-black truncate">
                                          {a.name}
                                        </p>
                                        <p className="text-[9px] text-gray-500 font-mono tabular-nums">
                                          {formatFileSize(a.size)}
                                        </p>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="h-8 w-8 rounded bg-gray-100 border flex items-center justify-center flex-shrink-0">
                                        <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-medium text-black truncate">
                                          {a.name}
                                        </p>
                                        <p className="text-[9px] text-gray-500 font-mono tabular-nums">
                                          {formatFileSize(a.size)}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!taskDetail?.comments || taskDetail.comments.length === 0) && (
                  <p className="text-[13px] text-[#9aa0a6] text-center py-6">No comments yet</p>
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

      {/* ── Comment Input (anchored bottom) ──────────────── */}
      <div className="px-5 py-3 border-t border-[#e8e8e8] bg-white">
        <div className="flex gap-2.5 items-start">
          <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
            <AvatarFallback className="text-[11px] bg-[#1e1f21] text-white">U</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 rounded-md border border-[#e8e8e8] bg-white focus-within:border-[#c4c7cf] transition-colors px-2.5 py-1.5">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                candidates={mentionCandidates}
                onMentionAdd={(member) =>
                  setStagedMentions((prev) =>
                    prev.some((m) => m.id === member.id)
                      ? prev
                      : [...prev, member]
                  )
                }
                onSubmit={() => {
                  if (!postingComment) handleAddComment();
                }}
                placeholder={
                  pendingCommentFiles.length > 0
                    ? "Caption (optional)…"
                    : "Add a comment… @ to mention"
                }
                disabled={postingComment}
                className="w-full text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6] text-[#1e1f21] leading-5 max-h-24 overflow-y-auto"
              />
              <input
                ref={commentFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleCommentFilesPicked}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              />
              <button
                type="button"
                onClick={() => commentFileInputRef.current?.click()}
                disabled={postingComment}
                className="flex items-center justify-center h-6 w-6 rounded text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] disabled:opacity-50"
                title="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleAddComment}
                disabled={
                  postingComment ||
                  (!newComment.trim() && pendingCommentFiles.length === 0)
                }
                className="h-6 px-2.5 text-[12px] font-medium rounded bg-[#1e1f21] text-white hover:bg-[#000] disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
              >
                {postingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : "Post"}
              </button>
            </div>
            {pendingCommentFiles.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {pendingCommentFiles.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#e8e8e8] bg-[#f9fafb] text-[11px] text-[#1e1f21]"
                  >
                    <Paperclip className="h-3 w-3 text-[#6f7782]" />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <span className="text-[#9aa0a6] tabular-nums">{formatFileSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingCommentFiles((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-[#9aa0a6] hover:text-[#1e1f21] ml-0.5"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Collaborators footer ─────────────────────────── */}
      <div className="px-5 py-2.5 border-t border-[#e8e8e8] flex items-center justify-between text-[12px] bg-white">
        <div className="flex items-center gap-1.5">
          <span className="text-[#6f7782]">Collaborators</span>
          <div className="flex items-center gap-1">
            {taskDetail?.collaborators?.map((collab: any) => (
              <Avatar key={collab.id} className="h-5 w-5" title={collab.name || "User"}>
                <AvatarFallback className="text-[9px] bg-[#1e1f21] text-white">
                  {(collab.name || "U").charAt(0)}
                </AvatarFallback>
              </Avatar>
            ))}
            {(!taskDetail?.collaborators || taskDetail.collaborators.length === 0) && (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] bg-[#1e1f21] text-white">U</AvatarFallback>
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
                <button className="h-5 w-5 rounded-full border border-dashed border-[#c4c7cf] flex items-center justify-center hover:border-[#1e1f21] hover:bg-[#f3f4f6] cursor-pointer">
                  <Plus className="h-2.5 w-2.5 text-[#9aa0a6]" />
                </button>
              }
            />
          </div>
        </div>
        <button
          className="text-[12px] text-[#6f7782] hover:text-[#1e1f21]"
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
        </button>
      </div>

      {viewerIndex !== null && taskDetail?.attachments?.[viewerIndex] && (
        <FileViewerModal
          files={taskDetail.attachments}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {commentViewer && commentViewer.files[commentViewer.index] && (
        <FileViewerModal
          files={commentViewer.files}
          initialIndex={commentViewer.index}
          onClose={() => setCommentViewer(null)}
        />
      )}
    </div>
  );
}
