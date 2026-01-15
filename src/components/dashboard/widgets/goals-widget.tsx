'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Plus, ArrowRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Objective {
  id: string;
  name: string;
  progress: number;
  status: string;
  period: string | null;
  team: { id: string; name: string } | null;
}

interface GoalsWidgetProps {
  onCreateGoal?: () => void;
}

type TabType = 'my' | 'team';
type FilterType = 'open' | 'closed' | 'all';

const statusConfig: Record<string, { label: string; color: string }> = {
  ON_TRACK: { label: 'On track', color: 'text-black' },
  AT_RISK: { label: 'At risk', color: 'text-black' },
  OFF_TRACK: { label: 'Off track', color: 'text-black' },
  ACHIEVED: { label: 'Achieved', color: 'text-black' },
  PARTIAL: { label: 'Partial', color: 'text-gray-600' },
  MISSED: { label: 'Missed', color: 'text-black' },
  DROPPED: { label: 'Dropped', color: 'text-gray-400' },
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ON_TRACK': return 'bg-black';
    case 'AT_RISK': return 'bg-gray-500';
    case 'OFF_TRACK': return 'bg-gray-300';
    case 'ACHIEVED': return 'bg-black';
    default: return 'bg-gray-400';
  }
};

export function GoalsWidget({ onCreateGoal }: GoalsWidgetProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [filter, setFilter] = useState<FilterType>('open');
  const [goals, setGoals] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'my') params.append('ownerId', 'me');
      params.append('limit', '4');

      const res = await fetch('/api/objectives?' + params.toString());
      if (res.ok) {
        let data = await res.json();
        if (filter === 'open') {
          data = data.filter((g: Objective) => !['ACHIEVED', 'MISSED', 'DROPPED'].includes(g.status));
        } else if (filter === 'closed') {
          data = data.filter((g: Objective) => ['ACHIEVED', 'MISSED', 'DROPPED'].includes(g.status));
        }
        setGoals(data.slice(0, 4));
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filter]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const filterOptions = [
    { id: 'open' as FilterType, label: 'Open goals' },
    { id: 'closed' as FilterType, label: 'Closed goals' },
    { id: 'all' as FilterType, label: 'All goals' },
  ];

  const tabs = [
    { id: 'my' as TabType, label: 'My goals' },
    { id: 'team' as TabType, label: 'Team' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-gray-500 h-7 gap-1 px-2">
              {filterOptions.find(f => f.id === filter)?.label}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {filterOptions.map((option) => (
              <DropdownMenuItem key={option.id} onClick={() => setFilter(option.id)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="link"
          size="sm"
          className="text-black hover:text-black p-0 h-auto gap-1"
          onClick={() => router.push('/goals')}
        >
          View all <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      <p className="text-sm text-gray-500 mb-3">Track your objectives</p>

      <div className="flex gap-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              activeTab === tab.id
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <Target className="h-10 w-10 text-gray-300 mb-2" />
            <p className="font-medium text-gray-900 mb-1">No goals yet</p>
            <p className="text-sm text-gray-500 mb-3 max-w-[200px]">
              Set goals to track your team&apos;s progress
            </p>
            <Button onClick={onCreateGoal} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create a goal
            </Button>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto h-full">
            <button
              onClick={onCreateGoal}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-1"
            >
              <Plus className="h-4 w-4" />
              Create goal
            </button>

            {goals.map((goal) => (
              <button
                key={goal.id}
                className="w-full p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                onClick={() => router.push('/goals/' + goal.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900 text-sm truncate pr-2">{goal.name}</h4>
                  <span className="text-sm text-gray-500 flex-shrink-0">{goal.progress}%</span>
                </div>

                <div className="w-full h-1.5 bg-gray-100 rounded-full mb-2">
                  <div
                    className={cn('h-full rounded-full transition-all', getStatusColor(goal.status))}
                    style={{ width: goal.progress + '%' }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {goal.period || 'No period'}
                    {goal.team ? ' \u00b7 ' + goal.team.name : ' \u00b7 No team'}
                  </span>
                  <span className={statusConfig[goal.status]?.color || 'text-gray-400'}>
                    {statusConfig[goal.status]?.label || 'No status'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
