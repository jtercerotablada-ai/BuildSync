"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Target, ChevronDown, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewObjective } from "./types";

/**
 * Tree / strategy-map view — vertical hierarchy of parent → children
 * objectives. Same data, different layout: parents take the top tier
 * with their children indented below.
 *
 * For now we group by "top-level objectives" (parentId is null) and
 * render their child arrays inline. A full graph view (with cross-team
 * arrows) is a separate iteration.
 */
export function GoalsTreeView({
  objectives,
}: {
  objectives: ViewObjective[];
}) {
  // Anything we receive from the listing endpoint is already top-level
  // (parentId: null is the page-level filter). Render each with its
  // direct children. Deeper nesting would require a separate fetch.
  const topLevel = objectives.filter((o) => !o.parentId);

  if (topLevel.length === 0) {
    return (
      <div className="p-12 text-center">
        <Network className="h-8 w-8 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">
          Create a top-level goal to start building your strategy map.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {topLevel.map((parent) => (
        <div key={parent.id} className="border rounded-xl p-4 bg-white">
          <Link href={`/goals/${parent.id}`} className="block group">
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-4 w-4 text-[#c9a84c]" />
              <p className="text-sm font-semibold text-black group-hover:underline truncate">
                {parent.name}
              </p>
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full",
                  parent.status === "OFF_TRACK"
                    ? "bg-black text-white"
                    : parent.status === "AT_RISK"
                      ? "bg-[#a8893a] text-white"
                      : "bg-[#c9a84c] text-white"
                )}
              >
                {parent.status.replace("_", " ").toLowerCase()}
              </span>
              <span className="ml-auto text-xs text-gray-500 tabular-nums">
                {parent.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#c9a84c]"
                style={{ width: `${parent.progress}%` }}
              />
            </div>
          </Link>

          {parent.children.length > 0 && (
            <div className="mt-3 pl-7 border-l-2 border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ChevronDown className="h-3 w-3" />
                Sub-goals ({parent.children.length})
              </p>
              <div className="space-y-1.5">
                {parent.children.map((c) => (
                  <Link
                    key={c.id}
                    href={`/goals/${c.id}`}
                    className="flex items-center gap-2 py-1.5 px-2 -ml-2 hover:bg-gray-50 rounded transition-colors group"
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        c.status === "OFF_TRACK"
                          ? "bg-black"
                          : c.status === "AT_RISK"
                            ? "bg-[#a8893a]"
                            : "bg-[#c9a84c]"
                      )}
                    />
                    <span className="text-xs text-gray-700 group-hover:text-black flex-1 truncate group-hover:underline">
                      {c.name}
                    </span>
                    <div className="h-1 w-20 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#c9a84c]"
                        style={{ width: `${c.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">
                      {c.progress}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Key results inline as leaf nodes */}
          {parent.keyResults.length > 0 && (
            <div className="mt-3 pl-7 border-l-2 border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Key results ({parent.keyResults.length})
              </p>
              <div className="space-y-1">
                {parent.keyResults.map((kr) => {
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
                            ((kr.currentValue - kr.startValue) / range) * 100
                          )
                        );
                  return (
                    <div
                      key={kr.id}
                      className="flex items-center gap-2 py-1 text-xs"
                    >
                      <Target className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-gray-600 truncate">
                        {kr.name}
                      </span>
                      <span className="text-gray-500 tabular-nums">
                        {Math.round(pct)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Owner badge */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
            <Avatar className="h-4 w-4">
              <AvatarImage src={parent.owner.image || undefined} />
              <AvatarFallback className="bg-[#c9a84c] text-white text-[8px]">
                {(parent.owner.name || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{parent.owner.name || "—"}</span>
            {parent.period && <span>· {parent.period}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
