"use client";

import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { holderLabel, type StageHolder } from "@/lib/pipelines";
import { cn } from "@/lib/utils";
import { HOLDER_PILL_CLASS } from "./holder-style";

/** Small shared pieces of the Firm view. Presentational only. */

export function HolderPill({
  holder,
  className,
}: {
  holder: StageHolder | null;
  className?: string;
}) {
  if (!holder) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded border border-dashed border-slate-300 px-1.5 py-px text-[10px] font-medium text-slate-400 whitespace-nowrap",
          className
        )}
      >
        No stage
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px text-[10px] font-medium whitespace-nowrap",
        HOLDER_PILL_CLASS[holder],
        className
      )}
    >
      {holderLabel(holder)}
    </span>
  );
}

/** A white card with a title row, used by every aside panel. */
export function CockpitCard({
  id,
  title,
  subtitle,
  right,
  children,
  className,
}: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className={cn(
        "scroll-mt-4 rounded-lg border border-[#e6e9ef] bg-white",
        className
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-[#e6e9ef] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-black">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function PersonAvatar({
  name,
  image,
  className,
}: {
  name: string | null;
  image: string | null;
  className?: string;
}) {
  const initials =
    (name ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join("") || "?";
  return (
    <Avatar className={cn("size-6", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className="bg-slate-200 text-[10px] font-semibold text-slate-600">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

/** "3h ago" / "2d ago", measured against a fixed reference (the payload's
 *  generatedAt) so the render never reads the clock. */
export function relativeFrom(value: string, reference: string): string {
  const diff = new Date(reference).getTime() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "";
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

/** Smooth-scroll to an anchor on the Firm view. */
export function scrollToId(id: string) {
  if (typeof document === "undefined") return;
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
