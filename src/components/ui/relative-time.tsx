"use client";

import * as React from "react";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * RelativeTime — auto-updating "X minutes ago" / "in X hours" label.
 * Replaces the hand-rolled time formatting scattered across cockpit
 * activity stream, dashboard widgets, status updates, and inbox.
 *
 * Updates automatically every minute (configurable) so labels never
 * go stale on long-running pages. Hover reveals the absolute
 * timestamp via title attribute for precision.
 */

export interface RelativeTimeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Date or ISO string. */
  date: Date | string | number;
  /** Show "in X hours" / "X ago" form. Default true. */
  addSuffix?: boolean;
  /** Strict mode: "5 minutes" instead of "about 5 minutes". Default true. */
  strict?: boolean;
  /** Refresh interval in ms. Default 60_000 (1 minute). */
  refreshInterval?: number;
  /** Render a short form: "5m", "2h", "3d", "1y" — overrides date-fns text. */
  short?: boolean;
}

function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  if (typeof input === "string" || typeof input === "number") return new Date(input);
  return new Date();
}

function shortForm(date: Date, addSuffix: boolean): string {
  const now = Date.now();
  const diffSec = Math.round((now - date.getTime()) / 1000);
  const past = diffSec >= 0;
  const abs = Math.abs(diffSec);
  let value: string;
  if (abs < 60) value = `${abs}s`;
  else if (abs < 3600) value = `${Math.floor(abs / 60)}m`;
  else if (abs < 86400) value = `${Math.floor(abs / 3600)}h`;
  else if (abs < 2592000) value = `${Math.floor(abs / 86400)}d`;
  else if (abs < 31536000) value = `${Math.floor(abs / 2592000)}mo`;
  else value = `${Math.floor(abs / 31536000)}y`;
  if (!addSuffix) return value;
  return past ? `${value} ago` : `in ${value}`;
}

export function RelativeTime({
  date,
  addSuffix = true,
  strict = true,
  refreshInterval = 60_000,
  short = false,
  className,
  ...props
}: RelativeTimeProps) {
  const d = React.useMemo(() => toDate(date), [date]);
  const [, setTick] = React.useState(0);

  // Auto-refresh — every refreshInterval ms increment tick so the
  // formatted label is recomputed. Cleared on unmount.
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), refreshInterval);
    return () => window.clearInterval(id);
  }, [refreshInterval]);

  const label = short
    ? shortForm(d, addSuffix)
    : strict
    ? formatDistanceToNowStrict(d, { addSuffix })
    : formatDistanceToNow(d, { addSuffix });

  return (
    <span
      data-slot="relative-time"
      className={cn("text-gray-500", className)}
      title={d.toLocaleString()}
      {...props}
    >
      {label}
    </span>
  );
}
