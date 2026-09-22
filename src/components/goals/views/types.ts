/**
 * Shared types for goal view components. The page-level `Objective`
 * type in `/goals/page.tsx` is the source of truth; this is a slim
 * mirror so view components don't import from the page.
 */
export interface ViewObjective {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  progress: number;
  period: string | null;
  confidenceScore?: number | null;
  lastCheckInAt?: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  team: {
    id: string;
    name: string;
  } | null;
  keyResults: {
    id: string;
    name: string;
    targetValue: number;
    currentValue: number;
    startValue: number;
    unit: string | null;
  }[];
  children: {
    id: string;
    name: string;
    status: string;
    progress: number;
  }[];
  _count: {
    keyResults: number;
    children: number;
    projects?: number;
  };
  parentId?: string | null;
}

export type GoalsViewType = "list" | "kanban" | "cards" | "tree";

// ── Goal periods ──────────────────────────────────────────────
// Periods are stored as plain labels ("Q3 FY26", "H2 FY26", "FY26") on
// Objective.period and the list filters on exact equality. The firm's fiscal
// year is the calendar year. The labels are generated from the current date
// rather than hard-coded: a fixed FY26 list defaulted every new goal to a
// quarter that had already ended and would have had no current period at all
// from January 2027.

const PERIOD_RE = /^(?:(Q)([1-4])|(H)([12]))?\s*FY(\d{2})$/;

function fiscalYearLabel(year: number): string {
  return `FY${String(year % 100).padStart(2, "0")}`;
}

/** Every period of one fiscal year, in the order the pickers list them. */
export function goalPeriodsForYear(year: number): string[] {
  const fy = fiscalYearLabel(year);
  return [
    `Q1 ${fy}`,
    `Q2 ${fy}`,
    `Q3 ${fy}`,
    `Q4 ${fy}`,
    `H1 ${fy}`,
    `H2 ${fy}`,
    fy,
  ];
}

/** The quarter `today` falls in, e.g. "Q3 FY26". The default for new goals. */
export function currentQuarterPeriod(today: Date): string {
  return `Q${Math.floor(today.getMonth() / 3) + 1} ${fiscalYearLabel(
    today.getFullYear()
  )}`;
}

/**
 * Periods for the given fiscal years around `today` (default: last, this and
 * next year). `extra` keeps a label that is already in use — a saved filter
 * or a goal's own older period — selectable even when it falls outside the
 * window, so picking it again never silently changes it.
 */
export function goalPeriodOptions(
  today: Date,
  opts: { yearsBack?: number; yearsAhead?: number; extra?: (string | null | undefined)[] } = {}
): string[] {
  const { yearsBack = 1, yearsAhead = 1, extra = [] } = opts;
  const year = today.getFullYear();
  const out: string[] = [];
  for (let y = year - yearsBack; y <= year + yearsAhead; y++) {
    out.push(...goalPeriodsForYear(y));
  }
  for (const label of extra) {
    if (label && !out.includes(label)) out.push(label);
  }
  return out.sort((a, b) => goalPeriodRank(a) - goalPeriodRank(b));
}

/**
 * The calendar range a period covers, as LOCAL midnight of its first and
 * last day (these are calendar days, not instants). Null for a label that is
 * not a recognised period.
 */
export function goalPeriodRange(
  period: string | null | undefined
): { start: Date; end: Date } | null {
  const m = period ? PERIOD_RE.exec(period.trim()) : null;
  if (!m) return null;
  const year = 2000 + Number(m[5]);
  let firstMonth = 0;
  let months = 12;
  if (m[1]) {
    firstMonth = (Number(m[2]) - 1) * 3;
    months = 3;
  } else if (m[3]) {
    firstMonth = (Number(m[4]) - 1) * 6;
    months = 6;
  }
  return {
    start: new Date(year, firstMonth, 1),
    // Day 0 of the following month = last day of the period.
    end: new Date(year, firstMonth + months, 0),
  };
}

/** Sort key matching the pickers: year first, then that year's quarters,
 *  halves and the full year, each in start order. Unknown labels sort last. */
export function goalPeriodRank(period: string | null | undefined): number {
  const range = goalPeriodRange(period);
  if (!range) return Number.MAX_SAFE_INTEGER;
  const m = PERIOD_RE.exec(period!.trim())!;
  const kind = m[1] ? 0 : m[3] ? 1 : 2;
  // Year-major, then quarters, halves and the full year, each by start.
  return range.start.getFullYear() * 100 + kind * 20 + range.start.getMonth();
}

/** "Jul 1 – Sep 30" for a period label, or "" when it is not recognised. */
export function formatGoalPeriodRange(period: string | null | undefined): string {
  const range = goalPeriodRange(period);
  if (!range) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}
