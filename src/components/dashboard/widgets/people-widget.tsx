'use client';

/**
 * PeopleWidget — Asana-style "Personas" tile.
 *
 * Layout (matches the Asana screenshot):
 *   ┌──────────────────────────────────────────┐
 *   │ Frequent collaborators ▾                 │
 *   ├──────────────────────────────────────────┤
 *   │ This week | This month                   │   ← period tabs
 *   ├──────────────────────────────────────────┤
 *   │ ⬤ juantercero@…   0 overdue · 2 done    │   ← per-person row
 *   │ ⬤ jane@…          1 overdue · 5 done    │
 *   │ + Invite teammate                        │   ← bottom action
 *   └──────────────────────────────────────────┘
 *
 * Title + ⋯ menu live in the WidgetContainer above (this widget runs
 * in classic mode with hideHeader=false).
 *
 * Stats come from /api/users?includeStats=true&period=week|month —
 * one round-trip per tab switch. The widget never falls into N+1
 * since the API uses two groupBy queries server-side.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Person {
  id: string;
  name: string | null;
  // Prisma User.email is nullable in this schema; fall back to name.
  email: string | null;
  image: string | null;
  jobTitle?: string | null;
  overdueCount?: number;
  completedCount?: number;
}

interface PeopleWidgetProps {
  onInvite?: () => void;
}

type PeriodTab = 'week' | 'month';
type FilterMode = 'frequent' | 'all';

export function PeopleWidget({ onInvite }: PeopleWidgetProps) {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('frequent');
  const [period, setPeriod] = useState<PeriodTab>('week');

  useEffect(() => {
    let cancelled = false;
    async function fetchPeople() {
      setLoading(true);
      try {
        const limit = filter === 'all' ? 12 : 6;
        const res = await fetch(
          `/api/users?limit=${limit}&filter=${filter}&includeStats=true&period=${period}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Person[] = await res.json();
        if (!cancelled) setPeople(data);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch people:', err);
          setError('Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPeople();
    return () => {
      cancelled = true;
    };
  }, [filter, period]);

  const handleInvite = () => {
    if (onInvite) {
      onInvite();
    } else {
      router.push('/team?invite=true');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Filter sub-bar (Frequent collaborators / All) */}
      <div className="flex items-center mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              {filter === 'frequent' ? 'Frequent collaborators' : 'All'}
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilter('frequent')}>
              Frequent collaborators
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('all')}>
              All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Period tabs (This week / This month) */}
      <div className="flex gap-4 border-b border-gray-200 mb-2">
        <button
          onClick={() => setPeriod('week')}
          className={cn(
            'pb-1.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
            period === 'week'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          This week
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={cn(
            'pb-1.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
            period === 'month'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          This month
        </button>
      </div>

      {error && <p className="text-sm text-black mb-2">{error}</p>}

      {/* People list — scrollable */}
      <div className="flex-1 overflow-y-auto -mx-1">
        {loading ? (
          <div className="space-y-2 px-1 py-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 bg-gray-100 animate-pulse rounded"
              />
            ))}
          </div>
        ) : people.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <p className="text-sm text-gray-500 mb-3">
              Invite your teammates to collaborate
            </p>
            <button
              onClick={handleInvite}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Invite teammates
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {people.map((person) => {
              const initials =
                (person.name || person.email || '?')
                  .split(/[\s@.]+/)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || '?';
              const overdue = person.overdueCount ?? 0;
              const completed = person.completedCount ?? 0;
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => router.push('/team')}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={person.image || undefined} />
                      <AvatarFallback className="bg-gray-900 text-white text-[11px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-800 truncate flex-1 min-w-0">
                      {person.name || person.email}
                    </span>
                    {/* Stat pills — pink/red for overdue, green for
                        completed. Match the Asana palette. Pills only
                        render when there's something to show, so a
                        brand-new workspace doesn't look spammed. */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={cn(
                          'text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full',
                          overdue > 0
                            ? 'bg-[#fce4e4] text-[#a8323a]'
                            : 'bg-gray-50 text-gray-400'
                        )}
                        title={`${overdue} overdue`}
                      >
                        {overdue} overdue
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full',
                          completed > 0
                            ? 'bg-[#dff1e6] text-[#1d6b3e]'
                            : 'bg-gray-50 text-gray-400'
                        )}
                        title={`${completed} completed`}
                      >
                        {completed} done
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* "+ Invite teammate" footer link — always visible when there
          are at least a few people, matches Asana's bottom CTA. */}
      {!loading && people.length > 0 && (
        <button
          onClick={handleInvite}
          className="flex items-center gap-2 px-2 py-2 mt-1 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
        >
          <Plus className="h-4 w-4" />
          Invite teammate
        </button>
      )}
    </div>
  );
}
