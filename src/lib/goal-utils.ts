/**
 * Shared utilities for the Goals (OKRs) feature.
 *
 * Centralized here so STATUS_OPTIONS, color helpers, and percentage
 * math don't drift across the list page, kanban view, detail page,
 * check-in dialog, and AI Coach — which is exactly what happened
 * across five copies before this extraction.
 */

export type ObjectiveStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ACHIEVED"
  | "PARTIAL"
  | "MISSED"
  | "DROPPED";

export interface GoalStatusOption {
  value: ObjectiveStatus | null;
  label: string;
  /** Tailwind class for background color (used as a dot). */
  color: string;
  /** Tailwind class for the text color when status is shown as a chip. */
  textColor: string;
  /** Raw hex (for inline-style fills, kanban borders, etc.) */
  hex: string;
}

/**
 * Monochrome + gold palette only — no greens, reds, blues anywhere.
 * The same status (e.g. ON_TRACK and ACHIEVED) shares gold so visual
 * status reads consistently across views.
 */
export const STATUS_OPTIONS: GoalStatusOption[] = [
  {
    value: "ON_TRACK",
    label: "On track",
    color: "bg-[#c9a84c]",
    textColor: "text-[#a8893a]",
    hex: "#c9a84c",
  },
  {
    value: "AT_RISK",
    label: "At risk",
    color: "bg-[#a8893a]",
    textColor: "text-[#a8893a]",
    hex: "#a8893a",
  },
  {
    value: "OFF_TRACK",
    label: "Off track",
    color: "bg-black",
    textColor: "text-black",
    hex: "#0a0a0a",
  },
  {
    value: "ACHIEVED",
    label: "Achieved",
    color: "bg-[#c9a84c]",
    textColor: "text-[#a8893a]",
    hex: "#c9a84c",
  },
  {
    value: "PARTIAL",
    label: "Partial",
    color: "bg-gray-400",
    textColor: "text-black",
    hex: "#a3a3a3",
  },
  {
    value: "MISSED",
    label: "Not achieved",
    color: "bg-gray-300",
    textColor: "text-black",
    hex: "#d4d4d4",
  },
  {
    value: "DROPPED",
    label: "Discarded",
    color: "bg-gray-400",
    textColor: "text-black",
    hex: "#666666",
  },
  {
    value: null,
    label: "No status",
    color: "bg-gray-400",
    textColor: "text-black",
    hex: "#a3a3a3",
  },
];

export function getStatusOption(
  status: ObjectiveStatus | string | null
): GoalStatusOption {
  return (
    STATUS_OPTIONS.find((o) => o.value === status) ??
    STATUS_OPTIONS.find((o) => o.value === null)!
  );
}

/**
 * Returns a Tailwind `bg-` class for a status dot. Backward-compatible
 * with the existing `getStatusColor` callers on the list page.
 */
export function getStatusBgClass(status: string): string {
  return getStatusOption(status).color;
}

/**
 * Confidence ring color thresholds (monochrome + gold).
 * 8-10 = gold, 5-7 = mid gold, 1-4 = black, null = neutral gray.
 */
export function confidenceColor(score: number | null | undefined): string {
  if (!score || score < 1) return "#d4d4d4";
  if (score >= 8) return "#c9a84c";
  if (score >= 5) return "#a8893a";
  return "#0a0a0a";
}

/**
 * Compute a 0-100 progress percentage from a KeyResult's start/current/
 * target triple, clamped and never NaN.
 */
export function calculateKRProgress(kr: {
  startValue: number;
  currentValue: number;
  targetValue: number;
}): number {
  const range = kr.targetValue - kr.startValue;
  if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  return Math.min(
    100,
    Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100)
  );
}

/**
 * Two-character avatar fallback initials for a person's display name.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
