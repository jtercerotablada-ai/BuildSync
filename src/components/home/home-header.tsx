"use client";

/**
 * Home header — greeting + date + personal stat strip + period selector.
 *
 * Mirrors Asana's pattern (greeting / My week / 0 tasks completed /
 * 0 collaborators / Personalize) but enriched for an engineering firm:
 *   - Time-aware greeting (Good morning / afternoon / evening)
 *   - Personal PMI stats: avg SPI across my projects, weekly velocity
 *   - Period selector: Today / This week / Next 14 days /
 *     Look-ahead 3 weeks (PMI vocab) / Quarter
 *
 * No "Personalize" button yet — we'll add it once there are widgets
 * the user can actually rearrange.
 */

import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type HomePeriod =
  | "today"
  | "week"
  | "next14"
  | "lookahead3w"
  | "quarter";

const PERIOD_LABEL: Record<HomePeriod, string> = {
  today: "Today",
  week: "This week",
  next14: "Next 14 days",
  lookahead3w: "Look-ahead (3 weeks)",
  quarter: "This quarter",
};

function greeting(name?: string | null): string {
  const h = new Date().getHours();
  const greet =
    h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${greet}, ${name.split(" ")[0]}` : greet;
}

export function HomeHeader({
  userName,
  period,
  onPeriodChange,
  closedThisWeek,
  overdueCount,
  avgSpi,
  velocityWeekly,
}: {
  userName?: string | null;
  period: HomePeriod;
  onPeriodChange: (p: HomePeriod) => void;
  closedThisWeek: number;
  overdueCount: number;
  avgSpi: number;
  velocityWeekly: number;
}) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
        {dateStr}
      </p>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4 mt-1">
        <h1 className="text-2xl md:text-3xl font-bold text-black">
          {greeting(userName)}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {PERIOD_LABEL[period]}
                <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.entries(PERIOD_LABEL) as [HomePeriod, string][]).map(
                ([id, label]) => (
                  <DropdownMenuItem key={id} onClick={() => onPeriodChange(id)}>
                    {label}
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Stat label="Closed" value={closedThisWeek.toString()} />
          <Stat
            label="Overdue"
            value={overdueCount.toString()}
            emphasize={overdueCount > 0}
          />
          <Stat
            label="Avg SPI"
            value={avgSpi > 0 ? avgSpi.toFixed(2) : "—"}
            emphasize={avgSpi > 0 && avgSpi < 0.95}
          />
          <Stat label="Velocity/wk" value={velocityWeekly.toString()} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border rounded-md bg-white">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-mono tabular-nums",
          emphasize ? "font-bold text-black" : "font-semibold text-gray-700"
        )}
      >
        {value}
      </span>
    </div>
  );
}
