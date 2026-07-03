'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface Mention {
  id: string;
  content: string;
  taskId: string;
  taskName: string;
  projectId: string | null;
  createdAt: string;
  author: {
    name: string;
    image: string | null;
  };
}

// Size / Remove are handled by WidgetContainer now — no props needed.
export function MentionsWidget() {
  const router = useRouter();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMentions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mentions?limit=5');
      if (res.ok) {
        const data = await res.json();
        setMentions(data);
      } else {
        setError('Failed to load mentions');
      }
    } catch (error) {
      console.error('Failed to fetch mentions:', error);
      setError('Failed to load mentions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  const formatDate = (date: string) => {
    const now = new Date();
    const d = new Date(date);
    const diff = now.getTime() - d.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Title + info tooltip + ⋯ menu are provided by the
          WidgetContainer above. AVAILABLE_WIDGETS already pairs
          this widget with titleIcon='info' so the info badge renders
          next to the container's "Comments with mentions" title. */}

      {/* ========== CONTENT ========== */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchMentions}>
              Retry
            </Button>
          </div>
        ) : mentions.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageCircle className="h-16 w-16 text-gray-200 mb-4" />
            <p className="text-gray-500 text-sm">
              When you are @-mentioned in a comment, it will appear here.
            </p>
          </div>
        ) : (
          /* Mentions list */
          <div className="space-y-2">
            {mentions.map((mention) => (
              <button
                key={mention.id}
                className="w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                onClick={() => router.push(`/tasks/${mention.taskId}`)}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={mention.author.image || undefined} />
                    <AvatarFallback className="text-xs bg-gray-900 text-white">
                      {mention.author.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <span className="font-medium text-sm truncate">{mention.author.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(mention.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{mention.content}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      on {mention.taskName}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
