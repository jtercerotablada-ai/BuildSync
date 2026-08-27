"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ViewObjective } from "./types";

import { STATUS_OPTIONS } from "@/lib/goal-utils";

interface KanbanColumn {
  id: string;
  label: string;
  color: string;
  /** Statuses whose objectives belong in this column. */
  statuses: string[];
}

// Subset of STATUS_OPTIONS that get a column of their own. The colors
// are driven from the shared palette in goal-utils so a tweak there
// cascades to every view.
const KANBAN_STATUSES = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "ACHIEVED", "DROPPED"];
// End-of-period statuses. They stay out of the main run of columns to
// keep the board about live work, but they cannot be dropped either:
// objectives marked Partial or Not achieved used to match no column at
// all and vanished from the board entirely, so they are collected in a
// trailing column that only appears once something lands in it.
const CLOSED_OUT_STATUSES = ["PARTIAL", "MISSED"];

function statusMeta(id: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === id);
  return { label: opt?.label ?? id, color: opt?.hex ?? "#a3a3a3" };
}

const COLUMNS: KanbanColumn[] = KANBAN_STATUSES.map((id) => ({
  id,
  ...statusMeta(id),
  statuses: [id],
}));

const CLOSED_OUT_COLUMN: KanbanColumn = {
  id: "CLOSED_OUT",
  label: "Closed out",
  color: statusMeta("PARTIAL").color,
  statuses: CLOSED_OUT_STATUSES,
};

// Every status a card can be moved to, closed-out ones included.
const MOVE_OPTIONS = [...KANBAN_STATUSES, ...CLOSED_OUT_STATUSES].map((id) => ({
  id,
  ...statusMeta(id),
}));

/**
 * Kanban view — columns by status. Drag-and-drop intentionally NOT
 * implemented here: we use click-to-change via a popover trigger that
 * PATCHes the status. This sidesteps the @dnd-kit dependency and keeps
 * the bundle small while still letting users move cards across
 * columns.
 *
 * The card body is the same compact summary used by the cards view.
 */
export function GoalsKanbanView({
  objectives,
  onStatusChange,
}: {
  objectives: ViewObjective[];
  onStatusChange?: () => void;
}) {
  const [moving, setMoving] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);

  async function changeStatus(
    objectiveId: string,
    status: string,
    statusLabel: string
  ) {
    setMoving(objectiveId);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Use the palette's label: the raw enum reads wrong for the
      // end-of-period statuses ("missed" vs "Not achieved").
      toast.success(`Moved to ${statusLabel.toLowerCase()}`);
      onStatusChange?.();
    } catch {
      toast.error("Couldn't update status");
    } finally {
      setMoving(null);
      setPickerOpen(null);
    }
  }

  // The closed-out column is only worth its width once a goal has been
  // marked Partial or Not achieved.
  const hasClosedOut = objectives.some((o) =>
    CLOSED_OUT_STATUSES.includes(o.status)
  );
  const boardColumns = hasClosedOut ? [...COLUMNS, CLOSED_OUT_COLUMN] : COLUMNS;

  return (
    <div className="p-4 md:p-6 overflow-x-auto">
      <div className="flex gap-3 min-w-fit">
        {boardColumns.map((col) => {
          const cards = objectives.filter((o) => col.statuses.includes(o.status));
          return (
            <div
              key={col.id}
              className="w-72 flex-shrink-0 bg-gray-50 rounded-lg p-2"
            >
              <div className="flex items-center justify-between px-2 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-700">
                    {col.label}
                  </span>
                </div>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  {cards.length}
                </span>
              </div>
              <div className="space-y-2">
                {cards.length === 0 ? (
                  <div className="text-[11px] text-gray-400 text-center py-6">
                    Empty
                  </div>
                ) : (
                  cards.map((obj) => (
                    <div
                      key={obj.id}
                      className={cn(
                        "relative bg-white border rounded-md p-3 hover:border-gray-400 transition-colors",
                        moving === obj.id && "opacity-50"
                      )}
                    >
                      <Link href={`/goals/${obj.id}`}>
                        <p className="text-sm font-medium text-black line-clamp-2 mb-2 hover:underline">
                          {obj.name}
                        </p>
                      </Link>
                      <div className="h-1 bg-gray-100 rounded-full mb-2 overflow-hidden">
                        <div
                          className="h-full bg-[#c9a84c]"
                          style={{ width: `${obj.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={obj.owner.image || undefined} />
                          <AvatarFallback className="bg-[#c9a84c] text-white text-[9px]">
                            {(obj.owner.name || "?")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          {/* This column merges two statuses, so the card
                              has to say which one it carries. */}
                          {col.id === "CLOSED_OUT" && (
                            <span>{statusMeta(obj.status).label}</span>
                          )}
                          <span className="tabular-nums">{obj.progress}%</span>
                          {obj.confidenceScore && (
                            <span className="tabular-nums">
                              · {obj.confidenceScore}/10
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Move-to picker. Built on the shared Popover so it
                          closes on outside click and on Escape, and so it
                          escapes the column's scroll container instead of
                          being clipped on the bottom card. */}
                      <Popover
                        open={pickerOpen === obj.id}
                        onOpenChange={(open) =>
                          setPickerOpen(open ? obj.id : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="mt-2 w-full text-[10px] text-gray-500 hover:text-black hover:bg-gray-50 rounded py-1 transition-colors border border-dashed"
                          >
                            Move…
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-[var(--radix-popover-trigger-width)] rounded-lg p-1"
                        >
                          {MOVE_OPTIONS.filter((c) => c.id !== obj.status).map(
                            (c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => changeStatus(obj.id, c.id, c.label)}
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 rounded flex items-center gap-2"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: c.color }}
                                />
                                {c.label}
                              </button>
                            )
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
