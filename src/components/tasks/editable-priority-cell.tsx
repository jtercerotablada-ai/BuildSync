"use client";

/**
 * Inline-editable Priority cell for the My Tasks list view.
 *
 * Click the pill → dropdown with 4 options (High / Medium / Low / None).
 * Saves via PATCH /api/tasks/:id with optimistic update so the cell
 * reflects the new value the moment the user picks, rolling back if
 * the API rejects.
 *
 * Visual matches the read-only renderer in BuiltinFieldCell exactly
 * so swapping them in/out doesn't shift layout.
 */

import { useState, useEffect } from "react";
import { Flag, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type Priority = "NONE" | "LOW" | "MEDIUM" | "HIGH";

const PRIORITY_META: Record<
  Priority,
  { label: string; dot: string; text: string }
> = {
  HIGH: { label: "High", dot: "bg-rose-500", text: "text-rose-700" },
  MEDIUM: { label: "Medium", dot: "bg-amber-500", text: "text-amber-700" },
  LOW: { label: "Low", dot: "bg-slate-400", text: "text-slate-600" },
  NONE: { label: "None", dot: "bg-slate-200", text: "text-slate-400" },
};

const ORDER: Priority[] = ["HIGH", "MEDIUM", "LOW", "NONE"];

export function EditablePriorityCell({
  taskId,
  value,
  onChange,
}: {
  taskId: string;
  value: Priority;
  onChange?: (next: Priority) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<Priority | null>(null);
  const current = optimistic ?? value;
  const meta = PRIORITY_META[current];

  // When the parent refetches and `value` updates to match what we
  // optimistically wrote, clear the local override so future renders
  // reflect the canonical server state directly.
  useEffect(() => {
    if (optimistic !== null && optimistic === value) {
      setOptimistic(null);
    }
  }, [value, optimistic]);

  async function pick(next: Priority) {
    if (next === current) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setSaving(true);
    setOptimistic(next);
    onChange?.(next);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setOptimistic(value); // roll back
      onChange?.(value);
      toast.error("Couldn't update priority");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saving}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1.5 text-[12px] font-medium px-1.5 py-0.5 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50",
            meta.text,
            // Render an empty pill on NONE so the cell stays clickable
            // — Asana shows a faint "—" hover affordance; we use a soft
            // chevron instead.
            current === "NONE" && "opacity-60 hover:opacity-100"
          )}
        >
          {current === "NONE" ? (
            <>
              <Flag className="w-3 h-3 opacity-60" />
              <ChevronDown className="w-3 h-3 opacity-40" />
            </>
          ) : (
            <>
              <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
              <Flag className="w-3 h-3 opacity-60" />
              {meta.label}
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-40 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {ORDER.map((p) => {
          const m = PRIORITY_META[p];
          return (
            <DropdownMenuItem
              key={p}
              onClick={() => pick(p)}
              className={cn(
                "flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5",
                p === current && "bg-slate-100"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", m.dot)} />
              <span className={cn("text-[13px] flex-1", m.text)}>{m.label}</span>
              {p === current && (
                <span className="text-[10px] text-slate-400">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
