"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import type { ProjectType } from "@prisma/client";
import {
  PIPELINES,
  holderDeskLabel,
  holderLabel,
  type PipelineId,
  type StageHolder,
} from "@/lib/pipelines";
import {
  OUR_HOLDERS,
  compareDwellDesc,
  groupJobsByPipeline,
  unstagedJobs,
  type CockpitJob,
} from "@/lib/cockpit";
import {
  DEADLINE_STATE_LABEL,
  deadlineBucket,
  deadlineCopyFor,
  deadlineState,
  deadlineToneClass,
  formatDaysOut,
  formatDeadlineDate,
} from "@/lib/regulatory";
import { daysFromToday } from "@/lib/date-only";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HolderPill } from "./bits";
import { HOLDER_COLOR } from "./holder-style";
import { StageRail } from "./StageRail";

// ───────────────────────────────────────────────────────────────────────────
// Filters (owned by FirmCockpit, ephemeral)
// ───────────────────────────────────────────────────────────────────────────

export type HolderFilter = StageHolder | "OURS" | "OTHERS" | null;

/** A stage key, or `none:<pipelineId>` for that pipeline's "No stage set". */
export type StageFilter = string | null;

export interface BoardFilters {
  holder: HolderFilter;
  type: ProjectType | null;
  stage: StageFilter;
  staleOnly: boolean;
  sortByWait: boolean;
}

export const EMPTY_FILTERS: BoardFilters = {
  holder: null,
  type: null,
  stage: null,
  staleOnly: false,
  sortByWait: false,
};

export function hasActiveFilters(f: BoardFilters): boolean {
  return !!(f.holder || f.type || f.stage || f.staleOnly);
}

function matchesHolder(job: CockpitJob, filter: HolderFilter): boolean {
  if (!filter) return true;
  if (!job.holder || job.holder === "NONE") return false;
  if (filter === "OURS") return OUR_HOLDERS.has(job.holder);
  if (filter === "OTHERS") return !OUR_HOLDERS.has(job.holder);
  return job.holder === filter;
}

function matchesStage(job: CockpitJob, filter: StageFilter): boolean {
  if (!filter) return true;
  if (filter.startsWith("none:")) {
    return job.pipelineId === filter.slice(5) && job.stageIndex === null;
  }
  return job.stage === filter;
}

/** Every filter except the stage one (the ribbon counts against this). */
function matchesBase(job: CockpitJob, f: BoardFilters): boolean {
  if (f.type && job.type !== f.type) return false;
  if (f.staleOnly && !job.stale) return false;
  return matchesHolder(job, f.holder);
}

export function holderFilterLabel(f: HolderFilter): string | null {
  if (!f) return null;
  if (f === "OURS") return "On our desk";
  if (f === "OTHERS") return "Waiting on others";
  return holderLabel(f);
}

function stageFilterLabel(f: StageFilter): string | null {
  if (!f) return null;
  if (f.startsWith("none:")) return "No stage set";
  for (const p of Object.values(PIPELINES)) {
    const s = p.stages.find((x) => x.key === f);
    if (s) return s.label;
  }
  return f;
}

const TYPE_CHIPS: { value: ProjectType | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "RECERTIFICATION", label: "Recertification" },
  { value: "BSIP", label: "BSIP" },
  { value: "DESIGN", label: "Design" },
  { value: "PERMIT", label: "Permit" },
  { value: "CONSTRUCTION", label: "Construction" },
];

const ROWS_PER_SECTION = 12;

// ───────────────────────────────────────────────────────────────────────────
// Board
// ───────────────────────────────────────────────────────────────────────────

export function PipelineBoard({
  jobs,
  filters,
  onFiltersChange,
  today,
}: {
  jobs: CockpitJob[];
  filters: BoardFilters;
  onFiltersChange: (next: BoardFilters) => void;
  today: Date | null;
}) {
  const [collapsed, setCollapsed] = useState<Set<PipelineId>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const set = (patch: Partial<BoardFilters>) =>
    onFiltersChange({ ...filters, ...patch });

  const base = useMemo(
    () => jobs.filter((j) => matchesBase(j, filters)),
    [jobs, filters]
  );
  const groups = useMemo(() => groupJobsByPipeline(base), [base]);
  const typeless = useMemo(
    () =>
      unstagedJobs(jobs).filter(
        (j) => !filters.type && !filters.holder && !filters.stage && (!filters.staleOnly || j.stale)
      ),
    [jobs, filters]
  );

  const sections = groups
    .map((g) => {
      let rows = g.jobs.filter((j) => matchesStage(j, filters.stage));
      if (filters.sortByWait) rows = [...rows].sort(compareDwellDesc);
      return { ...g, rows };
    })
    .filter((g) => g.rows.length > 0 || (!filters.stage && g.count > 0));

  const emptyPipelines = groups
    .filter((g) => g.count === 0 && !hasActiveFilters(filters))
    .map((g) => g.label);

  const anyRows =
    sections.some((s) => s.rows.length > 0) || typeless.length > 0;

  const toggleCollapsed = (id: PipelineId) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const holderChip = holderFilterLabel(filters.holder);
  const stageChip = stageFilterLabel(filters.stage);

  return (
    <section
      aria-label="Jobs by pipeline stage"
      className="min-w-0 rounded-lg border border-[#e6e9ef] bg-white"
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-[#e6e9ef] px-3 py-2.5 sm:px-4">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {TYPE_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              aria-pressed={filters.type === c.value}
              onClick={() => set({ type: c.value, stage: null })}
              className={cn(
                "h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-medium",
                filters.type === c.value
                  ? "border-black bg-black text-white"
                  : "border-[#e6e9ef] bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ToggleChip
            pressed={filters.staleOnly}
            onClick={() => set({ staleOnly: !filters.staleOnly })}
          >
            Stale only
          </ToggleChip>
          <ToggleChip
            pressed={filters.sortByWait}
            onClick={() => set({ sortByWait: !filters.sortByWait })}
          >
            Longest wait first
          </ToggleChip>
          {holderChip && (
            <RemovableChip onRemove={() => set({ holder: null })}>
              Holder: {holderChip}
            </RemovableChip>
          )}
          {stageChip && (
            <RemovableChip onRemove={() => set({ stage: null })}>
              Stage: {stageChip}
            </RemovableChip>
          )}
        </div>
      </div>

      {!anyRows ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-[13px] text-slate-600">
            No jobs match these filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onFiltersChange({ ...EMPTY_FILTERS, sortByWait: filters.sortByWait })
            }
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-[#e6e9ef]">
          {sections.map((s) => {
            const isCollapsed = collapsed.has(s.pipelineId);
            const showAll = expanded.has(s.pipelineId);
            const visible = showAll ? s.rows : s.rows.slice(0, ROWS_PER_SECTION);
            return (
              <div key={s.pipelineId}>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleCollapsed(s.pipelineId)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 sm:px-4"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-slate-400 transition-transform",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                  <span className="text-[13px] font-semibold text-black">
                    {s.label}
                  </span>
                  <span className="text-[12px] text-slate-500 tabular-nums">
                    · {s.count} {s.count === 1 ? "job" : "jobs"}
                    {s.staleCount > 0 && (
                      <span className="text-[#8F6C1F]"> · {s.staleCount} stale</span>
                    )}
                  </span>
                </button>

                {!isCollapsed && (
                  <>
                    <StageRibbon
                      pipelineId={s.pipelineId}
                      jobs={s.jobs}
                      active={filters.stage}
                      onStage={(key) =>
                        set({ stage: filters.stage === key ? null : key })
                      }
                    />
                    {s.rows.length === 0 ? (
                      <p className="px-4 py-3 text-[12px] text-slate-500">
                        No jobs at this stage.
                      </p>
                    ) : (
                      <>
                        <BoardHeader />
                        <ul>
                          {visible.map((j) => (
                            <JobRow key={j.id} job={j} today={today} />
                          ))}
                        </ul>
                        {s.rows.length > ROWS_PER_SECTION && (
                          <div className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s.pipelineId)) next.delete(s.pipelineId);
                                  else next.add(s.pipelineId);
                                  return next;
                                })
                              }
                              className="text-[12px] font-medium text-[#8F6C1F] hover:underline"
                            >
                              {showAll ? "Show fewer" : `Show all ${s.rows.length}`}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {emptyPipelines.length > 0 && (
            <p className="px-4 py-2.5 text-[12px] text-slate-400">
              No active jobs in: {emptyPipelines.join(", ")}.
            </p>
          )}

          {typeless.length > 0 && (
            <div id="unstaged" className="scroll-mt-4">
              <div className="px-3 py-2.5 sm:px-4">
                <p className="text-[13px] font-semibold text-black">
                  No type yet · <span className="tabular-nums">{typeless.length}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Give these jobs a type on their Overview to put them in a
                  pipeline.
                </p>
              </div>
              <ul>
                {typeless.map((j) => (
                  <JobRow key={j.id} job={j} today={today} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ToggleChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md border px-2.5 text-[11px] font-medium",
        pressed
          ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#8F6C1F]"
          : "border-[#e6e9ef] bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function RemovableChip({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-slate-50 pl-2.5 pr-1 text-[11px] text-slate-700">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="grid size-5 place-items-center rounded hover:bg-slate-200"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function StageRibbon({
  pipelineId,
  jobs,
  active,
  onStage,
}: {
  pipelineId: PipelineId;
  jobs: CockpitJob[];
  active: StageFilter;
  onStage: (key: string) => void;
}) {
  const stages = PIPELINES[pipelineId].stages.filter((s) => !s.terminal);
  const counts = new Map<string, number>();
  let none = 0;
  for (const j of jobs) {
    if (j.stageIndex === null || !j.stage) none += 1;
    else counts.set(j.stage, (counts.get(j.stage) ?? 0) + 1);
  }
  const noneKey = `none:${pipelineId}`;
  return (
    <div className="overflow-x-auto px-3 pb-2 sm:px-4">
      <div className="flex min-w-max gap-1">
        {none > 0 && (
          <RibbonCell
            label="No stage set"
            count={none}
            color={null}
            pressed={active === noneKey}
            onClick={() => onStage(noneKey)}
          />
        )}
        {stages.map((s) => (
          <RibbonCell
            key={s.key}
            label={s.label}
            count={counts.get(s.key) ?? 0}
            color={HOLDER_COLOR[s.holder]}
            title={`${s.label} · ${holderDeskLabel(s.holder)}`}
            pressed={active === s.key}
            onClick={() => onStage(s.key)}
          />
        ))}
      </div>
    </div>
  );
}

function RibbonCell({
  label,
  count,
  color,
  title,
  pressed,
  onClick,
}: {
  label: string;
  count: number;
  color: string | null;
  title?: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title ?? label}
      onClick={onClick}
      className={cn(
        "flex w-[104px] shrink-0 flex-col rounded-md border border-[#e6e9ef] border-t-[3px] bg-white px-2 py-1.5 text-left hover:bg-slate-50",
        color === null && "border-dashed border-t-slate-300",
        pressed && "ring-2 ring-[#c9a84c]",
        count === 0 && "opacity-60"
      )}
      style={color ? { borderTopColor: color } : undefined}
    >
      <span className="truncate text-[10px] text-slate-500">{label}</span>
      <span
        className={cn(
          "text-[14px] font-semibold tabular-nums",
          count === 0 ? "text-slate-300" : "text-black"
        )}
      >
        {count}
      </span>
    </button>
  );
}

const ROW_GRID =
  "lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_112px_72px_minmax(0,1.2fr)_76px]";

function BoardHeader() {
  return (
    <div
      className={cn(
        "hidden border-y border-[#e6e9ef] bg-slate-50/60 text-[10px] font-medium uppercase tracking-wider text-slate-500",
        ROW_GRID
      )}
    >
      <div className="px-4 py-1.5">Job</div>
      <div className="px-3 py-1.5">Stage</div>
      <div className="px-3 py-1.5">Holder</div>
      <div className="px-3 py-1.5">In stage</div>
      <div className="px-3 py-1.5">Deadline</div>
      <div className="px-3 py-1.5 text-right">Tasks</div>
    </div>
  );
}

function DwellCell({ job }: { job: CockpitJob }) {
  if (job.daysInStage === null) {
    return (
      <span className="text-slate-300" title="Arrival not recorded">
        —
      </span>
    );
  }
  const text = job.daysInStage === 0 ? "today" : `${job.daysInStage}d`;
  if (job.stale && job.holder) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-[#FBF3E4] px-1.5 py-px text-[11px] font-medium text-[#8F6C1F] tabular-nums"
        title={`Stale: over the ${job.staleAfterDays}-day limit (${holderDeskLabel(job.holder)})`}
      >
        <AlertTriangle className="size-3" aria-hidden />
        {text}
      </span>
    );
  }
  return <span className="tabular-nums text-slate-700">{text}</span>;
}

function DeadlineCell({ job, today }: { job: CockpitJob; today: Date | null }) {
  if (!job.regulatoryDeadline) return <span className="text-slate-300">—</span>;
  const copy = deadlineCopyFor(job.type);
  const date = formatDeadlineDate(job.regulatoryDeadline, { year: false });
  const state = deadlineState({ isArchived: false, status: job.status, stage: job.stage });
  if (state !== "live") {
    return (
      <span
        className="tabular-nums text-slate-400"
        title={`${copy.label}: ${formatDeadlineDate(job.regulatoryDeadline)} · ${DEADLINE_STATE_LABEL[state]}`}
      >
        {date}
      </span>
    );
  }
  const daysOut = today ? daysFromToday(job.regulatoryDeadline, today) : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={copy.label}>
      <span className="tabular-nums whitespace-nowrap text-slate-700">{date}</span>
      {daysOut === null ? (
        <span className="text-slate-300">—</span>
      ) : (
        <span
          className={cn(
            "truncate rounded border px-1 py-px text-[10px] font-medium tabular-nums whitespace-nowrap",
            deadlineToneClass(deadlineBucket(daysOut))
          )}
        >
          {formatDaysOut(daysOut)}
        </span>
      )}
    </span>
  );
}

function StageCell({ job }: { job: CockpitJob }) {
  if (!job.pipelineId || job.stageIndex === null) {
    return (
      <span className="inline-flex rounded border border-dashed border-slate-300 px-1.5 py-px text-[10px] text-slate-400">
        Set stage
      </span>
    );
  }
  return (
    <div className="min-w-0">
      <p className="truncate text-[12px] text-slate-800">{job.stageLabel}</p>
      <StageRail
        pipelineId={job.pipelineId}
        stageIndex={job.stageIndex}
        className="mt-1 max-w-[140px]"
      />
    </div>
  );
}

function TasksCell({ job }: { job: CockpitJob }) {
  return (
    <span
      className="tabular-nums text-[12px] text-slate-600 whitespace-nowrap"
      title={`${job.openTasks} open · ${job.overdueTasks} overdue`}
    >
      {job.openTasks}
      <span className="text-slate-300"> · </span>
      <span className={job.overdueTasks > 0 ? "font-semibold text-red-600" : "text-slate-400"}>
        {job.overdueTasks}
      </span>
    </span>
  );
}

function JobRow({ job, today }: { job: CockpitJob; today: Date | null }) {
  const sub = [job.projectNumber, job.clientName].filter(Boolean).join(" · ");
  return (
    <li className="border-b border-[#e6e9ef] last:border-b-0">
      <Link
        href={`/projects/${job.id}`}
        className={cn(
          "group block px-3 py-2.5 hover:bg-slate-50 sm:px-4 lg:items-center lg:px-0 lg:py-0",
          ROW_GRID
        )}
      >
        {/* Job */}
        <div className="flex min-w-0 items-start gap-2 lg:px-4 lg:py-2.5">
          <span
            className="mt-1 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: job.color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[13px] font-medium text-black group-hover:underline">
                {job.name}
              </p>
              {job.type === "BSIP" && (
                <span className="shrink-0 rounded bg-[#8a7028]/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-[#6b5520]">
                  BSIP
                </span>
              )}
            </div>
            {sub && <p className="truncate text-[11px] text-slate-500">{sub}</p>}
            {job.blocker && (
              <p className="truncate text-[11px] text-[#8F6C1F]">
                Blocked · {job.blocker}
              </p>
            )}
          </div>
          {/* Mobile: the holder + dwell ride on the first line */}
          <div className="flex shrink-0 flex-col items-end gap-1 lg:hidden">
            <HolderPill holder={job.holder} />
            <DwellCell job={job} />
          </div>
        </div>

        {/* Mobile second line */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-[11px] lg:hidden">
          <span className="text-slate-700">
            {job.stageLabel ?? (
              <span className="text-slate-400">No stage set</span>
            )}
          </span>
          {job.regulatoryDeadline && <DeadlineCell job={job} today={today} />}
          <TasksCell job={job} />
        </div>

        {/* Desktop cells */}
        <div className="hidden min-w-0 px-3 py-2.5 lg:block">
          <StageCell job={job} />
        </div>
        <div className="hidden px-3 py-2.5 lg:block">
          <HolderPill holder={job.holder} />
        </div>
        <div className="hidden px-3 py-2.5 text-[12px] lg:block">
          <DwellCell job={job} />
        </div>
        <div className="hidden min-w-0 px-3 py-2.5 text-[12px] lg:block">
          <DeadlineCell job={job} today={today} />
        </div>
        <div className="hidden px-3 py-2.5 text-right lg:block">
          <TasksCell job={job} />
        </div>
      </Link>
    </li>
  );
}
