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

import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
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
  /**
   * DRAFT state.
   * The picker holds its own copy of the dates while the popover is
   * open and only flushes back to the parent when the popover
   * dismisses. This is critical for two reasons:
   *   1. Otherwise every calendar click fires a PATCH + refetch on
   *      the parent, which re-renders the trigger element and tells
   *      Radix the trigger is gone — Radix then closes the popover.
   *   2. Asana never PATCH-spams the server while the user is still
   *      sliding the range around. It commits once on dismiss.
   */
  const [localStart, setLocalStart] = useState<Date | null>(startDate);
  const [localDue, setLocalDue] = useState<Date | null>(dueDate);
  const [startInput, setStartInput] = useState(
    startDate ? formatDateInput(startDate) : ''
  );
  const [dueInput, setDueInput] = useState(
    dueDate ? formatDateInput(dueDate) : ''
  );
  const [viewDate, setViewDate] = useState(startDate || dueDate || new Date());
  /** Which input is the "next click" filling — Asana toggles this on
   *  every click so two clicks can pick a full range. */
  const [focus, setFocus] = useState<'start' | 'due'>(
    startDate && !dueDate ? 'due' : 'start'
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Re-sync draft from props every time the popover transitions to
  // open. Outside of that window we keep the draft so live edits
  // don't snap back if the parent happens to re-render.
  useEffect(() => {
    if (open) {
      setLocalStart(startDate);
      setLocalDue(dueDate);
      setStartInput(startDate ? formatDateInput(startDate) : '');
      setDueInput(dueDate ? formatDateInput(dueDate) : '');
      setFocus(startDate && !dueDate ? 'due' : 'start');
      if (startDate || dueDate) {
        setViewDate(startDate || dueDate || new Date());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * Update the draft, swapping if start > due so an out-of-order
   * pair never reaches the parent.
   */
  function commitDraft(start: Date | null, due: Date | null) {
    if (start && due && dayOnly(start) > dayOnly(due)) {
      setLocalStart(due);
      setLocalDue(start);
      setStartInput(formatDateInput(due));
      setDueInput(formatDateInput(start));
    } else {
      setLocalStart(start);
      setLocalDue(due);
      setStartInput(start ? formatDateInput(start) : '');
      setDueInput(due ? formatDateInput(due) : '');
    }
  }

  /**
   * Refs that always reflect the LATEST draft + props at flush time.
   * Using state directly in flush() captures whatever values existed
   * when the close-callback was registered — which is stale by the
   * time the user finishes clicking. Refs sidestep the closure issue.
   */
  const localStartRef = useRef(localStart);
  const localDueRef = useRef(localDue);
  const startDateRef = useRef(startDate);
  const dueDateRef = useRef(dueDate);
  const onChangeRef = useRef(onChange);
  localStartRef.current = localStart;
  localDueRef.current = localDue;
  startDateRef.current = startDate;
  dueDateRef.current = dueDate;
  onChangeRef.current = onChange;

  /**
   * Flush draft state up to the parent. Called when the popover
   * dismisses; skipped when nothing actually changed so the parent
   * doesn't trigger a no-op PATCH.
   */
  function flush() {
    const ls = localStartRef.current;
    const ld = localDueRef.current;
    const sd = startDateRef.current;
    const dd = dueDateRef.current;
    const startChanged =
      (ls?.toDateString() || '') !== (sd?.toDateString() || '');
    const dueChanged =
      (ld?.toDateString() || '') !== (dd?.toDateString() || '');
    if (startChanged || dueChanged) {
      onChangeRef.current(ls, ld);
    }
  }

  /**
   * Single source of truth for "dismiss the popover and persist."
   * Wired to Done button, Esc key (via Radix onOpenChange), click-
   * outside (also Radix onOpenChange), and a future X button. Any
   * close path goes through here so the server can never end up
   * out of sync with the draft.
   */
  function dismiss() {
    flush();
    setOpen(false);
  }

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setStartInput(v);
    if (v.trim() === '') {
      setLocalStart(null);
      return;
    }
    const parsed = parseDateInput(v);
    if (parsed) {
      commitDraft(parsed, localDue);
      setViewDate(parsed);
    }
  };

  const handleDueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDueInput(v);
    if (v.trim() === '') {
      setLocalDue(null);
      return;
    }
    const parsed = parseDateInput(v);
    if (parsed) {
      commitDraft(localStart, parsed);
      setViewDate(parsed);
    }
  };

  const handleSelectDate = (day: number, month: number, year: number) => {
    const picked = new Date(year, month, day);
    // Pure draft update — flip focus so the next click naturally
    // hits the other endpoint. Nothing here touches the parent, so
    // the trigger element stays stable and the popover stays open
    // until the user explicitly dismisses it.
    if (focus === 'start') {
      commitDraft(picked, localDue);
      setFocus('due');
    } else {
      commitDraft(localStart, picked);
      setFocus('start');
    }
  };

  const handleClear = () => {
    setLocalStart(null);
    setLocalDue(null);
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
    !!localStart && date.toDateString() === localStart.toDateString();
  const isDue = (date: Date) =>
    !!localDue && date.toDateString() === localDue.toDateString();
  /** Cell sits strictly between start and due — gets the band fill. */
  const isInRange = (date: Date) => {
    if (!localStart || !localDue) return false;
    const t = dayOnly(date);
    return t > dayOnly(localStart) && t < dayOnly(localDue);
  };
  /** Same-day range (start === due) — show only the endpoint style. */
  const isSingleEndpoint = (date: Date) => {
    if (localStart && localDue &&
      localStart.toDateString() === localDue.toDateString()) {
      return date.toDateString() === localStart.toDateString();
    }
    // No start, only due — classic single-date highlight.
    if (!localStart && localDue) {
      return date.toDateString() === localDue.toDateString();
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
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Radix calls this when IT decides to close — Esc, click
        // outside, focus trap escape, etc. We funnel those paths
        // through dismiss() too so they flush before closing.
        // The Done button calls dismiss() directly, bypassing this
        // (since changing controlled `open` from a child doesn't
        // re-fire onOpenChange in Radix's controlled mode).
        if (!next) {
          dismiss();
        } else {
          setOpen(true);
        }
      }}
    >
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
          {(localStart || localDue) && (
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

        {/* Focus hint — reflects what the next click does. After the
            user has set both endpoints the hint switches to a
            "range set" confirmation so it doesn't keep telling them
            to pick something they already picked. */}
        <div className="px-3 pt-2 text-[10px] uppercase tracking-wider text-gray-400">
          {localStart && localDue
            ? 'Range set · click Done'
            : `Picking ${focus === 'start' ? 'start date' : 'due date'}`}
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

        {/* ========== FOOTER ========== */}
        {/* The Clock ("add time") and Repeat ("recurring task") icons
            previously sat on the left of this footer but were stubs
            that opened "coming soon" toasts. They've been removed
            until the underlying features land — surfacing UI for
            non-functional behavior just teaches users to ignore
            buttons. The footer is now Clear + Done aligned right. */}
        <div className="flex items-center justify-end gap-1 px-3 py-2 border-t">
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
            onClick={dismiss}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
