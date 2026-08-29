/**
 * Shared task formatting helpers — pulled out of my-tasks/page.tsx
 * so the project task-detail-panel can reuse the same labels and
 * formatting logic. Single source of truth for these mappings.
 */

import { daysFromToday, dueDateToLocalMidnight } from "@/lib/date-only";

/**
 * 3-letter discipline chip for the project type. Matches what shows
 * up in the cockpit-wide engineering metadata bar (CON / DES / REC /
 * PRM).
 */
export function projectTypeShort(
  type: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT" | "BSIP"
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
    // Already an abbreviation, so it keeps its own name rather than being
    // squeezed into three letters nobody at the firm would recognize.
    case "BSIP":
      return "BSIP";
  }
}

/**
 * Compact label for the project's current lifecycle gate. The full
 * enum is verbose ("PRE_DESIGN", "PERMITTING") so we ship a short
 * version that reads cleanly in a chip without dominating the row.
 */
export function formatGateShort(
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

/**
 * Human-readable file size from bytes. Used by the attachments list
 * and the comment composer's pending-files chips.
 */
export function formatFileSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Renders a Mon DD label for a single date, or "Mon DD – Mon DD" for
 * a range. Returns the fallback (formatted "due" string from
 * formatDueDate) when only a due is set, so the existing relative
 * phrasing ("Today", "Tomorrow", "Yesterday") is preserved for
 * single-date tasks.
 */
export function formatRangeLabel(
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
 * Lightweight relative-time formatter for due dates that ships with
 * built-in phrases like "Today", "Tomorrow", "Yesterday" and falls
 * back to "Mon D" for further-out dates. Mirrors the formatDueDate
 * helper used inside my-tasks so panels in projects render the same
 * vocabulary.
 *
 * `today` is local midnight of the viewer's day, or `null` while the
 * caller does not know it yet. It is a REQUIRED parameter because this
 * helper is rendered by client components (the task detail panel): it used
 * to read the clock itself, and a clock read during a client render is the
 * bug — the server render runs in UTC, so from 20:00 in Miami it is already
 * tomorrow there, and React does not repair a text mismatch when it
 * hydrates. A task due today stayed labelled "Tomorrow" all evening.
 * Client callers pass `useToday()` (src/lib/use-today.ts).
 */
export function formatDueDateLabel(
  date: string | null,
  today: Date | null
): {
  text: string;
  className: string;
} {
  if (!date) return { text: "No due date", className: "text-slate-400" };
  const d = new Date(date);
  if (isNaN(d.getTime()))
    return { text: "No due date", className: "text-slate-400" };

  // Due dates are stored as UTC-midnight timestamps; read them by the
  // UTC calendar day so a task due "today" never renders as "Yesterday"
  // for viewers west of UTC. See src/lib/date-only.ts.
  const target = dueDateToLocalMidnight(d);

  // No day yet — the server render and the first client render, before
  // useToday() has reported the browser's own day. Show the absolute date
  // instead of guessing a relative one: both renders agree, so there is
  // nothing for hydration to repair, and the relative phrasing appears one
  // frame later from the viewer's own clock. A wrong "Tomorrow" is worse
  // than a late one on the panel someone opens to check a deadline.
  if (!today) {
    return {
      text: target.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      className: "text-slate-600",
    };
  }

  const diffDays = daysFromToday(d, today);

  if (diffDays === 0) return { text: "Today", className: "text-[#a8893a]" };
  if (diffDays === 1) return { text: "Tomorrow", className: "text-[#a8893a]" };
  if (diffDays === -1) return { text: "Yesterday", className: "text-black" };
  if (diffDays < 0)
    return {
      text: target.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      className: "text-black",
    };
  if (diffDays < 7)
    return {
      text: target.toLocaleDateString("en-US", { weekday: "long" }),
      className: "text-slate-600",
    };
  return {
    text: target.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    className: "text-slate-600",
  };
}
