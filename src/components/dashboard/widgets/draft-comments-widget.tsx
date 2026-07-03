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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    // Load drafts from API (DB-persisted), fall back to localStorage
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/users/preferences');
        if (res.ok && !cancelled) {
          const prefs = await res.json();
          const ui = prefs.uiState as { draftComments?: DraftComment[] } | null;
          if (ui?.draftComments && Array.isArray(ui.draftComments)) {
            setDrafts(ui.draftComments);
            setLoading(false);
            return;
          }
        }
      } catch {
        // ignore
      }
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const data = JSON.parse(saved);
          setDrafts(data);
        }
      } catch {
        setDrafts([]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const deleteDraft = async (id: string) => {
    const previous = drafts;
    const updated = drafts.filter(d => d.id !== id);
    setDrafts(updated);
    setDeleteError(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    const restore = () => {
      setDrafts(previous);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(previous));
      } catch {
        // ignore
      }
      setDeleteError('Could not delete draft. Please try again.');
    };

    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiState: { draftComments: updated } }),
      });
      if (!res.ok) restore();
    } catch {
      restore();
    }
  };

  const formatDate = (date: string) => {
    const now = new Date();
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
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
      <div className="flex items-center justify-between -mt-1 mb-4 flex-shrink-0">
        <span className="text-sm text-slate-500">Comments you haven&apos;t sent yet</span>
        {drafts.length > 0 && (
          <span className="text-xs text-slate-400">{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {deleteError && (
        <p className="text-xs text-red-600 mb-2 flex-shrink-0" role="alert">{deleteError}</p>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 text-slate-300" />
            <p className="font-medium text-slate-900 mb-1">No draft comments</p>
            <p className="text-sm text-slate-500">
              Coming soon &middot; unsent comments will be saved here as drafts
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
                    className="text-left flex-1 min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                    onClick={() => router.push(draft.taskId ? `/tasks/${draft.taskId}` : '/my-tasks')}
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
                    aria-label="Delete draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
