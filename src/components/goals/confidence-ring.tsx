"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Confidence ring — circular 1-10 indicator with click-to-edit.
 *
 * Monochrome + gold palette only:
 *   - score 8-10  → gold #c9a84c
 *   - score 5-7   → mid gold #a8893a
 *   - score 1-4   → black
 *   - null/0      → gray
 *
 * Renders as an SVG ring. The center number is the score; the
 * surrounding stroke fills proportionally (score/10).
 *
 * On click, opens a small inline picker (1-10 dots) and calls
 * `onChange(newScore)`. Parent owns the PATCH.
 */
export function ConfidenceRing({
  score,
  onChange,
  size = 88,
  readOnly = false,
}: {
  score: number | null;
  onChange?: (next: number) => void | Promise<void>;
  size?: number;
  readOnly?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const safeScore = score && score >= 1 && score <= 10 ? score : null;
  const strokeColor = !safeScore
    ? "#d4d4d4"
    : safeScore >= 8
      ? "#c9a84c"
      : safeScore >= 5
        ? "#a8893a"
        : "#0a0a0a";

  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (safeScore ?? 0) / 10);

  async function pick(value: number) {
    if (!onChange) return;
    setSaving(true);
    try {
      await onChange(value);
      setPickerOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => !readOnly && setPickerOpen((v) => !v)}
        disabled={readOnly}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full",
          !readOnly && "cursor-pointer hover:opacity-90 transition-opacity"
        )}
        style={{ width: size, height: size }}
        aria-label={
          safeScore
            ? `Confidence ${safeScore} of 10. Click to edit.`
            : "Set confidence score"
        }
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f0f0f0"
            strokeWidth={5}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 300ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-semibold leading-none"
            style={{ color: strokeColor }}
          >
            {safeScore ?? "—"}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">
            /10
          </span>
        </div>
      </button>

      {pickerOpen && !readOnly && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 bg-white border rounded-lg shadow-lg p-2 flex items-center gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => pick(n)}
              className={cn(
                "w-6 h-6 rounded text-xs font-medium transition-colors",
                n === safeScore
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
              aria-label={`Set confidence to ${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
