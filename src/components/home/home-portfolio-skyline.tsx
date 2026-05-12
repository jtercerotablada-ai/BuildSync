"use client";

/**
 * Portfolio Skyline — every project rendered as a vertical bar (the
 * "building"), height = % completion, color = health, top notch =
 * current gate. Looking at the row reads like a structural firm's
 * city skyline — completely on-brand for Tercero Tablada's product.
 *
 * Interactions:
 *   - Hover a building → tooltip with project number, type, SPI, gate.
 *   - Click a building → navigate to the project detail page.
 *
 * Visual choices:
 *   - Monochrome gold for ON_TRACK / ACHIEVED, deep gold for AT_RISK,
 *     black for OFF_TRACK, gray for ON_HOLD / COMPLETE.
 *   - Building width is uniform so the row reads as a "city"; total
 *     width scales to fit the container, no horizontal scroll up to
 *     ~25 projects, then scrolls.
 *   - A faint baseline + a "ground line" anchor the buildings so the
 *     row feels architectural, not chart-y.
 *   - A "today line" of dashed gold runs across all bars at the
 *     average % planned (PV ratio) for the portfolio — a quick visual
 *     of "are we ahead or behind on average".
 *
 * SVG-only, no chart lib.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { computePmiSnapshot } from "@/lib/pmi-metrics";
import { cn } from "@/lib/utils";
import type { CockpitProject } from "@/components/cockpit/types";

const GATE_LABEL: Record<string, string> = {
  PRE_DESIGN: "Pre-design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

interface Building {
  p: CockpitProject;
  pct: number;
  pmi: ReturnType<typeof computePmiSnapshot>;
  color: string;
  textColor: string;
}

const BUILDING_HEIGHT = 140; // px of vertical real estate per building
const BUILDING_WIDTH = 24;
const BUILDING_GAP = 6;
const GROUND_BAR_HEIGHT = 4;

export function HomePortfolioSkyline({
  projects,
}: {
  projects: CockpitProject[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    b: Building;
  } | null>(null);

  const buildings: Building[] = useMemo(() => {
    return projects
      .map((p) => {
        const pmi = computePmiSnapshot({
          startDate: p.startDate,
          endDate: p.endDate,
          budget: p.budget,
          status: p.status,
          taskCount: p._count.tasks,
          completedTaskCount: 0,
        });
        const color =
          p.status === "OFF_TRACK"
            ? "#0a0a0a"
            : p.status === "AT_RISK"
              ? "#a8893a"
              : p.status === "ON_HOLD"
                ? "#666666"
                : p.status === "COMPLETE"
                  ? "#999999"
                  : "#c9a84c";
        const textColor = color === "#0a0a0a" ? "#c9a84c" : "#ffffff";
        return { p, pct: pmi.percentComplete, pmi, color, textColor };
      })
      .sort((a, b) => b.pct - a.pct); // tallest first
  }, [projects]);

  // The "today line" — average planned % across all dated projects.
  const avgPlanned = useMemo(() => {
    const planned = buildings
      .map((b) => b.pmi.percentPlanned)
      .filter((p) => p > 0);
    if (planned.length === 0) return null;
    return planned.reduce((a, b) => a + b, 0) / planned.length;
  }, [buildings]);

  const totalWidth =
    buildings.length * (BUILDING_WIDTH + BUILDING_GAP) - BUILDING_GAP;

  if (buildings.length === 0) {
    return (
      <div className="mx-4 md:mx-6 mb-3 border rounded-2xl bg-white px-4 py-6 text-center">
        <p className="text-sm text-gray-500">
          No projects to render — the skyline appears once you add some.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 md:mx-6 mb-3 border rounded-2xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-black">
            Portfolio skyline
          </h3>
          <p className="text-[11px] text-gray-500">
            Every project as a building. Height = % complete, color =
            health. Dashed gold = average planned %.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[10px] uppercase tracking-wider text-gray-500 font-medium">
          <Legend swatch="#c9a84c" label="On track" />
          <Legend swatch="#a8893a" label="At risk" />
          <Legend swatch="#0a0a0a" label="Off track" />
          <Legend swatch="#666666" label="Hold / done" />
        </div>
      </div>

      <div
        ref={ref}
        className="relative px-4 pt-4 pb-2 overflow-x-auto"
        onMouseLeave={() => setHover(null)}
      >
        <svg
          width={Math.max(totalWidth + 32, 400)}
          height={BUILDING_HEIGHT + 32}
          className="block"
        >
          {/* Ground bar (single gold line) */}
          <line
            x1={0}
            y1={BUILDING_HEIGHT + 4}
            x2={Math.max(totalWidth + 32, 400)}
            y2={BUILDING_HEIGHT + 4}
            stroke="#c9a84c"
            strokeWidth={1}
            opacity={0.4}
          />

          {/* "Today" planned line — dashed gold across the canvas */}
          {avgPlanned !== null && avgPlanned > 0 && avgPlanned < 100 && (
            <g>
              <line
                x1={0}
                y1={BUILDING_HEIGHT - (BUILDING_HEIGHT * avgPlanned) / 100}
                x2={Math.max(totalWidth + 32, 400)}
                y2={BUILDING_HEIGHT - (BUILDING_HEIGHT * avgPlanned) / 100}
                stroke="#c9a84c"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.55}
              />
              <text
                x={4}
                y={BUILDING_HEIGHT - (BUILDING_HEIGHT * avgPlanned) / 100 - 4}
                fontSize={9}
                fill="#a8893a"
                fontFamily="monospace"
                fontWeight={600}
              >
                avg planned {Math.round(avgPlanned)}%
              </text>
            </g>
          )}

          {/* Buildings */}
          {buildings.map((b, i) => {
            const x = i * (BUILDING_WIDTH + BUILDING_GAP);
            const h = Math.max(4, (BUILDING_HEIGHT * b.pct) / 100);
            const y = BUILDING_HEIGHT - h;
            const isCritical =
              b.pmi.floatDays !== null &&
              b.pmi.floatDays < 0 &&
              b.p.status !== "COMPLETE";
            return (
              <g
                key={b.p.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  const rect = (
                    e.currentTarget.parentNode as SVGElement
                  ).getBoundingClientRect();
                  setHover({
                    x: x + BUILDING_WIDTH / 2,
                    y,
                    b,
                  });
                }}
              >
                <Link href={`/projects/${b.p.id}`}>
                  {/* Building body */}
                  <rect
                    x={x}
                    y={y}
                    width={BUILDING_WIDTH}
                    height={h}
                    fill={b.color}
                    rx={2}
                    style={{
                      transition: "fill 200ms ease, opacity 200ms ease",
                    }}
                  />
                  {/* Critical-path notch — small gold crown on top */}
                  {isCritical && (
                    <rect
                      x={x}
                      y={y - 3}
                      width={BUILDING_WIDTH}
                      height={3}
                      fill="#c9a84c"
                    />
                  )}
                  {/* Subtle window pattern: 3 horizontal lines */}
                  {h > 30 && (
                    <>
                      <line
                        x1={x + 4}
                        y1={y + h * 0.3}
                        x2={x + BUILDING_WIDTH - 4}
                        y2={y + h * 0.3}
                        stroke={b.textColor}
                        strokeWidth={0.5}
                        opacity={0.25}
                      />
                      <line
                        x1={x + 4}
                        y1={y + h * 0.55}
                        x2={x + BUILDING_WIDTH - 4}
                        y2={y + h * 0.55}
                        stroke={b.textColor}
                        strokeWidth={0.5}
                        opacity={0.25}
                      />
                      <line
                        x1={x + 4}
                        y1={y + h * 0.8}
                        x2={x + BUILDING_WIDTH - 4}
                        y2={y + h * 0.8}
                        stroke={b.textColor}
                        strokeWidth={0.5}
                        opacity={0.25}
                      />
                    </>
                  )}
                  {/* Invisible hover target — slightly wider than building */}
                  <rect
                    x={x - 2}
                    y={0}
                    width={BUILDING_WIDTH + 4}
                    height={BUILDING_HEIGHT}
                    fill="transparent"
                  />
                </Link>
              </g>
            );
          })}
        </svg>

        {/* Hover card */}
        {hover && (
          <div
            className="absolute pointer-events-none border rounded-lg bg-white shadow-md px-3 py-2 z-10 min-w-[200px]"
            style={{
              left: Math.min(hover.x + 16, totalWidth - 200),
              top: 8,
            }}
          >
            <p className="text-[13px] font-semibold text-black truncate">
              {hover.b.p.name}
            </p>
            <p className="text-[10px] text-gray-500 font-mono tabular-nums">
              {hover.b.p.type ?? "—"}
              {hover.b.p.location ? ` · ${hover.b.p.location}` : ""}
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px]">
              <Stat label="% comp" value={`${hover.b.pct}%`} />
              <Stat
                label="SPI"
                value={
                  hover.b.pmi.spi > 0 ? hover.b.pmi.spi.toFixed(2) : "—"
                }
              />
              <Stat
                label="Gate"
                value={hover.b.p.gate ? GATE_LABEL[hover.b.p.gate] : "—"}
              />
              <Stat
                label="Float"
                value={
                  hover.b.pmi.floatDays === null
                    ? "—"
                    : hover.b.pmi.floatDays < 0
                      ? `-${Math.abs(hover.b.pmi.floatDays)}d`
                      : `${hover.b.pmi.floatDays}d`
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="block w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: swatch }}
      />
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p
        className={cn(
          "text-[11px] font-mono tabular-nums text-gray-700 truncate"
        )}
      >
        {value}
      </p>
    </div>
  );
}
