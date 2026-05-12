"use client";

/**
 * Vitals — four Apple Watch-style activity rings that capture the
 * health of the portfolio at a glance.
 *
 * One ring per discipline:
 *   1. Schedule  — Avg SPI across active projects (1.0 = full ring)
 *   2. Velocity  — Closed tasks last 7 days vs trailing 30-day pace
 *                  (>= 1.0 = at pace, >= 1.2 = excellent)
 *   3. Compliance — % of next-90-day compliance deadlines on track
 *                   (no projects in negative-float window)
 *   4. Capacity  — Team utilization 0-100 (peak = 100). Inverted hue
 *                   when > 90% (overloaded = bold black).
 *
 * Each ring fills with a CSS stroke animation on mount, the center
 * number counts up from 0, and a small delta arrow shows movement
 * vs last week when we have the data.
 *
 * SVG only — no Recharts dependency, no framer-motion. CSS keyframes
 * handle the entrance animation.
 */

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VitalRing {
  id: string;
  label: string;
  /** 0-1 fill ratio. */
  value: number;
  /** Display text in the ring center (the count-up animates to it). */
  display: string;
  /** Secondary line under display (e.g. "vs baseline 0.95"). */
  sublabel?: string;
  /** Optional week-over-week delta. */
  delta?: { value: number; suffix: string };
  /** Override fill color (defaults to gold). Pass black for critical. */
  color?: string;
  /** Inner emoji/icon optional. */
  emphasis?: "good" | "warn" | "bad";
}

export function HomeVitalsRings({ rings }: { rings: VitalRing[] }) {
  return (
    <div className="px-4 md:px-6 pt-2 pb-1">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {rings.map((r) => (
          <VitalRingCard key={r.id} ring={r} />
        ))}
      </div>
    </div>
  );
}

function VitalRingCard({ ring }: { ring: VitalRing }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Trigger the stroke + count-up animation one frame after mount.
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const size = 96;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, ring.value)));

  const color =
    ring.color ??
    (ring.emphasis === "bad"
      ? "#0a0a0a"
      : ring.emphasis === "warn"
        ? "#a8893a"
        : "#c9a84c");

  return (
    <div className="bg-white border rounded-2xl p-3 md:p-4 flex items-center gap-3 md:gap-4 group hover:shadow-md transition-shadow">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {/* Track (background ring) */}
        <svg
          width={size}
          height={size}
          className="-rotate-90 absolute inset-0"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f3f3f3"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? offset : circumference}
            style={{
              transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </svg>
        {/* Center value (count-up) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg md:text-xl font-mono tabular-nums font-semibold"
            style={{ color }}
          >
            {ring.display}
          </span>
          {ring.delta && (
            <span
              className={cn(
                "text-[9px] font-medium flex items-center gap-0.5 mt-0.5 tabular-nums",
                ring.delta.value > 0
                  ? "text-[#c9a84c]"
                  : ring.delta.value < 0
                    ? "text-black"
                    : "text-gray-400"
              )}
            >
              {ring.delta.value > 0 ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : ring.delta.value < 0 ? (
                <TrendingDown className="h-2.5 w-2.5" />
              ) : (
                <Minus className="h-2.5 w-2.5" />
              )}
              {Math.abs(ring.delta.value).toFixed(0)}
              {ring.delta.suffix}
            </span>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {ring.label}
        </p>
        {ring.sublabel && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            {ring.sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
