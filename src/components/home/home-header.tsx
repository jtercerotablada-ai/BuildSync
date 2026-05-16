"use client";

/**
 * Home header — greeting + date + Asana-style summary chips.
 *
 * Mirrors Asana's minimalist pattern: greeting, period selector,
 * "X tasks completed", "X collaborators". No emphasis pills for
 * SPI / Velocity / Overdue — those signals live in the AI Brief
 * tile and the dedicated PMI widgets below.
 */

import { Calendar, ChevronDown, CheckCircle2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  tasksCompleted,
  collaboratorsCount,
}: {
  userName?: string | null;
  period: HomePeriod;
  onPeriodChange: (p: HomePeriod) => void;
  tasksCompleted: number;
  collaboratorsCount: number;
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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

          <SummaryChip
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-gray-500" />}
            count={tasksCompleted}
            singular="task completed"
            plural="tasks completed"
          />
          <SummaryChip
            icon={<Users className="h-3.5 w-3.5 text-gray-500" />}
            count={collaboratorsCount}
            singular="collaborator"
            plural="collaborators"
          />
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
  count: number;
  singular: string;
  plural: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-700">
      {icon}
      <span className="font-semibold tabular-nums">{count}</span>
      <span className="text-gray-600">{count === 1 ? singular : plural}</span>
    </div>
  );
}
