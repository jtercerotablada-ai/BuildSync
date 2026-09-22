"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { CockpitPayload } from "@/lib/cockpit";
import { daysFromToday } from "@/lib/date-only";
import { formatDeadlineDate } from "@/lib/regulatory";
import { cn } from "@/lib/utils";
import { CockpitCard, PersonAvatar } from "./bits";

const TASKS_PER_PERSON = 5;

/**
 * Who has overdue work. The counts always add up: every contributor row, plus
 * "Unassigned" and "Others" (people outside the firm's contributor seats).
 * A row expands to up to five of that person's oldest overdue tasks from the
 * payload's sample; "n more" covers what the sample does not hold.
 */
export function OverdueByPerson({
  overdue,
  isManager,
  today,
}: {
  overdue: CockpitPayload["overdue"];
  isManager: boolean;
  today: Date | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [showClear, setShowClear] = useState(false);
  const withCount = overdue.people.filter((p) => p.count > 0);
  const clear = overdue.people.filter((p) => p.count === 0);

  return (
    <CockpitCard
      id="overdue"
      title="Overdue by person"
      subtitle={isManager ? undefined : "Across jobs you can see"}
    >
      {overdue.totalCount === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-slate-500">
          Nobody has overdue tasks.
        </p>
      ) : (
        <ul className="divide-y divide-[#e6e9ef] py-1">
          {withCount.map((p) => {
            const isOpen = open === p.user.id;
            const sample = overdue.tasks.filter((t) => t.assigneeId === p.user.id);
            const shown = sample.slice(0, TASKS_PER_PERSON);
            const more = p.count - shown.length;
            const oldest =
              p.oldestDueDate && today
                ? -daysFromToday(p.oldestDueDate, today)
                : null;
            return (
              <li key={p.user.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : p.user.id)}
                  className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-slate-50"
                >
                  <PersonAvatar name={p.user.name} image={p.user.image} />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-black">
                    {p.user.name ?? "Unnamed"}
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums text-red-600">
                    {p.count}
                  </span>
                  {oldest !== null && oldest > 0 && (
                    <span className="w-[68px] text-right text-[10px] tabular-nums text-slate-500">
                      oldest {oldest}d
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 text-slate-400 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <ul className="pb-1.5 pl-12 pr-4">
                    {shown.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/projects/${t.project.id}?task=${t.id}`}
                          className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] text-black">
                              {t.name}
                            </span>
                            <span className="block truncate text-[10px] text-slate-500">
                              {t.project.name}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-red-600">
                            {formatDeadlineDate(t.dueDate, { year: false })}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {more > 0 && (
                      <li className="px-1.5 py-1">
                        <Link
                          href="/projects/all"
                          className="text-[11px] font-medium text-[#8F6C1F] hover:underline"
                        >
                          {more} more — open their projects
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
          {overdue.unassigned > 0 && (
            <li className="flex items-center gap-2 px-4 py-1.5">
              <span className="size-6 rounded-full border border-dashed border-slate-300" aria-hidden />
              <span className="flex-1 text-[12px] text-slate-600">Unassigned</span>
              <span className="text-[12px] font-semibold tabular-nums text-red-600">
                {overdue.unassigned}
              </span>
            </li>
          )}
          {overdue.others > 0 && (
            <li
              className="flex items-center gap-2 px-4 py-1.5"
              title="Tasks assigned to people outside the firm's contributors"
            >
              <span className="size-6 rounded-full bg-slate-100" aria-hidden />
              <span className="flex-1 text-[12px] text-slate-600">Others</span>
              <span className="text-[12px] font-semibold tabular-nums text-red-600">
                {overdue.others}
              </span>
            </li>
          )}
        </ul>
      )}
      {isManager && clear.length > 0 && overdue.totalCount > 0 && (
        <div className="border-t border-[#e6e9ef]">
          <button
            type="button"
            aria-expanded={showClear}
            onClick={() => setShowClear((v) => !v)}
            className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[11px] text-slate-500 hover:bg-slate-50"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", !showClear && "-rotate-90")}
            />
            Everyone else is clear ({clear.length})
          </button>
          {showClear && (
            <ul className="flex flex-wrap gap-1.5 px-4 pb-2.5">
              {clear.map((p) => (
                <li
                  key={p.user.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e9ef] py-0.5 pl-0.5 pr-2 text-[11px] text-slate-600"
                >
                  <PersonAvatar name={p.user.name} image={p.user.image} className="size-5" />
                  {p.user.name ?? "Unnamed"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CockpitCard>
  );
}
