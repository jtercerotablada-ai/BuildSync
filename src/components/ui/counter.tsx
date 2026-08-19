"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Counter — animated number that smoothly tweens from its previous
 * value to the new one. Designed for dashboard widget metrics:
 * "Tasks completed", "Active projects", "Hours logged this week".
 *
 * Uses framer-motion (already installed as `motion`) for the spring
 * tween. Supports localized formatting via Intl.NumberFormat.
 */

export interface CounterProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Target value to count to. */
  value: number;
  /** Number of decimals to show. Default 0. */
  decimals?: number;
  /** Optional prefix (e.g. "$"). */
  prefix?: string;
  /** Optional suffix (e.g. "%", " tasks"). */
  suffix?: string;
  /** Spring stiffness. Higher = snappier. Default 80. */
  stiffness?: number;
  /** Spring damping. Higher = less overshoot. Default 25. */
  damping?: number;
  /** Use Intl.NumberFormat thousands separators. Default true. */
  separator?: boolean;
}

export function Counter({
  value,
  decimals = 0,
  prefix,
  suffix,
  stiffness = 80,
  damping = 25,
  separator = true,
  className,
  ...props
}: CounterProps) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness, damping });
  const display = useTransform(spring, (latest: number) => {
    const fixed = decimals > 0 ? latest.toFixed(decimals) : Math.round(latest).toString();
    if (separator) {
      const [intPart, decPart] = fixed.split(".");
      const formatted = Number(intPart).toLocaleString("en-US");
      return decPart ? `${formatted}.${decPart}` : formatted;
    }
    return fixed;
  });

  // Snap the underlying motion value to the new target whenever the
  // prop changes. Spring picks it up and animates over a few frames.
  React.useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  return (
    <span
      data-slot="counter"
      className={cn("tabular-nums", className)}
      {...props}
    >
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}
