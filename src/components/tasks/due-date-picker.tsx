'use client';

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
  value: Date | null;
  onChange: (date: Date | null) => void;
  trigger: React.ReactNode;
}

const DAYS_OF_WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
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

export function DueDatePicker({ value, onChange, trigger }: DueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ? formatDateInput(value) : '');
  const [viewDate, setViewDate] = useState(value || new Date());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (value) {
      setInputValue(formatDateInput(value));
      setViewDate(value);
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const parsed = parseDateInput(newValue);
    if (parsed) {
      onChange(parsed);
      setViewDate(parsed);
    }
  };

  const handleInputBlur = () => {
    const parsed = parseDateInput(inputValue);
    if (parsed) {
      onChange(parsed);
    } else if (value) {
      setInputValue(formatDateInput(value));
    }
  };

  const handleSelectDate = (day: number, month: number, year: number) => {
    const newDate = new Date(year, month, day);
    onChange(newDate);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
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

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return value && date.toDateString() === value.toDateString();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0"
        align="start"
        sideOffset={4}
      >
        {/* ========== INPUT DE FECHA ========== */}
        <div className="flex items-center border-b px-3 py-2 gap-2">
          <span className="text-sm text-gray-500">+ Due date</span>
          <div className="flex-1" />
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="MM/DD/YY"
            className="w-24 h-7 text-sm text-right border-gray-300"
          />
          {value && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ========== NAVEGACIÓN DE MES ========== */}
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* ========== CALENDARIO ========== */}
        <div className="px-3 pb-2">
          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_OF_WEEK.map((day, i) => (
              <div
                key={i}
                className="h-8 flex items-center justify-center text-xs text-gray-500 font-medium"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1">
            {allDays.map((item, i) => (
              <button
                key={i}
                onClick={() => handleSelectDate(item.day, item.month, item.year)}
                className={cn(
                  'h-8 w-8 flex items-center justify-center text-sm rounded-full transition-colors',
                  item.currentMonth
                    ? 'text-gray-900 hover:bg-gray-100'
                    : 'text-gray-300 hover:bg-gray-50',
                  isToday(item.date) && !isSelected(item.date) && 'border border-gray-400',
                  isSelected(item.date) && 'bg-blue-600 text-white hover:bg-blue-700',
                )}
              >
                {item.day}
              </button>
            ))}
          </div>
        </div>

        {/* ========== FOOTER CON OPCIONES ========== */}
        <div className="flex items-center justify-between px-3 py-2 border-t">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500"
              title="Add time"
              onClick={() => toast.info("Add time coming soon")}
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500"
              title="Set to repeat"
              onClick={() => toast.info("Recurring tasks coming soon")}
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 h-8"
            onClick={handleClear}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
