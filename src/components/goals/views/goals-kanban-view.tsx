"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ViewObjective } from "./types";

interface KanbanColumn {
  id: string;
  label: string;
  color: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: "ON_TRACK", label: "On track", color: "#c9a84c" },
  { id: "AT_RISK", label: "At risk", color: "#a8893a" },
  { id: "OFF_TRACK", label: "Off track", color: "#0a0a0a" },
  { id: "ACHIEVED", label: "Achieved", color: "#c9a84c" },
  { id: "DROPPED", label: "Dropped", color: "#666666" },
];

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

  async function changeStatus(objectiveId: string, status: string) {
    setMoving(objectiveId);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Moved to ${status.replace("_", " ").toLowerCase()}`);
      onStatusChange?.();
    } catch {
      toast.error("Couldn't update status");
    } finally {
      setMoving(null);
      setPickerOpen(null);
    }
  }

  return (
    <div className="p-4 md:p-6 overflow-x-auto">
      <div className="flex gap-3 min-w-fit">
        {COLUMNS.map((col) => {
          const cards = objectives.filter((o) => o.status === col.id);
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
                          <span className="tabular-nums">{obj.progress}%</span>
                          {obj.confidenceScore && (
                            <span className="tabular-nums">
                              · {obj.confidenceScore}/10
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Move-to picker */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setPickerOpen(
                            pickerOpen === obj.id ? null : obj.id
                          );
                        }}
                        className="mt-2 w-full text-[10px] text-gray-500 hover:text-black hover:bg-gray-50 rounded py-1 transition-colors border border-dashed"
                      >
                        Move…
                      </button>
                      {pickerOpen === obj.id && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 p-1">
                          {COLUMNS.filter((c) => c.id !== obj.status).map(
                            (c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => changeStatus(obj.id, c.id)}
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
                        </div>
                      )}
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
