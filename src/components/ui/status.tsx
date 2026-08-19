"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status pill — unified color-coded status component for tasks,
 * projects, goals, and team workflows. Replaces ad-hoc inline
 * badge styling scattered across BuildSync (task cards, project
 * overview, goals kanban, etc.) so every status reads the same.
 *
 * Six semantic variants map to BuildSync's domain language:
 *   - pending    → neutral gray         ("Backlog", "Not started")
 *   - active     → blue                 ("In progress", "On track")
 *   - success    → green                ("Approved", "Achieved", "Done")
 *   - warning    → amber                ("At risk", "Needs review")
 *   - danger     → red                  ("Off track", "Blocked", "Rejected")
 *   - muted      → very light gray      ("Dropped", "Archived")
 *
 * Each variant ships a colored dot + label so the meaning survives
 * for color-blind users (the dot's brightness/saturation differs).
 */

const statusVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap select-none transition-colors",
  {
    variants: {
      variant: {
        pending: "bg-gray-100 text-gray-700",
        active: "bg-blue-50 text-blue-700",
        success: "bg-green-50 text-green-700",
        warning: "bg-amber-50 text-amber-700",
        danger: "bg-red-50 text-red-700",
        muted: "bg-gray-50 text-gray-500",
      },
      size: {
        sm: "text-[10px] px-1.5 py-px",
        md: "text-[11px] px-2 py-0.5",
        lg: "text-[12px] px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "pending",
      size: "md",
    },
  }
);

const dotVariants = cva("rounded-full shrink-0", {
  variants: {
    variant: {
      pending: "bg-gray-400",
      active: "bg-blue-500",
      success: "bg-green-500",
      warning: "bg-amber-500",
      danger: "bg-red-500",
      muted: "bg-gray-300",
    },
    size: {
      sm: "size-1",
      md: "size-1.5",
      lg: "size-2",
    },
  },
  defaultVariants: {
    variant: "pending",
    size: "md",
  },
});

export interface StatusProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusVariants> {
  /** Hide the leading colored dot. Default false (dot shown). */
  hideDot?: boolean;
}

export function Status({
  className,
  variant,
  size,
  hideDot = false,
  children,
  ...props
}: StatusProps) {
  return (
    <span
      data-slot="status"
      className={cn(statusVariants({ variant, size }), className)}
      {...props}
    >
      {!hideDot && (
        <span className={cn(dotVariants({ variant, size }))} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

export { statusVariants };
