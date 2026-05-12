"use client";

/**
 * Team capacity — capacity bars normalized against the busiest
 * member. Asana's "Personas" tile shows avatars + "X overdue / Y done";
 * this version goes a level deeper with load percentage relative to
 * peak so it's obvious who's slammed and who's free.
 *
 * Click any row → /teams (full Capacity Matrix on the team page).
 */

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/components/cockpit/types";

export function HomeTeamCapacity({ members }: { members: TeamMember[] }) {
  if (members.length === 0) {
    return (
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-black leading-tight">
            People
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <Users className="h-6 w-6 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            Invite a teammate from /teams to start tracking capacity.
          </p>
        </div>
      </div>
    );
  }

  const peak = Math.max(1, ...members.map((m) => m.load));
  const sorted = [...members].sort((a, b) => b.load - a.load);
  const top = sorted.slice(0, 6);

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-black leading-tight">
            People
          </h3>
          <p className="text-[11px] text-gray-500">
            Capacity load · busiest first
          </p>
        </div>
        <Link
          href="/teams"
          className="text-[11px] text-gray-500 hover:text-black inline-flex items-center gap-0.5"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="divide-y">
        {top.map((m) => {
          const pct = Math.round((m.load / peak) * 100);
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={m.image || undefined} />
                <AvatarFallback className="bg-[#c9a84c] text-white text-[10px]">
                  {(m.name || "?")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-black truncate">
                  {m.name || m.email}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  {m.role.toLowerCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full",
                      pct >= 85
                        ? "bg-black"
                        : pct >= 60
                          ? "bg-[#a8893a]"
                          : "bg-[#c9a84c]"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono tabular-nums text-gray-700 w-12 text-right">
                  {m.load} tasks
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
