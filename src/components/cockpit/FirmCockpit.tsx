"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FolderPlus, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useToday } from "@/lib/use-today";
import { toDateOnlyISO } from "@/lib/date-only";
import { formatDeadlineDate } from "@/lib/regulatory";
import { openCreateProjectGallery } from "@/lib/open-create-project";
import type { PipelineId, StageHolder } from "@/lib/pipelines";
import {
  holderTotals,
  upcomingDeadlines,
  waitingSubline,
  type CockpitPayload,
} from "@/lib/cockpit";
import { cn } from "@/lib/utils";
import { scrollToId } from "./bits";
import { HolderBar } from "./HolderBar";
import {
  EMPTY_FILTERS,
  PipelineBoard,
  type BoardFilters,
  type HolderFilter,
} from "./PipelineBoard";
import { PeSignQueue } from "./PeSignQueue";
import { DeadlinesPanel } from "./DeadlinesPanel";
import { OverdueByPerson } from "./OverdueByPerson";
import { HeroMap } from "./HeroMap";
import { StageMoves } from "./StageMoves";

/**
 * The Firm view on /home: every active job the viewer can see, by pipeline
 * stage and by whose desk it is on, plus the seal queue, the regulatory
 * deadlines, overdue work by person, a map and the last stage moves.
 *
 * Read-only. One request (GET /api/dashboard/ceo?today=…), sent once the
 * viewer's own calendar day is known (useToday()), again when that day
 * changes, and when the tab comes back after more than a minute away.
 * Filters are local and ephemeral on purpose.
 */

const REFRESH_AFTER_MS = 60_000;

type LoadState = "loading" | "ready" | "error";

export function FirmCockpit({ onGoToMine }: { onGoToMine: () => void }) {
  const today = useToday();
  const [data, setData] = useState<CockpitPayload | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const loadedAt = useRef(0);
  const todayRef = useRef<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasData = useRef(false);
  useEffect(() => {
    todayRef.current = today;
  }, [today]);

  const load = useCallback(async (day: Date) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const silent = hasData.current;
    if (silent) setRefreshing(true);
    else setState("loading");
    try {
      const res = await fetch(
        `/api/dashboard/ceo?today=${toDateOnlyISO(day)}`,
        { cache: "no-store", signal: ctrl.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CockpitPayload;
      if (ctrl.signal.aborted) return;
      hasData.current = true;
      loadedAt.current = Date.now();
      setData(json);
      setState("ready");
    } catch (e) {
      if (ctrl.signal.aborted || (e instanceof DOMException && e.name === "AbortError"))
        return;
      if (silent) {
        toast.error("Couldn't refresh the firm view. Showing the last data.");
      } else {
        setState("error");
      }
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  // First load, and again when the calendar day changes ("overdue" moves).
  useEffect(() => {
    if (today) void load(today);
  }, [today, load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const day = todayRef.current;
      if (!day || abortRef.current) return;
      if (Date.now() - loadedAt.current > REFRESH_AFTER_MS) void load(day);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  const totals = useMemo(() => holderTotals(jobs), [jobs]);
  const deadlines30 = useMemo(
    () => (today ? upcomingDeadlines(jobs, today, 30) : null),
    [jobs, today]
  );

  if (state === "loading" && !data) return <CockpitSkeleton />;

  if (state === "error" && !data) {
    return (
      <div className="px-4 pb-12 md:px-6">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-[#e6e9ef] bg-white px-6 py-12 text-center">
          <AlertTriangle className="size-6 text-slate-400" aria-hidden />
          <div>
            <p className="text-[14px] font-medium text-black">
              Couldn&apos;t load the firm view.
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Your personal widgets still work under My work.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!today}
              onClick={() => today && void load(today)}
            >
              <RotateCw className="size-3.5" /> Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={onGoToMine}>
              Go to My work
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <CockpitSkeleton />;

  if (jobs.length === 0) {
    return (
      <div className="px-4 pb-12 md:px-6">
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-[#e6e9ef] bg-white/70 px-6 py-14 text-center">
          <FolderPlus className="size-6 text-slate-400" aria-hidden />
          <div className="max-w-md">
            <p className="text-[14px] font-medium text-black">No active jobs yet</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Create a recertification, BSIP, design, permit or construction
              job. It shows up here with its stage, whose desk it&apos;s on and
              for how long.
            </p>
            {!data.viewer.isManager && (
              <p className="mt-1 text-[12px] text-slate-500">
                You&apos;ll also see jobs other people share with you.
              </p>
            )}
            {data.finishedLast30Days > 0 && (
              <p className="mt-2 text-[12px] text-slate-600">
                {data.finishedLast30Days}{" "}
                {data.finishedLast30Days === 1 ? "job" : "jobs"} finished in the
                last 30 days.
              </p>
            )}
          </div>
          {data.viewer.isContributor && (
            <Button size="sm" onClick={() => openCreateProjectGallery()}>
              New project
            </Button>
          )}
        </div>
      </div>
    );
  }

  const peJobs = jobs.filter((j) => j.holder === "PE").length;
  const staleCount = jobs.filter((j) => j.stale).length;
  const overduePeople = data.overdue.people.filter((p) => p.count > 0).length;

  const toggleHolder = (h: HolderFilter) => {
    setFilters((f) => ({ ...f, holder: f.holder === h ? null : h, stage: null }));
    scrollToBoardOnNarrow();
  };

  let deadlineSub = "—";
  if (deadlines30) {
    const past = deadlines30.filter((r) => r.daysOut < 0).length;
    const next = deadlines30.find((r) => r.daysOut >= 0);
    deadlineSub =
      past > 0
        ? `${past} already past`
        : next
          ? `Next: ${formatDeadlineDate(next.job.regulatoryDeadline!, { year: false })}`
          : "None set";
  }

  const oursSub = [
    totals.byHolder.FIRM ? `Us ${totals.byHolder.FIRM}` : null,
    totals.byHolder.PE ? `The PE ${totals.byHolder.PE}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4 px-4 pb-12 md:px-6">
      {/* Attention tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        <Tile
          label="On our desk"
          value={totals.ours}
          sub={oursSub}
          pressed={filters.holder === "OURS"}
          onClick={() => toggleHolder("OURS")}
        />
        <Tile
          label="Waiting on others"
          value={totals.others}
          sub={waitingSubline(totals.byHolder)}
          pressed={filters.holder === "OTHERS"}
          onClick={() => toggleHolder("OTHERS")}
        />
        <Tile
          label="Stale"
          value={staleCount}
          sub="Past their desk limit"
          pressed={filters.staleOnly}
          onClick={() => {
            setFilters((f) => ({ ...f, staleOnly: !f.staleOnly }));
            scrollToBoardOnNarrow();
          }}
        />
        <Tile
          label="P.E. sign queue"
          value={peJobs + data.peQueue.taskCount}
          sub={`${peJobs} ${peJobs === 1 ? "job" : "jobs"} · ${data.peQueue.taskCount} ${data.peQueue.taskCount === 1 ? "approval" : "approvals"}`}
          onClick={() => scrollToId("pe-queue")}
        />
        <Tile
          label="Deadlines in 30 days"
          value={deadlines30 ? deadlines30.length : null}
          sub={deadlineSub}
          onClick={() => scrollToId("deadlines")}
        />
        <Tile
          label="Overdue tasks"
          value={data.overdue.totalCount}
          sub={`${overduePeople} ${overduePeople === 1 ? "person" : "people"}`}
          onClick={() => scrollToId("overdue")}
          danger
        />
      </div>

      <HolderBar
        totals={totals}
        activeHolder={
          filters.holder && filters.holder !== "OURS" && filters.holder !== "OTHERS"
            ? (filters.holder as StageHolder)
            : null
        }
        activeNoStage={
          filters.stage?.startsWith("none:")
            ? (filters.stage.slice(5) as PipelineId)
            : null
        }
        onHolder={(h) => toggleHolder(h)}
        onNoType={() => {
          setFilters(EMPTY_FILTERS);
          requestAnimationFrame(() => scrollToId("unstaged"));
        }}
        onNoStage={(p) => {
          const key = `none:${p}`;
          setFilters(
            filters.stage === key ? EMPTY_FILTERS : { ...EMPTY_FILTERS, stage: key }
          );
          requestAnimationFrame(() => scrollToId("pipeline-board"));
        }}
      />

      {data.truncated && (
        <p className="text-[12px] text-slate-500">
          Showing the 300 most recently updated jobs.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div id="pipeline-board" className="min-w-0 scroll-mt-4">
          <PipelineBoard
            jobs={jobs}
            filters={filters}
            onFiltersChange={setFilters}
            today={today}
          />
        </div>
        <aside className="order-first min-w-0 space-y-4 xl:order-none">
          <PeSignQueue
            jobs={jobs}
            peQueue={data.peQueue}
            isPe={data.viewer.isPe}
            today={today}
          />
          <DeadlinesPanel jobs={jobs} today={today} />
          <OverdueByPerson
            overdue={data.overdue}
            isManager={data.viewer.isManager}
            today={today}
          />
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <HeroMap jobs={jobs} />
        <StageMoves moves={data.moves} generatedAt={data.generatedAt} />
      </div>

      {refreshing && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400" aria-live="polite">
          <Loader2 className="size-3 animate-spin" /> Refreshing…
        </p>
      )}
    </div>
  );
}

function scrollToBoardOnNarrow() {
  if (typeof window === "undefined") return;
  // Below xl the aside sits above the board, so a filter set from a tile
  // would otherwise change something off-screen.
  if (window.matchMedia("(max-width: 1279px)").matches) {
    requestAnimationFrame(() => scrollToId("pipeline-board"));
  }
}

function Tile({
  label,
  value,
  sub,
  pressed,
  onClick,
  danger,
}: {
  label: string;
  value: number | null;
  sub: string;
  /** Present only on tiles that filter. */
  pressed?: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  const zero = value === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed === undefined ? undefined : pressed}
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-[#e6e9ef] bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50",
        pressed && "ring-2 ring-[#c9a84c]"
      )}
    >
      <span className="truncate text-[11px] font-medium text-slate-500">
        {label}
      </span>
      <span
        className={cn(
          "text-[22px] font-semibold leading-tight tabular-nums",
          value === null || zero
            ? "text-slate-300"
            : danger
              ? "text-red-600"
              : "text-black"
        )}
      >
        {value === null ? "—" : value}
      </span>
      <span className="truncate text-[11px] text-slate-500">{sub || " "}</span>
    </button>
  );
}

function CockpitSkeleton() {
  return (
    <div className="space-y-4 px-4 pb-12 md:px-6" aria-busy="true" aria-label="Loading the firm view">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
      <div className="h-[72px] animate-pulse rounded-lg bg-slate-100" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="order-first space-y-4 xl:order-none">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
