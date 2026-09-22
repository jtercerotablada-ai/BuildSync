"use client";

/**
 * Home header — greeting + date + Asana-style summary chips.
 *
 * Mirrors Asana's minimalist pattern: greeting, period selector,
 * "X tasks completed", "X collaborators". No emphasis pills for
 * SPI / Velocity / Overdue.
 */

import { useEffect, useState } from "react";
import { Calendar, Check, ChevronDown, CheckCircle2, Users } from "lucide-react";
import { APP_LOCALE } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The period only scopes the "tasks completed" chip, so every option is a
// window that has already started. "Next 14 days" and "Look-ahead (3 weeks)"
// used to be offered too: nothing on the page is forward-looking, so picking
// them changed nothing and still counted the past 7 days.
export type HomePeriod = "today" | "week" | "month" | "quarter";

const PERIOD_LABEL: Record<HomePeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  quarter: "This quarter",
};

/** A saved preference may hold a period that no longer exists (the retired
 *  look-ahead options); fall back to the default instead of a blank label. */
export function normalizeHomePeriod(value: unknown): HomePeriod {
  return typeof value === "string" && value in PERIOD_LABEL
    ? (value as HomePeriod)
    : "week";
}

function greeting(now: Date, name?: string | null): string {
  const h = now.getHours();
  const greet =
    h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${greet}, ${name.split(" ")[0]}` : greet;
}

export function HomeHeader({
  userName,
  period,
  onPeriodChange,
  tasksCompleted,
  collaboratorsCount,
  actions,
}: {
  userName?: string | null;
  period: HomePeriod;
  onPeriodChange: (p: HomePeriod) => void;
  // Tri-state chip counts: number → render, null → still loading
  // (skeleton), undefined → data unavailable (chip hidden, the rest
  // of the header renders normally).
  tasksCompleted?: number | null;
  collaboratorsCount?: number | null;
  // Optional trailing slot — renders inline with the period selector
  // and summary chips (Asana puts "Personalize" here instead of in a
  // separate row below the header).
  actions?: React.ReactNode;
}) {
  // Recompute date + greeting when a long-lived tab regains focus so
  // it doesn't keep saying "Good morning" at 3pm (or show yesterday's
  // date after midnight). visibilitychange is enough — nobody stares
  // at a background tab waiting for the greeting to flip.
  //
  // Read on mount, never during render: the server renders in UTC, so
  // from 20:00 in Miami it would print tomorrow's date and the wrong
  // greeting, and React does not repair that hydration mismatch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    function refresh() {
      if (document.visibilityState === "visible") setNow(new Date());
    }
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  const dateStr = now
    ? now.toLocaleDateString(APP_LOCALE, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
        {/* A non-breaking space holds the line height until the date lands. */}
        {dateStr ?? "\u00a0"}
      </p>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4 mt-1">
        <h1 className="text-2xl md:text-3xl font-bold text-black">
          {now ? greeting(now, userName) : "\u00a0"}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {PERIOD_LABEL[normalizeHomePeriod(period)]}
                <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.entries(PERIOD_LABEL) as [HomePeriod, string][]).map(
                ([id, label]) => (
                  <DropdownMenuItem key={id} onClick={() => onPeriodChange(id)}>
                    {id === period ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : (
                      <span className="w-4 mr-2" />
                    )}
                    {label}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {tasksCompleted !== undefined && (
            <SummaryChip
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-gray-500" />}
              count={tasksCompleted}
              singular="task completed"
              plural="tasks completed"
            />
          )}
          {/* This counted every member of the workspace, so a manager with no
              projects read "3 collaborators" while collaborating with nobody.
              It now counts the people who hold a place on a project the viewer
              owns or belongs to, which is what the word has always promised —
              so the word is right again, and the number moves when the work
              does. */}
          {collaboratorsCount !== undefined && (
            <SummaryChip
              icon={<Users className="h-3.5 w-3.5 text-gray-500" />}
              count={collaboratorsCount}
              singular="collaborator"
              plural="collaborators"
            />
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}

function SummaryChip({
  icon,
  count,
  singular,
  plural,
}: {
  icon: React.ReactNode;
  count: number | null; // null → loading skeleton
  singular: string;
  plural: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-700">
      {icon}
      {count === null ? (
        <span className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
      ) : (
        <>
          <span className="font-semibold tabular-nums">{count}</span>
          <span className="text-gray-600">
            {count === 1 ? singular : plural}
          </span>
        </>
      )}
    </div>
  );
}
