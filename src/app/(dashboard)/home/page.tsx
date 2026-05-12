"use client";

/**
 * /home — Pro Asana-style tile dashboard, 10× upgraded for an
 * engineering firm.
 *
 * Layout mirrors Asana's home (greeting + period + KPI strip,
 * then a grid of tiles: tasks delegated, projects, people, my
 * tasks) but every tile carries engineering / PMI weight that no
 * generic productivity tool exposes:
 *
 *   - AI Brief        — 2-4 deterministic lines summarizing what
 *                       matters across the portfolio
 *   - Priority Queue  — overdue + due-today critical-path tasks,
 *                       urgency-sorted
 *   - Active Projects — SPI / Health pill / current gate per row
 *   - People          — capacity bars normalized to peak load
 *   - Upcoming Milestones — 14-day strip, grouped by day
 *   - Recertification Radar — NYC LL11 / Miami 40-yr / Permits
 *                       due in the next 120 days (engineering-only)
 *   - Goals snapshot  — top OKRs with progress + owner confidence
 *   - Recent activity — chronological feed
 *
 * Single data source: /api/dashboard/ceo (the same CockpitData
 * we've been using). Goals tile fetches /api/objectives separately.
 */

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import type { CockpitData } from "@/components/cockpit/types";
import { computePmiSnapshot } from "@/lib/pmi-metrics";
import {
  HomeHeader,
  type HomePeriod,
} from "@/components/home/home-header";
import { HomeAIBrief } from "@/components/home/home-ai-brief";
import { HomePriorityQueue } from "@/components/home/home-priority-queue";
import { HomeActiveProjects } from "@/components/home/home-active-projects";
import { HomeTeamCapacity } from "@/components/home/home-team-capacity";
import { HomeRecertRadar } from "@/components/home/home-recert-radar";
import { HomeUpcomingMilestones } from "@/components/home/home-upcoming-milestones";
import { HomeGoalsSnapshot } from "@/components/home/home-goals-snapshot";
import { HomeRecentActivity } from "@/components/home/home-recent-activity";

const PERIOD_STORAGE_KEY = "home.period";

export default function HomePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<CockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<HomePeriod>("week");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(PERIOD_STORAGE_KEY) as HomePeriod | null;
    if (
      stored &&
      ["today", "week", "next14", "lookahead3w", "quarter"].includes(stored)
    ) {
      setPeriod(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PERIOD_STORAGE_KEY, period);
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/dashboard/ceo", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CockpitData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived stats for the header strip ─────────────────────────
  const stats = useMemo(() => {
    if (!data) {
      return { closed: 0, overdue: 0, avgSpi: 0, velocity: 0 };
    }
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const closed = data.activity.filter(
      (a) => a.completedAt && new Date(a.completedAt) >= weekAgo
    ).length;
    const overdue = data.criticalPath.filter(
      (t) => new Date(t.dueDate) < now
    ).length;

    // Avg SPI across projects that have schedule + budget data
    const spis = data.projects
      .map((p) =>
        computePmiSnapshot({
          startDate: p.startDate,
          endDate: p.endDate,
          budget: p.budget,
          status: p.status,
          taskCount: p._count.tasks,
          completedTaskCount: 0,
        }).spi
      )
      .filter((s) => s > 0);
    const avgSpi =
      spis.length > 0 ? spis.reduce((a, b) => a + b, 0) / spis.length : 0;

    const velocity = closed; // tasks closed in last 7 days
    return { closed, overdue, avgSpi, velocity };
  }, [data]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center px-6">
        <h2 className="text-lg font-semibold text-black">
          Couldn&rsquo;t load home
        </h2>
        <p className="text-sm text-gray-500 max-w-md">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-auto">
      <HomeHeader
        userName={session?.user?.name}
        period={period}
        onPeriodChange={setPeriod}
        closedThisWeek={stats.closed}
        overdueCount={stats.overdue}
        avgSpi={stats.avgSpi}
        velocityWeekly={stats.velocity}
      />

      <HomeAIBrief data={data} />

      {/* Main 2-column grid on desktop. Each row is a pair of tiles. */}
      <div className="px-4 md:px-6 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <HomePriorityQueue criticalTasks={data.criticalPath} />
        <HomeActiveProjects projects={data.projects} />

        <HomeTeamCapacity members={data.team} />
        <HomeUpcomingMilestones tasks={data.criticalPath} />

        <HomeRecertRadar projects={data.projects} />
        <HomeGoalsSnapshot />

        {/* Activity spans the full width — long horizontal feed reads
            better than two narrow lists. */}
        <div className="lg:col-span-2">
          <HomeRecentActivity items={data.activity} />
        </div>
      </div>
    </div>
  );
}
