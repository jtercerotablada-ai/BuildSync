'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Objective {
  id: string;
  name: string;
  progress: number;
  status: string;
}

interface GoalsWidgetProps {
  onCreateGoal?: () => void;
}

export function GoalsWidget({ onCreateGoal }: GoalsWidgetProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [goals, setGoals] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGoals() {
      setLoading(true);
      try {
        const res = await fetch(`/api/objectives?filter=${activeTab}&limit=4`);
        if (res.ok) {
          const data = await res.json();
          setGoals(data);
        }
      } catch (error) {
        console.error('Failed to fetch goals:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchGoals();
  }, [activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ON_TRACK': return 'bg-green-500';
      case 'AT_RISK': return 'bg-yellow-500';
      case 'OFF_TRACK': return 'bg-red-500';
      case 'ACHIEVED': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">Track your objectives</span>
        <Button
          variant="link"
          size="sm"
          className="text-blue-600 hover:text-blue-700 p-0 h-auto"
          onClick={() => router.push('/goals')}
        >
          View all <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my' | 'team')} className="flex-1 flex flex-col">
        <TabsList className="w-fit mb-3">
          <TabsTrigger value="my" className="text-xs">My goals</TabsTrigger>
          <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 overflow-hidden mt-0">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
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
              {goals.map((goal) => (
                <button
                  key={goal.id}
                  className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => router.push(`/goals/${goal.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 text-sm truncate pr-2">{goal.name}</p>
                    <span className="text-sm font-medium flex-shrink-0">{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={cn("h-1.5 rounded-full transition-all", getStatusColor(goal.status))}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
