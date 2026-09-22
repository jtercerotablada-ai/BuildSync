"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DEADLINE_HORIZON_DAYS,
  REFERENCE_LABEL,
  deadlineBucket,
  deadlineCopyFor,
  deadlineToneClass,
  formatDaysOut,
  formatDeadlineDate,
  referenceFieldsFor,
} from "@/lib/regulatory";
import {
  jobsMissingDeadline,
  upcomingDeadlines,
  type CockpitJob,
} from "@/lib/cockpit";
import type { StageHolder } from "@/lib/pipelines";
import { cn } from "@/lib/utils";
import { CockpitCard, HolderPill } from "./bits";

const ROWS = 8;

/** The fields a deadline row reads — a subset of CockpitJob, so another
 *  surface (e.g. an opt-in Deadline watch widget) can render the same row. */
export interface DeadlineRowJob {
  id: string;
  name: string;
  type: string | null;
  holder?: StageHolder | null;
  regulatoryDeadline: string | null;
  jurisdiction?: string | null;
  permitNumber?: string | null;
  caseNumber?: string | null;
}

/**
 * One regulatory deadline: what is due, which job, where (AHJ + case/permit
 * number — folio is left to the job page, it is long), the date, a days pill
 * in the shared 7/30/60 tones, and whose desk the job is on. `daysOut` is null
 * until the viewer's day is known; the pill then shows "—".
 */
export function DeadlineRow({
  job,
  daysOut,
  showHolder = true,
}: {
  job: DeadlineRowJob;
  daysOut: number | null;
  showHolder?: boolean;
}) {
  const copy = deadlineCopyFor(job.type);
  const refs = [
    job.jurisdiction?.trim() || null,
    ...referenceFieldsFor(job.type)
      .filter((f) => f !== "folioNumber")
      .map((f) => {
        const v = (f === "caseNumber" ? job.caseNumber : job.permitNumber)?.trim();
        return v ? `${REFERENCE_LABEL[f]} ${v}` : null;
      }),
  ].filter((s): s is string => !!s);

  return (
    <Link
      href={`/projects/${job.id}`}
      className="flex items-start gap-3 px-4 py-2 hover:bg-slate-50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-black">
          <span className="text-slate-500">{copy.short} · </span>
          <span className="font-medium">{job.name}</span>
        </p>
        {refs.length > 0 && (
          <p className="truncate text-[10px] text-slate-500">{refs.join(" · ")}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] tabular-nums text-slate-700"
            title={`${copy.label}: ${job.regulatoryDeadline ? formatDeadlineDate(job.regulatoryDeadline) : ""}`}
          >
            {job.regulatoryDeadline
              ? formatDeadlineDate(job.regulatoryDeadline, { year: false })
              : "—"}
          </span>
          {daysOut === null ? (
            <span className="text-[10px] text-slate-300">—</span>
          ) : (
            <span
              className={cn(
                "rounded border px-1 py-px text-[10px] font-medium tabular-nums whitespace-nowrap",
                deadlineToneClass(deadlineBucket(daysOut))
              )}
            >
              {formatDaysOut(daysOut)}
            </span>
          )}
        </div>
        {showHolder && job.holder !== undefined && <HolderPill holder={job.holder} />}
      </div>
    </Link>
  );
}

export function DeadlinesPanel({
  jobs,
  today,
}: {
  jobs: CockpitJob[];
  today: Date | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(
    () => (today ? upcomingDeadlines(jobs, today, DEADLINE_HORIZON_DAYS) : []),
    [jobs, today]
  );
  const missing = useMemo(() => jobsMissingDeadline(jobs), [jobs]);
  const visible = showAll ? rows : rows.slice(0, ROWS);

  return (
    <CockpitCard
      id="deadlines"
      title="Regulatory deadlines"
      subtitle={`Next ${DEADLINE_HORIZON_DAYS} days`}
    >
      {!today ? (
        <div className="space-y-2 px-4 py-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-slate-500">
          No regulatory deadlines in the next {DEADLINE_HORIZON_DAYS} days.
        </p>
      ) : (
        <ul className="divide-y divide-[#e6e9ef] py-1">
          {visible.map((r) => (
            <li key={r.job.id}>
              <DeadlineRow job={r.job} daysOut={r.daysOut} />
            </li>
          ))}
        </ul>
      )}
      {rows.length > ROWS && (
        <div className="border-t border-[#e6e9ef] px-4 py-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[12px] font-medium text-[#8F6C1F] hover:underline"
          >
            {showAll ? "Show fewer" : `Show all ${rows.length}`}
          </button>
        </div>
      )}
      {missing.length > 0 && (
        <p className="border-t border-[#e6e9ef] px-4 py-2 text-[11px] text-slate-500">
          <Link
            href={`/projects/${missing[0].id}`}
            className="hover:text-black hover:underline"
          >
            {missing.length} recertification, BSIP or permit{" "}
            {missing.length === 1 ? "job has" : "jobs have"} no deadline set.
          </Link>
        </p>
      )}
    </CockpitCard>
  );
}
