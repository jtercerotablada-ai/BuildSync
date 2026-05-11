"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Target, Folder, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewObjective } from "./types";

/**
 * List view — flat rows with KR previews per goal (expand to see KRs).
 * Designed as the default "scan" view: dense, sortable column-like
 * layout with status pill, progress, owner, period.
 */
export function GoalsListView({
  objectives,
}: {
  objectives: ViewObjective[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  if (objectives.length === 0) {
    return (
      <div className="p-12 text-center">
        <Target className="h-8 w-8 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No goals match this view.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-4">
      {/* Column header */}
      <div className="hidden md:grid grid-cols-[28px_minmax(0,1fr)_120px_140px_120px_80px] items-center gap-3 px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b">
        <span />
        <span>Goal</span>
        <span>Status</span>
        <span>Progress</span>
        <span>Owner</span>
        <span className="text-right">Confidence</span>
      </div>

      <ul className="divide-y">
        {objectives.map((obj) => {
          const isExp = expanded.has(obj.id);
          return (
            <li key={obj.id} className="py-2">
              <div className="grid grid-cols-[28px_minmax(0,1fr)_120px_140px_120px_80px] items-center gap-3 px-2 hover:bg-gray-50 rounded transition-colors">
                <button
                  type="button"
                  onClick={() => toggle(obj.id)}
                  className="text-gray-400 hover:text-black p-1"
                  aria-label={isExp ? "Collapse" : "Expand"}
                >
                  {isExp ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                <Link
                  href={`/goals/${obj.id}`}
                  className="text-sm text-black hover:underline truncate"
                >
                  {obj.name}
                </Link>

                <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-gray-700">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: statusColor(obj.status) }}
                  />
                  <span className="truncate">{statusLabel(obj.status)}</span>
                </span>

                <div className="hidden md:flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                    <div
                      className="h-full bg-[#c9a84c]"
                      style={{ width: `${obj.progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 tabular-nums w-8 text-right">
                    {obj.progress}%
                  </span>
                </div>

                <div className="hidden md:flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={obj.owner.image || undefined} />
                    <AvatarFallback className="bg-[#c9a84c] text-white text-[9px]">
                      {(obj.owner.name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-gray-600 truncate">
                    {obj.owner.name || "—"}
                  </span>
                </div>

                <span className="hidden md:block text-right text-[11px] text-gray-700 tabular-nums">
                  {obj.confidenceScore ? `${obj.confidenceScore}/10` : "—"}
                </span>
              </div>

              {isExp && (
                <div className="mt-2 ml-9 pl-3 border-l space-y-1">
                  {obj.keyResults.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1">
                      No key results yet.
                    </p>
                  ) : (
                    obj.keyResults.map((kr) => {
                      const range = kr.targetValue - kr.startValue;
                      const pct =
                        range === 0
                          ? kr.currentValue >= kr.targetValue
                            ? 100
                            : 0
                          : Math.min(
                              100,
                              Math.max(
                                0,
                                ((kr.currentValue - kr.startValue) / range) *
                                  100
                              )
                            );
                      return (
                        <div
                          key={kr.id}
                          className="flex items-center gap-2 py-1 text-xs"
                        >
                          <Target className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <span className="flex-1 text-gray-700 truncate">
                            {kr.name}
                          </span>
                          <span className="text-gray-500 tabular-nums">
                            {kr.currentValue}/{kr.targetValue}
                            {kr.unit ? ` ${kr.unit}` : ""} ·{" "}
                            {Math.round(pct)}%
                          </span>
                        </div>
                      );
                    })
                  )}
                  {obj.children.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Sub-goals
                      </p>
                      {obj.children.map((c) => (
                        <Link
                          key={c.id}
                          href={`/goals/${c.id}`}
                          className="flex items-center gap-2 py-1 text-xs hover:bg-gray-50 rounded"
                        >
                          <Folder className="h-3 w-3 text-gray-400" />
                          <span className="flex-1 text-gray-700 truncate hover:underline">
                            {c.name}
                          </span>
                          <span className="text-gray-500 tabular-nums">
                            {c.progress}%
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "ON_TRACK":
    case "ACHIEVED":
      return "#c9a84c";
    case "AT_RISK":
      return "#a8893a";
    case "OFF_TRACK":
    case "MISSED":
      return "#0a0a0a";
    case "DROPPED":
      return "#666666";
    default:
      return "#a3a3a3";
  }
}

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
