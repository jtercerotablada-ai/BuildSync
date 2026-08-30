"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  differenceInCalendarDays,
  isSameDay,
  startOfDay,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWeekend,
} from "date-fns";
import { dueDateToLocalMidnight } from "@/lib/date-only";
// The SAME span/overdue/drag rules the Timeline draws with. This view is a
// fork of it, and every rule it kept its own copy of drifted: a start-only
// task was drawn there and invisible here.
import {
  dragCommitBody,
  isTaskOverdue,
  taskSpan,
} from "@/lib/task-span";
// The dependency-arrow router, shared with the Timeline. It needs the bars to
// route around, which is why this view now builds an obstacle list.
import {
  barObstacle,
  routeDependency,
  type ObstacleRect,
} from "@/lib/dependency-route";
import { useToday } from "@/lib/use-today";
import { sectionBarStyle } from "@/lib/section-bar-colors";
import { notifyTaskMutated } from "@/lib/task-events";
// Zoom / collapsed / Options used to die with the component, and the tab
// strip unmounts it on every switch. The shape, the cap and the eviction
// order live in the lib so they can be tested; the hook is the transport.
import { useUiState } from "@/hooks/use-ui-state";
import {
  DEFAULT_GANTT_PREFS,
  EMPTY_GANTT_PREFS_MAP,
  GANTT_PREFS_KEY,
  ganttPrefsFor,
  nextGanttPrefsMap,
  sameGanttPrefs,
  type GanttPrefsMap,
  type GanttProjectPrefs,
  type GanttZoomLevel,
} from "@/lib/gantt-prefs";
// Section.stage has been on these objects all along with nothing reading it.
// On a recert the daily question is whose desk the job is on, and this is the
// only place the answer is already loaded.
import { holderDeskLabel, resolveStage } from "@/lib/pipelines";
// One rule for "did this shift move anything", shared with the Activity rows
// the same cascade writes — the module is pure, its only imports are types.
import {
  cascadeShiftMoved,
  type CascadeShiftDates,
} from "@/lib/cascade-activity";

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
  /** A `Project.stage` key, e.g. "recert.field_work" — the pipeline stage
   *  this section stands for. `stageLabel()`/`holderLabel()` in lib/pipelines
   *  turn it into "Building Official Review · The city". */
  stage?: string | null;
}

interface GanttViewProps {
  sections: Section[];
  /** Every section of the project, unfiltered and ungrouped. The `sections`
   *  prop is the FILTERED set; a blocker hidden by a filter must still be
   *  nameable. Optional so the component still renders standalone. */
  allSections?: Section[];
  /** False when the columns are synthetic group buckets, in which case
   *  every section-scoped write would 404. Same prop, same default and same
   *  meaning as List and Board received in 3198e68. */
  sectionsAreEditable?: boolean;
  /** The project's target completion date — on a recertification this is
   *  the county deadline the engagement exists to hit. Date-only at UTC
   *  midnight like every other date here. */
  projectEndDate?: string | Date | null;
  /** Marks the deadline line with the project name in its tooltip. */
  projectName?: string;
  /** This viewer's remembered zoom / folds / Options for THIS project,
   *  resolved on the server from the same uiState row `useUiState` reads.
   *  useUiState only reaches its cache and the DB from an effect, so without
   *  this the chart opens at the defaults and the remembered zoom lands a
   *  frame later — and worse, a click inside that window persisted the
   *  DEFAULTS over the stored folds, because the server's uiState merge
   *  REPLACES the object under a project id. Seeding the hook's default with
   *  the server's answer makes the SSR HTML, the hydration render and the
   *  first write all agree. */
  initialPrefs?: GanttProjectPrefs | null;
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

// One definition, in the lib, because the persisted preference and the chart
// have to agree on the set: a zoom key this file cannot draw is not a wrong
// label, it is `zoomConfig[zoom] === undefined` and a blank chart.
type ZoomLevel = GanttZoomLevel;

export type DependencyType =
  | "FINISH_TO_START"
  | "START_TO_START"
  | "FINISH_TO_FINISH"
  | "START_TO_FINISH";

export interface DependencyRow {
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

function dependencyCode(type: DependencyType): string {
  return DEPENDENCY_TYPES.find((d) => d.type === type)?.code ?? "";
}

/**
 * The constraint spelled out, for the reader who does not think in
 * FS/SS/FF/SF. The subject is always the DEPENDENT task ("this task …"),
 * and the wording is the server's actual rule: `edgeAnchor()` in
 * lib/dependency-cascade picks a blocker date and a dependent field, then
 * pushes that field to be no earlier than it — it never pulls a task in.
 * "Starts when the blocker finishes" would be a promise the cascade does
 * not keep.
 */
export function dependencyMeaning(type: DependencyType): string {
  switch (type) {
    case "FINISH_TO_START":
      return "starts no earlier than the blocker finishes";
    case "START_TO_START":
      return "starts no earlier than the blocker starts";
    case "FINISH_TO_FINISH":
      return "finishes no earlier than the blocker finishes";
    case "START_TO_FINISH":
      return "finishes no earlier than the blocker starts";
  }
}

/**
 * How a blocker relates to what is on screen.
 *   visible    — it is a row in the chart right now.
 *   hidden     — it exists and is nameable, but the current filter, search
 *                or grouping dropped it from the rows being drawn.
 *   unnameable — the dependency row arrived with no name behind it.
 */
export type BlockerVisibility = "visible" | "hidden" | "unnameable";

export interface ResolvedBlocker {
  dep: DependencyRow;
  /** null exactly when `visibility` is "unnameable". */
  name: string | null;
  visibility: BlockerVisibility;
}

/**
 * What the "Blocked by" cell is allowed to say about a task that has no
 * name here. Two ways a dependency arrives nameless, and neither is
 * fetchable from this component:
 *   1. the blocker is a task flagged private to someone else — the project
 *      page filters its sections through taskPrivacyClause(), and
 *      /api/projects/:id/dependencies applies no privacy filter at all, so
 *      the EDGE is visible while the task behind it is not;
 *   2. the blocker is a subtask — the page loads `parentTaskId: null` only,
 *      while the dependencies route scopes by projectId, which a subtask
 *      also carries.
 * (A cross-project edge cannot get here: that route requires BOTH endpoints
 * to be in this project.)
 * So the label names nothing, and the cell folds every unnameable blocker
 * into ONE of these — a count is a fact about someone else's private work.
 */
export const UNNAMEABLE_BLOCKER_LABEL = "A task you can't see";

/**
 * Classify every dependency of every task into visible / hidden /
 * unnameable, so the cell can be honest about all three.
 *
 * The bug this replaces: the lookup was built from the `sections` prop and
 * both maps did `if (!name) continue`, so a blocker removed by a filter was
 * dropped from the row entirely and the cell rendered "—" — pixel-identical
 * to a task with no blocker at all. Reproduced on production: completing
 * "Field inspection complete" and ticking Filter → Incomplete tasks made
 * "Generate recertification reports" stop naming its blocker.
 *
 * `visibleTaskIds` is the id set of the rows actually being drawn; a
 * nameable blocker outside it is "hidden", never dropped.
 */
export function resolveBlockedBy(
  dependencies: DependencyRow[],
  taskNameById: Map<string, string>,
  visibleTaskIds: Set<string>
): Map<string, ResolvedBlocker[]> {
  const m = new Map<string, ResolvedBlocker[]>();
  for (const dep of dependencies) {
    const name = taskNameById.get(dep.blockingTaskId) ?? null;
    const visibility: BlockerVisibility = !name
      ? "unnameable"
      : visibleTaskIds.has(dep.blockingTaskId)
        ? "visible"
        : "hidden";
    const arr = m.get(dep.dependentTaskId) ?? [];
    arr.push({ dep, name, visibility });
    m.set(dep.dependentTaskId, arr);
  }
  return m;
}

/**
 * The one-line cell contents. Every unnameable blocker collapses into a
 * single placeholder — rendering one per row would publish how many
 * private tasks are blocking this one, which is the number the placeholder
 * exists not to say. The menu still lists them one per row: removing a link
 * needs its own dep id, and the browser already holds those.
 */
export function blockedCellParts(
  blockers: ResolvedBlocker[]
): { key: string; label: string; visibility: BlockerVisibility }[] {
  const parts: { key: string; label: string; visibility: BlockerVisibility }[] =
    [];
  let unnameableShown = false;
  for (const b of blockers) {
    if (b.visibility === "unnameable") {
      if (unnameableShown) continue;
      unnameableShown = true;
      parts.push({
        key: b.dep.id,
        label: UNNAMEABLE_BLOCKER_LABEL,
        visibility: "unnameable",
      });
      continue;
    }
    parts.push({
      key: b.dep.id,
      label: b.name as string,
      visibility: b.visibility,
    });
  }
  return parts;
}

/** Hover text for the cell: says WHY a muted name is muted, so "hidden by a
 *  filter" is never read as "deleted". */
export function blockedCellTitle(blockers: ResolvedBlocker[]): string {
  return blockedCellParts(blockers)
    .map((p) =>
      p.visibility === "visible"
        ? p.label
        : p.visibility === "hidden"
          ? `${p.label} (hidden by the current filter)`
          : `${p.label} (blocking this task, but not visible to you)`
    )
    .join(", ");
}

// ============================================
// WHAT THE SERVER JUST DID — cascade disclosure
// ============================================

/** One entry of the API's `cascadeShifts`. The server has always sent the
 *  NAME of every task its cascade moved; this view kept only the count.
 *  The dates ride along as ISO strings — `movedShifts` below needs them to
 *  count the same shifts the history writes. */
export interface CascadeShiftSummary extends CascadeShiftDates {
  taskId: string;
  taskName: string;
}

/** The optimistic layer stores date-only strings. Shifts arrive as ISO over
 *  the wire; a Date is accepted too so a caller cannot silently store
 *  "Wed Sep 0". */
function dateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return (value instanceof Date ? value.toISOString() : String(value)).slice(
    0,
    10
  );
}

/**
 * The shifts that actually moved a date.
 *
 * The server can return a shift that ends where it began (a diamond in the
 * graph, folded into one entry — see cascadeShiftMoved), and the Activity
 * feed already skips those. Counting them here would have the toast say
 * "Shifted 3 dependent tasks" over a history holding two rows: one event,
 * two answers, and the toast is the one the reader cannot go back and check.
 */
function movedShifts<T extends CascadeShiftDates>(
  shifts: readonly T[] | undefined | null
): T[] {
  if (!Array.isArray(shifts)) return [];
  return shifts.filter(cascadeShiftMoved);
}

/**
 * The toast a cascade earns, or null when nothing downstream moved.
 *
 * Deliberately the SAME two sentences the task panel's date picker already
 * uses (task-detail-panel.tsx) — a drag on this chart and a date typed in the
 * panel run the identical server cascade, and two phrasings for one event is
 * how a person stops trusting either. The count form is the fallback, not the
 * default: see cascadeToastNames.
 */
export function cascadeToastTitle(
  shifts: readonly CascadeShiftSummary[] | undefined | null
): string | null {
  const moved = movedShifts(shifts);
  if (moved.length === 0) return null;
  if (moved.length === 1) return `Shifted dependent "${moved[0].taskName}"`;
  return `Shifted ${moved.length} dependent tasks`;
}

/**
 * The names behind the count, for the toast's second line; null when the
 * title already named the task.
 *
 * "3 dependent tasks moved" is not an answer to "which?", and on a
 * recertification the only question that matters about a cascade is whether
 * the one with the county date in it moved. A toast has room for a few names,
 * not thirty, so the tail is counted.
 */
export function cascadeToastNames(
  shifts: readonly CascadeShiftSummary[] | undefined | null,
  max = 4
): string | null {
  const moved = movedShifts(shifts);
  if (moved.length < 2) return null;
  const shown = moved.slice(0, Math.max(1, max)).map((s) => s.taskName);
  const rest = moved.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest} more` : shown.join(", ");
}

// ============================================
// THE DEADLINE — Project.endDate, the date the engagement exists to hit
// ============================================

/**
 * The chip that labels the deadline line.
 *
 * `today` is `useToday()`'s value and may be null on the first frame; the
 * label then states the date and claims nothing about whether it has passed,
 * because the only clock available during that render is the server's UTC one
 * and west of UTC it is already tomorrow.
 */
export function deadlineMarkerLabel(deadline: Date, today: Date | null): string {
  const when = format(deadline, "MMM d");
  if (!today) return `Deadline · ${when}`;
  const days = differenceInCalendarDays(deadline, today);
  if (days === 0) return "Deadline today";
  // Past deadlines are the ones worth saying something about: a recert letter
  // date that has gone by is the whole reason this line is drawn.
  if (days < 0) return `Deadline passed · ${when}`;
  return `Deadline · ${when}`;
}

/** Hover text for the deadline line and its axis marker. Names the project so
 *  the line can never be read as belonging to a task. */
export function deadlineMarkerTitle(
  deadline: Date,
  today: Date | null,
  projectName?: string
): string {
  const head = projectName ? `${projectName} — ` : "";
  const base = `${head}deadline ${format(deadline, "MMM d, yyyy")}`;
  if (!today) return base;
  const days = differenceInCalendarDays(deadline, today);
  if (days === 0) return `${base} · due today`;
  if (days < 0) {
    const n = -days;
    return `${base} · ${n} day${n === 1 ? "" : "s"} past due`;
  }
  return `${base} · ${days} day${days === 1 ? "" : "s"} left`;
}

// ============================================
// THE GRID WINDOW — how many columns a span costs
// ============================================

/**
 * The hard ceiling on drawn columns.
 *
 * renderGridCells emits one div per column PER ROW, so the number here is
 * multiplied by every task on the chart: 500 columns on a 50-row project is
 * already 25 000 divs. It is a truncation, not a scroll limit — past it the
 * window simply stops before the work does, which is why nothing may widen
 * the window without asking whether the result still fits.
 */
export const MAX_GRID_COLUMNS = 500;

/**
 * Columns needed to cover `from`..`to` at this zoom, padding included.
 *
 * Extracted so the deadline can be ASKED whether it fits before it is
 * allowed to move the window. The bug: `Project.endDate` was folded into
 * the min/max of the dated tasks and the count was then clamped to
 * MAX_GRID_COLUMNS, so a deadline far outside the plan — a county date
 * already passed, which is exactly the recert that needs looking at —
 * dragged the window's start back to itself and the clamp cut it off
 * BEFORE the work. Today's line, every bar and every section bracket then
 * computed outside the window and rendered nothing: a blank chart.
 */
export function gridColumnsNeeded(
  zoom: GanttZoomLevel,
  from: Date,
  to: Date
): number {
  const days = differenceInDays(to, from);
  switch (zoom) {
    case "day":
      return days + 14;
    case "week":
      return Math.ceil(days / 7) + 4;
    case "month":
      return Math.ceil(days / 28) + 2;
    case "quarter":
      return Math.ceil(days / 84) + 1;
  }
}

// ============================================
// SECTION STAGE — whose desk this column is sitting on
// ============================================

/**
 * The stage chip for a section, or null when there is nothing to say.
 *
 * The chip says WHOSE DESK, never the stage label. A section has a stage
 * because it was NAMED as one — `stageForSectionName()` matches the column
 * name against the pipeline's labels and that is the only rule any writer
 * uses — so "Field Work · Us" beside a header reading "Field Work" prints
 * the same words twice and adds one fact. The label is not lost: it is the
 * hover text, where the reader who wants the stage key's own name can find
 * it.
 *
 * Null covers every degrade path and they all have to be silent: a section
 * with no stage (most projects), a stage key from a pipeline that no longer
 * exists, and the synthetic `group:*` buckets the List's Group-by builds,
 * which carry no stage at all. Absent a stage the header must look exactly as
 * it did before this existed.
 */
export function sectionStageChip(
  stage: string | null | undefined
): { label: string; desk: string } | null {
  const resolved = resolveStage(stage);
  if (!resolved) return null;
  return {
    label: resolved.stage.label,
    desk: holderDeskLabel(resolved.stage.holder),
  };
}

// ============================================
// PALETTE — bars are colored BY SECTION (Asana's "Color: by section")
// via the shared palette in lib/section-bar-colors, matching the
// Timeline view — one flat blue for every bar read as an
// undifferentiated wall. Completed bars go neutral gray. Today is a
// 2px blue stripe, weekends are pale gray bands.
// ============================================

const BAR_FILL_COMPLETED = "#C9CDD4"; // neutral gray for done tasks
const TODAY_BLUE = "#335FB5"; // today stripe + axis dot
const WEEKEND_STRIPE = "#E8E9EA"; // weekend bands
const DATE_OVERDUE = "#B4304C"; // red due text
const DATE_TODAY = "#14865E"; // green "– Today" due text
// The project deadline marker. Deliberately NOT today's blue and deliberately
// dashed: two solid vertical lines in one hue would read as two "todays", and
// the one thing this line must never be mistaken for is the one already there.
// It reuses the overdue red because that is what the date means when it is
// behind you.
const DEADLINE_RED = "#B4304C";

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

const ZOOM_ORDER: ZoomLevel[] = ["day", "week", "month", "quarter"];
const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: "Days",
  week: "Weeks",
  month: "Months",
  quarter: "Quarters",
};

// ============================================
// DEPENDENCY CONNECTOR GEOMETRY
// ============================================
// The elbow that used to live here (a fork of the Timeline's, which had the
// same defect) knew only its two endpoints: it dropped its vertical leg at the
// midpoint of the two stubs, an x chosen with no idea whether a bar was
// sitting there, and ran both horizontal legs along the row centrelines, which
// is exactly where every bar in those rows is. `@/lib/dependency-route` is
// given the bars instead and routes around them; it is shared with the
// Timeline so the two views stop drifting apart a third time.

// ============================================
// DUE-DATE RANGE TEXT ("Jul 15 – 20", "Jul 7 – Today", "Jul 21", "—")
// ============================================

/** Whole calendar days from `today` to a due date (negative = overdue).
 *  Takes today as an argument instead of calling date-only's
 *  `daysFromToday()`: that reads the clock, and on the server the local day
 *  IS the UTC day — from 20:00 Miami every due colour was computed against
 *  tomorrow, and React does not repair a style mismatch on hydration. */
export function daysFrom(today: Date, value: string | Date): number {
  return differenceInCalendarDays(dueDateToLocalMidnight(value), today);
}

/** `today` is null until mounted; with no today there is no "Today" to say,
 *  so the range falls back to the plain date rather than guessing. */
export function dueRangeText(
  task: { startDate?: string | null; dueDate: string | null },
  today: Date | null
): string {
  // A start-only task ("the survey starts the 14th, we do not know yet
  // when it closes") has a date; printing an em dash for it said "no date"
  // about the one field it does carry.
  if (!task.dueDate) {
    return task.startDate
      ? `Starts ${format(dueDateToLocalMidnight(task.startDate), "MMM d")}`
      : "—";
  }
  const due = dueDateToLocalMidnight(task.dueDate);
  const dueIsToday = today !== null && isSameDay(due, today);
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
  allSections,
  sectionsAreEditable = true,
  projectEndDate,
  projectName,
  initialPrefs,
  onTaskClick,
  projectId,
  members = [],
}: GanttViewProps) {
  const router = useRouter();

  // Local midnight, null until mounted. Every today-derived mark on this
  // chart — the blue line, the header dot, the bold day column, the due
  // colours — hangs off this so none of them can be painted from the
  // server's UTC clock, which after 20:00 Miami is already tomorrow.
  const today = useToday();

  // ---------- State ----------
  // Every one of these four starts at the SERVER-RESOLVED preferences for
  // this project — the same value on the server render and on the first
  // client render, because it is a prop, so there is no hydration mismatch to
  // repair and no frame of defaults to watch settle. Reading useUiState's
  // localStorage cache during render would be the mismatch (see the comment
  // on its initializer, use-ui-state.ts:181); a prop is not.
  const seededPrefs = useMemo<GanttProjectPrefs>(
    () => initialPrefs ?? { ...DEFAULT_GANTT_PREFS, collapsedSectionIds: [] },
    [initialPrefs]
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(seededPrefs.collapsedSectionIds)
  );
  // The day the window is anchored on once the user has paged away from the
  // live today. NOT seeded with `new Date()`: a state initializer runs during
  // RENDER, and the server renders in UTC — on a Sunday evening in Miami the
  // server's clock already says Monday, so it anchored the whole grid a week
  // ahead (a quarter ahead at Month zoom, on the last evening of a quarter),
  // and React does not repair the column labels or the bars' inline
  // left/width when it hydrates. `null` means "wherever today is", which the
  // browser supplies through `today`.
  const [pinnedDate, setPinnedDate] = useState<Date | null>(null);
  const currentDate = pinnedDate ?? today;
  // Days, not Months. This followed Asana's Gantt, which is not drawing a
  // 40-year recertification: Months runs at ~12px/day (366px per month), so
  // the three-day inspection, the two-day report and the one-day filing are
  // 37px, 24px and 12px of bar — a wall of stubs where the whole point is
  // reading which one comes first. The Timeline, the same chart in another
  // file, has always opened at day. A remembered zoom overrides this.
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(seededPrefs.zoom);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [showDependencies, setShowDependencies] = useState(
    seededPrefs.showDependencies
  );
  // Off by default — Asana draws no due-soon rings; still toggleable.
  const [highlightDueSoon, setHighlightDueSoon] = useState(
    seededPrefs.highlightDueSoon
  );

  // ---------- Remembered view state (per user, per project) ----------
  // The hook's default is this project's server-resolved entry, so the map
  // is never empty while the DB fetch is in flight — which is the window in
  // which a write used to save the defaults over the stored folds.
  const ganttPrefsSeed = useMemo<GanttPrefsMap>(
    () => (initialPrefs ? { [projectId]: initialPrefs } : EMPTY_GANTT_PREFS_MAP),
    [initialPrefs, projectId]
  );
  const {
    value: ganttPrefsMap,
    setValue: setGanttPrefsMap,
    isHydrated: ganttPrefsHydrated,
  } = useUiState<GanttPrefsMap>(GANTT_PREFS_KEY, ganttPrefsSeed);

  // Set the moment the user touches any of the four. After that the load
  // below stops applying: the server value arrives asynchronously (cache
  // first, DB a beat later), and a user who dialled the zoom in that window
  // must not have it yanked back by a payload that predates the click.
  const prefsTouchedRef = useRef(false);
  const prefsProjectRef = useRef(projectId);

  // Apply the remembered settings once they arrive. Re-runs on every change to
  // the map — not just the first — because on a machine with no localStorage
  // cache `isHydrated` flips true against an EMPTY map and the real one lands
  // only when the DB fetch resolves; a run-once guard would have made the
  // preference work on every device except a new one.
  useEffect(() => {
    // A different project is a different question: whatever the user dialled
    // for the last one must not keep this one's own settings from loading.
    if (prefsProjectRef.current !== projectId) {
      prefsProjectRef.current = projectId;
      prefsTouchedRef.current = false;
    }
    if (!ganttPrefsHydrated || prefsTouchedRef.current) return;
    const p = ganttPrefsFor(ganttPrefsMap, projectId);
    setZoomLevel(p.zoom);
    setShowDependencies(p.showDependencies);
    setHighlightDueSoon(p.highlightDueSoon);
    // A fresh Set every run would re-render the whole chart each time the map
    // object changes identity, so only swap it when the ids actually differ.
    setCollapsedSections((prev) => {
      if (
        prev.size === p.collapsedSectionIds.length &&
        p.collapsedSectionIds.every((id) => prev.has(id))
      ) {
        return prev;
      }
      return new Set(p.collapsedSectionIds);
    });
  }, [ganttPrefsHydrated, ganttPrefsMap, projectId]);

  // Persist one changed setting. `patch` carries what just changed; the rest
  // is read off this render's state — which is the server-seeded value from
  // the first frame — because the server's uiState merge REPLACES the object
  // stored for a project rather than merging into it, so a partial write
  // would silently blank the other three.
  const persistGanttPrefs = useCallback(
    (patch: Partial<GanttProjectPrefs>) => {
      prefsTouchedRef.current = true;
      const base: GanttProjectPrefs = {
        zoom: zoomLevel,
        collapsedSectionIds: [...collapsedSections],
        showDependencies,
        highlightDueSoon,
      };
      const next = { ...base, ...patch };
      // Return BEFORE calling setValue, not by returning `cur` from inside
      // it: the hook writes its cache and schedules the PATCH around the
      // updater, so a no-op toggle still hit the network from in there.
      if (sameGanttPrefs(ganttPrefsFor(ganttPrefsMap, projectId), next)) return;
      setGanttPrefsMap((cur) => nextGanttPrefsMap(cur, projectId, next));
    },
    [
      zoomLevel,
      collapsedSections,
      showDependencies,
      highlightDueSoon,
      ganttPrefsMap,
      setGanttPrefsMap,
      projectId,
    ]
  );

  const applyZoom = useCallback(
    (level: ZoomLevel) => {
      setZoomLevel(level);
      persistGanttPrefs({ zoom: level });
    },
    [persistGanttPrefs]
  );

  // ---------- The deadline ----------
  // Project.endDate — on a recertification, the date on the county letter the
  // whole engagement exists to hit. It has been on the wire since this chart
  // was built and the only vertical line here was today's. Read as a DATE-ONLY
  // UTC-midnight value like every other date on this screen; derived from a
  // prop, so the server and the browser compute the same day and hydration has
  // nothing to repair.
  const deadlineDate = useMemo(
    () => (projectEndDate ? dueDateToLocalMidnight(projectEndDate) : null),
    [projectEndDate]
  );
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
    // Nullable: a start-only task is a real bar now, and its right handle
    // is how the engineer finally commits an end date.
    originalDue: string | null;
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

  // Section → palette index for per-section bar colors: the columns on
  // screen, in their own order.
  //
  // The old comment said "the FULL sections prop (not filteredSections)" and
  // `sections` IS filteredSections — but the claim it was defending holds
  // anyway, so this stayed as it was: project-content's memo only ever MAPS
  // the sections and filters their TASKS (project-content.tsx:619-707), so no
  // filter, search or hide-completed can drop a section and renumber the ones
  // after it. Numbering off `allSections` instead was tried and reverted: it
  // moved the group-by buckets to palette slots after the real sections,
  // while timeline-view.tsx numbers the same buckets 0..k — one lane, two
  // hues, on two charts one tab apart.
  const sectionColorIdx = useMemo(() => {
    const m = new Map<string, number>();
    sections.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [sections]);

  // ---------- Rows ----------
  // Filtering and sorting belong to the project toolbar rendered directly
  // above this chart, which already hands down filtered, sorted sections.
  // This view used to re-apply its OWN filter and sort on top: two "Filter"
  // buttons one row apart showing different states, and a "Manual (project
  // order)" option that could never restore an order the shared sort had
  // already rewritten.
  const filteredSections = effectiveSections;

  // ---------- Name lookup ----------
  // The union of allSections and the `sections` prop. The comment here used
  // to say this read "the FULL sections prop"; `sections` is the FILTERED
  // one — search, Incomplete/Completed, Due this week, Assigned to me and
  // hide-completed all delete rows from it, and a group-by replaces the
  // sections themselves with `group:*` buckets. Both halves are load-bearing:
  // allSections carries the real sections a filter emptied, and `sections`
  // carries the tasks when the columns are group buckets.
  const taskNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of allSections ?? [])
      for (const t of s.tasks) m.set(t.id, t.name);
    for (const s of sections) for (const t of s.tasks) m.set(t.id, t.name);
    return m;
  }, [allSections, sections]);

  // The ids the chart is actually drawing. A nameable blocker outside this
  // set is hidden, not gone, and the cell says so instead of rendering the
  // same "—" a task with no blocker at all gets.
  const visibleTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sections) for (const t of s.tasks) ids.add(t.id);
    return ids;
  }, [sections]);

  // Every blocker of every task, classified visible / hidden / unnameable.
  // Carries the whole DependencyRow: the menu needs the dep id to remove a
  // link and the type to retype one, including for a blocker it cannot name.
  const blockedByDetail = useMemo(
    () => resolveBlockedBy(dependencies, taskNameById, visibleTaskIds),
    [dependencies, taskNameById, visibleTaskIds]
  );

  // Candidates for "Add blocker" — the UNFILTERED set, deduped by id (a
  // task appears in both arrays under a group-by). Built from the filtered
  // list, the menu could not offer the predecessor the filter had just
  // removed: with "Incomplete tasks" ticked, no completed task could be
  // named as a blocker at all, which is most of what a recert depends on.
  const allTasksFlat = useMemo(() => {
    const seen = new Set<string>();
    const out: Task[] = [];
    for (const s of [...(allSections ?? []), ...effectiveSections]) {
      for (const t of s.tasks) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
      }
    }
    return out;
  }, [allSections, effectiveSections]);

  // Search box inside the "Blocked by" menu. The list used to be the first
  // 15 tasks in board order, so on any real project the task you wanted to
  // depend on simply wasn't in the menu. Only one menu is open at a time,
  // so a single query serves every row; it resets whenever a menu opens.
  const [blockerQuery, setBlockerQuery] = useState("");
  // The type the NEXT link created from this menu is born with. Every link
  // used to be posted as {blockingTaskId} alone and the route defaulted it
  // to FINISH_TO_START, so the only way to get a start-to-start pair — two
  // inspections that must begin together — was to click its drawn arrow
  // afterwards, and depPaths draws no arrow when either endpoint has no
  // dates or sits in a collapsed or filtered section. Reset to FS whenever a
  // menu opens: a link type is a fact about one link, and carrying SS
  // silently into the next task's menu is the kind of invisible state this
  // pass exists to remove.
  const [newBlockerType, setNewBlockerType] =
    useState<DependencyType>("FINISH_TO_START");

  // ---------- Inline edit helpers (Asana's Gantt table is editable) ----------
  const [renaming, setRenaming] = useState<{
    taskId: string;
    value: string;
  } | null>(null);

  // Apply server cascade results to the optimistic layer so rescheduled
  // bars glide to their new dates IMMEDIATELY instead of waiting for
  // router.refresh() to land.
  const applyShiftOverrides = useCallback(
    (
      shifts:
        | readonly (CascadeShiftDates & { taskId: string })[]
        | undefined
    ) => {
      if (!Array.isArray(shifts) || shifts.length === 0) return;
      // An open task panel keeps its own copy of the task and refetches only
      // on this event. Every caller here has just been told by the server
      // that these tasks' dates moved, so the panel is stale the instant the
      // bars glide — and the panel is where someone goes to find out why.
      for (const s of shifts) notifyTaskMutated(s.taskId);
      setOptimisticDates((prev) => {
        const next = { ...prev };
        for (const s of shifts) {
          next[s.taskId] = {
            startDate: dateOnly(s.newStart),
            dueDate: dateOnly(s.newEnd),
          };
        }
        return next;
      });
    },
    []
  );

  const patchTask = useCallback(
    async (taskId: string, body: Record<string, unknown>) => {
      // Counted like every other in-flight write: the stale-override reaper
      // below drops optimistic dates that the props have not confirmed once
      // nothing is pending, and the cascade overrides applied here are
      // exactly that kind of unconfirmed date.
      patchesInFlightRef.current += 1;
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
        // The response body was read and thrown away. Editing a date in this
        // table runs the SAME server cascade a drag does, and the same one the
        // task panel's picker runs — where it is named. Here it happened in
        // silence: dependent bars only moved on the next refresh, with nothing
        // saying they had moved or which ones.
        const updated = await res.json().catch(() => null);
        const shifts: {
          taskId: string;
          taskName: string;
          newStart: string | null;
          newEnd: string | null;
        }[] = Array.isArray(updated?.cascadeShifts)
          ? updated.cascadeShifts
          : [];
        // applyShiftOverrides notifies for every task the cascade moved; this
        // one is for the task the user actually edited.
        applyShiftOverrides(shifts);
        notifyTaskMutated(taskId);
        const cascadeTitle = cascadeToastTitle(shifts);
        if (cascadeTitle) {
          const names = cascadeToastNames(shifts);
          toast.success(
            cascadeTitle,
            names ? { description: names } : undefined
          );
        }
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update task"
        );
      } finally {
        patchesInFlightRef.current -= 1;
      }
    },
    [router, applyShiftOverrides]
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

  const addBlocker = useCallback(
    async (
      taskId: string,
      blockingTaskId: string,
      // The route already accepts all four types and defaults to
      // FINISH_TO_START; this view was the half that never sent one.
      type: DependencyType = "FINISH_TO_START"
    ) => {
      patchesInFlightRef.current += 1;
      try {
        const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockingTaskId, type }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to add dependency");
        }
        // The server auto-shifts the dependent when the new link is already
        // violated — move the bars optimistically, then refresh.
        const data = await res.json().catch(() => null);
        const shifts: CascadeShiftSummary[] = Array.isArray(data?.cascadeShifts)
          ? data.cascadeShifts
          : [];
        applyShiftOverrides(shifts);
        if (shifts.length > 0) router.refresh();
        await reloadDependencies();
        // Say what was saved in the words the picker used — the code alone
        // ("Dependency added · SF") is a confirmation only for the reader who
        // already knew what SF meant. The cascade line underneath is the same
        // sentence a drag and the table's date picker produce, from the same
        // two helpers: one server event, one wording.
        const cascade = cascadeToastTitle(shifts);
        const names = cascadeToastNames(shifts);
        toast.success(`Blocker added — this task ${dependencyMeaning(type)}`, {
          description: cascade
            ? names
              ? `${cascade} — ${names}`
              : cascade
            : undefined,
        });
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
        toast.success("Blocker removed");
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
        const shifts: CascadeShiftSummary[] = Array.isArray(data?.cascadeShifts)
          ? data.cascadeShifts
          : [];
        // Dates may have moved — glide the bars optimistically, then let
        // the refresh confirm; the arrows re-anchor from the same dates.
        applyShiftOverrides(shifts);
        if (shifts.length > 0) router.refresh();
        await reloadDependencies();
        const cascade = cascadeToastTitle(shifts);
        const names = cascadeToastNames(shifts);
        toast.success(`Blocker updated — this task ${dependencyMeaning(type)}`, {
          description: cascade
            ? names
              ? `${cascade} — ${names}`
              : cascade
            : undefined,
        });
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
    // Snap a day to the unit the current zoom draws in — the same rule for
    // the anchor and for the earliest task, so the grid always starts on a
    // column boundary.
    const snapToUnit = (d: Date) =>
      zoomLevel === "day" || zoomLevel === "week"
        ? startOfWeek(d, { weekStartsOn: 1 })
        : startOfQuarter(d);

    // Null until the browser says which day it is; see `currentDate`.
    const anchorStart = currentDate ? snapToUnit(currentDate) : null;

    // Extend the window to cover EVERY dated task (MS Project / Asana
    // behavior — same fix as the Timeline): the default range is a
    // minimum, not a ceiling, so a plan longer than the window (e.g. the
    // recert template's ~4 months at Days zoom) is never cut off. Grows
    // left to the earliest task and right past the latest one; capped so
    // a stray far-future date can't render a huge DOM.
    let minTask: Date | null = null;
    let maxTask: Date | null = null;
    for (const s of sections) {
      for (const t of s.tasks) {
        // taskSpan, not `t.dueDate` — a start-only task must widen the grid
        // it is about to be drawn on, or it falls outside the window.
        const span = taskSpan(t);
        if (!span) continue;
        if (!minTask || span.start < minTask) minTask = span.start;
        if (!maxTask || span.end > maxTask) maxTask = span.end;
      }
    }
    // With no today yet, anchor on the earliest dated task instead: the
    // server and the browser derive that from the SAME sections, so the grid
    // they paint is the same one and hydration has nothing to repair. In the
    // usual case — a plan with work already behind it — this IS the start
    // date either way, because the window always grows left to minTask.
    let startDate = anchorStart ?? (minTask ? snapToUnit(minTask) : null);
    // No anchor and no dated task: draw no grid for this frame rather than
    // one built on the server's day. The next frame has today.
    if (!startDate) return [];
    if (minTask && minTask < startDate) startDate = snapToUnit(minTask);
    // The deadline widens the window like a dated task — but ONLY while the
    // result still fits under the column cap. Without this test a county date
    // years from the work moved the window to itself and the clamp below cut
    // it off before the first bar, leaving a grid with no tasks, no section
    // brackets and no today line on it. When it does not fit, nothing is
    // widened and the marker stays off: `deadlinePosition` already returns
    // null outside the window, and a chart that still draws the work is worth
    // more than one vertical line.
    if (deadlineDate) {
      const candStart =
        deadlineDate < startDate ? snapToUnit(deadlineDate) : startDate;
      const candEnd =
        maxTask && maxTask > deadlineDate ? maxTask : deadlineDate;
      if (gridColumnsNeeded(zoomLevel, candStart, candEnd) <= MAX_GRID_COLUMNS) {
        startDate = candStart;
        maxTask = candEnd;
      }
    }
    let count = config.range;
    if (maxTask && maxTask > startDate) {
      count = Math.max(
        count,
        Math.min(gridColumnsNeeded(zoomLevel, startDate, maxTask), MAX_GRID_COLUMNS)
      );
    }

    const cols = config.getColumns(startDate, count);

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
        isToday:
          zoomLevel === "day" && today !== null && isSameDay(date, today),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, zoomLevel, sections, today, deadlineDate]);

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

  // Keep the anchor (currentDate's week/quarter) at the left edge on
  // mount, zoom change and arrow paging. The grid can now start well
  // BEFORE the anchor when past-dated tasks extend the window backwards —
  // without this, the view would open on that history instead of on
  // today. Keyed so ordinary task edits (which rebuild bounds) never yank
  // the user's scroll position. Mirrors the Timeline's effect.
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollKeyRef = useRef("");
  // "Today" pressed while already parked on today produced the SAME key —
  // same zoom, same start-of-day — so the effect early-returned and the
  // button did nothing once the user had scrolled away. The nonce makes
  // every press its own key; it is deliberately not derived from the date.
  const [recenterNonce, setRecenterNonce] = useState(0);
  useEffect(() => {
    if (!bounds || !currentDate) return;
    const key = `${zoomLevel}|${startOfDay(currentDate).getTime()}|${recenterNonce}`;
    if (lastScrollKeyRef.current === key) return;
    lastScrollKeyRef.current = key;
    const el = chartScrollRef.current;
    if (!el) return;
    const anchorStart =
      zoomLevel === "day" || zoomLevel === "week"
        ? startOfWeek(currentDate, { weekStartsOn: 1 })
        : startOfQuarter(currentDate);
    const px =
      (differenceInDays(anchorStart, bounds.timelineStart) /
        bounds.totalDays) *
      bounds.totalWidth;
    el.scrollLeft = Math.max(0, px);
  }, [zoomLevel, currentDate, bounds, recenterNonce]);

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
      const span = taskSpan(task);
      if (!span || !bounds) return null;

      // The span reads both dates by their UTC calendar day so bars don't
      // render a day early for viewers west of UTC, sits a due-only task on
      // its due date, and gives a START-ONLY task a one-day span on its
      // start — the bar itself then fades its right edge.
      const taskStart = span.start;
      const taskEnd = span.end;

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
  // so the arrow SVG lands exactly on each ROW_HEIGHT bar row. ----------
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
      // right edge (markerLeft = left + width − 12, so center = left +
      // width) — anchor arrows to the glyph, not the invisible bar rect.
      // NOTE: the marker render uses pos.width for due-only tasks too (a
      // full day cell), NOT the DUE_ONLY_W pill clamp — assuming the pill
      // width here left a ~28px gap between arrowheads and the glyph at
      // Days zoom (40px/day), invisible at Months only because dayWidth
      // there happens to be ≈ DUE_ONLY_W.
      if (task.taskType === "MILESTONE" || task.taskType === "APPROVAL") {
        const centerX = pos.left + pos.width;
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

  // ---------- Obstacles the dependency arrows must route around ----------
  // Every drawn bar, glyph and due-only pill, in the chart's own coordinate
  // space. Built from getTaskScreenPos rather than from getTaskPosition so the
  // rect sits exactly where the ANCHOR does: that one function already knows a
  // milestone is a 24px diamond centred on its due day and a start-less task a
  // 12px pill, and a second copy of those rules is how this view and the
  // Timeline drifted apart in the first place.
  //
  // Unlike the Timeline, the Gantt gives every task its own ROW_HEIGHT row
  // (taskRowMap counts section headers and ghost rows, so no two bars share a
  // y), so this list is one rect per visible task and never two in a row.
  // Collapsed sections are absent from taskRowMap, so their tasks return null
  // and are not obstacles — they are not drawn either.
  //
  // Nothing here is the label text: Asana renders this chart bare, names live
  // only in the left table, so a bar's right edge is the whole obstacle.
  const barObstacles = useMemo(() => {
    if (!showDependencies) return [] as ObstacleRect[];
    const rects: ObstacleRect[] = [];
    for (const section of filteredSections) {
      for (const task of section.tasks) {
        const pos = getTaskScreenPos(task.id);
        if (!pos) continue;
        rects.push(barObstacle(pos.xLeft, pos.xRight, pos.yCenter, BAR_HEIGHT));
      }
    }
    return rects;
  }, [showDependencies, filteredSections, getTaskScreenPos]);

  // ---------- Routed paths, one per dependency ----------
  // Computed once per LAYOUT, not once per render. Routing costs
  // O(links × bars) now that the router is handed every bar on the chart, and
  // this component re-renders on hover, on selection and on every frame of a
  // bar drag — which would have re-run the whole chart's geometry at pointer
  // rate on a big project. Nothing in here reads dragState or hoveredTask:
  // getTaskScreenPos returns the COMMITTED span, exactly as it did before, so
  // an arrow still does not follow a bar mid-drag. Only the active stroke
  // stays in the render.
  const depPaths = useMemo(() => {
    if (!showDependencies) return [] as { dep: DependencyRow; path: string }[];
    return dependencies.flatMap((dep) => {
      const blocking = getTaskScreenPos(dep.blockingTaskId);
      const dependent = getTaskScreenPos(dep.dependentTaskId);
      if (!blocking || !dependent) return [];

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

      // Routed around the bars, not through them: the old elbow dropped its
      // vertical leg at the midpoint of the two stubs whatever was sitting
      // there, and ran its horizontal legs down the row centrelines, which is
      // where the bars are. Long runs now ride the (ROW_HEIGHT − BAR_HEIGHT)
      // band straddling a row boundary — bar-free by construction — and only
      // the two short stubs at the ends ever touch a centreline.
      const path = routeDependency({
        from: { x: sx, y: sy, dir: sxOutDir },
        to: { x: ex, y: ey, dir: exInDir },
        obstacles: barObstacles,
        laneHeight: ROW_HEIGHT,
        barHeight: BAR_HEIGHT,
      });
      return [{ dep, path }];
    });
  }, [showDependencies, dependencies, getTaskScreenPos, barObstacles]);

  // ---------- Today line ----------
  const todayPosition = useMemo(() => {
    // No today yet (first frame) → no line and no header dot, rather than a
    // line drawn on the server's day.
    if (!bounds || !today) return null;
    if (today < bounds.timelineStart || today > bounds.timelineEnd) return null;
    const daysFromStart = differenceInDays(today, bounds.timelineStart);
    return (daysFromStart / bounds.totalDays) * bounds.totalWidth;
  }, [bounds, today]);

  // ---------- Deadline line ----------
  // The same offset maths as todayPosition, including the out-of-range case:
  // a deadline the window does not cover gets no line rather than one pinned
  // to an edge it does not fall on. The window is grown to cover it above
  // WHEN IT FITS, so this is null exactly when covering it would have cost
  // more than MAX_GRID_COLUMNS — a county date years from the work. No line
  // is the right answer there; the alternative was a grid that stopped
  // before the first bar.
  const deadlinePosition = useMemo(() => {
    if (!bounds || !deadlineDate) return null;
    if (
      deadlineDate < bounds.timelineStart ||
      deadlineDate > bounds.timelineEnd
    ) {
      return null;
    }
    const daysFromStart = differenceInDays(deadlineDate, bounds.timelineStart);
    return (daysFromStart / bounds.totalDays) * bounds.totalWidth;
  }, [bounds, deadlineDate]);

  // Null on the first frame with today still unknown — the label then states
  // the date and claims nothing about whether it has passed.
  const deadlineLabel = deadlineDate
    ? deadlineMarkerLabel(deadlineDate, today)
    : null;
  const deadlineTitle = deadlineDate
    ? deadlineMarkerTitle(deadlineDate, today, projectName)
    : null;
  // Flip the chip to the left of the line when the line is near the right
  // edge, so the label is not pushed off the end of the grid.
  const deadlineLabelOnLeft =
    deadlinePosition !== null &&
    bounds !== null &&
    deadlinePosition > bounds.totalWidth - 160;

  // ---------- Drag move / resize (UTC-midnight-safe save) ----------
  const pixelsToDays = useCallback(
    (px: number) => {
      if (!bounds) return 0;
      return (px / bounds.totalWidth) * bounds.totalDays;
    },
    [bounds]
  );

  // Pointer events, not mouse events: the bars advertise grab and resize
  // affordances but a touch never produced a single mousemove, so dragging
  // and resizing were silently dead on a tablet. Capturing the pointer also
  // keeps the drag alive when the finger or cursor leaves the bar.
  const handleDragStart = useCallback(
    (
      e: React.PointerEvent,
      taskId: string,
      handle: "left" | "right" | "move",
      task: Task
    ) => {
      // Primary button only — pointerdown also fires for right-click.
      if (e.button !== 0) return;
      // preventDefault suppresses the browser's own text selection and
      // native image drag on a mouse press; a touch is already held by
      // `touch-none`, and cancelling there risks the tap that opens the task.
      if (e.pointerType !== "touch") e.preventDefault();
      e.stopPropagation();
      // A task with a start and no due date is drawn on this chart now, so
      // it may be dragged; one with neither date is not drawn at all.
      if (!task.dueDate && !task.startDate) return;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
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

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragState.startX;
      let snappedDays = Math.round(pixelsToDays(dx));
      // Clamp handle overshoot in the PREVIEW too, mirroring the commit
      // clamps — otherwise the ghost slides past the opposite edge and
      // visibly jumps back on release.
      if (dragState.handle !== "move") {
        const span = taskSpan({
          startDate: dragState.originalStart,
          dueDate: dragState.originalDue,
        });
        if (span) {
          const durationDays = Math.round(
            (span.end.getTime() - span.start.getTime()) / 86400000
          );
          if (dragState.handle === "left") {
            // A start-only bar has no due day to bump into, so its left
            // handle is free in both directions. Clamping it to the zero
            // duration of its one-day span froze the PREVIEW at the grab
            // point while `dragCommitBody` — which has no such clamp when
            // there is no due date — still wrote the dragged day on release:
            // the bar did not move, then jumped on mouse-up. Same exemption
            // the Timeline makes; both charts commit through the same lib.
            if (!span.open) snappedDays = Math.min(snappedDays, durationDays);
          } else {
            snappedDays = Math.max(snappedDays, -durationDays);
          }
        }
      }
      const snappedPx = snappedDays * bounds.dayWidth;
      setDragState((prev) => (prev ? { ...prev, deltaX: snappedPx } : prev));
    };

    const handlePointerUp = async (e: PointerEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(pixelsToDays(deltaX));
      if (deltaDays === 0) {
        setDragState(null);
        return;
      }
      didDragRef.current = true;

      // The Timeline's rules, not a second copy of them: the originals are
      // read by their UTC calendar day (round-tripping through parseISO +
      // local format shifted every saved date one day earlier west of UTC),
      // the handles clamp instead of inverting the range, a body move never
      // invents a due date, and the right handle is what commits one on a
      // start-only task.
      const body = dragCommitBody(
        dragState.originalStart,
        dragState.originalDue,
        dragState.handle,
        deltaDays
      );

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
        if (!res.ok) {
          // The API rejects an inverted range with a precise reason
          // ("startDate must be on or before dueDate"), and answers a
          // permission failure with another; both were thrown away here and
          // replaced with "Failed to update dates", so the engineer re-tried
          // the same drag with no idea which edge was wrong — or that the
          // problem was not the drag at all. Same read the Timeline does.
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "");
        }
        // Glide dependents along too (server-side cascade result).
        const updated = await res.json().catch(() => null);
        const shifts: {
          taskId: string;
          taskName: string;
          newStart: string | null;
          newEnd: string | null;
        }[] = updated?.cascadeShifts ?? [];
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
        // Tell the rest of the app the dates moved. An open task detail panel
        // keeps its own copy of the task and refetches only on this event, so
        // without it the panel showed pre-drag dates until it was closed and
        // reopened — and the cascaded tasks showed pre-drag dates too, which
        // is worse: nobody dragged those.
        notifyTaskMutated(taskId);
        for (const s of shifts) notifyTaskMutated(s.taskId);
        // SAY IT. The cascade moved other people's work and this chart used
        // to move those bars in silence; the server has been sending the name
        // of every task it rescheduled all along.
        const cascadeTitle = cascadeToastTitle(shifts);
        if (cascadeTitle) {
          const names = cascadeToastNames(shifts);
          toast.success(
            cascadeTitle,
            names ? { description: names } : undefined
          );
        }
        router.refresh();
      } catch (error) {
        // Roll back only the failed bar.
        setOptimisticDates((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        const reason = error instanceof Error ? error.message : "";
        toast.error(reason || "Failed to update dates");
      } finally {
        patchesInFlightRef.current -= 1;
      }
    };

    // A cancelled pointer (the browser taking over the gesture, a call
    // interrupting the touch) must drop the drag instead of leaving the
    // ghost bar pinned to the last position.
    const handlePointerCancel = () => setDragState(null);

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    // Hold the drag cursor for the whole page: without it the cursor flips
    // back to the default the moment the pointer leaves the bar.
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor =
      dragState.handle === "move" ? "grabbing" : "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
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
      if (!res.ok) {
        // The server says WHY — an approval whose approver you are not, a
        // task in a project you can only read. "Failed to update task" sent
        // the engineer to look for a network problem that was not there.
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "");
      }
      notifyTaskMutated(task.id);
      router.refresh();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      toast.error(reason || "Failed to update task");
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
      if (!res.ok) {
        // Same swallow as the other two: the route answers with a real
        // sentence and the draft name is still in the input, so the person
        // needs to know whether to rename it or to stop trying.
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "");
      }
      setAddingSection(false);
      setNewSectionName("");
      router.refresh();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      toast.error(reason || "Failed to add section");
    }
  };

  // ---------- Navigation & zoom ----------
  const navigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      // Un-pin rather than pin the clock: the window goes back to following
      // `today`, so a chart left open overnight follows it over midnight too.
      setPinnedDate(null);
      setRecenterNonce((n) => n + 1);
      return;
    }
    const amount = direction === "prev" ? -1 : 1;
    // Page from wherever the window sits. Reading the clock here is safe —
    // an event handler only ever runs in the browser.
    const from = (d: Date | null) => d ?? today ?? new Date();
    if (zoomLevel === "day")
      setPinnedDate((d) => addWeeks(from(d), amount * 2));
    else if (zoomLevel === "week")
      setPinnedDate((d) => addMonths(from(d), amount));
    else if (zoomLevel === "month")
      setPinnedDate((d) => addMonths(from(d), amount * 3));
    else setPinnedDate((d) => addMonths(from(d), amount * 6));
  };

  // Every zoom entry point goes through applyZoom so the choice is
  // remembered, whichever control made it — the stepper and the dropdown
  // both used to write state this component threw away on the next tab
  // switch.
  const zoomIndex = ZOOM_ORDER.indexOf(zoomLevel);
  const zoomIn = () => {
    if (zoomIndex > 0) applyZoom(ZOOM_ORDER[zoomIndex - 1]);
  };
  const zoomOut = () => {
    if (zoomIndex < ZOOM_ORDER.length - 1)
      applyZoom(ZOOM_ORDER[zoomIndex + 1]);
  };

  const toggleSection = (sectionId: string) => {
    // Computed rather than a functional setState because the same value has
    // to be persisted, and reading it back out of the updater would mean
    // writing to the preference store from inside a render-phase function.
    const next = new Set(collapsedSections);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    setCollapsedSections(next);
    persistGanttPrefs({ collapsedSectionIds: [...next] });
  };

  // ---------- Helpers ----------
  const isTaskDueSoon = (task: Task) => {
    if (!task.dueDate || task.completed || !today) return false;
    // Whole calendar days, not a wall-clock difference (differenceInDays
    // truncates and flagged 8-days-out as due soon).
    const days = daysFrom(today, task.dueDate);
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
                {/* Same withholding as the "Add section" row at the bottom
                    of the table: under a group-by the new section could not
                    appear until the grouping is cleared. */}
                {sectionsAreEditable && (
                  <DropdownMenuItem onClick={() => setAddingSection(true)}>
                    Section
                  </DropdownMenuItem>
                )}
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
                    onClick={() => applyZoom(level)}
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
                onCheckedChange={(v) => {
                  setShowDependencies(v === true);
                  persistGanttPrefs({ showDependencies: v === true });
                }}
              >
                Show dependencies
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={highlightDueSoon}
                onCheckedChange={(v) => {
                  setHighlightDueSoon(v === true);
                  persistGanttPrefs({ highlightDueSoon: v === true });
                }}
              >
                Highlight due soon
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ============ GRID ============ */}
      <div className="flex-1 overflow-auto" ref={chartScrollRef}>
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
              // Null for a section with no stage and for the synthetic
              // `group:*` buckets, which carry none — the header then renders
              // exactly as it did before this chip existed.
              const stageChip = sectionStageChip(section.stage);
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
                    {/* Whose desk this column is sitting on. Section.stage
                        has been loaded here all along with nothing reading
                        it, and on a recert "are we sitting on this or is the
                        county?" is the question the schedule gets opened for.
                        The stage's own LABEL is deliberately not printed —
                        the header two elements to the left already is it, by
                        the rule that gave the section its stage. Same words
                        as the cockpit's PipelineStrip, from one map. */}
                    {stageChip && (
                      <span
                        className="flex-shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                        title={`Stage: ${stageChip.label} — ${stageChip.desk.toLowerCase()}`}
                      >
                        {stageChip.desk}
                      </span>
                    )}
                  </button>

                  {/* Task rows */}
                  {!isCollapsed && (
                    <>
                      {section.tasks.map((task) => {
                        const blockers = blockedByDetail.get(task.id) ?? [];
                        const blockedParts = blockedCellParts(blockers);
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
                                        !task.dueDate || task.completed || !today
                                          ? undefined
                                          : daysFrom(today, task.dueDate) < 0
                                            ? DATE_OVERDUE
                                            : daysFrom(today, task.dueDate) === 0
                                              ? DATE_TODAY
                                              : undefined,
                                    }}
                                  >
                                    {dueRangeText(task, today)}
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
                              <DropdownMenu
                                onOpenChange={(open) => {
                                  if (open) {
                                    setBlockerQuery("");
                                    setNewBlockerType("FINISH_TO_START");
                                  }
                                }}
                              >
                                <DropdownMenuTrigger asChild>
                                  <button className="w-full px-2 py-1 text-xs text-slate-500 text-left truncate hover:bg-slate-100 rounded cursor-pointer">
                                    {/* Three states, three renderings. A
                                        blocker the filter hid keeps its NAME
                                        and goes muted; one with no name says
                                        that something is blocking without
                                        naming it. Only a task with no
                                        blockers at all gets the em dash —
                                        it used to be what all three showed. */}
                                    <span
                                      className="truncate block"
                                      title={blockedCellTitle(blockers)}
                                    >
                                      {blockedParts.length === 0 ? (
                                        <span className="text-slate-300">
                                          —
                                        </span>
                                      ) : (
                                        blockedParts.map((part, i) => (
                                          <span key={part.key}>
                                            {i > 0 && ", "}
                                            <span
                                              className={cn(
                                                part.visibility !== "visible" &&
                                                  "text-slate-400 italic"
                                              )}
                                            >
                                              {part.label}
                                            </span>
                                          </span>
                                        ))
                                      )}
                                    </span>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="start"
                                  className="w-64 max-h-72 overflow-y-auto"
                                >
                                  {/* One submenu per existing blocker. The
                                      row used to BE the remove button, so the
                                      only thing you could do to a blocker
                                      from here was delete it by clicking its
                                      name; the type was invisible and the
                                      only place to change it was the drawn
                                      arrow, which depPaths omits whenever an
                                      endpoint has no dates or sits in a
                                      collapsed or filtered section. A Radix
                                      Sub is the one construct that survives
                                      inside this content — it keeps the
                                      roving focus and the typeahead the
                                      search input below already fights. */}
                                  {blockers.map((b) => (
                                    <DropdownMenuSub key={b.dep.id}>
                                      <DropdownMenuSubTrigger className="gap-2">
                                        <span
                                          className={cn(
                                            "truncate flex-1",
                                            b.visibility !== "visible" &&
                                              "text-slate-400 italic"
                                          )}
                                        >
                                          {b.name ?? UNNAMEABLE_BLOCKER_LABEL}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                          {dependencyCode(b.dep.type)}
                                        </span>
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="w-64">
                                        <div className="px-2 py-1 text-[11px] text-slate-400">
                                          Link type
                                        </div>
                                        {DEPENDENCY_TYPES.map((d) => (
                                          <DropdownMenuItem
                                            key={d.type}
                                            onClick={() =>
                                              changeDependencyType(b.dep, d.type)
                                            }
                                            className="gap-2"
                                          >
                                            <Check
                                              className={cn(
                                                "w-3.5 h-3.5 flex-shrink-0",
                                                d.type === b.dep.type
                                                  ? "text-[#c9a84c]"
                                                  : "opacity-0"
                                              )}
                                            />
                                            <span className="flex-1 truncate">
                                              {d.label}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                              {d.code}
                                            </span>
                                          </DropdownMenuItem>
                                        ))}
                                        {/* The codes mean nothing to half the
                                            office; the sentence is the
                                            server's own rule, not a gloss. */}
                                        <div className="px-2 pt-1 pb-1.5 text-[11px] text-slate-400 leading-snug">
                                          This task{" "}
                                          {dependencyMeaning(b.dep.type)}.
                                        </div>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() =>
                                            removeBlocker(task.id, b.dep.id)
                                          }
                                          className="gap-2 text-red-600 focus:text-red-600"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                          Remove blocker
                                        </DropdownMenuItem>
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  ))}
                                  {blockers.length > 0 && (
                                    <div className="my-1 border-t" />
                                  )}
                                  <div className="sticky top-0 z-10 bg-white">
                                    <div className="px-2 py-1 text-[11px] text-slate-400">
                                      Add blocker
                                    </div>
                                    <div className="px-2 pb-1">
                                      <input
                                        value={blockerQuery}
                                        onChange={(e) =>
                                          setBlockerQuery(e.target.value)
                                        }
                                        // Radix's menu typeahead swallows
                                        // keystrokes that reach the content.
                                        onKeyDown={(e) => e.stopPropagation()}
                                        placeholder="Search tasks…"
                                        className="w-full px-2 py-1 text-xs border rounded outline-none focus:border-slate-400"
                                      />
                                    </div>
                                    {/* Type for the link about to be
                                        created. FS stays selected, so the
                                        ordinary link is still one click on a
                                        task name; the other three are one
                                        click away instead of unreachable
                                        until an arrow happens to be drawn.
                                        Plain buttons, not menu items — a
                                        DropdownMenuItem would close the whole
                                        menu on select, and the picking is not
                                        finished yet. Same reason the search
                                        input stops its keydowns: Radix's
                                        typeahead reads printable keys off the
                                        content and its roving focus claims
                                        the arrows. */}
                                    <div
                                      className="px-2 pb-1.5"
                                      onKeyDown={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-1">
                                        {DEPENDENCY_TYPES.map((d) => (
                                          <button
                                            key={d.type}
                                            type="button"
                                            aria-pressed={
                                              newBlockerType === d.type
                                            }
                                            title={`${d.label} — this task ${dependencyMeaning(d.type)}`}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setNewBlockerType(d.type);
                                            }}
                                            className={cn(
                                              "px-1.5 py-0.5 text-[10px] font-medium rounded border",
                                              newBlockerType === d.type
                                                ? "border-[#c9a84c] bg-[#faf6ea] text-slate-900"
                                                : "border-slate-200 text-slate-400 hover:text-slate-600"
                                            )}
                                          >
                                            {d.code}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="pt-1 text-[11px] text-slate-400 leading-snug">
                                        {dependencyLabel(newBlockerType)} —
                                        this task{" "}
                                        {dependencyMeaning(newBlockerType)}.
                                      </div>
                                    </div>
                                  </div>
                                  {(() => {
                                    const q = blockerQuery.trim().toLowerCase();
                                    const candidates = allTasksFlat.filter(
                                      (t) =>
                                        t.id !== task.id &&
                                        !blockers.some(
                                          (b) => b.dep.blockingTaskId === t.id
                                        ) &&
                                        (!q || t.name.toLowerCase().includes(q))
                                    );
                                    if (candidates.length === 0) {
                                      return (
                                        <div className="px-2 py-2 text-xs text-slate-400">
                                          {q
                                            ? "No tasks match your search."
                                            : "No other tasks to block on."}
                                        </div>
                                      );
                                    }
                                    return (
                                      <>
                                        {candidates.slice(0, 50).map((t) => (
                                          <DropdownMenuItem
                                            key={t.id}
                                            onClick={() =>
                                              addBlocker(
                                                task.id,
                                                t.id,
                                                newBlockerType
                                              )
                                            }
                                            className="gap-2"
                                          >
                                            <Plus className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="truncate">
                                              {t.name}
                                            </span>
                                          </DropdownMenuItem>
                                        ))}
                                        {candidates.length > 50 && (
                                          <div className="px-2 py-1 text-[11px] text-slate-400">
                                            +{candidates.length - 50} more —
                                            refine your search
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}

                      {/* Ghost "Add task…" row.
                          The ROW is always drawn — taskRowMap counts it and
                          the right panel mirrors it, so removing it here
                          would slide the whole left table out of register
                          with its own bars. Only the BUTTON is withheld: it
                          posts `sectionId: section.id`, and under a group-by
                          that id is a synthetic `group:d:week` with no row
                          behind it, so POST /api/tasks answered 404 "Section
                          not found" and the composer toasted a failure every
                          single time. Same rule List and Board got in
                          3198e68. */}
                      {sectionsAreEditable ? (
                        <button
                          className="flex items-center gap-2 px-3 border-b text-slate-400 hover:text-slate-600 hover:bg-slate-50 w-full text-left"
                          style={{ height: ROW_HEIGHT }}
                          onClick={() =>
                            setCreateDialog({
                              open: true,
                              sectionId: section.id,
                            })
                          }
                        >
                          <Plus className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm">Add task…</span>
                        </button>
                      ) : (
                        <div
                          className="border-b"
                          style={{ height: ROW_HEIGHT }}
                        />
                      )}
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
                  onBlur={() => {
                    // Same rule as the board composer: blur neither creates
                    // nor discards. An empty input tidies itself away; a
                    // draft stays open until Enter or Escape decides it.
                    if (!newSectionName.trim()) setAddingSection(false);
                  }}
                  placeholder="Section name"
                  className="flex-1 text-sm border border-[#c9a84c] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#c9a84c]"
                />
              </div>
            ) : sectionsAreEditable ? (
              <button
                className="flex items-center gap-2 px-3 text-slate-500 hover:bg-slate-50 w-full text-left border-b"
                style={{ height: ROW_HEIGHT }}
                onClick={() => setAddingSection(true)}
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add section</span>
              </button>
            ) : (
              // Withheld under a group-by for the reason 3198e68 gives: the
              // POST really would create a section, but the columns on screen
              // are group buckets, so it could not appear until the grouping
              // is cleared. The empty row keeps totalRows honest — it is
              // counted in taskRowMap and mirrored on the right.
              <div className="border-b" style={{ height: ROW_HEIGHT }} />
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
                {/* Deadline marker on the axis — a diamond, not a dot, so the
                    two markers are told apart at a glance and not only by
                    colour. It lives INSIDE the sticky header, so it stays on
                    screen when the chart is scrolled down past the chip. */}
                {deadlinePosition !== null && (
                  <div
                    className="absolute bottom-0 w-2 h-2 -translate-x-1/2 rotate-45"
                    style={{
                      left: deadlinePosition,
                      backgroundColor: DEADLINE_RED,
                    }}
                    title={deadlineTitle ?? undefined}
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

              {/* DEADLINE line — Project.endDate.
                  z-10, the same layer as the today line and BELOW the sticky
                  date header (z-20). That ordering is load-bearing: the
                  dependency-arrow layer was at z-20 once, tied with the
                  header, and being later in the DOM it painted over it when
                  the chart scrolled — fixed by dropping it to z-[15]. Nothing
                  in this body may go above 15. */}
              {deadlinePosition !== null && (
                <div
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{ left: deadlinePosition }}
                >
                  <div
                    className="absolute top-0 bottom-0 w-0.5 -translate-x-px"
                    style={{
                      // Dashed, because a second SOLID vertical line reads as
                      // a second "today".
                      backgroundImage: `repeating-linear-gradient(to bottom, ${DEADLINE_RED} 0 6px, transparent 6px 12px)`,
                    }}
                  />
                  <span
                    className={cn(
                      // pointer-events back ON for the chip alone: the wrapper
                      // is inert so the line never eats a bar's mousedown,
                      // but the chip has to be hoverable to show its title.
                      "pointer-events-auto absolute top-0 whitespace-nowrap rounded px-1.5 py-[2px] text-[10px] font-semibold leading-none text-white shadow-sm",
                      deadlineLabelOnLeft ? "right-[6px]" : "left-[6px]"
                    )}
                    style={{ backgroundColor: DEADLINE_RED }}
                    title={deadlineTitle ?? undefined}
                  >
                    {deadlineLabel}
                  </span>
                </div>
              )}

              {/* Dependency arrows — TWO stacked svgs over one shared
                  geometry. The VISIBLE strokes render ABOVE the z-10 bars
                  (z-20, fully pointer-events-none); that used to be forced —
                  a leg crossing an intermediate row's bar was swallowed and
                  the link read as two disconnected stubs — and the router no
                  longer crosses bars, but the layer stays on top so the
                  arrowhead landing on a bar's edge is never clipped by it
                  (MS Project draws connectors over bars too). The fat CLICK
                  targets stay BELOW the bars (z-[5]) so they can never steal
                  a bar's mousedown/drag. */}
              {showDependencies && dependencies.length > 0 && bounds && (
                <>
                  {/* Click layer — fat transparent hit paths, under the
                      bars. A 1.5px line is unclickable; the parent svg
                      is pointer-events-none, so only these take clicks. */}
                  <svg
                    className="absolute inset-0 pointer-events-none z-[5]"
                    width={bounds.totalWidth}
                    height={totalRows * ROW_HEIGHT}
                  >
                    {depPaths.map(({ dep, path }) => (
                      <path
                        key={dep.id}
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
                    ))}
                  </svg>
                  {/* Visible layer — strokes + arrowheads. ABOVE the bars
                      (z-10) so an arrowhead landing on a bar edge is not
                      clipped, but BELOW the sticky date header (z-20):
                      at z-20 it tied with the header and, being later in
                      the DOM, won — so scrolling the chart down drew the
                      connectors straight across "September 2026" and the
                      day numbers. The bars never did that, because they
                      sit at z-10 and pass under the header correctly. */}
                  <svg
                    className="absolute inset-0 pointer-events-none z-[15]"
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
                    {depPaths.map(({ dep, path }) => {
                      // Hover/selection only — it changes on pointer move,
                      // so it must NOT live in the routing memo.
                      const isActive =
                        depMenu?.dep.id === dep.id ||
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
                              ? "url(#gantt-dep-arrow-active)"
                              : "url(#gantt-dep-arrow-default)"
                          }
                          opacity={isActive ? 1 : 0.9}
                        />
                      );
                    })}
                  </svg>
                </>
              )}

              {/* Rows — mirror the left panel 1:1 */}
              {filteredSections.map((section) => {
                const isCollapsed = collapsedSections.has(section.id);
                // Per-section bar hue (shared with the Timeline view).
                const sectionFill = sectionBarStyle(
                  sectionColorIdx.get(section.id) ?? 0
                ).bg;
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
                          const span = taskSpan(t);
                          if (!span) continue;
                          if (!min || span.start < min) min = span.start;
                          if (!max || span.end > max) max = span.end;
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
                              style={{ backgroundColor: sectionFill }}
                            />
                            <div
                              className="absolute left-0 top-0 w-[3px] h-[14px] rounded-b"
                              style={{ backgroundColor: sectionFill }}
                            />
                            <div
                              className="absolute right-0 top-0 w-[3px] h-[14px] rounded-b"
                              style={{ backgroundColor: sectionFill }}
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
                          // LATE. Not behind the due-soon Options toggle:
                          // "what slipped" is the question a recert chart
                          // exists to answer, and an overdue bar used to be
                          // the same blue as one due next month.
                          const overdue = isTaskOverdue(task, today);
                          // Bars take their section's hue; done goes gray.
                          const barColor = task.completed
                            ? BAR_FILL_COMPLETED
                            : sectionFill;
                          const isDueOnly = !task.startDate;
                          // Started, no end committed. One day wide with a
                          // right edge that dissolves instead of ending, so
                          // it does not read as a one-day task.
                          const isOpenEnded = !task.dueDate && !!task.startDate;
                          // Same channels the Timeline paints late in:
                          // border + background-image, which the hover /
                          // selected / due-soon RINGS do not use, so nothing
                          // fights for the same box-shadow.
                          const overdueHatch = `repeating-linear-gradient(45deg, ${DATE_OVERDUE}47 0 5px, transparent 5px 11px)`;
                          const openEdgeFill = `linear-gradient(to right, ${barColor} 0%, ${barColor} 40%, ${barColor}00 100%)`;

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
                                ? isOpenEnded
                                  ? // No due day to shrink toward — the
                                    // commit translates the bar, so the
                                    // preview must translate too.
                                    position.width
                                  : position.width - dragState.deltaX
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
                                    className="absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing touch-none hover:scale-110 transition-transform z-10"
                                    style={{ left: markerLeft }}
                                    // Markers used to be click-only, so a
                                    // milestone that slipped could not be
                                    // rescheduled on the chart at all. "move"
                                    // shifts only dueDate when there is no
                                    // startDate, which is the milestone case.
                                    onPointerDown={(e) =>
                                      handleDragStart(e, task.id, "move", task)
                                    }
                                    onClick={() => {
                                      if (didDragRef.current) {
                                        didDragRef.current = false;
                                        return;
                                      }
                                      handleRowClick(task.id);
                                    }}
                                    title={`${task.name} — milestone`}
                                  >
                                    <Diamond
                                      className="w-6 h-6"
                                      fill={overdue ? DATE_OVERDUE : barColor}
                                      color={overdue ? DATE_OVERDUE : barColor}
                                    />
                                  </div>
                                ) : isApproval ? (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing touch-none hover:scale-110 transition-transform z-10"
                                    style={{ left: markerLeft }}
                                    onPointerDown={(e) =>
                                      handleDragStart(e, task.id, "move", task)
                                    }
                                    onClick={() => {
                                      if (didDragRef.current) {
                                        didDragRef.current = false;
                                        return;
                                      }
                                      handleRowClick(task.id);
                                    }}
                                    title={`${task.name} — approval gate`}
                                  >
                                    <ThumbsUp
                                      className="w-6 h-6"
                                      fill={overdue ? DATE_OVERDUE : barColor}
                                      color={overdue ? DATE_OVERDUE : barColor}
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
                                      "absolute cursor-grab active:cursor-grabbing touch-none group/bar z-10",
                                      // A rounded right cap reads as a
                                      // finished end; an open bar has none.
                                      isOpenEnded
                                        ? "rounded-l rounded-r-none"
                                        : "rounded",
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
                                      // An open-ended bar paints only the
                                      // gradient, so its right edge really
                                      // does reach zero.
                                      backgroundColor: isOpenEnded
                                        ? "transparent"
                                        : barColor,
                                      backgroundImage: isOpenEnded
                                        ? openEdgeFill
                                        : overdue
                                          ? overdueHatch
                                          : undefined,
                                      border: overdue
                                        ? `2px solid ${DATE_OVERDUE}`
                                        : undefined,
                                    }}
                                    title={`${task.name} · ${dueRangeText(task, today)}`}
                                    onPointerDown={(e) =>
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
                                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize touch-none opacity-0 transition-opacity group-hover/bar:opacity-100 bg-black/20 rounded-l z-10"
                                        onPointerDown={(e) =>
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
                                        "absolute right-0 top-0 bottom-0 cursor-ew-resize touch-none opacity-0 transition-opacity group-hover/bar:opacity-100 bg-black/20 rounded-r z-10",
                                        isDueOnly ? "w-1" : "w-2"
                                      )}
                                      onPointerDown={(e) =>
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

