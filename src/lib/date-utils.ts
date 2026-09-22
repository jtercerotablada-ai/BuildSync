/**
 * Shared date / time formatting helpers. Extracted so the same
 * "5m ago" / "3 days remaining" semantics don't drift across detail
 * page, AI Coach panel, comments feed, etc.
 */

import { startOfLocalDay } from "@/lib/date-only";

/**
 * "Today at 10:32 AM" / "Yesterday at 4:15 PM" / "11/12/2026 at 9:00 AM".
 * Locale-friendly version of the absolute timestamp shown next to a
 * comment or activity item.
 */
export function formatRelativeTime(
  date: string | Date,
  now: Date = new Date()
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Calendar days, not elapsed 24h periods: last night at 22:00 read at
  // 09:00 is "Yesterday", though only 11 hours have passed. Math.round
  // absorbs the 23/25-hour days around a DST switch.
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diffDays = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(d).getTime()) / MS_PER_DAY
  );

  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString("en-US")} at ${time}`;
}

/**
 * Compact "just now" / "5m ago" / "3h ago" / "2d ago" for tight UI
 * spots (badges, cached-at indicators, etc.).
 */
export function formatCompactRelative(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const then = d.getTime();
  if (Number.isNaN(then)) return "earlier";
  const delta = Date.now() - then;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Pretty time-to-deadline string for an objective.
 *   "Overdue" / "Due today" / "Due tomorrow" / "5 days remaining" /
 *   "3 months remaining in Q1 FY26"
 */
export function getTimeRemaining(
  period: string | null | undefined,
  endDate: string | Date | null | undefined
): string {
  if (!period && !endDate) return "";

  if (endDate) {
    const end = typeof endDate === "string" ? new Date(endDate) : endDate;
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays < 30) return `${diffDays} days remaining`;
    const diffMonths = Math.ceil(diffDays / 30);
    return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} remaining${period ? ` in ${period}` : ""}`;
  }

  return period ? `In ${period}` : "";
}
