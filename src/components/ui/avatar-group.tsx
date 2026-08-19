"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * AvatarGroup — stacks N avatars with overlap, shows +M overflow.
 * Replaces the per-cell people rendering in custom-field-cell.tsx
 * (PEOPLE field) and standardizes how Collaborators are shown in
 * task rows, project headers, and team cards.
 *
 * Items receive their own initials/colors; if image is provided
 * it renders, otherwise fallback initials.
 */

export interface AvatarGroupItem {
  id: string;
  name: string;
  image?: string | null;
  /** Hex color for fallback bg. Defaults to a stable hash-based color. */
  color?: string;
}

const SIZE_MAP = {
  xs: { box: "size-5", text: "text-[9px]" },
  sm: { box: "size-6", text: "text-[10px]" },
  md: { box: "size-7", text: "text-[11px]" },
  lg: { box: "size-8", text: "text-[12px]" },
} as const;

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  items: AvatarGroupItem[];
  /** How many avatars to show before collapsing into +N. Default 3. */
  max?: number;
  size?: keyof typeof SIZE_MAP;
  /** Reverse stacking order (default: rightmost on top). */
  reverse?: boolean;
}

/** Deterministic color from a string — gives every avatar a stable
 *  background even when no color is provided by the data layer. */
function hashColor(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  const palette = [
    "#4f46e5", // indigo
    "#0891b2", // cyan
    "#059669", // emerald
    "#d97706", // amber
    "#dc2626", // red
    "#7c3aed", // violet
    "#0284c7", // sky
    "#9333ea", // purple
  ];
  return palette[Math.abs(h) % palette.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AvatarGroup({
  items,
  max = 3,
  size = "md",
  reverse = false,
  className,
  ...props
}: AvatarGroupProps) {
  const visible = items.slice(0, max);
  const overflow = items.length - max;
  const sz = SIZE_MAP[size];

  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "flex items-center",
        // Negative spacing so avatars overlap. The overlap amount
        // scales with size so very small avatars still read as
        // distinct chips.
        size === "xs" || size === "sm" ? "-space-x-1.5" : "-space-x-2",
        reverse && "flex-row-reverse",
        className
      )}
      {...props}
    >
      {visible.map((it, idx) => {
        const bg = it.color ?? hashColor(it.id || it.name);
        return (
          <Avatar
            key={it.id}
            className={cn(
              sz.box,
              "ring-2 ring-white",
              // Stack order: each later avatar sits on top of the
              // previous one. Reverse mode inverts so the first
              // item is on top.
              reverse ? "" : ""
            )}
            style={{ zIndex: reverse ? idx : visible.length - idx }}
            title={it.name}
          >
            {it.image ? (
              <AvatarImage src={it.image} alt={it.name} />
            ) : null}
            <AvatarFallback
              className={cn(sz.text, "text-white font-medium")}
              style={{ backgroundColor: bg }}
            >
              {getInitials(it.name)}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {overflow > 0 && (
        <Avatar
          className={cn(sz.box, "ring-2 ring-white")}
          style={{ zIndex: 0 }}
          title={`${overflow} more`}
        >
          <AvatarFallback
            className={cn(sz.text, "bg-gray-200 text-gray-700 font-medium")}
          >
            +{overflow}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
