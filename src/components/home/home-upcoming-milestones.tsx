"use client";

/**
 * Upcoming milestones — the next 14 days of priority tasks across
 * the portfolio rendered as a date-grouped strip.
 *
 * V1 uses CriticalTask[] from /api/dashboard/ceo (the same data the
 * Priority Queue uses) but filtered to a forward window and grouped
 * by day. Once Day 3 ships milestones-as-task-type, this tile will
 * filter to taskType=MILESTONE and the visuals upgrade to diamond
 * markers per PMBOK convention.
 */

import Link from "next/link";
import { Flag } from "lucide-react";
import type { CriticalTask } from "@/components/cockpit/types";

export function HomeUpcomingMilestones({
  tasks,
}: {
  tasks: CriticalTask[];
}) {
  const now = new Date();
  const horizonDays = 14;
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  // Filter to tasks due within the window (not overdue — overdue
  // lives in Priority Queue) and group by date string.
  const upcoming = tasks
    .filter((t) => {
      const d = new Date(t.dueDate);
      return d >= now && d <= horizonEnd;
    })
    .sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

  // Group by ISO date so we get day buckets.
  const byDay = new Map<string, CriticalTask[]>();
  for (const t of upcoming) {
    const key = new Date(t.dueDate).toISOString().slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(t);
    byDay.set(key, list);
  }
  const days = Array.from(byDay.entries()).slice(0, 7);

  return (
    <div className="h-full flex flex-col border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b flex-shrink-0 pr-12">
        <h3 className="text-sm font-semibold text-black leading-tight">
          Upcoming milestones
        </h3>
        <p className="text-[11px] text-gray-500">
          Next {horizonDays} days · {upcoming.length} item
          {upcoming.length === 1 ? "" : "s"}
        </p>
      </div>
      {days.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
          <Flag className="h-6 w-6 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 max-w-[260px]">
            No milestones in the next {horizonDays} days.
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {days.map(([day, items]) => {
            const d = new Date(day);
            const label = d.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const isToday =
              d.toISOString().slice(0, 10) ===
              new Date().toISOString().slice(0, 10);
            return (
              <li
                key={day}
                className="border-b last:border-b-0 px-4 py-2.5 flex gap-3"
              >
                <div className="w-[68px] flex-shrink-0">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: isToday ? "#c9a84c" : "#9ca3af" }}
                  >
                    {isToday ? "Today" : label}
                  </p>
                </div>
                <ul className="flex-1 space-y-1">
                  {items.slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/projects/${t.project.id}`}
                        className="flex items-center gap-2 text-[12px] hover:underline"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: t.project.color }}
                        />
                        <span className="text-black truncate">{t.name}</span>
                        <span className="text-gray-400 truncate">
                          · {t.project.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {items.length > 4 && (
                    <li className="text-[10px] text-gray-400 ml-3.5">
                      + {items.length - 4} more
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
