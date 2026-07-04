"use client";

/**
 * BuiltinFieldCell — render of the "Show more" built-in columns that
 * Asana surfaces on its list view (Priority, Tags, Blocked by, Blocks,
 * Completion date, Last modified, Creation date, Created by). Each
 * one reads directly from existing Task fields, so there's no fetch,
 * no CustomFieldValue, no schema row — just a formatter.
 *
 * Most built-ins are read-only (timestamps, creator, dependencies).
 * Two are inline-editable: Priority (popover with 4 options) and
 * Tags (popover with picker + create-new). When the user has write
 * access we mount the editable variants; otherwise we fall back to
 * the plain renderers here.
 */

import { Flag, Ban, ShieldAlert, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EditablePriorityCell } from "@/components/tasks/editable-priority-cell";
import { EditableTagsCell } from "@/components/tasks/editable-tags-cell";

interface TaskRefMin {
  id: string;
  name: string;
  completed: boolean;
}

interface TaskForBuiltins {
  id: string;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  startDate?: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  dependencies?: { blockingTask: TaskRefMin }[];
  dependents?: { dependentTask: TaskRefMin }[];
  taskTags?: { tag: { id: string; name: string; color: string } }[];
  _count?: { likes?: number };
}

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

const PRIORITY_META: Record<
  TaskForBuiltins["priority"],
  { label: string; dot: string; text: string } | null
> = {
  HIGH: { label: "High", dot: "bg-rose-500", text: "text-rose-700" },
  MEDIUM: { label: "Medium", dot: "bg-amber-500", text: "text-amber-700" },
  LOW: { label: "Low", dot: "bg-slate-400", text: "text-slate-600" },
  NONE: null,
};

export function BuiltinFieldCell({
  builtinId,
  task,
  onPatchTask,
}: {
  builtinId: string;
  task: TaskForBuiltins;
  /** Optimistic update hook — parent passes a function that splices
   *  the task in its in-memory list so the cell reflects the change
   *  immediately. Optional: when omitted, the cell still saves but
   *  the row may flicker until the next refetch. */
  onPatchTask?: (taskId: string, patch: Partial<TaskForBuiltins>) => void;
}) {
  switch (builtinId) {
    case "priority": {
      return (
        <EditablePriorityCell
          taskId={task.id}
          value={task.priority}
          onChange={(next) => onPatchTask?.(task.id, { priority: next })}
        />
      );
    }
    case "_priority_static": {
      // Static fallback (unused for now). Kept so callers that only
      // want a non-interactive render can opt in later via a flag.
      const meta = PRIORITY_META[task.priority];
      if (!meta) return null;
      return (
        <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", meta.text)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
          <Flag className="w-3 h-3 opacity-60" />
          {meta.label}
        </span>
      );
    }
    case "completed_at": {
      const s = formatShortDate(task.completedAt);
      if (!s) return null;
      return <span className="text-[13px] text-slate-600">{s}</span>;
    }
    case "updated_at": {
      const s = formatShortDate(task.updatedAt);
      if (!s) return null;
      return <span className="text-[13px] text-slate-600">{s}</span>;
    }
    case "created_at": {
      const s = formatShortDate(task.createdAt);
      if (!s) return null;
      return <span className="text-[13px] text-slate-600">{s}</span>;
    }
    case "start_date": {
      const s = formatShortDate(task.startDate);
      if (!s) return null;
      return <span className="text-[13px] text-slate-600">{s}</span>;
    }
    case "likes": {
      const count = task._count?.likes ?? 0;
      return (
        <span className="inline-flex items-center gap-1 text-[13px] text-slate-600">
          <Heart
            className={cn(
              "w-3.5 h-3.5",
              count > 0 ? "text-rose-500 fill-rose-500" : "text-slate-300"
            )}
          />
          {count > 0 ? count : ""}
        </span>
      );
    }
    case "creator": {
      if (!task.creator) return null;
      const display = task.creator.name || task.creator.email || "Someone";
      return (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <Avatar className="w-5 h-5 flex-shrink-0">
            <AvatarImage src={task.creator.image || undefined} />
            <AvatarFallback className="text-[10px] bg-gray-100 text-gray-600">
              {display.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-[13px] text-slate-600 truncate">{display}</span>
        </span>
      );
    }
    case "blocked_by": {
      const list = task.dependencies || [];
      if (list.length === 0) return null;
      const first = list[0].blockingTask;
      const more = list.length - 1;
      return (
        <span
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 truncate"
          title={list.map((d) => d.blockingTask.name).join(", ")}
        >
          <Ban className="w-3 h-3 text-rose-400 flex-shrink-0" />
          <span className="truncate">
            {first.name}
            {more > 0 && (
              <span className="text-slate-400 ml-1">+{more}</span>
            )}
          </span>
        </span>
      );
    }
    case "blocks": {
      const list = task.dependents || [];
      if (list.length === 0) return null;
      const first = list[0].dependentTask;
      const more = list.length - 1;
      return (
        <span
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 truncate"
          title={list.map((d) => d.dependentTask.name).join(", ")}
        >
          <ShieldAlert className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <span className="truncate">
            {first.name}
            {more > 0 && (
              <span className="text-slate-400 ml-1">+{more}</span>
            )}
          </span>
        </span>
      );
    }
    case "tags": {
      return (
        <EditableTagsCell
          taskId={task.id}
          value={task.taskTags || []}
          onChange={(next) => onPatchTask?.(task.id, { taskTags: next })}
        />
      );
    }
    default:
      return null;
  }
}
