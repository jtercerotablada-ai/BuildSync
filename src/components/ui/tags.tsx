"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tag + TagList — compact label pills for task tagging, MULTI_SELECT
 * custom-field cells, and category surfacing. Each tag carries its
 * own color (a 6/8-digit hex or any CSS color). TagList handles the
 * "show first N + (+M)" overflow that custom-field-cell.tsx
 * currently re-implements per-cell.
 *
 * Visual: rounded-full, gentle tinted bg derived from the tag color
 * by appending a low-alpha hex suffix. Removable mode adds an x icon
 * with hover affordance.
 */

export interface TagItem {
  id: string;
  label: string;
  /** Any CSS color. We tint background + use color directly for text. */
  color?: string;
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  color?: string;
  size?: "sm" | "md";
  /** Show an x button. Fires onRemove when clicked. */
  removable?: boolean;
  onRemove?: () => void;
}

export function Tag({
  label,
  color,
  size = "md",
  removable,
  onRemove,
  className,
  ...props
}: TagProps) {
  // Derive a 12%-alpha background from the tag color so the pill
  // reads as a tinted chip without overwhelming the row. Fallback
  // to neutral gray when no color is set.
  const bg = color ? `${color}1f` : "#f3f4f6";
  const fg = color ?? "#4b5563";

  return (
    <span
      data-slot="tag"
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap select-none",
        size === "sm" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
      style={{ backgroundColor: bg, color: fg }}
      {...props}
    >
      <span className="truncate max-w-[140px]">{label}</span>
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="hover:bg-black/10 rounded-full p-px transition-colors -mr-0.5"
          aria-label={`Remove ${label}`}
        >
          <X className={size === "sm" ? "size-2.5" : "size-3"} />
        </button>
      )}
    </span>
  );
}

export interface TagListProps extends React.HTMLAttributes<HTMLDivElement> {
  tags: TagItem[];
  /** How many tags to show before collapsing the rest into +N. */
  max?: number;
  size?: "sm" | "md";
  /** When set, each tag becomes removable and onRemove fires per-id. */
  onRemove?: (id: string) => void;
}

export function TagList({
  tags,
  max = 2,
  size = "md",
  onRemove,
  className,
  ...props
}: TagListProps) {
  const visible = tags.slice(0, max);
  const overflow = tags.length - max;

  return (
    <div
      data-slot="tag-list"
      className={cn("flex items-center gap-1 flex-wrap", className)}
      {...props}
    >
      {visible.map((t) => (
        <Tag
          key={t.id}
          label={t.label}
          color={t.color}
          size={size}
          removable={!!onRemove}
          onRemove={onRemove ? () => onRemove(t.id) : undefined}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex items-center rounded-full bg-gray-100 text-gray-600 font-medium",
            size === "sm" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
