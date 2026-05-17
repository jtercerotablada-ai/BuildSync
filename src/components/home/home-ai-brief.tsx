"use client";

/**
 * Home AI brief — a 2-3 line summary of "what matters right now"
 * across the user's portfolio.
 *
 * V1 (this version) is purely deterministic — computed from the
 * /api/dashboard/ceo payload using simple heuristics so we don't
 * burn LLM tokens on every Home load. The output reads natural
 * enough that a casual user can't tell it isn't an LLM.
 *
 * V2 (later, gated by a refresh button) will swap to a real call to
 * /api/ai/coach that synthesizes the same data narratively. The
 * line format is identical so the UI doesn't change.
 *
 * Rules of the heuristic:
 *   1. Lead with the most "pull-the-eye" thing:
 *        - PE stamp queue (once Day 2 ships)
 *        - Overdue critical-path tasks
 *        - Projects with SPI < 0.9 ("watch")
 *   2. Follow with the next 1-2 items in priority order.
 *   3. End with a concrete deadline if one falls inside 7 days.
 */

import { Sparkles } from "lucide-react";
import { computePmiSnapshot } from "@/lib/pmi-metrics";
import type { CockpitData } from "@/components/cockpit/types";

export function HomeAIBrief({ data }: { data: CockpitData }) {
  const lines = buildBrief(data);

  return (
    <div className="h-full flex flex-col border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-[#c9a84c]/5 via-white to-white flex items-center gap-2 flex-shrink-0 pr-12">
        <Sparkles className="h-4 w-4 text-[#c9a84c]" />
        <h3 className="text-sm font-semibold text-black">Brief</h3>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
          heuristic · today
        </span>
        {/* The Refresh button used to live here but was permanently
            disabled with a "available after Day 4" tooltip. Removed
            until a real /api/ai/coach call is wired — the brief
            refreshes naturally on every Home page load anyway. */}
      </div>
      <ul className="px-4 py-3 space-y-1.5 flex-1 overflow-y-auto">
        {lines.map((line, i) => (
          <li
            key={i}
            className="text-[13px] text-gray-700 leading-relaxed flex items-start gap-2"
          >
            <span className="text-[#c9a84c] mt-1 flex-shrink-0">▪</span>
            <span dangerouslySetInnerHTML={{ __html: line }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Build 2-4 brief lines from CockpitData using deterministic rules.
 */
function buildBrief(data: CockpitData): string[] {
  const lines: string[] = [];
  const now = new Date();

  // ── Line 1: most urgent thing ────────────────────────────────
  if (data.kpis.pendingSignatures > 0) {
    lines.push(
      `<strong>${data.kpis.pendingSignatures} document${data.kpis.pendingSignatures === 1 ? "" : "s"}</strong> await${data.kpis.pendingSignatures === 1 ? "s" : ""} your stamp.`
    );
  }
  const overdue = data.criticalPath.filter(
    (t) => new Date(t.dueDate) < now
  );
  if (overdue.length > 0) {
    lines.push(
      `<strong>${overdue.length} critical-path task${overdue.length === 1 ? "" : "s"} overdue</strong>${overdue[0] ? ` (oldest: "${escapeHtml(overdue[0].name)}" on ${escapeHtml(overdue[0].project.name)}).` : "."}`
    );
  }

  // ── Line 2-3: project health alerts ───────────────────────────
  const watchProjects = data.projects
    .map((p) => {
      const totalTasks = p._count.tasks;
      // Real EV → SPI computation using the per-project completed
      // count now returned by /api/dashboard/ceo. Replaces the
      // earlier zero-stub that collapsed SPI for every project.
      const pmi = computePmiSnapshot({
        startDate: p.startDate,
        endDate: p.endDate,
        budget: p.budget,
        status: p.status,
        taskCount: totalTasks,
        completedTaskCount: p._count.completedTasks,
      });
      return { p, pmi };
    })
    .filter(({ p, pmi }) => {
      // Project in trouble: SPI computed < 0.9 OR explicit AT_RISK / OFF_TRACK
      if (p.status === "AT_RISK" || p.status === "OFF_TRACK") return true;
      return pmi.spi > 0 && pmi.spi < 0.9;
    })
    .slice(0, 2);

  for (const { p, pmi } of watchProjects) {
    const reason = pmi.spi > 0 && pmi.spi < 0.9 ? `SPI ${pmi.spi.toFixed(2)}` : p.status.replace("_", " ").toLowerCase();
    lines.push(
      `<strong>${escapeHtml(p.name)}</strong> needs attention — ${reason}.`
    );
  }

  // ── Line N: compliance deadline within 14 days ───────────────
  const soonestCompliance = [...data.compliance]
    .filter((p) => p.endDate)
    .sort(
      (a, b) =>
        new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime()
    )[0];
  if (soonestCompliance) {
    const days = Math.ceil(
      (new Date(soonestCompliance.endDate!).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (days >= 0 && days <= 14) {
      lines.push(
        `<strong>${escapeHtml(soonestCompliance.name)}</strong> deadline in <strong>${days} day${days === 1 ? "" : "s"}</strong>.`
      );
    }
  }

  // ── Fallback when there's literally nothing to flag ──────────
  if (lines.length === 0) {
    lines.push(
      "Portfolio is healthy. No overdue work, no projects on watch, no near-term compliance deadlines."
    );
  }

  return lines.slice(0, 4);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
