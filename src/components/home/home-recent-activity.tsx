"use client";

/**
 * Recent activity — chronological feed of what changed across the
 * portfolio. Pulls ActivityItem[] from /api/dashboard/ceo.
 */

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Activity } from "lucide-react";
import type { ActivityItem } from "@/components/cockpit/types";
import { formatCompactRelative } from "@/lib/date-utils";

export function HomeRecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-black leading-tight">
          Recent activity
        </h3>
        <p className="text-[11px] text-gray-500">
          {items.length} events · last 7 days
        </p>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <Activity className="h-6 w-6 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            No activity yet across your projects.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {items.slice(0, 8).map((a) => {
            const actor = a.assignee || a.creator;
            const verb = a.completedAt ? "completed" : "updated";
            const when = a.completedAt
              ? formatCompactRelative(a.completedAt)
              : formatCompactRelative(a.updatedAt);
            return (
              <li
                key={a.id}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50"
              >
                <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                  <AvatarImage src={actor?.image || undefined} />
                  <AvatarFallback className="bg-[#c9a84c] text-white text-[9px]">
                    {(actor?.name || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-gray-700 leading-snug">
                    <span className="font-medium text-black">
                      {actor?.name || "Someone"}
                    </span>{" "}
                    <span className="text-gray-500">{verb}</span>{" "}
                    <Link
                      href={`/projects/${a.project.id}`}
                      className="text-black hover:underline"
                    >
                      {a.name}
                    </Link>
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 inline-flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-sm"
                      style={{ backgroundColor: a.project.color }}
                    />
                    {a.project.name} · {when}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
