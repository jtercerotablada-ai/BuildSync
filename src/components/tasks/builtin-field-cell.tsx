"use client";

/**
 * BuiltinFieldCell — read-only render of the "Show more" built-in
 * columns that Asana surfaces on its list view (Priority, Tags,
 * Blocked by, Blocks, Completion date, Last modified, Creation date,
 * Created by). Each one reads directly from existing Task fields, so
 * there's no fetch, no CustomFieldValue, no schema row — just a
 * formatter.
 *
 * Kept deliberately compact: matches the inline-pill style of the
 * core columns (Due date, Collaborators) so the list reads evenly
 * left-to-right. The detail panel handles full editing.
 */

import { Flag, Ban, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TaskRefMin {
  id: string;
  name: string;
  completed: boolean;
}

interface TaskForBuiltins {
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
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
}: {
  builtinId: string;
  task: TaskForBuiltins;
}) {
  switch (builtinId) {
    case "priority": {
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
      const tags = task.taskTags || [];
      if (tags.length === 0) return null;
      // Show the first 2 chips inline + a "+N" pill for overflow so
      // the cell doesn't blow out the column width when a task has
      // many tags. The hover title surfaces the full list.
      const visible = tags.slice(0, 2);
      const overflow = tags.length - visible.length;
      return (
        <div
          className="flex items-center gap-1 min-w-0"
          title={tags.map((t) => t.tag.name).join(", ")}
        >
          {visible.map((t) => (
            <span
              key={t.tag.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium truncate max-w-[80px]"
              style={{
                backgroundColor: `${t.tag.color}1a`, // ~10% alpha
                color: t.tag.color,
              }}
            >
              {t.tag.name}
            </span>
          ))}
          {overflow > 0 && (
            <span className="text-[11px] text-slate-400 tabular-nums">
              +{overflow}
            </span>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}
