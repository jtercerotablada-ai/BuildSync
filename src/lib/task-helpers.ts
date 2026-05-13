/**
 * Shared task formatting helpers — pulled out of my-tasks/page.tsx
 * so the project task-detail-panel can reuse the same labels and
 * formatting logic. Single source of truth for these mappings.
 */

/**
 * 3-letter discipline chip for the project type. Matches what shows
 * up in the cockpit-wide engineering metadata bar (CON / DES / REC /
 * PRM).
 */
export function projectTypeShort(
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
 */
export function formatDueDateLabel(date: string | null): {
  text: string;
  className: string;
} {
  if (!date) return { text: "No due date", className: "text-slate-400" };
  const d = new Date(date);
  if (isNaN(d.getTime()))
    return { text: "No due date", className: "text-slate-400" };

  const today = new Date(new Date().toDateString());
  const target = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );
  const dayMs = 86400000;
  const diffDays = Math.round((target.getTime() - today.getTime()) / dayMs);

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
