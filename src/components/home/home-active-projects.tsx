"use client";

/**
 * Active projects — Asana shows a "Recientes" list of project names.
 * We render each project with the same PMI metadata that drives
 * /projects/all: SPI, % complete, health pill, current gate, next
 * milestone (if there is one in the upcoming 14 days).
 *
 * Sort: AT_RISK / OFF_TRACK first (pull the eye), then by SPI ascending
 * (worst first within healthy bucket). Capped at 5 — "View all" link
 * jumps to /projects/all.
 */

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computePmiSnapshot,
  formatIndex,
  healthVisual,
} from "@/lib/pmi-metrics";
import type { CockpitData, CockpitProject } from "@/components/cockpit/types";

const GATE_LABEL: Record<string, string> = {
  PRE_DESIGN: "Pre-design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

export function HomeActiveProjects({
  projects,
}: {
  projects: CockpitData["projects"];
}) {
  // Enrich with PMI snapshot for sorting + display
  const enriched = projects.map((p) => ({
    p,
    pmi: computePmiSnapshot({
      startDate: p.startDate,
      endDate: p.endDate,
      budget: p.budget,
      status: p.status,
      taskCount: p._count.tasks,
      completedTaskCount: 0, // CockpitData doesn't return completed count
    }),
  }));

  const sorted = enriched.sort((a, b) => {
    const order = (s: string) => {
      if (s === "OFF_TRACK") return 0;
      if (s === "AT_RISK") return 1;
      return 2;
    };
    const o = order(a.p.status) - order(b.p.status);
    if (o !== 0) return o;
    return (a.pmi.spi || 1) - (b.pmi.spi || 1);
  });

  const top = sorted.slice(0, 5);

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-black leading-tight">
            Active projects
          </h3>
          <p className="text-[11px] text-gray-500">
            {projects.length} total · sorted by attention need
          </p>
        </div>
        <Link
          href="/projects/all"
          className="text-[11px] text-gray-500 hover:text-black inline-flex items-center gap-0.5"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="divide-y">
        {top.map(({ p, pmi }) => (
          <ProjectRow key={p.id} project={p} pmi={pmi} />
        ))}
        {top.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-gray-400">
            No projects yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function ProjectRow({
  project: p,
  pmi,
}: {
  project: CockpitProject;
  pmi: ReturnType<typeof computePmiSnapshot>;
}) {
  const hv = healthVisual(pmi.health);
  const overdue =
    pmi.floatDays !== null &&
    pmi.floatDays < 0 &&
    p.status !== "COMPLETE";

  return (
    <li>
      <Link
        href={`/projects/${p.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
      >
        <div
          className="w-1.5 h-10 rounded-sm flex-shrink-0"
          style={{ backgroundColor: p.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[13px] font-medium text-black truncate group-hover:underline">
              {p.name}
            </p>
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
              style={{ backgroundColor: hv.hex, color: hv.textHex }}
            >
              {overdue && "▲ "}
              {hv.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
            <span className="font-mono tabular-nums">
              {pmi.percentComplete}%
            </span>
            <span className="text-gray-300">·</span>
            <span className="font-mono tabular-nums">
              SPI {formatIndex(pmi.spi)}
            </span>
            {p.gate && (
              <>
                <span className="text-gray-300">·</span>
                <span className="truncate">{GATE_LABEL[p.gate] ?? p.gate}</span>
              </>
            )}
            {p.location && (
              <>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-0.5 truncate max-w-[120px]">
                  <MapPin className="h-2.5 w-2.5" />
                  <span className="truncate">{p.location}</span>
                </span>
              </>
            )}
          </div>
          <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full",
                pmi.health === "OFF_TRACK"
                  ? "bg-black"
                  : pmi.health === "AT_RISK"
                    ? "bg-[#a8893a]"
                    : "bg-[#c9a84c]"
              )}
              style={{ width: `${pmi.percentComplete}%` }}
            />
          </div>
        </div>
        {p.owner && (
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarImage src={p.owner.image || undefined} />
            <AvatarFallback className="bg-[#c9a84c] text-white text-[10px]">
              {(p.owner.name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </Link>
    </li>
  );
}
