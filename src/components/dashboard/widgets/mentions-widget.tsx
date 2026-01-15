'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Mention {
  id: string;
  content: string;
  taskId: string;
  taskName: string;
  createdAt: string;
  author: {
    name: string;
    image: string | null;
  };
}

export function MentionsWidget() {
  const router = useRouter();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMentions() {
      try {
        const res = await fetch('/api/mentions?limit=5');
        if (res.ok) {
          const data = await res.json();
          setMentions(data);
        }
      } catch (error) {
        console.error('Failed to fetch mentions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchMentions();
  }, []);

  const formatDate = (date: string) => {
    const now = new Date();
    const d = new Date(date);
    const diff = now.getTime() - d.getTime();

    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between -mt-1">
        <span className="text-sm text-slate-500">Comments where you were @mentioned</span>
        <Button
          variant="link"
          size="sm"
          className="text-black hover:text-black p-0 h-auto"
          onClick={() => router.push('/inbox?filter=mentions')}
        >
          View all <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : mentions.length === 0 ? (
        <div className="text-center py-8">
          <AtSign className="h-12 w-12 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-900 mb-1">No mentions</p>
          <p className="text-sm text-slate-500">
            Comments where you&apos;re @mentioned will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mentions.map((mention) => (
            <button
              key={mention.id}
              className="w-full p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
              onClick={() => router.push(`/tasks/${mention.taskId}`)}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={mention.author.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {mention.author.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">{mention.author.name}</p>
                    <span className="text-xs text-slate-400">{formatDate(mention.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">on {mention.taskName}</p>
                  <p className="text-sm text-slate-600 line-clamp-1 mt-1">{mention.content}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
