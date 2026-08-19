"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * MiniCalendar — compact date picker for inline due-date / start-date
 * fields. Lighter footprint than the full Calendar component:
 * single-month, 7-col grid, trigger button styled like a row cell.
 *
 * Wraps the same react-day-picker used by /ui/calendar so behavior
 * (locales, disabled days, keyboard nav) is consistent across the
 * app, but the chrome is tightened for table-row use cases like
 * the due-date column in /my-tasks.
 *
 * For range selection use the existing due-date-picker.tsx (Asana
 * style with start + due). This component is single-date only.
 */

export interface MiniCalendarProps {
  /** Currently selected date. */
  value: Date | null;
  onChange: (date: Date | null) => void;
  /** Placeholder shown when value is null. */
  placeholder?: string;
  /** Disable specific dates (e.g. weekends, past dates). */
  disabled?: (date: Date) => boolean;
  /** Custom format for the trigger label. Default "MMM d, yyyy". */
  formatString?: string;
  /** Hide the clear-x button when a value is set. Default false. */
  hideClear?: boolean;
  className?: string;
  /** Right-align the popover. */
  alignEnd?: boolean;
  disabledTrigger?: boolean;
}

export function MiniCalendar({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  formatString = "MMM d, yyyy",
  hideClear = false,
  className,
  alignEnd = false,
  disabledTrigger = false,
}: MiniCalendarProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabledTrigger}
          className={cn(
            "h-7 px-2 text-[12px] font-normal justify-between gap-2",
            !value && "text-gray-500",
            className
          )}
        >
          <span className="truncate">
            {value ? format(value, formatString) : placeholder}
          </span>
          {value && !hideClear && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="text-gray-400 hover:text-gray-700 cursor-pointer shrink-0"
              aria-label="Clear date"
            >
              ×
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={alignEnd ? "end" : "start"}
        className="w-auto p-2"
      >
        <DayPicker
          mode="single"
          selected={value ?? undefined}
          onSelect={(d) => {
            onChange(d ?? null);
            setOpen(false);
          }}
          disabled={disabled}
          showOutsideDays
          className="[--cell-size:--spacing(7)] text-[12px]"
          components={{
            Chevron: ({ orientation }) =>
              orientation === "left" ? (
                <ChevronLeftIcon className="size-3.5" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              ),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
