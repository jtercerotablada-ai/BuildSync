'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Plus, Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getStatusOption } from '@/lib/goal-utils';

interface Objective {
  id: string;
  name: string;
  progress: number;
  status: string;
  period: string | null;
  team: { id: string; name: string } | null;
}

interface Team {
  id: string;
  name: string;
  _count?: { objectives: number };
}

interface GoalsWidgetProps {
  onCreateGoal?: () => void;
}

type TabType = 'my' | 'team' | 'company';

// Progress bar color based on percentage
const getProgressColor = (progress: number, status: string) => {
  if (status === 'AT_RISK' || status === 'OFF_TRACK') return 'bg-black';
  if (progress >= 70) return 'bg-[#c9a84c]';
  if (progress >= 50) return 'bg-[#a8893a]';
  return 'bg-black';
};

// Status text color
const getStatusTextColor = (progress: number, status: string) => {
  if (status === 'AT_RISK' || status === 'OFF_TRACK') return 'text-black';
  if (progress >= 70) return 'text-[#a8893a]';
  if (progress >= 50) return 'text-[#a8893a]';
  return 'text-black';
};

export function GoalsWidget({ onCreateGoal }: GoalsWidgetProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [goals, setGoals] = useState<Objective[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True once /api/teams/list has settled (ok or not) — the Team tab
  // query waits for it so an unfiltered fetch never shows up as team goals.
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  // Fetch teams for the team selector
  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch('/api/teams/list');
        if (res.ok) {
          const data = await res.json();
          setTeams(data);
          if (data.length > 0 && !selectedTeam) {
            setSelectedTeam(data[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      } finally {
        setTeamsLoaded(true);
      }
    }
    fetchTeams();
  }, []);

  const fetchGoals = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    if (activeTab === 'team') {
      // Wait for the teams request to settle — an unfiltered query here
      // would show every accessible goal mislabeled as team goals.
      if (!teamsLoaded) {
        setLoading(true);
        return;
      }
      if (!selectedTeam) {
        setGoals([]);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (activeTab === 'my') {
        params.append('ownerId', 'me');
      } else if (activeTab === 'team' && selectedTeam) {
        params.append('teamId', selectedTeam.id);
      }
      // For 'company' tab, fetch all goals (no filter)

      params.append('limit', '4');

      const res = await fetch('/api/objectives?' + params.toString(), { signal });
      if (res.ok) {
        const data = await res.json();
        // Filter to open goals only
        const openGoals = data.filter((g: Objective) =>
          !['ACHIEVED', 'MISSED', 'DROPPED'].includes(g.status)
        );
        setGoals(openGoals.slice(0, 4));
      } else {
        setGoals([]);
        setError('Failed to load goals');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to fetch goals:', error);
      setError('Failed to load goals');
    } finally {
      // An aborted request means a newer fetch owns the loading state.
      if (!signal?.aborted) setLoading(false);
    }
  }, [activeTab, selectedTeam, teamsLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGoals(controller.signal);
    return () => controller.abort();
  }, [fetchGoals]);

  const tabs = [
    { id: 'my' as TabType, label: 'My goals' },
    { id: 'team' as TabType, label: 'Team' },
    { id: 'company' as TabType, label: 'Company' },
  ];

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'my':
        return {
          title: "You haven't added any goals yet.",
          subtitle: "Add a goal so your team knows what you plan to achieve."
        };
      case 'team':
        return {
          title: "You haven't added team goals yet.",
          subtitle: "Add a goal so your team knows what you plan to achieve."
        };
      case 'company':
        return {
          title: "No company goals yet.",
          subtitle: "Add company-wide goals to align your organization."
        };
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div role="tablist" className="flex items-center gap-4 min-w-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'text-sm font-medium pb-1 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'text-gray-900 border-gray-900'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Team selector - only visible on Team tab */}
        {activeTab === 'team' && teams.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 text-sm min-w-0">
                <Users className="h-3.5 w-3.5" />
                <span className="truncate max-w-[120px]">
                  {selectedTeam?.name || 'Select team'}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {teams.map((team) => (
                <DropdownMenuItem
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{team.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {team._count?.objectives || 0} goals
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchGoals()}>
              Retry
            </Button>
          </div>
        ) : goals.length === 0 ? (
          <div className="flex items-start justify-between py-4">
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-1">
                {getEmptyMessage().title}
              </p>
              <p className="text-sm text-gray-500">
                {getEmptyMessage().subtitle}
              </p>
            </div>
            <Button
              onClick={onCreateGoal}
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0 ml-4"
            >
              <Plus className="h-4 w-4" />
              Create goal
            </Button>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto h-full">
            {/* Create goal button at top */}
            <button
              onClick={onCreateGoal}
              className="w-full flex items-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-gray-500 text-sm"
            >
              <Plus className="h-4 w-4" />
              Create goal
            </button>

            {/* Goal cards — Asana shows period + status pill on each
                card; we mirror both so the read is full-context (you
                see *when* and *how it's going* without opening the
                goal). */}
            {goals.map((goal) => (
              <button
                key={goal.id}
                className="w-full p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                onClick={() => router.push('/goals/' + goal.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Progress bar */}
                  <div className="w-24 h-2 bg-gray-100 rounded-full flex-shrink-0">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        getProgressColor(goal.progress, goal.status)
                      )}
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>

                  {/* Goal name */}
                  <span className="flex-1 font-medium text-gray-900 text-sm truncate">
                    {goal.name}
                  </span>

                  {/* Progress percentage */}
                  <span className={cn(
                    'text-sm font-medium flex-shrink-0',
                    getStatusTextColor(goal.progress, goal.status)
                  )}>
                    {goal.progress}%
                  </span>
                </div>
                {/* Meta row: period + status pill */}
                {(goal.period || goal.status) && (
                  <div className="flex items-center gap-2 mt-1.5 ml-[108px]">
                    {goal.period && (
                      <span className="text-[11px] text-gray-500 tabular-nums">
                        {goal.period}
                      </span>
                    )}
                    {goal.period && goal.status && (
                      <span className="text-gray-300">·</span>
                    )}
                    {goal.status && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-medium',
                          getStatusOption(goal.status).textColor
                        )}
                      >
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            getStatusOption(goal.status).color
                          )}
                        />
                        {getStatusOption(goal.status).label}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}

            {/* View all link */}
            <button
              onClick={() => router.push('/goals')}
              className="text-sm text-gray-500 hover:text-gray-700 mt-2"
            >
              View all goals →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
