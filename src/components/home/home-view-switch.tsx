"use client";

import { Building2, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type HomeView = "firm" | "mine";

/**
 * Home's two views: the Firm cockpit and the personal widget grid ("My
 * work"). A plain two-button toggle — each button carries aria-pressed and
 * keeps native focus and Tab order, so no tablist/roving tabindex is needed.
 */
export function HomeViewSwitch({
  value,
  onChange,
}: {
  value: HomeView;
  onChange: (view: HomeView) => void;
}) {
  const options: { id: HomeView; label: string; Icon: typeof Building2 }[] = [
    { id: "firm", label: "Firm", Icon: Building2 },
    { id: "mine", label: "My work", Icon: LayoutGrid },
  ];
  return (
    <div
      role="group"
      aria-label="Home view"
      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
    >
      {options.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) onChange(id);
            }}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a84c]",
              active
                ? "bg-white text-black shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
