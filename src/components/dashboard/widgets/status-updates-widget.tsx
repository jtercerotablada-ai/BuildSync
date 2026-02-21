'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface StatusUpdate {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  project: {
    id: string;
    name: string;
  };
  author: {
    name: string;
  };
}

export function StatusUpdatesWidget() {
  const router = useRouter();
  const [updates, setUpdates] = useState<StatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUpdates() {
      try {
        const res = await fetch('/api/status-updates?limit=5');
        if (res.ok) {
          const data = await res.json();
          setUpdates(data);
        }
      } catch (error) {
        console.error('Failed to fetch status updates:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUpdates();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ON_TRACK': return 'bg-green-500';
      case 'AT_RISK': return 'bg-yellow-500';
      case 'OFF_TRACK': return 'bg-red-500';
      case 'COMPLETE': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex items-center justify-center">
      {loading ? (
        <div className="space-y-2 w-full">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      ) : updates.length === 0 ? (
        <div className="text-center">
          {/* Icon - document with circle */}
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="w-12 h-14 border-2 border-gray-300 rounded-sm mx-auto">
              <div className="mt-3 mx-2 space-y-1.5">
                <div className="h-1 bg-gray-200 rounded" />
                <div className="h-1 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full" />
          </div>
          <p className="text-gray-500 text-sm mb-1">
            Status updates let you share progress on your projects.
          </p>
          <p className="text-gray-400 text-xs mb-4">
            Go to any project and create a status update to see it here.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => router.push('/projects')}
          >
            Go to projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2 w-full overflow-y-auto h-full">
          {updates.map((update) => (
            <button
              key={update.id}
              className="w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
              onClick={() => router.push(`/projects/${update.project.id}`)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("w-2 h-2 rounded-full", getStatusColor(update.status))} />
                <span className="font-medium text-sm">{update.project?.name}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{update.content}</p>
              <p className="text-xs text-gray-400 mt-1">
                {update.author?.name} · {formatDate(update.createdAt)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
