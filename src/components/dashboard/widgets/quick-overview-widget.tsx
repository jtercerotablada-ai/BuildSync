'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertCircle, CheckCircle2, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardStats {
  dueToday: number;
  overdue: number;
  completedThisWeek: number;
  activeProjects: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  iconBgColor: string;
  iconColor: string;
}

function StatCard({ icon, value, label, iconBgColor, iconColor }: StatCardProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("p-2 rounded-lg", iconBgColor)}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export function QuickOverviewWidget() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="grid grid-cols-2 gap-4 flex-1 content-center">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Grid 2x2 para caber en widget cuadrado */}
      <div className="grid grid-cols-2 gap-4 flex-1 content-center">
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          value={stats?.dueToday ?? 0}
          label="Tasks due today"
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5" />}
          value={stats?.overdue ?? 0}
          label="Overdue tasks"
          iconBgColor="bg-red-50"
          iconColor="text-red-600"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={stats?.completedThisWeek ?? 0}
          label="Completed this week"
          iconBgColor="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          icon={<FolderKanban className="h-5 w-5" />}
          value={stats?.activeProjects ?? 0}
          label="Active projects"
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>
    </div>
  );
}
