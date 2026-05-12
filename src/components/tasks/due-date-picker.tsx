'use client';

/**
 * DueDatePicker — Asana-style date range picker.
 *
 * Despite the name (kept for callsite compatibility), this component
 * now manages BOTH a start date and a due date. A task that has both
 * shows as a band on the calendar; a task with only a due date
 * collapses to a single highlighted cell.
 *
 * Props
 * - startDate / dueDate: the current range (either may be null)
 * - onChange(start, due): fires whenever the range changes
 * - trigger: the element that opens the popover
 *
 * Interaction model
 * - Two inline inputs at the top, one for start and one for due.
 * - Clicking a date in the calendar fills the currently-focused
 *   input, then auto-advances focus to the other input (Asana behavior).
 * - If the user picks a "due" earlier than "start", we swap them
 *   silently — that's what every other range picker does.
 * - "Clear" wipes both dates.
 */

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Repeat,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DueDatePickerProps {
  /** Optional start of the range. */
  startDate?: Date | null;
  /** End of the range — also used as the single date if startDate is null. */
  dueDate: Date | null;
  /** Fires when either endpoint changes. */
  onChange: (startDate: Date | null, dueDate: Date | null) => void;
  trigger: React.ReactNode;
}

const DAYS_OF_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

function parseDateInput(value: string): Date | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  let fullYear = parseInt(year);
  if (fullYear < 100) {
    fullYear += 2000;
  }

  const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
  if (isNaN(date.getTime())) return null;

  return date;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

/** Strip time so two dates can be compared by day. */
function dayOnly(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function DueDatePicker({
  startDate = null,
  dueDate,
  onChange,
  trigger,
}: DueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [startInput, setStartInput] = useState(startDate ? formatDateInput(startDate) : '');
  const [dueInput, setDueInput] = useState(dueDate ? formatDateInput(dueDate) : '');
  const [viewDate, setViewDate] = useState(startDate || dueDate || new Date());
  /** Which input is the "next click" filling — Asana toggles this on
   *  every click so two clicks can pick a full range. */
  const [focus, setFocus] = useState<'start' | 'due'>(
    startDate && !dueDate ? 'due' : 'start'
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    setStartInput(startDate ? formatDateInput(startDate) : '');
  }, [startDate]);
  useEffect(() => {
    setDueInput(dueDate ? formatDateInput(dueDate) : '');
  }, [dueDate]);

  /** Commit a new range to the parent, swapping if start > due. */
  function commit(start: Date | null, due: Date | null) {
    if (start && due && dayOnly(start) > dayOnly(due)) {
      onChange(due, start);
    } else {
      onChange(start, due);
    }
  }

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setStartInput(v);
    if (v.trim() === '') {
      commit(null, dueDate);
      return;
    }
    const parsed = parseDateInput(v);
    if (parsed) {
      commit(parsed, dueDate);
      setViewDate(parsed);
    }
  };

  const handleDueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDueInput(v);
    if (v.trim() === '') {
      commit(startDate, null);
      return;
    }
    const parsed = parseDateInput(v);
    if (parsed) {
      commit(startDate, parsed);
      setViewDate(parsed);
    }
  };

  const handleSelectDate = (day: number, month: number, year: number) => {
    const picked = new Date(year, month, day);
    // Asana behavior: never auto-close on a date pick. The user keeps
    // adjusting either endpoint until they explicitly dismiss (click
    // outside, hit Done, or press Esc). Just flip focus to the other
    // input so two clicks naturally fill a fresh range.
    if (focus === 'start') {
      commit(picked, dueDate);
      setFocus('due');
    } else {
      commit(startDate, picked);
      setFocus('start');
    }
  };

  const handleClear = () => {
    onChange(null, null);
    setStartInput('');
    setDueInput('');
    setFocus('start');
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

  const prevMonthDays = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth() - 1);
  const prevDays = Array.from({ length: firstDay }, (_, i) => ({
    day: prevMonthDays - firstDay + i + 1,
    currentMonth: false,
    month: viewDate.getMonth() - 1,
    year: viewDate.getMonth() === 0 ? viewDate.getFullYear() - 1 : viewDate.getFullYear(),
    date: new Date(
      viewDate.getMonth() === 0 ? viewDate.getFullYear() - 1 : viewDate.getFullYear(),
      viewDate.getMonth() === 0 ? 11 : viewDate.getMonth() - 1,
      prevMonthDays - firstDay + i + 1
    )
  }));

  const currentDays = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    currentMonth: true,
    month: viewDate.getMonth(),
    year: viewDate.getFullYear(),
    date: new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1)
  }));

  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const nextDays = Array.from({ length: totalCells - firstDay - daysInMonth }, (_, i) => ({
    day: i + 1,
    currentMonth: false,
    month: viewDate.getMonth() + 1,
    year: viewDate.getMonth() === 11 ? viewDate.getFullYear() + 1 : viewDate.getFullYear(),
    date: new Date(
      viewDate.getMonth() === 11 ? viewDate.getFullYear() + 1 : viewDate.getFullYear(),
      viewDate.getMonth() === 11 ? 0 : viewDate.getMonth() + 1,
      i + 1
    )
  }));

  const allDays = [...prevDays, ...currentDays, ...nextDays];

  const isToday = (date: Date) => date.toDateString() === today.toDateString();

  const isStart = (date: Date) =>
    !!startDate && date.toDateString() === startDate.toDateString();
  const isDue = (date: Date) =>
    !!dueDate && date.toDateString() === dueDate.toDateString();
  /** Cell sits strictly between start and due — gets the band fill. */
  const isInRange = (date: Date) => {
    if (!startDate || !dueDate) return false;
    const t = dayOnly(date);
    return t > dayOnly(startDate) && t < dayOnly(dueDate);
  };
  /** Same-day range (start === due) — show only the endpoint style. */
  const isSingleEndpoint = (date: Date) => {
    if (startDate && dueDate &&
      startDate.toDateString() === dueDate.toDateString()) {
      return date.toDateString() === startDate.toDateString();
    }
    // No start, only due — classic single-date highlight.
    if (!startDate && dueDate) {
      return date.toDateString() === dueDate.toDateString();
    }
    return false;
  };
  const isWeekend = (date: Date) => {
    const d = date.getDay();
    return d === 0 || d === 6;
  };

  /**
   * Asana behavior: weekend cells inside a range are NOT highlighted —
   * the visual band breaks across non-working days. Endpoints that
   * happen to fall on a weekend are still highlighted (the user
   * explicitly picked them); only the in-between weekend days drop
   * out so a Mon–Fri block reads as one continuous run.
   */
  const shouldFillCell = (date: Date): boolean => {
    if (isStart(date) || isDue(date) || isSingleEndpoint(date)) return true;
    if (isInRange(date) && !isWeekend(date)) return true;
    return false;
  };
  /** Round the left edge of a filled cell when nothing fills to its
   *  left (start of range, day after a weekend, first column of week,
   *  or first cell of a stand-alone endpoint). */
  const shouldRoundLeft = (date: Date): boolean => {
    if (!shouldFillCell(date)) return false;
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    return !shouldFillCell(prev);
  };
  const shouldRoundRight = (date: Date): boolean => {
    if (!shouldFillCell(date)) return false;
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return !shouldFillCell(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align="start"
        sideOffset={4}
      >
        {/* ========== DATE INPUTS (start + due) ========== */}
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <Input
            value={startInput}
            onChange={handleStartChange}
            onFocus={() => setFocus('start')}
            placeholder="Start"
            className={cn(
              "flex-1 h-7 text-xs text-center border-gray-300 px-1",
              focus === 'start' && "ring-2 ring-[#c9a84c]/40 border-[#c9a84c]"
            )}
          />
          <span className="text-gray-400">→</span>
          <Input
            value={dueInput}
            onChange={handleDueChange}
            onFocus={() => setFocus('due')}
            placeholder="Due"
            className={cn(
              "flex-1 h-7 text-xs text-center border-gray-300 px-1",
              focus === 'due' && "ring-2 ring-[#c9a84c]/40 border-[#c9a84c]"
            )}
          />
          {(startDate || dueDate) && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              title="Clear dates"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Focus hint */}
        <div className="px-3 pt-2 text-[10px] uppercase tracking-wider text-gray-400">
          Picking {focus === 'start' ? 'start date' : 'due date'}
        </div>

        {/* ========== MONTH NAVIGATION ========== */}
        <div className="flex items-center justify-between px-3 py-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* ========== CALENDAR ========== */}
        <div className="px-3 pb-2">
          {/* Days of the week */}
          <div className="grid grid-cols-7 gap-y-1 mb-1">
            {DAYS_OF_WEEK.map((day, i) => (
              <div
                key={i}
                className="h-8 flex items-center justify-center text-xs text-gray-500 font-medium"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days grid — no horizontal gap so adjacent filled cells
              read as one continuous Asana-style band. The band breaks
              naturally at weekends and at row boundaries. */}
          <div className="grid grid-cols-7 gap-y-1">
            {allDays.map((item, i) => {
              const filled = shouldFillCell(item.date);
              const roundL = shouldRoundLeft(item.date);
              const roundR = shouldRoundRight(item.date);

              return (
                <div
                  key={i}
                  className={cn(
                    "h-8 flex items-center justify-center",
                    filled && "bg-[#c9a84c]",
                    filled && roundL && "rounded-l-full",
                    filled && roundR && "rounded-r-full"
                  )}
                >
                  <button
                    onClick={() =>
                      handleSelectDate(item.day, item.month, item.year)
                    }
                    type="button"
                    className={cn(
                      "h-8 w-8 flex items-center justify-center text-sm transition-colors rounded-full",
                      // Outside-range cells keep gray text + hover
                      !filled && item.currentMonth &&
                        "text-gray-900 hover:bg-gray-100",
                      !filled && !item.currentMonth &&
                        "text-gray-300 hover:bg-gray-50",
                      // Today indicator only when the cell isn't already
                      // overpowered by the gold range band.
                      isToday(item.date) && !filled &&
                        "border border-gray-400",
                      // Inside-range cells: white text on gold; hover
                      // darkens to the deep-gold tone.
                      filled && "text-white hover:bg-[#a8893a]"
                    )}
                  >
                    {item.day}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========== FOOTER WITH OPTIONS ========== */}
        <div className="flex items-center justify-between px-3 py-2 border-t">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500"
              title="Add time"
              type="button"
              onClick={() => toast.info("Add time coming soon")}
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500"
              title="Set to repeat"
              type="button"
              onClick={() => toast.info("Recurring tasks coming soon")}
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 h-8"
              type="button"
              onClick={handleClear}
            >
              Clear
            </Button>
            <Button
              size="sm"
              className="h-8 bg-black hover:bg-gray-800 text-white"
              type="button"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
