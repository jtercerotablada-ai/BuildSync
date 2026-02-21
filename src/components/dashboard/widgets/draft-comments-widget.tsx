'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DraftComment {
  id: string;
  content: string;
  taskId: string;
  taskName: string;
  createdAt: string;
}

const STORAGE_KEY = 'buildsync-draft-comments';

export function DraftCommentsWidget() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load drafts from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setDrafts(data);
      } catch {
        setDrafts([]);
      }
    }
    setLoading(false);
  }, []);

  const deleteDraft = (id: string) => {
    const updated = drafts.filter(d => d.id !== id);
    setDrafts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between -mt-1">
        <span className="text-sm text-slate-500">Comments you haven&apos;t sent yet</span>
        {drafts.length > 0 && (
          <span className="text-xs text-slate-400">{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-8">
          <MessageCircle className="h-12 w-12 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-900 mb-1">No draft comments</p>
          <p className="text-sm text-slate-500">
            Unsent comments will be saved here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  className="text-left flex-1 min-w-0"
                  onClick={() => router.push(`/my-tasks`)}
                >
                  <p className="text-xs text-slate-500 truncate">On: {draft.taskName}</p>
                  <p className="text-sm text-slate-700 line-clamp-2">{draft.content}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(draft.createdAt)}</p>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-black"
                  onClick={() => deleteDraft(draft.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
