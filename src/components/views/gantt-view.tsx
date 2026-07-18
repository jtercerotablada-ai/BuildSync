"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Filter,
  Diamond,
  ThumbsUp,
  Circle,
  CheckCircle2,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { DueDatePicker } from "@/components/tasks/due-date-picker";
import {
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  startOfQuarter,
  format,
  differenceInDays,
  isSameDay,
  startOfDay,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWeekend,
} from "date-fns";
import { daysFromToday, dueDateToLocalMidnight } from "@/lib/date-only";

// ============================================
// TYPES — kept identical to timeline-view.tsx so
// project-content.tsx can pass the same props.
// ============================================

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  startDate?: string | null;
  priority: string;
  taskType?: "TASK" | "MILESTONE" | "APPROVAL" | null;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  subtasks?: { id: string; completed: boolean }[];
  _count?: {
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

interface GanttViewProps {
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  projectId: string;
  /** Project members (owner included) for the inline assignee picker. */
  members?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  }[];
}

type ZoomLevel = "day" | "week" | "month" | "quarter";
type TaskFilter = "all" | "incomplete" | "completed" | "due_this_week";

type DependencyType =
  | "FINISH_TO_START"
  | "START_TO_START"
  | "FINISH_TO_FINISH"
  | "START_TO_FINISH";

interface DependencyRow {
  id: string;
  type: DependencyType;
  dependentTaskId: string;
  blockingTaskId: string;
}

// Asana's dependency-type menu: full name + the two-letter code.
const DEPENDENCY_TYPES: { type: DependencyType; label: string; code: string }[] =
  [
    { type: "FINISH_TO_START", label: "Finish to start", code: "FS" },
    { type: "FINISH_TO_FINISH", label: "Finish to finish", code: "FF" },
    { type: "START_TO_START", label: "Start to start", code: "SS" },
    { type: "START_TO_FINISH", label: "Start to finish", code: "SF" },
  ];

function dependencyLabel(type: DependencyType): string {
  const t = DEPENDENCY_TYPES.find((d) => d.type === type);
  return t ? `${t.label} · ${t.code}` : "";
}

// ============================================
// PALETTE — cloned from Asana's Gantt (measured in the real app):
// every bar is the same blue (no priority coloring), today is a 2px
// blue stripe, weekends are pale gray bands.
// ============================================

const BAR_FILL = "#79ABFF"; // Asana TaskCell blue
const BAR_FILL_COMPLETED = "#C3D3F0"; // muted blue for done tasks
const TODAY_BLUE = "#335FB5"; // today stripe + axis dot
const WEEKEND_STRIPE = "#E8E9EA"; // weekend bands
const DATE_OVERDUE = "#B4304C"; // red due text
const DATE_TODAY = "#14865E"; // green "– Today" due text

// ============================================
// LAYOUT CONSTANTS — Asana's measured geometry
// ============================================

const ROW_HEIGHT = 37;
const BAR_HEIGHT = 24;
const DUE_ONLY_W = 12; // pill width for tasks without a start date
const HEADER_HEIGHT = 48; // two 24px header rows
const NAME_COL_W = 254;
const DUE_COL_W = 120;
const BLOCKED_COL_W = 200;
const SIDEBAR_W = NAME_COL_W + DUE_COL_W + BLOCKED_COL_W; // 574

// Row order inside each section (Asana's "Ordenar")
const PRIORITY_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  NONE: 3,
};

const ZOOM_ORDER: ZoomLevel[] = ["day", "week", "month", "quarter"];
const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: "Days",
  week: "Weeks",
  month: "Months",
  quarter: "Quarters",
};

// ============================================
// DEPENDENCY CONNECTOR GEOMETRY (copied from timeline-view.tsx)
// ============================================

/** Convert a polyline into an SVG path with rounded corners of radius `r`. */
function roundedPolyline(pts: { x: number; y: number }[], r: number): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const ax = p1.x - ((p1.x - p0.x) / d1) * rr;
    const ay = p1.y - ((p1.y - p0.y) / d1) * rr;
    const bx = p1.x + ((p2.x - p1.x) / d2) * rr;
    const by = p1.y + ((p2.y - p1.y) / d2) * rr;
    d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

/** Rounded orthogonal elbow between two bar endpoints (MS Project / Asana style). */
function dependencyElbowPath(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  sxOutDir: number,
  exInDir: number
): string {
  const STUB = 14;
  const R = 7;
  const sOutX = sx + sxOutDir * STUB;
  const eInX = ex + exInDir * STUB;

  if (Math.abs(sy - ey) < 1) {
    return `M ${sx} ${sy} L ${ex} ${ey}`;
  }

  // The short 4-point elbow (out → drop at midX → in) is only legal when
  // that single vertical leg sits on the correct side of BOTH ends: it has
  // to leave `sx` heading `sxOutDir` AND reach `ex` from the `exInDir`
  // side. Checking only the start (as this used to) breaks every arrow
  // whose two stubs point the SAME way — FF (right→right) and SS
  // (left→left): the leg dropped inside the dependent's bar and the last
  // segment ran through it to the far edge, arrowhead pointing backwards.
  const midX = (sOutX + eInX) / 2;
  const leavesCorrectly = sxOutDir * (midX - sx) > 0;
  const arrivesCorrectly = exInDir * (midX - ex) > 0;

  let pts: { x: number; y: number }[];
  if (leavesCorrectly && arrivesCorrectly) {
    pts = [
      { x: sx, y: sy },
      { x: midX, y: sy },
      { x: midX, y: ey },
      { x: ex, y: ey },
    ];
  } else {
    const midY = (sy + ey) / 2;
    pts = [
      { x: sx, y: sy },
      { x: sOutX, y: sy },
      { x: sOutX, y: midY },
      { x: eInX, y: midY },
      { x: eInX, y: ey },
      { x: ex, y: ey },
    ];
  }
  return roundedPolyline(pts, R);
}

// ============================================
// DUE-DATE RANGE TEXT ("Jul 15 – 20", "Jul 7 – Today", "Jul 21", "—")
// ============================================

function dueRangeText(task: Task): string {
  if (!task.dueDate) return "—";
  const due = dueDateToLocalMidnight(task.dueDate);
  const dueIsToday = isSameDay(due, new Date());
  const dueAlone = dueIsToday ? "Today" : format(due, "MMM d");
  if (!task.startDate) return dueAlone;
  const start = dueDateToLocalMidnight(task.startDate);
  if (isSameDay(start, due)) return dueAlone;
  const startTxt = format(start, "MMM d");
  const sameMonth =
    start.getMonth() === due.getMonth() &&
    start.getFullYear() === due.getFullYear();
  const dueTxt = dueIsToday
    ? "Today"
    : sameMonth
      ? format(due, "d")
      : format(due, "MMM d");
  return `${startTxt} – ${dueTxt}`;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function GanttView({
  sections,
  onTaskClick,
  projectId,
  members = [],
}: GanttViewProps) {
  const router = useRouter();

  // ---------- State ----------
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const [currentDate, setCurrentDate] = useState(new Date());
  // Asana's Gantt defaults to Months.
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("month");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [taskSort, setTaskSort] = useState<
    "manual" | "due" | "name" | "priority"
  >("manual");
  const [showDependencies, setShowDependencies] = useState(true);
  // Off by default — Asana draws no due-soon rings; still toggleable.
  const [highlightDueSoon, setHighlightDueSoon] = useState(false);
  const [dependencies, setDependencies] = useState<DependencyRow[]>([]);
  // Clicked dependency arrow → Asana's type pill + menu. x/y are CONTENT
  // coords inside the scrolling timeline body (same space as the arrow
  // paths), so the pill stays glued to its arrow while the user scrolls.
  const [depMenu, setDepMenu] = useState<{
    dep: DependencyRow;
    x: number;
    y: number;
    flipUp: boolean;
    open: boolean;
  } | null>(null);
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    sectionId?: string;
    taskType?: "TASK" | "MILESTONE";
  }>({ open: false });
  // Inline add-section input row (prompt() is not allowed).
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const sectionInputRef = useRef<HTMLInputElement>(null);

  const [dragState, setDragState] = useState<{
    taskId: string;
    handle: "left" | "right" | "move";
    startX: number;
    originalStart: string | null;
    originalDue: string;
    deltaX: number;
  } | null>(null);
  // Set on a real drag (delta != 0) so the trailing click doesn't
  // also open the task panel.
  const didDragRef = useRef(false);

  // Optimistic date overrides — applied the instant a drag is released so
  // the bar stays where the user dropped it while the PATCH +
  // router.refresh() round-trip completes (no snap-back). Also fed by the
  // server's cascadeShifts so dependent bars glide along immediately.
  const [optimisticDates, setOptimisticDates] = useState<
    Record<string, { startDate: string | null; dueDate: string | null }>
  >({});
  const patchesInFlightRef = useRef(0);

  // Drop each override once fresh server data CONFIRMS it (incoming prop
  // dates match). Non-matching overrides get two strikes while idle before
  // being dropped as stale — see timeline-view for the full rationale.
  const staleOverridesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    setOptimisticDates((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      const propDates = new Map<string, { s: string | null; d: string | null }>();
      for (const sec of sections)
        for (const t of sec.tasks)
          propDates.set(t.id, {
            s: t.startDate ? String(t.startDate).slice(0, 10) : null,
            d: t.dueDate ? String(t.dueDate).slice(0, 10) : null,
          });
      const next: typeof prev = {};
      let changed = false;
      for (const id of ids) {
        const o = prev[id];
        const p = propDates.get(id);
        const matches =
          !!p &&
          p.s === (o.startDate ? o.startDate.slice(0, 10) : null) &&
          p.d === (o.dueDate ? o.dueDate.slice(0, 10) : null);
        if (
          matches ||
          (patchesInFlightRef.current === 0 && staleOverridesRef.current.has(id))
        ) {
          changed = true;
          staleOverridesRef.current.delete(id);
          continue;
        }
        staleOverridesRef.current.add(id);
        next[id] = o;
      }
      return changed ? next : prev;
    });
  }, [sections]);

  const effectiveSections = useMemo(() => {
    if (Object.keys(optimisticDates).length === 0) return sections;
    return sections.map((section) => ({
      ...section,
      tasks: section.tasks.map((task) => {
        const o = optimisticDates[task.id];
        return o ? { ...task, startDate: o.startDate, dueDate: o.dueDate ?? task.dueDate } : task;
      }),
    }));
  }, [sections, optimisticDates]);

  useEffect(() => {
    if (addingSection) sectionInputRef.current?.focus();
  }, [addingSection]);

  // ---------- Dependencies fetch ----------
  useEffect(() => {
    let canceled = false;
    fetch(`/api/projects/${projectId}/dependencies`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: DependencyRow[]) => {
        if (!canceled && Array.isArray(data)) setDependencies(data);
      })
      .catch(() => {
        if (!canceled) setDependencies([]);
      });
    return () => {
      canceled = true;
    };
    // Re-fetch when the task set changes too (router.refresh updates
    // `sections` after a dependency edit in the task panel).
     
  }, [projectId, sections]);

  // ---------- Filter + row sort ----------
  const filteredSections = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    return effectiveSections.map((section) => {
      let tasks =
        taskFilter === "all"
          ? section.tasks
          : section.tasks.filter((task) => {
              if (taskFilter === "incomplete") return !task.completed;
              if (taskFilter === "completed") return task.completed;
              // due_this_week
              if (!task.dueDate) return false;
              const due = dueDateToLocalMidnight(task.dueDate);
              return due >= weekStart && due <= weekEnd;
            });
      if (taskSort !== "manual") {
        const dueMs = (t: Task) =>
          t.dueDate
            ? dueDateToLocalMidnight(t.dueDate).getTime()
            : Number.MAX_SAFE_INTEGER;
        tasks = [...tasks].sort((a, b) => {
          if (taskSort === "due") return dueMs(a) - dueMs(b);
          if (taskSort === "name") return a.name.localeCompare(b.name);
          return (
            (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) ||
            dueMs(a) - dueMs(b)
          );
        });
      }
      return { ...section, tasks };
    });
  }, [effectiveSections, taskFilter, taskSort]);

  // ---------- Name lookup (from the FULL sections prop, so "Blocked by"
  // resolves even when the predecessor is filtered out) ----------
  const taskNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) for (const t of s.tasks) m.set(t.id, t.name);
    return m;
  }, [sections]);

  const blockedByNames = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const dep of dependencies) {
      const name = taskNameById.get(dep.blockingTaskId);
      if (!name) continue;
      const arr = m.get(dep.dependentTaskId) ?? [];
      arr.push(name);
      m.set(dep.dependentTaskId, arr);
    }
    return m;
  }, [dependencies, taskNameById]);

  // Same map but with the dependency ids, for the editable "Blocked by"
  // cell (remove needs the dep id, add needs candidate tasks).
  const blockedByDetail = useMemo(() => {
    const m = new Map<
      string,
      { depId: string; blockingTaskId: string; name: string }[]
    >();
    for (const dep of dependencies) {
      const name = taskNameById.get(dep.blockingTaskId);
      if (!name) continue;
      const arr = m.get(dep.dependentTaskId) ?? [];
      arr.push({ depId: dep.id, blockingTaskId: dep.blockingTaskId, name });
      m.set(dep.dependentTaskId, arr);
    }
    return m;
  }, [dependencies, taskNameById]);

  const allTasksFlat = useMemo(
    () => effectiveSections.flatMap((s) => s.tasks),
    [effectiveSections]
  );

  // ---------- Inline edit helpers (Asana's Gantt table is editable) ----------
  const [renaming, setRenaming] = useState<{
    taskId: string;
    value: string;
  } | null>(null);

  const patchTask = useCallback(
    async (taskId: string, body: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to update task");
        }
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update task"
        );
      }
    },
    [router]
  );

  const saveRename = useCallback(() => {
    if (!renaming) return;
    const name = renaming.value.trim();
    const taskId = renaming.taskId;
    setRenaming(null);
    if (!name || name === taskNameById.get(taskId)) return;
    patchTask(taskId, { name });
  }, [renaming, patchTask, taskNameById]);

  const reloadDependencies = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/dependencies`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDependencies(data);
      }
    } catch {
      /* keep the stale list */
    }
  }, [projectId]);

  // Apply server cascade results to the optimistic layer so rescheduled
  // bars glide to their new dates IMMEDIATELY instead of waiting for
  // router.refresh() to land.
  const applyShiftOverrides = useCallback(
    (
      shifts:
        | { taskId: string; newStart: string | null; newEnd: string | null }[]
        | undefined
    ) => {
      if (!Array.isArray(shifts) || shifts.length === 0) return;
      setOptimisticDates((prev) => {
        const next = { ...prev };
        for (const s of shifts) {
          next[s.taskId] = {
            startDate: s.newStart ? String(s.newStart).slice(0, 10) : null,
            dueDate: s.newEnd ? String(s.newEnd).slice(0, 10) : null,
          };
        }
        return next;
      });
    },
    []
  );

  const addBlocker = useCallback(
    async (taskId: string, blockingTaskId: string) => {
      patchesInFlightRef.current += 1;
      try {
        const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockingTaskId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to add dependency");
        }
        // The server auto-shifts the dependent when the new link is already
        // violated — move the bars optimistically, then refresh.
        const data = await res.json().catch(() => null);
        const shifted = Array.isArray(data?.cascadeShifts)
          ? data.cascadeShifts.length
          : 0;
        applyShiftOverrides(data?.cascadeShifts);
        if (shifted > 0) router.refresh();
        await reloadDependencies();
        toast.success(
          shifted > 0
            ? `Dependency added · ${shifted} task${shifted > 1 ? "s" : ""} rescheduled`
            : "Dependency added"
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to add dependency"
        );
      } finally {
        patchesInFlightRef.current -= 1;
      }
    },
    [reloadDependencies, router, applyShiftOverrides]
  );

  const removeBlocker = useCallback(
    async (taskId: string, depId: string) => {
      try {
        const res = await fetch(
          `/api/tasks/${taskId}/dependencies?id=${depId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to remove dependency");
        }
        await reloadDependencies();
        toast.success("Dependency removed");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove dependency"
        );
      }
    },
    [reloadDependencies]
  );

  // ---------- Dependency type menu (click an arrow) ----------

  /** Retype a dependency. The server auto-shifts the dependent task (and
   *  anything downstream) so the new constraint holds, then we refresh both
   *  the arrows and the bars. */
  const changeDependencyType = useCallback(
    async (dep: DependencyRow, type: DependencyType) => {
      if (dep.type === type) {
        setDepMenu(null);
        return;
      }
      // Optimistic: the arrow re-anchors immediately.
      setDependencies((prev) =>
        prev.map((d) => (d.id === dep.id ? { ...d, type } : d))
      );
      setDepMenu((m) => (m && m.dep.id === dep.id ? { ...m, dep: { ...m.dep, type }, open: false } : m));
      patchesInFlightRef.current += 1;
      try {
        const res = await fetch(
          `/api/tasks/${dep.dependentTaskId}/dependencies?id=${dep.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to update dependency");
        }
        const data = await res.json().catch(() => null);
        const shifted = Array.isArray(data?.cascadeShifts)
          ? data.cascadeShifts.length
          : 0;
        // Dates may have moved — glide the bars optimistically, then let
        // the refresh confirm; the arrows re-anchor from the same dates.
        applyShiftOverrides(data?.cascadeShifts);
        if (shifted > 0) router.refresh();
        await reloadDependencies();
        toast.success(
          shifted > 0
            ? `Dependency updated · ${shifted} task${shifted > 1 ? "s" : ""} rescheduled`
            : "Dependency updated"
        );
      } catch (err) {
        // Roll the optimistic change back — including the pill's own copy of
        // the row, or it keeps showing the type that never saved.
        setDependencies((prev) =>
          prev.map((d) => (d.id === dep.id ? { ...d, type: dep.type } : d))
        );
        setDepMenu((m) =>
          m && m.dep.id === dep.id ? { ...m, dep: { ...m.dep, type: dep.type } } : m
        );
        await reloadDependencies();
        toast.error(
          err instanceof Error ? err.message : "Failed to update dependency"
        );
      } finally {
        patchesInFlightRef.current -= 1;
      }
    },
    [reloadDependencies, router, applyShiftOverrides]
  );

  const deleteDependency = useCallback(
    async (dep: DependencyRow) => {
      setDepMenu(null);
      await removeBlocker(dep.dependentTaskId, dep.id);
    },
    [removeBlocker]
  );

  // Close the pill on outside pointerdown / Escape; Backspace deletes the
  // selected dependency (Asana shows the "Bksp" hint in the menu).
  useEffect(() => {
    if (!depMenu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-gantt-dep-menu]")) setDepMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Never steal Backspace from a field the user is typing in.
      if (
        t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
      ) {
        return;
      }
      if (e.key === "Escape") setDepMenu(null);
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        void deleteDependency(depMenu.dep);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [depMenu, deleteDependency]);

  // ---------- Zoom configuration ----------
  const zoomConfig: Record<
    ZoomLevel,
    { columnWidth: number; range: number; getColumns: (start: Date, count: number) => Date[] }
  > = {
    day: {
      columnWidth: 40,
      range: 120,
      getColumns: (start, count) =>
        eachDayOfInterval({ start, end: addDays(start, count - 1) }),
    },
    week: {
      columnWidth: 80,
      range: 36,
      getColumns: (start, count) =>
        eachWeekOfInterval(
          { start, end: addWeeks(start, count - 1) },
          { weekStartsOn: 1 }
        ),
    },
    month: {
      // Asana's Meses zoom runs at ~12px/day (366px per average month).
      columnWidth: 366,
      range: 18,
      getColumns: (start, count) =>
        eachMonthOfInterval({ start, end: addMonths(start, count - 1) }),
    },
    quarter: {
      columnWidth: 365, // ~4px/day
      range: 8,
      getColumns: (start, count) => {
        const quarters: Date[] = [];
        let current = startOfQuarter(start);
        for (let i = 0; i < count; i++) {
          quarters.push(current);
          current = addMonths(current, 3);
        }
        return quarters;
      },
    },
  };

  const config = zoomConfig[zoomLevel];

  // ---------- Columns ----------
  const columns = useMemo(() => {
    const startDate =
      zoomLevel === "day" || zoomLevel === "week"
        ? startOfWeek(currentDate, { weekStartsOn: 1 })
        : startOfQuarter(currentDate);

    const cols = config.getColumns(startDate, config.range);

    return cols.map((date) => {
      let label = "";
      if (zoomLevel === "day") label = format(date, "d");
      else if (zoomLevel === "week") label = format(date, "MMM d");
      else if (zoomLevel === "month") label = format(date, "MMMM");
      else label = `Q${Math.floor(date.getMonth() / 3) + 1}`;

      return {
        date,
        label,
        isWeekend: zoomLevel === "day" && isWeekend(date),
        isToday: zoomLevel === "day" && isSameDay(date, new Date()),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, zoomLevel]);

  // ---------- Top header groups (months / quarters / years) ----------
  const headerGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    let key = "";
    for (const col of columns) {
      let label: string;
      if (zoomLevel === "day" || zoomLevel === "week") {
        label = format(col.date, "MMMM yyyy");
      } else if (zoomLevel === "month") {
        label = `Q${Math.floor(col.date.getMonth() / 3) + 1} ${format(col.date, "yyyy")}`;
      } else {
        label = format(col.date, "yyyy");
      }
      if (label !== key) {
        key = label;
        groups.push({ label, count: 0 });
      }
      groups[groups.length - 1].count++;
    }
    return groups;
  }, [columns, zoomLevel]);

  // ---------- Timeline bounds (shared by bars / today line / drag math) ----------
  const bounds = useMemo(() => {
    if (columns.length === 0) return null;
    const timelineStart = columns[0].date;
    const lastColumn = columns[columns.length - 1].date;
    // Extend by the real unit of the last column so bars don't drift
    // at month/quarter zoom (a quarter spans ~91 days, not 30).
    const timelineEnd =
      zoomLevel === "day"
        ? addDays(lastColumn, 1)
        : zoomLevel === "week"
          ? addDays(lastColumn, 7)
          : zoomLevel === "month"
            ? addMonths(lastColumn, 1)
            : addMonths(lastColumn, 3);
    const totalDays = differenceInDays(timelineEnd, timelineStart);
    const totalWidth = columns.length * config.columnWidth;
    const dayWidth = totalWidth / totalDays;
    // Per-column pixel widths proportional to each column's true day span.
    // Months are 28-31 days (not the 30.42-day average a fixed 120px column
    // implies), so fixed-width columns drift off the uniform day-width math
    // used by bars and the today line at month/quarter zoom.
    const columnWidths = columns.map((c, i) => {
      const colStart = differenceInDays(c.date, timelineStart);
      const colEnd =
        i + 1 < columns.length
          ? differenceInDays(columns[i + 1].date, timelineStart)
          : totalDays;
      return (colEnd - colStart) * dayWidth;
    });
    return {
      timelineStart,
      timelineEnd,
      totalDays,
      totalWidth,
      dayWidth,
      columnWidths,
    };
  }, [columns, zoomLevel, config.columnWidth]);

  // Header-group pixel widths — sum of member column widths so group
  // borders stay aligned with the proportional columns.
  const groupWidths = useMemo(() => {
    if (!bounds) return headerGroups.map((g) => g.count * config.columnWidth);
    let idx = 0;
    return headerGroups.map((g) => {
      let w = 0;
      for (let k = 0; k < g.count; k++) w += bounds.columnWidths[idx++] ?? 0;
      return w;
    });
  }, [headerGroups, bounds, config.columnWidth]);

  // Weekend bands across the whole canvas at week/month zoom (Asana shades
  // weekends at Meses too; day zoom shades per-column, quarter is too dense).
  const weekendStripes = useMemo(() => {
    if (!bounds || zoomLevel === "day" || zoomLevel === "quarter") return [];
    const stripes: { left: number; width: number }[] = [];
    for (let off = 0; off < bounds.totalDays; off++) {
      const dow = addDays(bounds.timelineStart, off).getDay();
      if (dow === 6) {
        stripes.push({
          left: off * bounds.dayWidth,
          width: Math.min(2, bounds.totalDays - off) * bounds.dayWidth,
        });
      } else if (dow === 0 && off === 0) {
        stripes.push({ left: 0, width: bounds.dayWidth });
      }
    }
    return stripes;
  }, [bounds, zoomLevel]);

  // Pixel span for an arbitrary [start, end] date range (section summary
  // bars) — same clamping rules as getTaskPosition.
  const getSpanPosition = useCallback(
    (start: Date, end: Date) => {
      if (!bounds) return null;
      if (end < bounds.timelineStart || start >= bounds.timelineEnd) return null;
      const startOffset = Math.max(
        0,
        differenceInDays(start, bounds.timelineStart)
      );
      const endOffset = Math.min(
        bounds.totalDays - 1,
        differenceInDays(end, bounds.timelineStart)
      );
      const left = (startOffset / bounds.totalDays) * bounds.totalWidth;
      const width = Math.max(
        ((endOffset - startOffset + 1) / bounds.totalDays) * bounds.totalWidth,
        DUE_ONLY_W
      );
      return { left, width };
    },
    [bounds]
  );

  // ---------- Task bar position ----------
  const getTaskPosition = useCallback(
    (task: Task) => {
      if (!task.dueDate || !bounds) return null;

      // dueDate/startDate are UTC-midnight instants; read them by their
      // UTC calendar day (dueDateToLocalMidnight) so bars don't render a
      // day early for viewers west of UTC.
      const taskEnd = dueDateToLocalMidnight(task.dueDate);
      // No startDate → a 1-day bar sitting on the due date.
      let taskStart = task.startDate
        ? dueDateToLocalMidnight(task.startDate)
        : taskEnd;
      // Defend against inverted ranges persisted before the drag clamps.
      if (taskStart > taskEnd) taskStart = taskEnd;

      // timelineEnd is exclusive — a task starting exactly there is outside.
      if (taskEnd < bounds.timelineStart || taskStart >= bounds.timelineEnd) {
        return null;
      }

      const startOffset = Math.max(
        0,
        differenceInDays(taskStart, bounds.timelineStart)
      );
      // Clamp to the last rendered day (totalDays - 1) so the inclusive +1
      // in the width below ends exactly at the grid's right border.
      const endOffset = Math.min(
        bounds.totalDays - 1,
        differenceInDays(taskEnd, bounds.timelineStart)
      );

      const left = (startOffset / bounds.totalDays) * bounds.totalWidth;
      const width = Math.max(
        ((endOffset - startOffset + 1) / bounds.totalDays) * bounds.totalWidth,
        DUE_ONLY_W
      );

      return { left, width };
    },
    [bounds]
  );

  // ---------- Row map (taskId → absolute row index), accounting for
  // section header rows, ghost "Add task…" rows and collapsed sections
  // so the arrow SVG lands exactly on each 40px bar row. ----------
  const { taskRowMap, totalRows } = useMemo(() => {
    const map = new Map<string, number>();
    let row = 0;
    for (const section of filteredSections) {
      row++; // section header row
      if (collapsedSections.has(section.id)) continue;
      for (const task of section.tasks) {
        map.set(task.id, row);
        row++;
      }
      row++; // ghost "Add task…" row
    }
    row++; // bottom "+ Add section" row
    return { taskRowMap: map, totalRows: row };
  }, [filteredSections, collapsedSections]);

  const getTaskScreenPos = useCallback(
    (taskId: string) => {
      const row = taskRowMap.get(taskId);
      if (row === undefined) return null;
      let task: Task | null = null;
      for (const s of filteredSections) {
        const t = s.tasks.find((x) => x.id === taskId);
        if (t) {
          task = t;
          break;
        }
      }
      if (!task) return null;
      const pos = getTaskPosition(task);
      if (!pos) return null;
      const yCenter = row * ROW_HEIGHT + ROW_HEIGHT / 2;
      // Milestones/approvals render as a 24px glyph centered on the span's
      // right edge (markerLeft = left + width − 12) — anchor arrows to the
      // glyph, not the invisible bar rect.
      if (task.taskType === "MILESTONE" || task.taskType === "APPROVAL") {
        const centerX = pos.left + (task.startDate ? pos.width : DUE_ONLY_W);
        return { xLeft: centerX - 12, xRight: centerX + 12, yCenter };
      }
      // Due-only tasks render as a slim pill — anchor arrows to it.
      const width = task.startDate ? pos.width : DUE_ONLY_W;
      return {
        xLeft: pos.left,
        xRight: pos.left + width,
        yCenter,
      };
    },
    [taskRowMap, filteredSections, getTaskPosition]
  );

  // ---------- Today line ----------
  const todayPosition = useMemo(() => {
    if (!bounds) return null;
    const today = startOfDay(new Date());
    if (today < bounds.timelineStart || today > bounds.timelineEnd) return null;
    const daysFromStart = differenceInDays(today, bounds.timelineStart);
    return (daysFromStart / bounds.totalDays) * bounds.totalWidth;
  }, [bounds]);

  // ---------- Drag move / resize (UTC-midnight-safe save) ----------
  const pixelsToDays = useCallback(
    (px: number) => {
      if (!bounds) return 0;
      return (px / bounds.totalWidth) * bounds.totalDays;
    },
    [bounds]
  );

  const handleDragStart = useCallback(
    (
      e: React.MouseEvent,
      taskId: string,
      handle: "left" | "right" | "move",
      task: Task
    ) => {
      e.preventDefault();
      e.stopPropagation();
      if (!task.dueDate) return;
      didDragRef.current = false;
      setDragState({
        taskId,
        handle,
        startX: e.clientX,
        originalStart: task.startDate || null,
        originalDue: task.dueDate,
        deltaX: 0,
      });
    },
    []
  );

  useEffect(() => {
    if (!dragState || !bounds) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      let snappedDays = Math.round(pixelsToDays(dx));
      // Clamp handle overshoot in the PREVIEW too, mirroring the commit
      // clamps — otherwise the ghost slides past the opposite edge and
      // visibly jumps back on release.
      if (dragState.handle !== "move") {
        const s = dueDateToLocalMidnight(
          dragState.originalStart ?? dragState.originalDue
        );
        const d = dueDateToLocalMidnight(dragState.originalDue);
        const durationDays = Math.round(
          (d.getTime() - s.getTime()) / 86400000
        );
        if (dragState.handle === "left") {
          snappedDays = Math.min(snappedDays, durationDays);
        } else {
          snappedDays = Math.max(snappedDays, -durationDays);
        }
      }
      const snappedPx = snappedDays * bounds.dayWidth;
      setDragState((prev) => (prev ? { ...prev, deltaX: snappedPx } : prev));
    };

    const handleMouseUp = async (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(pixelsToDays(deltaX));
      if (deltaDays === 0) {
        setDragState(null);
        return;
      }
      didDragRef.current = true;

      // Read the originals by their UTC calendar day (they're UTC-midnight
      // instants). Round-tripping through parseISO+local format shifts every
      // saved date one day earlier for users west of UTC.
      const origDue = dueDateToLocalMidnight(dragState.originalDue);
      const impliedStart = dragState.originalStart
        ? dueDateToLocalMidnight(dragState.originalStart)
        : origDue; // 1-day bar convention in this view

      const body: Record<string, string | null> = {};
      if (dragState.handle === "left") {
        let newStart = addDays(impliedStart, deltaDays);
        if (newStart > origDue) newStart = origDue;
        body.startDate = format(newStart, "yyyy-MM-dd");
      } else if (dragState.handle === "right") {
        let newDue = addDays(origDue, deltaDays);
        if (newDue < impliedStart) newDue = impliedStart;
        body.dueDate = format(newDue, "yyyy-MM-dd");
        // Pin the left edge for tasks without a persisted startDate,
        // otherwise the 1-day bar just translates instead of growing.
        if (!dragState.originalStart) {
          body.startDate = format(impliedStart, "yyyy-MM-dd");
        }
      } else {
        // "move" — shift BOTH dates by the same delta (duration preserved).
        const newDue = addDays(origDue, deltaDays);
        body.dueDate = format(newDue, "yyyy-MM-dd");
        if (dragState.originalStart) {
          body.startDate = format(addDays(impliedStart, deltaDays), "yyyy-MM-dd");
        }
      }

      // Optimistic: pin the bar at its dropped position IMMEDIATELY, then
      // persist in the background — it must never snap back mid round-trip.
      const taskId = dragState.taskId;
      setOptimisticDates((prev) => ({
        ...prev,
        [taskId]: {
          startDate: body.startDate !== undefined ? body.startDate : dragState.originalStart,
          dueDate: body.dueDate !== undefined ? body.dueDate : dragState.originalDue,
        },
      }));
      setDragState(null);

      patchesInFlightRef.current += 1;
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        // Glide dependents along too (server-side cascade result).
        const updated = await res.json().catch(() => null);
        const shifts: { taskId: string; newStart: string | null; newEnd: string | null }[] =
          updated?.cascadeShifts ?? [];
        if (shifts.length > 0) {
          setOptimisticDates((prev) => {
            const next = { ...prev };
            for (const s of shifts) {
              next[s.taskId] = {
                startDate: s.newStart ? String(s.newStart).slice(0, 10) : null,
                dueDate: s.newEnd ? String(s.newEnd).slice(0, 10) : null,
              };
            }
            return next;
          });
        }
        router.refresh();
      } catch {
        // Roll back only the failed bar.
        setOptimisticDates((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        toast.error("Failed to update dates");
      } finally {
        patchesInFlightRef.current -= 1;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, pixelsToDays, router, bounds]);

  // ---------- Mutations ----------
  const toggleComplete = async (e: React.MouseEvent, task: Task) => {
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

  const submitNewSection = async () => {
    const name = newSectionName.trim();
    if (!name) {
      setAddingSection(false);
      setNewSectionName("");
      return;
    }
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectId }),
      });
      if (!res.ok) throw new Error();
      setAddingSection(false);
      setNewSectionName("");
      router.refresh();
    } catch {
      toast.error("Failed to add section");
    }
  };

  // ---------- Navigation & zoom ----------
  const navigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(new Date());
      return;
    }
    const amount = direction === "prev" ? -1 : 1;
    if (zoomLevel === "day") setCurrentDate((d) => addWeeks(d, amount * 2));
    else if (zoomLevel === "week") setCurrentDate((d) => addMonths(d, amount));
    else if (zoomLevel === "month")
      setCurrentDate((d) => addMonths(d, amount * 3));
    else setCurrentDate((d) => addMonths(d, amount * 6));
  };

  const zoomIndex = ZOOM_ORDER.indexOf(zoomLevel);
  const zoomIn = () => {
    if (zoomIndex > 0) setZoomLevel(ZOOM_ORDER[zoomIndex - 1]);
  };
  const zoomOut = () => {
    if (zoomIndex < ZOOM_ORDER.length - 1)
      setZoomLevel(ZOOM_ORDER[zoomIndex + 1]);
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // ---------- Helpers ----------
  const isTaskDueSoon = (task: Task) => {
    if (!task.dueDate || task.completed) return false;
    // daysFromToday rounds whole calendar days (differenceInDays against
    // wall-clock `new Date()` truncates and flags 8-days-out as due soon).
    const days = daysFromToday(task.dueDate);
    return days >= 0 && days <= 7;
  };

  const handleRowClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    onTaskClick(taskId);
  };

  const renderGridCells = (shadeWeekends: boolean) =>
    columns.map((col, i) => (
      <div
        key={i}
        className={cn("border-r", shadeWeekends && col.isWeekend && "bg-slate-100/70")}
        style={{ width: bounds?.columnWidths[i] ?? config.columnWidth }}
      />
    ));

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ============ TOOLBAR ============ */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 bg-white border-b overflow-x-auto flex-shrink-0">
        {/* Left */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Split button — Asana's "Agregar tarea ▾" */}
          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              className="rounded-r-none"
              onClick={() => setCreateDialog({ open: true, taskType: "TASK" })}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add task
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-l-none border-l-0 px-1.5"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => setCreateDialog({ open: true, taskType: "TASK" })}
                >
                  Task
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setCreateDialog({ open: true, taskType: "MILESTONE" })
                  }
                >
                  <Diamond className="w-3.5 h-3.5 mr-2 text-[#79ABFF]" />
                  Milestone
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddingSection(true)}>
                  Section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("today")}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Zoom: dropdown + stepper */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={zoomOut}
              disabled={zoomIndex === ZOOM_ORDER.length - 1}
              title="Zoom out"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[92px]">
                  {ZOOM_LABELS[zoomLevel]}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ZOOM_ORDER.map((level) => (
                  <DropdownMenuItem
                    key={level}
                    onClick={() => setZoomLevel(level)}
                    className={cn(zoomLevel === level && "bg-slate-100")}
                  >
                    {ZOOM_LABELS[level]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={zoomIn}
              disabled={zoomIndex === 0}
              title="Zoom in"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={taskFilter !== "all" ? "secondary" : "ghost"}
                size="sm"
              >
                <Filter className="w-4 h-4 mr-1" />
                {taskFilter === "all"
                  ? "Filter"
                  : taskFilter === "incomplete"
                    ? "Incomplete"
                    : taskFilter === "completed"
                      ? "Completed"
                      : "Due this week"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTaskFilter("all")}>
                All tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTaskFilter("incomplete")}>
                Incomplete tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTaskFilter("completed")}>
                Completed tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTaskFilter("due_this_week")}>
                Due this week
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort — Asana's "Ordenar": reorders rows inside each section */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={taskSort !== "manual" ? "secondary" : "ghost"}
                size="sm"
              >
                <ArrowUpDown className="w-4 h-4 mr-1" />
                {taskSort === "manual"
                  ? "Sort"
                  : taskSort === "due"
                    ? "Due date"
                    : taskSort === "name"
                      ? "Alphabetical"
                      : "Priority"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(
                [
                  ["manual", "Manual (project order)"],
                  ["due", "Due date"],
                  ["name", "Alphabetical"],
                  ["priority", "Priority"],
                ] as const
              ).map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={taskSort === key}
                  onCheckedChange={() => setTaskSort(key)}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <SlidersHorizontal className="w-4 h-4 mr-1" />
                Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={showDependencies}
                onCheckedChange={(v) => setShowDependencies(v === true)}
              >
                Show dependencies
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={highlightDueSoon}
                onCheckedChange={(v) => setHighlightDueSoon(v === true)}
              >
                Highlight due soon
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ============ GRID ============ */}
      <div className="flex-1 overflow-auto">
        {/* min-h-full so table + grid stretch to the viewport bottom —
            the grid must never stop short of the screen edge (Asana). */}
        <div className="flex min-w-max min-h-full">
          {/* ---------- LEFT PANEL (table) ---------- */}
          <div
            className="flex-shrink-0 bg-white border-r sticky max-md:static left-0 z-30 flex flex-col"
            style={{ width: SIDEBAR_W }}
          >
            {/* Corner header — sticky both top and left */}
            <div
              className="flex items-center border-b bg-slate-50 sticky top-0 z-40 text-xs font-medium text-slate-600"
              style={{ height: HEADER_HEIGHT }}
            >
              <div className="px-3" style={{ width: NAME_COL_W }}>
                Name
              </div>
              <div
                className="px-2 border-l h-full flex items-center"
                style={{ width: DUE_COL_W }}
              >
                Due date
              </div>
              <div
                className="px-2 border-l h-full flex items-center"
                style={{ width: BLOCKED_COL_W }}
              >
                Blocked by
              </div>
            </div>

            {/* Sections & tasks */}
            {filteredSections.map((section) => {
              const isCollapsed = collapsedSections.has(section.id);
              return (
                <div key={section.id}>
                  {/* Section header row */}
                  <button
                    className="flex items-center gap-2 px-2 border-b bg-white hover:bg-slate-50 w-full text-left"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => toggleSection(section.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-sm text-slate-900 truncate">
                      {section.name}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {section.tasks.length}
                    </span>
                  </button>

                  {/* Task rows */}
                  {!isCollapsed && (
                    <>
                      {section.tasks.map((task) => {
                        const blockedBy = blockedByNames.get(task.id);
                        const blockedTxt = blockedBy?.join(", ") ?? "";
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "flex items-center border-b cursor-pointer hover:bg-slate-50",
                              selectedTaskId === task.id && "bg-slate-50"
                            )}
                            style={{ height: ROW_HEIGHT }}
                            onClick={() => handleRowClick(task.id)}
                          >
                            {/* Name cell — double-click renames, the
                                avatar opens the assignee picker (Asana's
                                Gantt table is editable in place) */}
                            <div
                              className="flex items-center gap-2 px-3 min-w-0"
                              style={{ width: NAME_COL_W }}
                            >
                              <button
                                className="flex-shrink-0 text-slate-300 hover:text-[#c9a84c]"
                                onClick={(e) => toggleComplete(e, task)}
                                title={
                                  task.completed
                                    ? "Mark incomplete"
                                    : "Mark complete"
                                }
                              >
                                {task.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#c9a84c]" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>
                              {renaming?.taskId === task.id ? (
                                <input
                                  autoFocus
                                  value={renaming.value}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    setRenaming({
                                      taskId: task.id,
                                      value: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveRename();
                                    if (e.key === "Escape") setRenaming(null);
                                  }}
                                  onBlur={saveRename}
                                  className="flex-1 min-w-0 text-sm bg-transparent outline-none border-b-2 border-[#335FB5] px-0.5"
                                />
                              ) : (
                                <span
                                  className={cn(
                                    "text-sm truncate flex-1",
                                    task.completed &&
                                      "line-through text-slate-400"
                                  )}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setRenaming({
                                      taskId: task.id,
                                      value: task.name,
                                    });
                                  }}
                                >
                                  {task.name}
                                </span>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="flex-shrink-0"
                                    title="Set assignee"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {task.assignee ? (
                                      task.assignee.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={task.assignee.image}
                                          alt={task.assignee.name ?? ""}
                                          className="w-6 h-6 rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-[#d4b65a] flex items-center justify-center text-xs font-medium text-white">
                                          {task.assignee.name?.[0] || "?"}
                                        </div>
                                      )
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center hover:border-slate-500">
                                        <User className="w-3 h-3 text-slate-300" />
                                      </div>
                                    )}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  {members.map((m) => (
                                    <DropdownMenuItem
                                      key={m.id}
                                      onClick={() =>
                                        patchTask(task.id, {
                                          assigneeId: m.id,
                                        })
                                      }
                                      className="gap-2"
                                    >
                                      <span className="w-5 h-5 rounded-full bg-[#d4b65a] flex items-center justify-center text-[10px] font-medium text-white overflow-hidden">
                                        {m.image ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={m.image}
                                            alt={m.name || ""}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          (m.name || m.email || "?")[0]
                                        )}
                                      </span>
                                      <span className="truncate">
                                        {m.name || m.email}
                                      </span>
                                    </DropdownMenuItem>
                                  ))}
                                  {task.assignee && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        patchTask(task.id, {
                                          assigneeId: null,
                                        })
                                      }
                                      className="gap-2 text-slate-500"
                                    >
                                      <X className="w-4 h-4" />
                                      Unassign
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {/* Due date cell — click opens the range
                                picker; red when overdue, green when the
                                range ends today (Asana's date tones) */}
                            <div
                              className="border-l h-full flex items-center"
                              style={{ width: DUE_COL_W }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DueDatePicker
                                startDate={
                                  task.startDate
                                    ? dueDateToLocalMidnight(task.startDate)
                                    : null
                                }
                                dueDate={
                                  task.dueDate
                                    ? dueDateToLocalMidnight(task.dueDate)
                                    : null
                                }
                                onChange={(start, due) => {
                                  patchTask(task.id, {
                                    startDate: start
                                      ? format(start, "yyyy-MM-dd")
                                      : null,
                                    dueDate: due
                                      ? format(due, "yyyy-MM-dd")
                                      : null,
                                  });
                                }}
                                trigger={
                                  <div
                                    className="w-full px-2 py-1 text-xs text-slate-600 truncate cursor-pointer hover:bg-slate-100 rounded"
                                    style={{
                                      color:
                                        !task.dueDate || task.completed
                                          ? undefined
                                          : daysFromToday(task.dueDate) < 0
                                            ? DATE_OVERDUE
                                            : daysFromToday(task.dueDate) === 0
                                              ? DATE_TODAY
                                              : undefined,
                                    }}
                                  >
                                    {dueRangeText(task)}
                                  </div>
                                }
                              />
                            </div>
                            {/* Blocked by cell — click manages blockers */}
                            <div
                              className="border-l h-full flex items-center"
                              style={{ width: BLOCKED_COL_W }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="w-full px-2 py-1 text-xs text-slate-500 text-left truncate hover:bg-slate-100 rounded cursor-pointer">
                                    <span className="truncate" title={blockedTxt}>
                                      {blockedTxt || (
                                        <span className="text-slate-300">
                                          —
                                        </span>
                                      )}
                                    </span>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="start"
                                  className="w-64 max-h-72 overflow-y-auto"
                                >
                                  {(blockedByDetail.get(task.id) ?? []).map(
                                    (b) => (
                                      <DropdownMenuItem
                                        key={b.depId}
                                        onClick={() =>
                                          removeBlocker(task.id, b.depId)
                                        }
                                        className="gap-2"
                                      >
                                        <X className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="truncate">
                                          {b.name}
                                        </span>
                                      </DropdownMenuItem>
                                    )
                                  )}
                                  {(blockedByDetail.get(task.id) ?? [])
                                    .length > 0 && (
                                    <div className="my-1 border-t" />
                                  )}
                                  <div className="px-2 py-1 text-[11px] text-slate-400">
                                    Add blocker
                                  </div>
                                  {allTasksFlat
                                    .filter(
                                      (t) =>
                                        t.id !== task.id &&
                                        !(
                                          blockedByDetail.get(task.id) ?? []
                                        ).some(
                                          (b) => b.blockingTaskId === t.id
                                        )
                                    )
                                    .slice(0, 15)
                                    .map((t) => (
                                      <DropdownMenuItem
                                        key={t.id}
                                        onClick={() =>
                                          addBlocker(task.id, t.id)
                                        }
                                        className="gap-2"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="truncate">
                                          {t.name}
                                        </span>
                                      </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}

                      {/* Ghost "Add task…" row */}
                      <button
                        className="flex items-center gap-2 px-3 border-b text-slate-400 hover:text-slate-600 hover:bg-slate-50 w-full text-left"
                        style={{ height: ROW_HEIGHT }}
                        onClick={() =>
                          setCreateDialog({ open: true, sectionId: section.id })
                        }
                      >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">Add task…</span>
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add section row — inline input, no prompt() */}
            {addingSection ? (
              <div
                className="flex items-center gap-2 px-3 border-b bg-white"
                style={{ height: ROW_HEIGHT }}
              >
                <input
                  ref={sectionInputRef}
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewSection();
                    if (e.key === "Escape") {
                      setAddingSection(false);
                      setNewSectionName("");
                    }
                  }}
                  placeholder="Section name"
                  className="flex-1 text-sm border border-[#c9a84c] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#c9a84c]"
                />
              </div>
            ) : (
              <button
                className="flex items-center gap-2 px-3 text-slate-500 hover:bg-slate-50 w-full text-left border-b"
                style={{ height: ROW_HEIGHT }}
                onClick={() => setAddingSection(true)}
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add section</span>
              </button>
            )}

            {/* White filler down to the viewport bottom */}
            <div className="flex-1 bg-white" />
          </div>

          {/* ---------- RIGHT PANEL (time grid + bars) ---------- */}
          <div className="flex-1 flex flex-col">
            {/* Two-row date header — sticky top */}
            <div
              className="sticky top-0 bg-white border-b z-20 flex-shrink-0"
              style={{ height: HEADER_HEIGHT }}
            >
              {/* Group row */}
              <div className="flex border-b" style={{ height: HEADER_HEIGHT / 2 }}>
                {headerGroups.map((group, i) => (
                  <div
                    key={i}
                    className="flex items-center px-2 text-xs font-medium text-slate-700 border-r truncate"
                    style={{ width: groupWidths[i] }}
                  >
                    {group.label}
                  </div>
                ))}
              </div>
              {/* Unit row */}
              <div
                className="flex relative"
                style={{ height: HEADER_HEIGHT / 2 }}
              >
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-center text-xs border-r text-slate-500",
                      col.isWeekend && "bg-slate-100/70",
                      col.isToday && "font-semibold text-[#a8893a]"
                    )}
                    style={{ width: bounds?.columnWidths[i] ?? config.columnWidth }}
                  >
                    {col.label}
                  </div>
                ))}
                {/* Today dot at the header */}
                {todayPosition !== null && (
                  <div
                    className="absolute bottom-0 w-2 h-2 rounded-full -translate-x-1/2"
                    style={{ left: todayPosition, backgroundColor: TODAY_BLUE }}
                  />
                )}
              </div>
            </div>

            {/* Body — flex column that stretches to the viewport bottom;
                the trailing flex-1 row keeps the grid (and the today line,
                which spans top-0→bottom-0) running past the last row. */}
            <div
              className="relative flex-1 flex flex-col"
              style={{ minHeight: totalRows * ROW_HEIGHT }}
            >
              {/* Weekend bands behind everything (week/month zoom) */}
              {weekendStripes.map((s, i) => (
                <div
                  key={`wk-${i}`}
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: s.left,
                    width: s.width,
                    backgroundColor: WEEKEND_STRIPE,
                  }}
                />
              ))}

              {/* Today line — Asana blue */}
              {todayPosition !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none"
                  style={{ left: todayPosition, backgroundColor: TODAY_BLUE }}
                />
              )}

              {/* Dependency arrows */}
              {showDependencies && dependencies.length > 0 && bounds && (
                <svg
                  className="absolute inset-0 pointer-events-none z-[5]"
                  width={bounds.totalWidth}
                  height={totalRows * ROW_HEIGHT}
                >
                  <defs>
                    <marker
                      id="gantt-dep-arrow-default"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6.5"
                      refY="4"
                      orient="auto"
                    >
                      <polygon points="0 0.5, 7 4, 0 7.5" fill="#94a3b8" />
                    </marker>
                    <marker
                      id="gantt-dep-arrow-active"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6.5"
                      refY="4"
                      orient="auto"
                    >
                      <polygon points="0 0.5, 7 4, 0 7.5" fill="#a8893a" />
                    </marker>
                  </defs>
                  {dependencies.map((dep) => {
                    const blocking = getTaskScreenPos(dep.blockingTaskId);
                    const dependent = getTaskScreenPos(dep.dependentTaskId);
                    if (!blocking || !dependent) return null;

                    // FS = blocker right → dependent left; SS = left→left;
                    // FF = right→right; SF = left→right.
                    let sx = 0;
                    let sy = 0;
                    let ex = 0;
                    let ey = 0;
                    let sxOutDir = 1;
                    let exInDir = -1;
                    if (dep.type === "FINISH_TO_START") {
                      sx = blocking.xRight;
                      sy = blocking.yCenter;
                      ex = dependent.xLeft;
                      ey = dependent.yCenter;
                      sxOutDir = 1;
                      exInDir = -1;
                    } else if (dep.type === "START_TO_START") {
                      sx = blocking.xLeft;
                      sy = blocking.yCenter;
                      ex = dependent.xLeft;
                      ey = dependent.yCenter;
                      sxOutDir = -1;
                      exInDir = -1;
                    } else if (dep.type === "FINISH_TO_FINISH") {
                      sx = blocking.xRight;
                      sy = blocking.yCenter;
                      ex = dependent.xRight;
                      ey = dependent.yCenter;
                      sxOutDir = 1;
                      exInDir = 1;
                    } else {
                      sx = blocking.xLeft;
                      sy = blocking.yCenter;
                      ex = dependent.xRight;
                      ey = dependent.yCenter;
                      sxOutDir = -1;
                      exInDir = 1;
                    }

                    const path = dependencyElbowPath(
                      sx,
                      sy,
                      ex,
                      ey,
                      sxOutDir,
                      exInDir
                    );

                    const isSelected = depMenu?.dep.id === dep.id;
                    const isActive =
                      isSelected ||
                      hoveredTask === dep.blockingTaskId ||
                      hoveredTask === dep.dependentTaskId ||
                      selectedTaskId === dep.blockingTaskId ||
                      selectedTaskId === dep.dependentTaskId;

                    return (
                      <g key={dep.id}>
                        <path
                          d={path}
                          stroke={isActive ? "#a8893a" : "#94a3b8"}
                          strokeWidth={isActive ? 2 : 1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          markerEnd={
                            isActive
                              ? "url(#gantt-dep-arrow-active)"
                              : "url(#gantt-dep-arrow-default)"
                          }
                          opacity={isActive ? 1 : 0.9}
                        />
                        {/* Fat transparent hit area — a 1.5px line is
                            unclickable. The parent <svg> is pointer-events-
                            none, so only these paths take clicks. */}
                        <path
                          d={path}
                          stroke="transparent"
                          strokeWidth={12}
                          fill="none"
                          style={{
                            pointerEvents: "stroke",
                            cursor: "pointer",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Convert the click to the SVG's own coordinate
                            // space (= the timeline body's), so the pill
                            // scrolls with the arrow instead of floating.
                            const svg = e.currentTarget.ownerSVGElement;
                            const box = svg?.getBoundingClientRect();
                            setDepMenu({
                              dep,
                              x: box ? e.clientX - box.left : 0,
                              y: box ? e.clientY - box.top : 0,
                              // Not enough room below → open upwards.
                              flipUp: window.innerHeight - e.clientY < 260,
                              open: false,
                            });
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Rows — mirror the left panel 1:1 */}
              {filteredSections.map((section) => {
                const isCollapsed = collapsedSections.has(section.id);
                return (
                  <div key={section.id} className="flex-shrink-0">
                    {/* Section header row — carries Asana's section summary
                        bar: a thin bracket spanning min start → max due of
                        the section's dated tasks. */}
                    <div
                      className="flex border-b relative"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {renderGridCells(true)}
                      {(() => {
                        let min: Date | null = null;
                        let max: Date | null = null;
                        for (const t of section.tasks) {
                          if (!t.dueDate) continue;
                          const end = dueDateToLocalMidnight(t.dueDate);
                          let s = t.startDate
                            ? dueDateToLocalMidnight(t.startDate)
                            : end;
                          if (s > end) s = end;
                          if (!min || s < min) min = s;
                          if (!max || end > max) max = end;
                        }
                        if (!min || !max) return null;
                        const pos = getSpanPosition(min, max);
                        if (!pos) return null;
                        return (
                          <div
                            className="absolute z-10 pointer-events-none"
                            style={{
                              left: pos.left,
                              width: pos.width,
                              top: ROW_HEIGHT / 2 - 7,
                            }}
                          >
                            <div
                              className="h-[8px]"
                              style={{ backgroundColor: BAR_FILL }}
                            />
                            <div
                              className="absolute left-0 top-0 w-[3px] h-[14px] rounded-b"
                              style={{ backgroundColor: BAR_FILL }}
                            />
                            <div
                              className="absolute right-0 top-0 w-[3px] h-[14px] rounded-b"
                              style={{ backgroundColor: BAR_FILL }}
                            />
                          </div>
                        );
                      })()}
                    </div>

                    {!isCollapsed && (
                      <>
                        {section.tasks.map((task) => {
                          const position = getTaskPosition(task);
                          const isMilestone = task.taskType === "MILESTONE";
                          const isApproval = task.taskType === "APPROVAL";
                          const dueSoon = isTaskDueSoon(task);
                          // Asana colors every bar the same project blue.
                          const barColor = task.completed
                            ? BAR_FILL_COMPLETED
                            : BAR_FILL;
                          const isDueOnly = !task.startDate;

                          const isResizing =
                            dragState !== null && dragState.taskId === task.id;
                          const renderLeft =
                            position && isResizing
                              ? dragState.handle === "left" ||
                                dragState.handle === "move"
                                ? position.left + dragState.deltaX
                                : position.left
                              : position?.left;
                          const renderWidth =
                            position && isResizing
                              ? dragState.handle === "left"
                                ? position.width - dragState.deltaX
                                : dragState.handle === "right"
                                  ? position.width + dragState.deltaX
                                  : position.width
                              : position?.width;

                          // Milestones/approvals sit on the DUE date
                          // (right edge of the computed span).
                          const markerLeft =
                            (renderLeft ?? 0) + (renderWidth ?? 0) - 12;

                          // Asana renders the chart bare — names live only
                          // in the left table. Due-only tasks are a slim
                          // pill (12px), except while stretching them.
                          const barWidth =
                            isDueOnly &&
                            !(isResizing && dragState!.handle === "right")
                              ? DUE_ONLY_W
                              : Math.max(renderWidth ?? DUE_ONLY_W, DUE_ONLY_W);

                          return (
                            <div
                              key={task.id}
                              className="flex border-b relative"
                              style={{ height: ROW_HEIGHT }}
                              onMouseEnter={() => setHoveredTask(task.id)}
                              onMouseLeave={() => setHoveredTask(null)}
                            >
                              {renderGridCells(true)}

                              {position &&
                                (isMilestone ? (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform z-10"
                                    style={{ left: markerLeft }}
                                    onClick={() => handleRowClick(task.id)}
                                    title={`${task.name} — milestone`}
                                  >
                                    <Diamond
                                      className="w-6 h-6"
                                      fill={BAR_FILL}
                                      color={BAR_FILL}
                                    />
                                  </div>
                                ) : isApproval ? (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform z-10"
                                    style={{ left: markerLeft }}
                                    onClick={() => handleRowClick(task.id)}
                                    title={`${task.name} — approval gate`}
                                  >
                                    <ThumbsUp
                                      className="w-6 h-6"
                                      fill={BAR_FILL}
                                      color={BAR_FILL}
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      // z-10 keeps the bar ABOVE the dependency
                                      // svg (z-[5]) — its invisible 12px hit-
                                      // paths otherwise sit on top of the bar
                                      // and steal mousedown/click wherever an
                                      // arrow crosses it, making drags feel
                                      // stuck.
                                      "absolute rounded cursor-grab active:cursor-grabbing group/bar z-10",
                                      "hover:ring-2 hover:ring-[#335FB5]/50",
                                      "transition-shadow",
                                      selectedTaskId === task.id &&
                                        "ring-2 ring-[#335FB5]",
                                      dueSoon &&
                                        highlightDueSoon &&
                                        "ring-2 ring-[#a8893a]/70",
                                      isResizing &&
                                        "shadow-lg ring-2 ring-[#335FB5]"
                                    )}
                                    style={{
                                      left: renderLeft,
                                      width: barWidth,
                                      top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                                      height: BAR_HEIGHT,
                                      backgroundColor: barColor,
                                    }}
                                    title={`${task.name} · ${dueRangeText(task)}`}
                                    onMouseDown={(e) =>
                                      handleDragStart(e, task.id, "move", task)
                                    }
                                    onClick={() => {
                                      if (didDragRef.current) {
                                        didDragRef.current = false;
                                        return;
                                      }
                                      handleRowClick(task.id);
                                    }}
                                  >
                                    {/* Resize handles — a due-only pill keeps
                                        only the right one (stretching gives
                                        the task a duration). */}
                                    {!isDueOnly && (
                                      <div
                                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-black/20 rounded-l z-10"
                                        onMouseDown={(e) =>
                                          handleDragStart(
                                            e,
                                            task.id,
                                            "left",
                                            task
                                          )
                                        }
                                      />
                                    )}
                                    <div
                                      className={cn(
                                        "absolute right-0 top-0 bottom-0 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-black/20 rounded-r z-10",
                                        isDueOnly ? "w-1" : "w-2"
                                      )}
                                      onMouseDown={(e) =>
                                        handleDragStart(
                                          e,
                                          task.id,
                                          "right",
                                          task
                                        )
                                      }
                                    />
                                  </div>
                                ))}
                            </div>
                          );
                        })}

                        {/* Ghost "Add task…" row (grid only, matches left) */}
                        <div
                          className="flex border-b"
                          style={{ height: ROW_HEIGHT }}
                        >
                          {renderGridCells(true)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Bottom add-section row */}
              <div
                className="flex border-b flex-shrink-0"
                style={{ height: ROW_HEIGHT }}
              >
                {renderGridCells(true)}
              </div>

              {/* Grid keeps running to the viewport bottom (Asana-style) */}
              <div className="flex flex-1">{renderGridCells(true)}</div>

              {/* ---------- Dependency type pill + menu (Asana) ----------
                  Lives INSIDE the timeline body so its content coords track
                  the arrow while the user scrolls horizontally. */}
              {depMenu && (
                <div
                  data-gantt-dep-menu
                  className="absolute z-50"
                  style={{
                    left: depMenu.x,
                    top: depMenu.y,
                    transform: depMenu.flipUp ? "translateY(-100%)" : undefined,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setDepMenu((m) => m && { ...m, open: !m.open })
                    }
                    className="flex h-7 items-center gap-1 rounded-[6px] border border-[#C6C9CD] bg-white px-2.5 text-xs text-[#1E1F21] shadow-sm hover:bg-[#F7F7F7]"
                  >
                    {dependencyLabel(depMenu.dep.type)}
                    <ChevronDown className="h-3 w-3 text-[#6B6D70]" />
                  </button>

                  {depMenu.open && (
                    <div className="mt-1 w-[212px] rounded-[8px] border border-[#E0E1E3] bg-white py-1 shadow-lg">
                      {DEPENDENCY_TYPES.map((t) => (
                        <button
                          key={t.type}
                          type="button"
                          onClick={() =>
                            void changeDependencyType(depMenu.dep, t.type)
                          }
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#1E1F21] hover:bg-[#F7F7F7]"
                        >
                          <Check
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              depMenu.dep.type === t.type
                                ? "text-[#1E1F21]"
                                : "invisible"
                            )}
                          />
                          {t.label} · {t.code}
                        </button>
                      ))}
                      <div className="my-1 h-px bg-[#E0E1E3]" />
                      <button
                        type="button"
                        onClick={() => void deleteDependency(depMenu.dep)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] text-[#B4304C] hover:bg-[#F7F7F7]"
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-3.5" />
                          Remove
                        </span>
                        <kbd className="rounded border border-[#E0E1E3] bg-[#F7F7F7] px-1.5 py-0.5 text-[10px] font-normal text-[#6B6D70]">
                          Bksp
                        </kbd>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateTaskDialog
        open={createDialog.open}
        onOpenChange={(open) => setCreateDialog((prev) => ({ ...prev, open }))}
        projectId={projectId}
        sectionId={createDialog.sectionId}
        defaultTaskType={createDialog.taskType}
      />
    </div>
  );
}

