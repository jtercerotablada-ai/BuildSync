/**
 * Duration helpers for the "Time tracking" (Estimated / Actual) field.
 *
 * Engineering/construction estimates are done in DAYS, like Microsoft
 * Project and Primavera P6 — a review is "2 days", a drawing set is
 * "5 days", a small fix is "0.5 day". We store the value as a decimal
 * number of WORKING days and let the user type an optional unit suffix
 * (MS-Project style): "3" or "3d" = 3 days, "4h" = 0.5 day, "2w" = 10
 * days. 1 working day = 8 hours, 1 working week = 5 days.
 */

export const WORK_HOURS_PER_DAY = 8;
export const WORK_DAYS_PER_WEEK = 5;

/** Legacy value shape (minutes) → days, for any field created before the
 *  switch to days. New writes use { estimatedDays, actualDays }. */
export function minutesToDays(min: number): number {
  return round3(min / (WORK_HOURS_PER_DAY * 60));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Parse a user-typed duration into a decimal number of days. Accepts a
 * bare number (days) or a number + unit suffix: d/day(s), h/hr(s)/hour(s),
 * w/wk(s)/week(s). Returns null for empty/invalid input.
 */
export function parseDaysInput(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (s === "") return null;
  const m = s.match(
    /^(\d*\.?\d+)\s*(d|day|days|h|hr|hrs|hour|hours|w|wk|wks|week|weeks)?$/
  );
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const unit = m[2] || "d";
  let days: number;
  if (unit.startsWith("h")) days = n / WORK_HOURS_PER_DAY;
  else if (unit.startsWith("w")) days = n * WORK_DAYS_PER_WEEK;
  else days = n; // days (default)
  return round3(days);
}

/** Format a decimal number of days for display, e.g. 3 → "3d", 0.5 → "0.5d". */
export function formatDays(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days)) return "";
  return `${round3(days)}d`;
}

/** Extract days from either the new { estimatedDays, actualDays } shape or
 *  the legacy { estimatedMin, actualMin } minutes shape. */
export function readTimeTracking(value: unknown): {
  estimatedDays: number | null;
  actualDays: number | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { estimatedDays: null, actualDays: null };
  }
  const v = value as Record<string, unknown>;
  const estDays =
    typeof v.estimatedDays === "number"
      ? v.estimatedDays
      : typeof v.estimatedMin === "number"
        ? minutesToDays(v.estimatedMin)
        : null;
  const actDays =
    typeof v.actualDays === "number"
      ? v.actualDays
      : typeof v.actualMin === "number"
        ? minutesToDays(v.actualMin)
        : null;
  return { estimatedDays: estDays, actualDays: actDays };
}
