'use client';

import { Check, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ============ PRIORITY ============

type Priority = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;

const priorityOptions: { value: Priority; label: string; color: string; bg: string }[] = [
  { value: 'HIGH', label: 'High', color: 'bg-red-500', bg: 'bg-red-100 text-red-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-500', bg: 'bg-yellow-100 text-yellow-700' },
  { value: 'LOW', label: 'Low', color: 'bg-green-500', bg: 'bg-green-100 text-green-700' },
];

interface PrioritySelectorProps {
  value: Priority;
  onChange: (value: Priority) => void;
}

export function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
  const selected = priorityOptions.find(o => o.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center justify-between w-full py-1.5 px-2 hover:bg-gray-50 rounded text-left">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center">
              <Check className="h-3 w-3 text-gray-400" />
            </div>
            <span className="text-sm text-gray-600">Priority</span>
          </div>
          {selected ? (
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', selected.bg)}>
              {selected.label}
            </span>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {priorityOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className={cn('w-3 h-3 rounded-full', option.color)} />
            <span>{option.label}</span>
            {value === option.value && (
              <Check className="h-4 w-4 ml-auto text-blue-600" />
            )}
          </DropdownMenuItem>
        ))}
        {value && value !== 'NONE' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onChange('NONE')}
              className="flex items-center gap-2 text-gray-500 cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>Clear field</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============ STATUS ============

type Status = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | null;

const statusOptions: { value: Status; label: string; color: string; bg: string }[] = [
  { value: 'ON_TRACK', label: 'On track', color: 'bg-green-500', bg: 'bg-green-100 text-green-700' },
  { value: 'AT_RISK', label: 'At risk', color: 'bg-yellow-500', bg: 'bg-yellow-100 text-yellow-700' },
  { value: 'OFF_TRACK', label: 'Off track', color: 'bg-red-500', bg: 'bg-red-100 text-red-700' },
];

interface StatusSelectorProps {
  value: Status;
  onChange: (value: Status) => void;
  completed?: boolean;
}

export function StatusSelector({ value, onChange, completed }: StatusSelectorProps) {
  const selected = statusOptions.find(o => o.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center justify-between w-full py-1.5 px-2 hover:bg-gray-50 rounded text-left">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center">
              <Check className="h-3 w-3 text-gray-400" />
            </div>
            <span className="text-sm text-gray-600">Status</span>
          </div>
          {completed ? (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
              Done
            </span>
          ) : selected ? (
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', selected.bg)}>
              {selected.label}
            </span>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className={cn('w-3 h-3 rounded-full', option.color)} />
            <span>{option.label}</span>
            {value === option.value && (
              <Check className="h-4 w-4 ml-auto text-blue-600" />
            )}
          </DropdownMenuItem>
        ))}
        {value && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onChange(null)}
              className="flex items-center gap-2 text-gray-500 cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>Clear field</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
