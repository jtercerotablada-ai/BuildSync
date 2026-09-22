"use client";

import Link from "next/link";
import { AlertTriangle, Stamp } from "lucide-react";
import { compareDwellDesc, type CockpitJob, type CockpitPayload } from "@/lib/cockpit";
import { daysFromToday } from "@/lib/date-only";
import { formatDeadlineDate } from "@/lib/regulatory";
import { cn } from "@/lib/utils";
import { CockpitCard, PersonAvatar } from "./bits";

/**
 * What is waiting on the seal: jobs sitting at an "Awaiting PE Signature"
 * stage, longest first, then the open APPROVAL tasks assigned to whoever may
 * seal — the Deliverables rule: the workspace owner, or a seat granted seal
 * authority. Read-only — rows only link.
 */
export function PeSignQueue({
  jobs,
  peQueue,
  isPe,
  today,
}: {
  jobs: CockpitJob[];
  peQueue: CockpitPayload["peQueue"];
  isPe: boolean;
  today: Date | null;
}) {
  const peJobs = jobs.filter((j) => j.holder === "PE").sort(compareDwellDesc);
  const names = peQueue.peUsers
    .map((u) => (u.name ?? "").split(" ")[0] || "the PE")
    .join(" & ");
  const subtitle = isPe
    ? "Waiting on your seal"
    : names
      ? `Waiting on ${names}'s seal`
      : undefined;
  const more = peQueue.taskCount - peQueue.tasks.length;
  const empty = peJobs.length === 0 && peQueue.tasks.length === 0;

  return (
    <CockpitCard id="pe-queue" title="P.E. sign queue" subtitle={subtitle}>
      {peQueue.peUsers.length === 0 && (
        <p className="border-b border-[#e6e9ef] px-4 py-2.5 text-[11px] text-slate-500">
          Approval tasks show here once someone in the firm may seal — the
          owner grants seal authority from a project&apos;s Deliverables tab.
        </p>
      )}
      {empty ? (
        <p className="px-4 py-6 text-center text-[12px] text-slate-500">
          Nothing waiting on the seal.
        </p>
      ) : (
        <div className="divide-y divide-[#e6e9ef]">
          {peJobs.length > 0 && (
            <ul className="py-1">
              {peJobs.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/projects/${j.id}`}
                    className="flex items-center gap-2 px-4 py-1.5 hover:bg-slate-50"
                  >
                    <Stamp className="size-3.5 shrink-0 text-[#8a7028]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-black">
                      {j.name}
                    </span>
                    {j.daysInStage !== null && (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums",
                          j.stale
                            ? "rounded bg-[#FBF3E4] px-1.5 font-medium text-[#8F6C1F]"
                            : "text-slate-500"
                        )}
                        title={j.stale ? `Stale: over the ${j.staleAfterDays}-day limit` : undefined}
                      >
                        {j.stale && <AlertTriangle className="size-3" aria-hidden />}
                        {j.daysInStage === 0 ? "today" : `${j.daysInStage}d`}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {peQueue.tasks.length > 0 && (
            <ul className="py-1">
              {peQueue.tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/projects/${t.project.id}?task=${t.id}`}
                    className="flex items-center gap-2 px-4 py-1.5 hover:bg-slate-50"
                  >
                    <PersonAvatar
                      name={t.assignee.name}
                      image={t.assignee.image}
                      className="size-5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-black">
                        {t.name}
                      </span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {t.project.name}
                      </span>
                    </span>
                    <DueChip dueDate={t.dueDate} today={today} />
                  </Link>
                </li>
              ))}
              {more > 0 && (
                <li className="px-4 py-1.5 text-[11px] text-slate-500">
                  +{more} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </CockpitCard>
  );
}

function DueChip({ dueDate, today }: { dueDate: string | null; today: Date | null }) {
  if (!dueDate) return <span className="shrink-0 text-[10px] text-slate-300">No date</span>;
  const days = today ? daysFromToday(dueDate, today) : null;
  return (
    <span
      className={cn(
        "shrink-0 rounded border px-1 py-px text-[10px] tabular-nums",
        days !== null && days < 0
          ? "border-red-200 bg-red-50 text-red-700"
          : days === 0
            ? "border-[#E9D9A8] bg-[#FBF6E9] text-[#8F6C1F]"
            : "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {formatDeadlineDate(dueDate, { year: false })}
    </span>
  );
}
