"use client";

/**
 * Priority Queue — the single tile that tells the user "do these
 * things in this order today".
 *
 * Today it shows critical-path tasks assigned to anyone (the
 * /api/dashboard/ceo endpoint surfaces these). When Day 2 ships the
 * Documents/Stamps schema we'll add "stamp queue" items here; when
 * Day 4 ships RFI/Submittal we'll fold those in too. Each item has
 * a `kind` discriminator so the list is extension-ready.
 *
 * Sorting: overdue first (worst-overdue at the top), then due today,
 * then due this week, then by priority. Asana shows tasks in a flat
 * list; we sort by urgency so the user doesn't have to.
 */

import Link from "next/link";
import { AlertTriangle, CheckSquare, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { CriticalTask } from "@/components/cockpit/types";

type QueueItem =
  | {
      kind: "task";
      id: string;
      title: string;
      project: { id: string; name: string; color: string };
      dueDate: Date;
      assignee: { name: string | null; image: string | null } | null;
      href: string;
    };

export function HomePriorityQueue({
  criticalTasks,
}: {
  criticalTasks: CriticalTask[];
}) {
  const items: QueueItem[] = criticalTasks.map((t) => ({
    kind: "task" as const,
    id: t.id,
    title: t.name,
    project: t.project,
    dueDate: new Date(t.dueDate),
    assignee: t.assignee
      ? { name: t.assignee.name, image: t.assignee.image }
      : null,
    href: `/projects/${t.project.id}`,
  }));

  // Sort by urgency: most-overdue first, then due-soonest.
  items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return (
    <TileWrapper
      title="Priority queue"
      subtitle={
        items.length === 0
          ? "Nothing urgent"
          : `${items.length} item${items.length === 1 ? "" : "s"} owed`
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          message="No critical-path work pending. Capacity available for new commitments."
        />
      ) : (
        <ul className="divide-y">
          {items.slice(0, 6).map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
          {items.length > 6 && (
            <li className="px-4 py-2.5 text-[11px] text-gray-500 hover:bg-gray-50">
              <Link href="/my-tasks" className="flex items-center justify-between">
                <span>{items.length - 6} more items</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </li>
          )}
        </ul>
      )}
    </TileWrapper>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const now = new Date();
  const daysFromNow = Math.floor(
    (item.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysFromNow < 0;
  const isToday = daysFromNow === 0;

  const dueLabel = isOverdue
    ? `${Math.abs(daysFromNow)}d overdue`
    : isToday
      ? "Today"
      : daysFromNow === 1
        ? "Tomorrow"
        : `${daysFromNow}d`;

  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-shrink-0">
          {isOverdue ? (
            <AlertTriangle className="h-4 w-4 text-black" />
          ) : isToday ? (
            <span className="block w-2 h-2 rounded-full bg-[#c9a84c]" />
          ) : (
            <span className="block w-2 h-2 rounded-full bg-gray-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-black truncate">
            {item.title}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 truncate">
            <span
              className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.project.color }}
            />
            <span className="truncate">{item.project.name}</span>
          </div>
        </div>
        <span
          className={cn(
            "text-[11px] font-mono tabular-nums whitespace-nowrap",
            isOverdue
              ? "font-semibold text-black"
              : isToday
                ? "text-[#a8893a] font-medium"
                : "text-gray-500"
          )}
        >
          {dueLabel}
        </span>
        {item.assignee && (
          <Avatar className="h-5 w-5 flex-shrink-0">
            <AvatarImage src={item.assignee.image || undefined} />
            <AvatarFallback className="bg-[#c9a84c] text-white text-[9px]">
              {(item.assignee.name || "?")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        )}
      </Link>
    </li>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <Icon className="h-6 w-6 text-gray-300 mb-2" />
      <p className="text-sm text-gray-500 max-w-[260px]">{message}</p>
    </div>
  );
}

// Shared tile container (kept local to avoid component-lib churn).
function TileWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-black leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-gray-500">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
