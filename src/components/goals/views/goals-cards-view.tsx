"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Target, Folder, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceRing } from "@/components/goals/confidence-ring";
import { formatCompactRelative } from "@/lib/date-utils";
import type { ViewObjective } from "./types";

/**
 * Cards view — 3-column grid. Each card surfaces the things owners care
 * about most when scanning: confidence, progress, period, KR/sub-goal
 * counts. Designed for at-a-glance triage across a quarter.
 */
export function GoalsCardsView({
  objectives,
}: {
  objectives: ViewObjective[];
}) {
  if (objectives.length === 0) {
    return (
      <div className="p-12 text-center">
        <Target className="h-8 w-8 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">
          No goals to show in this view.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      {objectives.map((obj) => (
        <Link
          key={obj.id}
          href={`/goals/${obj.id}`}
          className="group block border rounded-xl p-4 bg-white hover:border-gray-400 hover:shadow-sm transition-all"
        >
          <div className="flex items-start gap-3 mb-3">
            <ConfidenceRing
              score={obj.confidenceScore ?? null}
              size={56}
              readOnly
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-black leading-snug line-clamp-2 group-hover:underline">
                {obj.name}
              </p>
              {obj.period && (
                <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-wider">
                  {obj.period}
                </p>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
              <span className="uppercase tracking-wider">Progress</span>
              <span className="tabular-nums font-medium text-black">
                {obj.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  obj.status === "OFF_TRACK"
                    ? "bg-black"
                    : obj.status === "AT_RISK"
                      ? "bg-[#a8893a]"
                      : "bg-[#c9a84c]"
                )}
                style={{ width: `${obj.progress}%` }}
              />
            </div>
          </div>

          {/* Meta strip */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={obj.owner.image || undefined} />
                <AvatarFallback className="bg-[#c9a84c] text-white text-[9px]">
                  {(obj.owner.name || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-gray-500 truncate max-w-[100px]">
                {obj.owner.name || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              {obj._count.keyResults > 0 && (
                <span className="flex items-center gap-0.5">
                  <Target className="h-3 w-3" />
                  {obj._count.keyResults}
                </span>
              )}
              {obj._count.projects !== undefined &&
                obj._count.projects > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Folder className="h-3 w-3" />
                    {obj._count.projects}
                  </span>
                )}
              {obj.team && (
                <span className="flex items-center gap-0.5 truncate max-w-[80px]">
                  <Users className="h-3 w-3" />
                  <span className="truncate">{obj.team.name}</span>
                </span>
              )}
            </div>
          </div>

          {/* Last check-in indicator — surfaces drift (goals that
              haven't been touched recently). Gold dot when fresh
              (<7 days), gray when stale, hidden if never checked in. */}
          {obj.lastCheckInAt && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t text-[10px] text-gray-500">
              <Clock className="h-2.5 w-2.5" />
              <span>Last check-in {formatCompactRelative(obj.lastCheckInAt)}</span>
            </div>
          )}
          {!obj.lastCheckInAt && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t text-[10px] text-gray-400">
              <Clock className="h-2.5 w-2.5" />
              <span>No check-in yet</span>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
