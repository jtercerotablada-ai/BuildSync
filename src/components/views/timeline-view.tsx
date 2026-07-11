"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Filter,
  Diamond,
  ThumbsUp,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import {
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  startOfMonth,
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
// TYPES
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

interface TimelineViewProps {
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  projectId: string;
}

type ZoomLevel = "day" | "week" | "month";

// ============================================
// PRIORITY COLORS — monochrome + gold palette
// ============================================

const PRIORITY_COLORS: Record<string, string> = {
  NONE: "#9ca3af",   // slate-400
  LOW: "#d4b65a",    // bright gold
  MEDIUM: "#c9a84c", // gold
  HIGH: "#0a0a0a",   // black
};

const COMPLETED_BAR_FILL = "#94a3b8"; // slate-400

// Swimlane geometry — Asana-height lanes: 36px bars fit two wrapped
// 11px label lines instead of truncating to one.
const LANE_HEIGHT = 44;
const BAND_PADDING = 12;
const COLLAPSED_BAND_HEIGHT = 36;
const BAR_HEIGHT = 36;
// Tasks with a due date but no start render as a narrow pill + label
// outside (Asana's "Para entregar" style), not a full day-wide bar.
const DUE_ONLY_TICK_W = 8;

// Sort order inside each swimlane (Asana's "Ordenar")
const PRIORITY_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  NONE: 3,
};
const HEADER_HEIGHT = 64; // two 32px sticky header rows
const FOOTER_ROW_HEIGHT = 44; // add-section row

// ============================================
// DEPENDENCY CONNECTOR GEOMETRY (rounded elbows)
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

/**
 * Rounded orthogonal elbow between a source endpoint and a target endpoint.
 * sxOutDir/exInDir are +1 (right) or -1 (left) per dependency type.
 */
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

  const needWrap =
    (sxOutDir > 0 && eInX < sOutX) || (sxOutDir < 0 && eInX > sOutX);

  let pts: { x: number; y: number }[];
  if (!needWrap) {
    const midX = (sOutX + eInX) / 2;
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
// MAIN COMPONENT
// ============================================

export function TimelineView({
  sections,
  onTaskClick,
  projectId,
}: TimelineViewProps) {
  const router = useRouter();

  // State
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState(new Date());
  // Asana's Cronograma defaults to day zoom.
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("day");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDueSoon, setShowDueSoon] = useState(true);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"all" | "incomplete" | "completed" | "due_this_week">("all");
  const [taskSort, setTaskSort] = useState<"start" | "due" | "name" | "priority">("start");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<"TASK" | "MILESTONE">("TASK");
  // Inline add-section (Enter = create, Escape = cancel)
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  // Dependencies — loaded on mount; rendered as rounded elbow arrows.
  type DependencyRow = {
    id: string;
    type: "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH" | "START_TO_FINISH";
    dependentTaskId: string;
    blockingTaskId: string;
  };
  const [dependencies, setDependencies] = useState<DependencyRow[]>([]);
  const [showDependencies, setShowDependencies] = useState(true);

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
    // Re-fetch when the task set changes too: adding/removing a dependency
    // from the task panel triggers router.refresh(), which updates `sections`.
     
  }, [projectId, sections]);

  const [dragState, setDragState] = useState<{
    taskId: string;
    handle: "left" | "right" | "move";
    startX: number;
    originalStart: string | null;
    originalDue: string;
    deltaX: number;
  } | null>(null);
  // True once a drag actually moved by ≥1 snapped day — used to
  // suppress the click that fires after mouseup so a real drag
  // doesn't also open the task panel.
  const dragMovedRef = useRef(false);

  // ============================================
  // FILTER
  // ============================================

  const filteredSections = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    if (taskFilter === "all") return sections;

    return sections.map((section) => ({
      ...section,
      tasks: section.tasks.filter((task) => {
        if (taskFilter === "incomplete") return !task.completed;
        if (taskFilter === "completed") return task.completed;
        if (taskFilter === "due_this_week") {
          if (!task.dueDate) return false;
          const due = dueDateToLocalMidnight(task.dueDate);
          return due >= weekStart && due <= weekEnd;
        }
        return true;
      }),
    }));
  }, [sections, taskFilter]);

  // ============================================
  // ZOOM CONFIGURATION
  // ============================================

  const zoomConfig: Record<
    ZoomLevel,
    { columnWidth: number; range: number; getColumns: (start: Date, count: number) => Date[] }
  > = {
    // Ranges are generous so the canvas always overflows the viewport and
    // scrolls horizontally (Asana never shows dead space past the grid).
    day: {
      columnWidth: 40,
      range: 120,
      getColumns: (start: Date, count: number) =>
        eachDayOfInterval({ start, end: addDays(start, count - 1) }),
    },
    week: {
      columnWidth: 80,
      range: 36,
      getColumns: (start: Date, count: number) =>
        eachWeekOfInterval(
          { start, end: addWeeks(start, count - 1) },
          { weekStartsOn: 1 }
        ),
    },
    month: {
      columnWidth: 120,
      range: 24,
      getColumns: (start: Date, count: number) =>
        eachMonthOfInterval({
          start: startOfMonth(start),
          end: addMonths(start, count - 1),
        }),
    },
  };

  const config = zoomConfig[zoomLevel];

  // ============================================
  // TIMELINE COLUMNS
  // ============================================

  const columns = useMemo(() => {
    const startDate =
      zoomLevel === "month"
        ? startOfMonth(currentDate)
        : startOfWeek(currentDate, { weekStartsOn: 1 });

    const cols = config.getColumns(startDate, config.range);

    return cols.map((date) => {
      let label = "";
      if (zoomLevel === "day") {
        label = format(date, "d");
      } else if (zoomLevel === "week") {
        label = format(date, "MMM d");
      } else {
        label = format(date, "MMM");
      }
      return {
        date,
        label,
        isWeekend: zoomLevel === "day" && isWeekend(date),
        isToday: zoomLevel === "day" && isSameDay(date, new Date()),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, zoomLevel]);

  // ============================================
  // TOP HEADER GROUPS (months at day/week zoom, quarters at month zoom)
  // ============================================

  const topGroups = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    let currentLabel = "";
    for (const col of columns) {
      const label =
        zoomLevel === "month"
          ? `Q${Math.floor(col.date.getMonth() / 3) + 1} ${format(col.date, "yyyy")}`
          : format(col.date, "MMMM yyyy");
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, count: 0 });
      }
      groups[groups.length - 1].count++;
    }
    return groups;
  }, [columns, zoomLevel]);

  // ============================================
  // TIMELINE RANGE (shared by bars / today line / pixel↔day math)
  // ============================================

  const timelineRange = useMemo(() => {
    const fallback =
      zoomLevel === "month"
        ? startOfMonth(currentDate)
        : startOfWeek(currentDate, { weekStartsOn: 1 });
    const start = columns[0]?.date || fallback;
    const lastColumn = columns[columns.length - 1]?.date || fallback;
    const end =
      zoomLevel === "day"
        ? addDays(lastColumn, 1)
        : zoomLevel === "week"
          ? addDays(lastColumn, 7)
          : addMonths(lastColumn, 1);
    const totalWidth = columns.length * config.columnWidth;
    const totalDays = Math.max(1, differenceInDays(end, start));
    const dayWidth = totalWidth / totalDays;
    // Per-column pixel widths proportional to each column's true day span.
    // Months are 28-31 days (not the 30.42-day average a fixed 120px column
    // implies), so fixed-width columns drift off the uniform day-width math
    // used by bars and the today line at month zoom.
    const columnWidths = columns.map((c, i) => {
      const colStart = differenceInDays(c.date, start);
      const colEnd =
        i + 1 < columns.length
          ? differenceInDays(columns[i + 1].date, start)
          : totalDays;
      return (colEnd - colStart) * dayWidth;
    });
    return { start, end, totalWidth, totalDays, dayWidth, columnWidths };
  }, [columns, zoomLevel, currentDate, config.columnWidth]);

  // Header-group pixel widths — sum of member column widths so group
  // borders stay aligned with the proportional columns.
  const groupWidths = useMemo(() => {
    let idx = 0;
    return topGroups.map((g) => {
      let w = 0;
      for (let k = 0; k < g.count; k++)
        w += timelineRange.columnWidths[idx++] ?? config.columnWidth;
      return w;
    });
  }, [topGroups, timelineRange, config.columnWidth]);

  // ============================================
  // TASK BAR POSITION
  // ============================================
  // Bars only for tasks with a dueDate. Missing startDate = 1-day bar
  // sitting on the due date. dueDate/startDate are UTC-midnight
  // instants; read them by their UTC calendar day so bars don't render
  // a day early for viewers west of UTC.

  const getTaskPosition = useCallback(
    (task: Task) => {
      if (!task.dueDate) return null;

      const { start: timelineStart, end: timelineEnd, totalWidth, totalDays } = timelineRange;

      const taskEnd = dueDateToLocalMidnight(task.dueDate);
      let taskStart = task.startDate
        ? dueDateToLocalMidnight(task.startDate)
        : taskEnd;
      if (taskStart > taskEnd) taskStart = taskEnd;

      // timelineEnd is exclusive — a task starting exactly there is outside.
      if (taskEnd < timelineStart || taskStart >= timelineEnd) {
        return null;
      }

      const startOffset = Math.max(0, differenceInDays(taskStart, timelineStart));
      // Clamp to the last rendered day (totalDays - 1) so the inclusive +1
      // in the width below ends exactly at the grid's right border.
      const endOffset = Math.min(totalDays - 1, differenceInDays(taskEnd, timelineStart));

      const left = (startOffset / totalDays) * totalWidth;
      const width = Math.max(((endOffset - startOffset + 1) / totalDays) * totalWidth, 14);

      return { left, width };
    },
    [timelineRange]
  );

  // ============================================
  // SWIMLANE LAYOUT — greedy first-fit lane packing per section band
  // ============================================

  const bandLayout = useMemo(() => {
    type Band = {
      section: Section;
      collapsed: boolean;
      laneOf: Map<string, number>;
      laneCount: number;
      bandHeight: number;
      top: number;
      datedTasks: Task[];
    };
    const bands: Band[] = [];
    let top = 0;

    for (const section of filteredSections) {
      const collapsed = collapsedSections.has(section.id);

      // Sort dated tasks by the chosen order (Asana's "Ordenar") and
      // first-fit into lanes so overlapping [start,due] ranges stack
      // vertically. First-fit is safe with any input order — a lane only
      // accepts a task starting after the lane's last end.
      const dated = section.tasks
        .filter((t) => t.dueDate)
        .map((t) => {
          const end = dueDateToLocalMidnight(t.dueDate!);
          let start = t.startDate ? dueDateToLocalMidnight(t.startDate) : end;
          if (start > end) start = end;
          return { task: t, start: start.getTime(), end: end.getTime() };
        })
        .sort((a, b) => {
          if (taskSort === "due") return a.end - b.end || a.start - b.start;
          if (taskSort === "name") return a.task.name.localeCompare(b.task.name);
          if (taskSort === "priority")
            return (
              (PRIORITY_RANK[a.task.priority] ?? 3) -
                (PRIORITY_RANK[b.task.priority] ?? 3) || a.start - b.start
            );
          return a.start - b.start || a.end - b.end;
        });

      const laneEnds: number[] = [];
      const laneOf = new Map<string, number>();
      for (const item of dated) {
        let lane = laneEnds.findIndex((laneEnd) => laneEnd < item.start);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(item.end);
        } else {
          laneEnds[lane] = item.end;
        }
        laneOf.set(item.task.id, lane);
      }

      const laneCount = Math.max(1, laneEnds.length);
      const bandHeight = collapsed
        ? COLLAPSED_BAND_HEIGHT
        : laneCount * LANE_HEIGHT + BAND_PADDING;

      bands.push({
        section,
        collapsed,
        laneOf,
        laneCount,
        bandHeight,
        top,
        datedTasks: dated.map((d) => d.task),
      });
      top += bandHeight;
    }

    return { bands, totalHeight: top };
  }, [filteredSections, collapsedSections, taskSort]);

  // taskId → absolute canvas coordinates for dependency arrows.
  // Y = bandTop + lane*LANE_HEIGHT + 18 (lane center). Null when the
  // task is collapsed, undated, or outside the visible window.
  const getTaskScreenPos = useCallback(
    (taskId: string) => {
      for (const band of bandLayout.bands) {
        if (band.collapsed) continue;
        const lane = band.laneOf.get(taskId);
        if (lane === undefined) continue;
        const task = band.section.tasks.find((t) => t.id === taskId);
        if (!task) return null;
        const pos = getTaskPosition(task);
        if (!pos) return null;
        // Due-only tasks render as a narrow tick — anchor arrows to it.
        const width = task.startDate ? pos.width : DUE_ONLY_TICK_W;
        return {
          xLeft: pos.left,
          xRight: pos.left + width,
          yCenter: band.top + lane * LANE_HEIGHT + 4 + BAR_HEIGHT / 2,
        };
      }
      return null;
    },
    [bandLayout, getTaskPosition]
  );

  // ============================================
  // TODAY LINE POSITION
  // ============================================

  const todayPosition = useMemo(() => {
    const today = startOfDay(new Date());
    const { start, end, totalWidth, totalDays } = timelineRange;
    if (today < start || today > end) return null;
    const daysFromStart = differenceInDays(today, start);
    // Center the marker on today's column at day zoom.
    return ((daysFromStart + (zoomLevel === "day" ? 0.5 : 0)) / totalDays) * totalWidth;
  }, [timelineRange, zoomLevel]);

  // ============================================
  // DRAG MOVE / RESIZE — whole-day snap, UTC-midnight-safe save
  // ============================================

  const pixelsToDays = useCallback(
    (px: number) => {
      const { totalWidth, totalDays } = timelineRange;
      return (px / totalWidth) * totalDays;
    },
    [timelineRange]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, taskId: string, handle: "left" | "right" | "move", task: Task) => {
      e.preventDefault();
      e.stopPropagation();
      if (!task.dueDate) return;
      dragMovedRef.current = false;
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
    if (!dragState) return;

    // Use the true render ratio — columnWidth/30 at month zoom disagrees
    // with totalWidth/totalDays and made the ghost bar snap on release.
    const pxPerDay = timelineRange.totalWidth / timelineRange.totalDays;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const snappedDays = Math.round(pixelsToDays(dx));
      if (snappedDays !== 0) dragMovedRef.current = true;
      const snappedPx = snappedDays * pxPerDay;
      setDragState((prev) => (prev ? { ...prev, deltaX: snappedPx } : prev));
    };

    const handleMouseUp = async (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(pixelsToDays(deltaX));
      if (deltaDays === 0) {
        setDragState(null);
        return;
      }

      // Read the originals by their UTC calendar day (they're UTC-midnight
      // instants). Round-tripping through parseISO+local format shifted every
      // saved date one day earlier for users west of UTC.
      const origDue = dueDateToLocalMidnight(dragState.originalDue);
      const impliedStart = dragState.originalStart
        ? dueDateToLocalMidnight(dragState.originalStart)
        : origDue; // no startDate = 1-day bar sitting on the due date

      const body: Record<string, string | null> = {};
      if (dragState.handle === "left") {
        let newStart = addDays(impliedStart, deltaDays);
        if (newStart > origDue) newStart = origDue;
        body.startDate = format(newStart, "yyyy-MM-dd");
      } else if (dragState.handle === "right") {
        let newDue = addDays(origDue, deltaDays);
        if (newDue < impliedStart) newDue = impliedStart;
        body.dueDate = format(newDue, "yyyy-MM-dd");
        // Pin the left edge: with no persisted startDate the 1-day bar
        // would otherwise translate instead of growing.
        if (!dragState.originalStart) {
          body.startDate = format(impliedStart, "yyyy-MM-dd");
        }
      } else {
        // "move" — shift the whole bar; duration preserved.
        const newDue = addDays(origDue, deltaDays);
        body.dueDate = format(newDue, "yyyy-MM-dd");
        if (dragState.originalStart) {
          body.startDate = format(addDays(impliedStart, deltaDays), "yyyy-MM-dd");
        }
      }

      try {
        const res = await fetch(`/api/tasks/${dragState.taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        toast.error("Failed to update dates");
      }
      setDragState(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, pixelsToDays, router, timelineRange]);

  // ============================================
  // NAVIGATION & ZOOM STEPPING
  // ============================================

  const navigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(new Date());
    } else {
      const amount = direction === "prev" ? -1 : 1;
      if (zoomLevel === "day") setCurrentDate((d) => addWeeks(d, amount * 2));
      else if (zoomLevel === "week") setCurrentDate((d) => addMonths(d, amount));
      else setCurrentDate((d) => addMonths(d, amount * 3));
    }
  };

  const ZOOM_ORDER: ZoomLevel[] = ["day", "week", "month"];
  const zoomIndex = ZOOM_ORDER.indexOf(zoomLevel);
  const zoomIn = () => {
    if (zoomIndex > 0) setZoomLevel(ZOOM_ORDER[zoomIndex - 1]);
  };
  const zoomOut = () => {
    if (zoomIndex < ZOOM_ORDER.length - 1) setZoomLevel(ZOOM_ORDER[zoomIndex + 1]);
  };
  const ZOOM_LABELS: Record<ZoomLevel, string> = {
    day: "Days",
    week: "Weeks",
    month: "Months",
  };

  // ============================================
  // SECTION TOGGLE + INLINE ADD SECTION
  // ============================================

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const submitNewSection = async () => {
    const name = newSectionName.trim();
    if (!name) {
      setAddingSection(false);
      setNewSectionName("");
      return;
    }
    try {
      const response = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectId }),
      });
      if (!response.ok) throw new Error("Failed to create section");
      setAddingSection(false);
      setNewSectionName("");
      router.refresh();
    } catch {
      toast.error("Failed to add section");
    }
  };

  // ============================================
  // TASK FLAGS
  // ============================================

  // Due within 7 days and not yet complete → subtle gold ring.
  const isTaskDueSoon = (task: Task) => {
    if (!task.dueDate) return false;
    if (task.completed) return false;
    // daysFromToday rounds whole calendar days (differenceInDays against
    // wall-clock `new Date()` truncates and flags 8-days-out as due soon).
    const daysUntilDue = daysFromToday(task.dueDate);
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  };

  const isTaskMilestone = (task: Task) => task.taskType === "MILESTONE";
  const isTaskApproval = (task: Task) => task.taskType === "APPROVAL";

  // ============================================
  // RESPONSIVE GUTTER
  // ============================================

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const gutterWidth = isMobile ? 120 : 200;
  const { totalWidth } = timelineRange;
  const FILTER_LABELS: Record<typeof taskFilter, string> = {
    all: "All",
    incomplete: "Incomplete",
    completed: "Completed",
    due_this_week: "Due this week",
  };
  const SORT_LABELS: Record<typeof taskSort, string> = {
    start: "Start date",
    due: "Due date",
    name: "Alphabetical",
    priority: "Priority",
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ============================================ */}
      {/* TOOLBAR */}
      {/* ============================================ */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 bg-white border-b overflow-x-auto">
        {/* Left */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Split button — Asana's "Agregar tarea ▾" */}
          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              className="rounded-r-none"
              onClick={() => {
                setCreateType("TASK");
                setShowCreateDialog(true);
              }}
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
                  onClick={() => {
                    setCreateType("TASK");
                    setShowCreateDialog(true);
                  }}
                >
                  Task
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setCreateType("MILESTONE");
                    setShowCreateDialog(true);
                  }}
                >
                  <Diamond className="w-3.5 h-3.5 mr-2 text-[#a8893a]" />
                  Milestone
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddingSection(true)}>
                  Section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 md:mx-2" />

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
          {/* Zoom */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {ZOOM_LABELS[zoomLevel]}
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ZOOM_ORDER.map((level) => (
                <DropdownMenuCheckboxItem
                  key={level}
                  checked={zoomLevel === level}
                  onCheckedChange={() => setZoomLevel(level)}
                >
                  {ZOOM_LABELS[level]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={zoomIndex >= ZOOM_ORDER.length - 1}
            title="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={zoomIndex <= 0}
            title="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </Button>

          <div className="h-6 w-px bg-slate-200 mx-1 md:mx-2 hidden md:block" />

          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={taskFilter !== "all" ? "secondary" : "ghost"} size="sm">
                <Filter className="w-4 h-4 mr-1" />
                <span className="hidden md:inline">
                  {taskFilter === "all" ? "Filter" : FILTER_LABELS[taskFilter]}
                </span>
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

          {/* Sort — Asana's "Ordenar": reorders lanes inside each section */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={taskSort !== "start" ? "secondary" : "ghost"}
                size="sm"
              >
                <ArrowUpDown className="w-4 h-4 mr-1" />
                <span className="hidden md:inline">
                  {taskSort === "start" ? "Sort" : SORT_LABELS[taskSort]}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABELS) as (typeof taskSort)[]).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={taskSort === key}
                  onCheckedChange={() => setTaskSort(key)}
                >
                  {SORT_LABELS[key]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <SlidersHorizontal className="w-4 h-4 mr-1" />
                <span className="hidden md:inline">Options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={showDependencies && dependencies.length > 0}
                disabled={dependencies.length === 0}
                onCheckedChange={(v) => setShowDependencies(!!v)}
              >
                Show dependencies
                {dependencies.length > 0 && (
                  <span className="ml-2 text-[10px] tabular-nums text-slate-400">
                    {dependencies.length}
                  </span>
                )}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showDueSoon}
                onCheckedChange={(v) => setShowDueSoon(!!v)}
              >
                Highlight due soon
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ============================================ */}
      {/* SWIMLANE TIMELINE */}
      {/* ============================================ */}
      <div className="flex-1 overflow-auto">
        {/* min-h-full so gutter + canvas stretch to the viewport bottom —
            the grid must never stop short of the screen edge (Asana). */}
        <div className="flex min-w-max min-h-full">
          {/* ============================================ */}
          {/* LEFT GUTTER — section labels, sticky left */}
          {/* ============================================ */}
          <div
            className="flex-shrink-0 bg-white border-r sticky left-0 z-30 flex flex-col"
            style={{ width: gutterWidth }}
          >
            {/* Corner cell — sticky both top and left */}
            <div
              className="border-b bg-white sticky top-0 z-40 flex-shrink-0"
              style={{ height: HEADER_HEIGHT }}
            />

            {/* One gutter cell per band, height-matched to the band */}
            {bandLayout.bands.map((band) => (
              <div
                key={band.section.id}
                className="border-b bg-white flex-shrink-0"
                style={{ height: band.bandHeight }}
              >
                <button
                  className="flex items-center gap-1 px-2 md:px-3 w-full text-left hover:bg-slate-50"
                  style={{ height: Math.min(band.bandHeight, 36) }}
                  onClick={() => toggleSection(band.section.id)}
                >
                  {band.collapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span className="font-semibold text-xs md:text-sm text-slate-900 truncate">
                    {band.section.name}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto flex-shrink-0 tabular-nums">
                    {band.section.tasks.length}
                  </span>
                </button>
              </div>
            ))}

            {/* Add section — inline input, Enter=create / Escape=cancel */}
            <div
              className="border-b flex-shrink-0"
              style={{ height: FOOTER_ROW_HEIGHT }}
            >
              {addingSection ? (
                <div className="flex items-center h-full px-2 md:px-3">
                  <input
                    autoFocus
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitNewSection();
                      } else if (e.key === "Escape") {
                        setAddingSection(false);
                        setNewSectionName("");
                      }
                    }}
                    onBlur={() => {
                      setAddingSection(false);
                      setNewSectionName("");
                    }}
                    placeholder="Section name"
                    className="w-full text-sm bg-white border border-[#c9a84c] rounded px-2 py-1 outline-none"
                  />
                </div>
              ) : (
                <button
                  className="flex items-center gap-2 px-2 md:px-3 text-slate-500 hover:bg-slate-50 w-full h-full text-left"
                  onClick={() => setAddingSection(true)}
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Add section</span>
                </button>
              )}
            </div>

            {/* White filler down to the viewport bottom */}
            <div className="flex-1 bg-white" />
          </div>

          {/* ============================================ */}
          {/* TIMELINE CANVAS */}
          {/* ============================================ */}
          <div className="flex-1 flex flex-col" style={{ width: totalWidth }}>
            {/* Two sticky header rows */}
            <div
              className="sticky top-0 bg-white border-b z-20 relative flex-shrink-0"
              style={{ height: HEADER_HEIGHT, width: totalWidth }}
            >
              {/* Top row — months (day/week zoom) or quarters (month zoom) */}
              <div className="flex border-b" style={{ height: HEADER_HEIGHT / 2 }}>
                {topGroups.map((group, i) => (
                  <div
                    key={i}
                    className="flex items-center px-2 text-xs md:text-sm font-medium text-slate-700 border-r truncate"
                    style={{ width: groupWidths[i] }}
                  >
                    {group.label}
                  </div>
                ))}
              </div>

              {/* Bottom row — day numbers / week starts / month names */}
              <div className="flex" style={{ height: HEADER_HEIGHT / 2 }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-center text-xs border-r",
                      col.isWeekend && "bg-slate-100"
                    )}
                    style={{ width: timelineRange.columnWidths[i] ?? config.columnWidth }}
                  >
                    <span
                      className={cn(
                        "text-slate-500",
                        col.isToday &&
                          "bg-[#c9a84c] text-white rounded-full w-5 h-5 flex items-center justify-center font-medium"
                      )}
                    >
                      {col.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Today dot in the header */}
              {todayPosition !== null && (
                <div
                  className="absolute w-2 h-2 rounded-full bg-[#c9a84c] pointer-events-none"
                  style={{ left: todayPosition - 4, bottom: -1 }}
                />
              )}
            </div>

            {/* Bands — flex column that stretches to the viewport bottom;
                the trailing flex-1 row keeps the grid (and the today line,
                which spans top-0→bottom-0) running past the last section. */}
            <div
              className="relative flex-1 flex flex-col"
              style={{ width: totalWidth }}
            >
              {/* Today line — gold */}
              {todayPosition !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#c9a84c] z-10 pointer-events-none"
                  style={{ left: todayPosition - 1 }}
                />
              )}

              {/* Dependency arrows — rounded orthogonal elbows */}
              {showDependencies && dependencies.length > 0 && (
                <svg
                  className="absolute left-0 top-0 pointer-events-none z-[5]"
                  width={totalWidth}
                  height={bandLayout.totalHeight}
                >
                  <defs>
                    <marker
                      id="dep-arrow-default"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6.5"
                      refY="4"
                      orient="auto"
                    >
                      <polygon points="0 0.5, 7 4, 0 7.5" fill="#94a3b8" />
                    </marker>
                    <marker
                      id="dep-arrow-active"
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

                    // FS = blocker right → dependent left, etc.
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

                    const path = dependencyElbowPath(sx, sy, ex, ey, sxOutDir, exInDir);

                    const isActive =
                      hoveredTask === dep.blockingTaskId ||
                      hoveredTask === dep.dependentTaskId ||
                      selectedTaskId === dep.blockingTaskId ||
                      selectedTaskId === dep.dependentTaskId;

                    return (
                      <path
                        key={dep.id}
                        d={path}
                        stroke={isActive ? "#a8893a" : "#94a3b8"}
                        strokeWidth={isActive ? 2 : 1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        markerEnd={
                          isActive
                            ? "url(#dep-arrow-active)"
                            : "url(#dep-arrow-default)"
                        }
                        opacity={isActive ? 1 : 0.9}
                      />
                    );
                  })}
                </svg>
              )}

              {/* Section bands */}
              {bandLayout.bands.map((band) => (
                <div
                  key={band.section.id}
                  className={cn(
                    "relative border-b flex-shrink-0",
                    band.collapsed && "bg-slate-50"
                  )}
                  style={{ height: band.bandHeight }}
                >
                  {/* Grid columns (weekend shading at day zoom) */}
                  <div className="absolute inset-0 flex">
                    {columns.map((col, i) => (
                      <div
                        key={i}
                        className={cn("border-r h-full", col.isWeekend && "bg-slate-100")}
                        style={{ width: timelineRange.columnWidths[i] ?? config.columnWidth }}
                      />
                    ))}
                  </div>

                  {/* Lane-packed bars */}
                  {!band.collapsed &&
                    band.datedTasks.map((task) => {
                      const position = getTaskPosition(task);
                      if (!position) return null;
                      const lane = band.laneOf.get(task.id) ?? 0;
                      const laneTop = lane * LANE_HEIGHT + 4;

                      const isMilestone = isTaskMilestone(task);
                      const isApproval = isTaskApproval(task);
                      const dueSoon = isTaskDueSoon(task);
                      const taskColor = task.completed
                        ? COMPLETED_BAR_FILL
                        : PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.NONE;

                      // Live drag preview
                      const isResizing = !!dragState && dragState.taskId === task.id;
                      const renderLeft =
                        isResizing &&
                        (dragState!.handle === "left" || dragState!.handle === "move")
                          ? position.left + dragState!.deltaX
                          : position.left;
                      const renderWidth = isResizing
                        ? dragState!.handle === "left"
                          ? Math.max(position.width - dragState!.deltaX, 14)
                          : dragState!.handle === "right"
                            ? Math.max(position.width + dragState!.deltaX, 14)
                            : position.width
                        : position.width;

                      if (isMilestone || isApproval) {
                        // Point-in-time marker centered on the DUE date's
                        // day cell — computed from the date itself so the
                        // min-width clamp and a persisted startDate can't
                        // pull the marker off its labeled date.
                        const due = dueDateToLocalMidnight(task.dueDate!);
                        const dueOffset = Math.min(
                          timelineRange.totalDays - 1,
                          Math.max(0, differenceInDays(due, timelineRange.start))
                        );
                        const centerX =
                          (dueOffset + 0.5) * timelineRange.dayWidth;
                        const Icon = isMilestone ? Diamond : ThumbsUp;
                        return (
                          <div
                            key={task.id}
                            className="absolute flex items-center gap-1.5 cursor-pointer hover:opacity-80 z-10"
                            style={{ left: centerX - 10, top: laneTop, height: BAR_HEIGHT }}
                            onClick={() => {
                              setSelectedTaskId(task.id);
                              onTaskClick(task.id);
                            }}
                            onMouseEnter={() => setHoveredTask(task.id)}
                            onMouseLeave={() => setHoveredTask(null)}
                            title={`${task.name} — ${isMilestone ? "milestone" : "approval"}`}
                          >
                            <Icon
                              className="w-5 h-5 flex-shrink-0"
                              fill="#a8893a"
                              color="#a8893a"
                            />
                            <div className="leading-tight whitespace-nowrap">
                              <div
                                className={cn(
                                  "text-[11px] font-medium text-slate-900",
                                  task.completed && "line-through text-slate-400"
                                )}
                              >
                                {task.name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Due {format(due, "MMM d")}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Asana style: a task with a due date but no start
                      // renders as a narrow pill with its name + "Due X"
                      // OUTSIDE the bar ("Para entregar" pattern).
                      const isDueOnly = !task.startDate;
                      const barWidth =
                        isDueOnly &&
                        !(isResizing && dragState!.handle === "right")
                          ? DUE_ONLY_TICK_W
                          : Math.max(renderWidth, 14);
                      const labelInside = !isDueOnly && renderWidth >= 80;
                      const start = task.startDate
                        ? dueDateToLocalMidnight(task.startDate)
                        : dueDateToLocalMidnight(task.dueDate!);
                      const due = dueDateToLocalMidnight(task.dueDate!);

                      return (
                        <div key={task.id}>
                          {/* Bar */}
                          <div
                            className={cn(
                              "absolute rounded-lg cursor-grab active:cursor-grabbing group/bar z-10",
                              "hover:ring-2 hover:ring-[#c9a84c] hover:ring-offset-1",
                              "transition-shadow",
                              selectedTaskId === task.id &&
                                "ring-2 ring-[#c9a84c] ring-offset-1",
                              dueSoon && showDueSoon && "ring-2 ring-[#a8893a]/70",
                              isResizing && "shadow-lg ring-2 ring-[#c9a84c]"
                            )}
                            style={{
                              left: renderLeft,
                              width: barWidth,
                              top: laneTop,
                              height: BAR_HEIGHT,
                              backgroundColor: taskColor,
                              opacity: task.completed ? 0.6 : 1,
                            }}
                            onMouseDown={(e) => handleResizeStart(e, task.id, "move", task)}
                            onMouseEnter={() => setHoveredTask(task.id)}
                            onMouseLeave={() => setHoveredTask(null)}
                            onClick={() => {
                              if (dragMovedRef.current) return;
                              setSelectedTaskId(task.id);
                              onTaskClick(task.id);
                            }}
                            title={`${task.name} · ${format(start, "MMM d")} → ${format(due, "MMM d")}`}
                          >
                            <div className="relative h-full flex items-center px-1.5 gap-1 overflow-hidden">
                              {!isDueOnly && task.assignee && renderWidth >= 40 && (
                                <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-medium text-white flex-shrink-0 overflow-hidden">
                                  {task.assignee.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={task.assignee.image}
                                      alt={task.assignee.name || ""}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    task.assignee.name?.[0] || "?"
                                  )}
                                </div>
                              )}
                              {labelInside && (
                                <span
                                  className={cn(
                                    // Wrap to two lines like Asana instead
                                    // of truncating to one.
                                    "text-[11px] leading-[13px] font-medium line-clamp-2",
                                    task.priority === "HIGH" || task.completed
                                      ? "text-white"
                                      : "text-black",
                                    task.completed && "line-through"
                                  )}
                                >
                                  {task.name}
                                </span>
                              )}
                            </div>

                            {/* Resize handles — a due-only tick keeps just
                                the right handle (stretching it right gives
                                the task a duration; the tick body drags). */}
                            {!isDueOnly && (
                              <div
                                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-black/20 rounded-l-lg z-10"
                                onMouseDown={(e) => handleResizeStart(e, task.id, "left", task)}
                              />
                            )}
                            <div
                              className={cn(
                                "absolute right-0 top-0 bottom-0 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-black/20 rounded-r-lg z-10",
                                isDueOnly ? "w-1" : "w-2"
                              )}
                              onMouseDown={(e) => handleResizeStart(e, task.id, "right", task)}
                            />
                          </div>

                          {/* Label outside the bar when it's a due-only tick
                              or too narrow. Due-only gets Asana's two-line
                              name + "Due X" subtitle. */}
                          {!labelInside &&
                            (isDueOnly ? (
                              <div
                                className="absolute pointer-events-none z-10 leading-tight"
                                style={{
                                  left: renderLeft + barWidth + 6,
                                  top: laneTop + 3,
                                }}
                              >
                                <div
                                  className={cn(
                                    "text-[11px] font-medium text-slate-900 whitespace-nowrap",
                                    task.completed && "line-through text-slate-400"
                                  )}
                                >
                                  {task.name}
                                </div>
                                <div className="text-[10px] text-slate-500 whitespace-nowrap">
                                  Due {format(due, "MMM d")}
                                </div>
                              </div>
                            ) : (
                              <span
                                className={cn(
                                  "absolute text-xs font-medium text-slate-700 whitespace-nowrap pointer-events-none z-10",
                                  task.completed && "line-through text-slate-400"
                                )}
                                style={{
                                  left: renderLeft + barWidth + 6,
                                  top: laneTop + BAR_HEIGHT / 2 - 8,
                                }}
                              >
                                {task.name}
                              </span>
                            ))}
                        </div>
                      );
                    })}
                </div>
              ))}

              {/* Filler row aligned with the gutter's add-section row */}
              <div
                className="flex border-b flex-shrink-0"
                style={{ height: FOOTER_ROW_HEIGHT }}
              >
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn("border-r", col.isWeekend && "bg-slate-100")}
                    style={{ width: timelineRange.columnWidths[i] ?? config.columnWidth }}
                  />
                ))}
              </div>

              {/* Grid keeps running to the viewport bottom (Asana-style) */}
              <div className="flex flex-1">
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn("border-r", col.isWeekend && "bg-slate-100")}
                    style={{ width: timelineRange.columnWidths[i] ?? config.columnWidth }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
        sectionId={filteredSections[0]?.id}
        defaultTaskType={createType}
      />
    </div>
  );
}
