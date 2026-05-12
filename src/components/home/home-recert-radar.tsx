"use client";

/**
 * Recertification radar — engineering-specific tile that no generic
 * PM SaaS has. For a structural firm in NYC + Miami + CDMX + Bogotá,
 * recurring façade inspections, 40-year recerts, and permit renewals
 * are recurring revenue + recurring regulatory exposure.
 *
 * For V1 we use existing data: any project with type=RECERTIFICATION
 * or PERMIT, sorted by endDate ascending, surfaced if endDate falls
 * within the next 120 days. Future iterations can add a true
 * RegulatoryFiling schema with cycle dates, jurisdiction codes, etc.
 *
 * Color cue: <30 days = black (critical), 30-60 = deep gold (watch),
 * 60-120 = gold (upcoming).
 */

import Link from "next/link";
import { ShieldCheck, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CockpitProject } from "@/components/cockpit/types";

export function HomeRecertRadar({
  projects,
}: {
  projects: CockpitProject[];
}) {
  const now = new Date();
  const horizonDays = 120;
  const filtered = projects
    .filter((p) => p.type === "RECERTIFICATION" || p.type === "PERMIT")
    .filter((p) => p.endDate)
    .map((p) => {
      const end = new Date(p.endDate!);
      const days = Math.ceil(
        (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { p, days };
    })
    .filter(({ days }) => days <= horizonDays)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-black leading-tight">
            Recertification radar
          </h3>
          <p className="text-[11px] text-gray-500">
            Filings &amp; renewals due within {horizonDays} days
          </p>
        </div>
        <Link
          href="/projects/all"
          className="text-[11px] text-gray-500 hover:text-black inline-flex items-center gap-0.5"
        >
          All <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <ShieldCheck className="h-6 w-6 text-[#c9a84c]/60 mb-2" />
          <p className="text-sm text-gray-500 max-w-[260px]">
            Nothing on the radar in the next {horizonDays} days.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {filtered.map(({ p, days }) => {
            const tone: "critical" | "watch" | "upcoming" =
              days < 0
                ? "critical"
                : days < 30
                  ? "critical"
                  : days < 60
                    ? "watch"
                    : "upcoming";
            const toneColor =
              tone === "critical"
                ? "#0a0a0a"
                : tone === "watch"
                  ? "#a8893a"
                  : "#c9a84c";
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {days < 0 ? (
                      <AlertTriangle className="h-4 w-4 text-black" />
                    ) : (
                      <span
                        className="block w-2 h-2 rounded-full"
                        style={{ backgroundColor: toneColor }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-black truncate">
                      {p.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
                      <span>{p.type === "PERMIT" ? "Permit" : "Recert"}</span>
                      {p.location && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="truncate normal-case tracking-normal">
                            {p.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={cn(
                        "text-[12px] font-mono tabular-nums",
                        days < 30 ? "font-bold text-black" : "font-semibold"
                      )}
                      style={{
                        color: days < 30 ? "#0a0a0a" : toneColor,
                      }}
                    >
                      {days < 0
                        ? `${Math.abs(days)}d late`
                        : days === 0
                          ? "Today"
                          : `${days}d`}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono tabular-nums">
                      {new Date(p.endDate!).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
