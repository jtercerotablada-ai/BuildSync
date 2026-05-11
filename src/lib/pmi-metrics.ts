/**
 * PMBOK-style Earned Value Management (EVM) metrics, computed from the
 * data we already store on a Project (budget, start/end, tasks). No
 * schema changes needed — the goal here is to make the listing and
 * detail pages read like enterprise PM software, not like a generic
 * task tracker.
 *
 * Terms (per PMBOK Guide 7e, §EVM):
 *   BAC  Budget At Completion. Original approved budget.
 *   PV   Planned Value. Budgeted cost of work that should be done by now.
 *   EV   Earned Value. Budgeted cost of work actually done by now.
 *   AC   Actual Cost. Money actually spent so far.
 *   CV   Cost Variance        =  EV - AC   (positive = under budget)
 *   SV   Schedule Variance    =  EV - PV   (positive = ahead)
 *   CPI  Cost Performance Idx =  EV / AC   (≥1 healthy)
 *   SPI  Schedule Perf. Idx   =  EV / PV   (≥1 healthy)
 *   EAC  Estimate At Completion = BAC / CPI (forecast final cost)
 *   ETC  Estimate To Complete   = EAC - AC
 *   VAC  Variance At Completion = BAC - EAC
 *   TCPI Target CPI to finish on budget = (BAC - EV) / (BAC - AC)
 *
 * Since we don't yet capture AC (actual money spent) directly, we
 * accept it as input. Callers that don't track it pass `null` and we
 * fall back to AC = EV (an optimistic equality that yields CPI = 1).
 */

export interface ProjectMinimal {
  startDate: string | Date | null;
  endDate: string | Date | null;
  budget: number | string | null;
  status: string;
  /** Tasks counted toward % complete (root-level, non-subtask). */
  taskCount: number;
  completedTaskCount: number;
  /** Optional override — when present we treat it as the cost-loaded
      progress instead of the simple task-count ratio. */
  costWeightedProgress?: number | null;
  /** Optional captured baseline (when null we fall back to the
      committed start/end dates as the de-facto baseline). */
  baselineStartDate?: string | Date | null;
  baselineEndDate?: string | Date | null;
  /** Actual money spent (manually tracked). When null we set AC = EV. */
  actualCost?: number | null;
}

export interface PmiSnapshot {
  bac: number; // Budget at Completion (USD or local currency)
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number; // 0 when AC is 0
  spi: number; // 0 when PV is 0
  eac: number;
  etc: number;
  vac: number;
  tcpi: number; // 0 when (BAC - AC) is 0
  /** 0-100 — Earned Value as a percentage of BAC. */
  percentComplete: number;
  /** 0-100 — Planned percent complete based on time elapsed. */
  percentPlanned: number;
  /** Schedule slip in days. Positive = behind. Negative = ahead. */
  slipDays: number;
  /** Days from now until the planned end. Negative if past end. */
  floatDays: number | null;
  /** Heuristic risk label based on SPI + CPI. */
  health: "ON_TRACK" | "WATCH" | "AT_RISK" | "OFF_TRACK";
}

function toDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(n: number | string | null | undefined): number {
  if (n === null || n === undefined) return 0;
  if (typeof n === "number") return n;
  const parsed = parseFloat(n);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Compute the full PMI / EVM snapshot for a single project at the
 * current moment in time. Pure function — safe in components or
 * server code.
 */
export function computePmiSnapshot(p: ProjectMinimal, now: Date = new Date()): PmiSnapshot {
  const bac = toNumber(p.budget);
  const start = toDate(p.startDate);
  const end = toDate(p.endDate);
  const baselineStart = toDate(p.baselineStartDate) || start;
  const baselineEnd = toDate(p.baselineEndDate) || end;

  // ── Percent complete (EV/BAC). Prefer cost-weighted progress when
  //    the caller supplied one, otherwise use the simple task ratio.
  const taskRatio =
    p.taskCount > 0 ? p.completedTaskCount / p.taskCount : 0;
  const evRatio =
    p.costWeightedProgress !== null && p.costWeightedProgress !== undefined
      ? Math.max(0, Math.min(1, p.costWeightedProgress / 100))
      : taskRatio;
  const ev = bac * evRatio;

  // ── Planned value: linear baseline across baselineStart → baselineEnd.
  let pvRatio = 0;
  if (baselineStart && baselineEnd && baselineEnd > baselineStart) {
    if (now <= baselineStart) pvRatio = 0;
    else if (now >= baselineEnd) pvRatio = 1;
    else
      pvRatio =
        (now.getTime() - baselineStart.getTime()) /
        (baselineEnd.getTime() - baselineStart.getTime());
  } else if (start && end && now > start && end > start) {
    pvRatio = Math.min(1, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()));
  }
  const pv = bac * pvRatio;

  // ── Actual cost. Default to EV when not provided so CPI stays 1 and
  //    doesn't lie about cost performance.
  const ac =
    p.actualCost !== null && p.actualCost !== undefined
      ? toNumber(p.actualCost)
      : ev;

  const cv = ev - ac;
  const sv = ev - pv;
  const cpi = ac > 0 ? ev / ac : 0;
  const spi = pv > 0 ? ev / pv : 0;
  const eac = cpi > 0 ? bac / cpi : bac;
  const etc = eac - ac;
  const vac = bac - eac;
  const tcpi = bac - ac !== 0 ? (bac - ev) / (bac - ac) : 0;

  // Slip days — how many days behind the project would be if SPI < 1.
  // Compute as: planned-end vs the day the project will land at the
  // current pace.
  let slipDays = 0;
  if (baselineStart && baselineEnd && evRatio > 0 && evRatio < 1) {
    const baselineMs = baselineEnd.getTime() - baselineStart.getTime();
    const elapsedMs = now.getTime() - baselineStart.getTime();
    // At current pace, days needed to finish:
    const projectedMs = elapsedMs / evRatio;
    slipDays = Math.round((projectedMs - baselineMs) / (1000 * 60 * 60 * 24));
  } else if (baselineEnd && now > baselineEnd && evRatio < 1) {
    slipDays = Math.round(
      (now.getTime() - baselineEnd.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Float — days remaining until planned end (negative if overdue).
  let floatDays: number | null = null;
  if (end) {
    floatDays = Math.round(
      (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Health heuristic. Tuned for engineering projects:
  //   ON_TRACK : SPI ≥ 0.95 AND CPI ≥ 0.95
  //   WATCH    : 0.85 ≤ SPI < 0.95 OR 0.85 ≤ CPI < 0.95
  //   AT_RISK  : 0.70 ≤ SPI < 0.85 OR 0.70 ≤ CPI < 0.85
  //   OFF_TRACK: SPI < 0.70 OR CPI < 0.70
  let health: PmiSnapshot["health"];
  const spiSafe = spi || 1; // a brand-new project with no PV reads as healthy
  const cpiSafe = cpi || 1;
  if (spiSafe < 0.7 || cpiSafe < 0.7) health = "OFF_TRACK";
  else if (spiSafe < 0.85 || cpiSafe < 0.85) health = "AT_RISK";
  else if (spiSafe < 0.95 || cpiSafe < 0.95) health = "WATCH";
  else health = "ON_TRACK";
  if (p.status === "OFF_TRACK") health = "OFF_TRACK";
  if (p.status === "AT_RISK" && health === "ON_TRACK") health = "WATCH";

  return {
    bac,
    pv,
    ev,
    ac,
    cv,
    sv,
    cpi,
    spi,
    eac,
    etc,
    vac,
    tcpi,
    percentComplete: Math.round(evRatio * 100),
    percentPlanned: Math.round(pvRatio * 100),
    slipDays,
    floatDays,
    health,
  };
}

/**
 * Tight currency formatter for table cells — strips fractional cents
 * and abbreviates $1,200,000 → $1.2M so the column stays narrow.
 */
export function formatCompactCurrency(
  amount: number,
  currency: string = "USD"
): string {
  if (!Number.isFinite(amount) || amount === 0) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString()}`;
  }
}

/**
 * Format a performance index (CPI / SPI / TCPI). Returns "—" for 0
 * and rounds to 2 decimals.
 */
export function formatIndex(idx: number): string {
  if (!idx || idx === 0) return "—";
  return idx.toFixed(2);
}

/**
 * Health label + tabular color spec (hex) for chips and dots.
 */
export function healthVisual(h: PmiSnapshot["health"]): {
  label: string;
  hex: string;
  textHex: string;
} {
  switch (h) {
    case "ON_TRACK":
      return { label: "On track", hex: "#c9a84c", textHex: "#0a0a0a" };
    case "WATCH":
      return { label: "Watch", hex: "#a8893a", textHex: "#ffffff" };
    case "AT_RISK":
      return { label: "At risk", hex: "#0a0a0a", textHex: "#c9a84c" };
    case "OFF_TRACK":
      return { label: "Off track", hex: "#0a0a0a", textHex: "#ffffff" };
  }
}
