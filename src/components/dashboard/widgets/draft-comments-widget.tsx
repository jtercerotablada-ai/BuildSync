'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUiState } from '@/hooks/use-ui-state';

interface DraftComment {
  id: string;
  content: string;
  taskId: string;
  taskName: string;
  createdAt: string;
}

export function DraftCommentsWidget() {
  const router = useRouter();
  // Shared uiState hook: joins the home page's single deduped
  // GET /api/users/preferences (instead of issuing its own copy),
  // handles the localStorage cache, and persists writes through the
  // debounced key-scoped PATCH.
  const {
    value: drafts,
    setValue: setDrafts,
    isHydrated,
  } = useUiState<DraftComment[]>('draftComments', []);

  const deleteDraft = async (draft: DraftComment) => {
    const previous = drafts;
    const updated = previous.filter(d => d.id !== draft.id);
    setDrafts(updated);
    try {
      // The hook's debounced PATCH swallows transport failures, and the
      // next load prefers the DB — a silently failed delete would
      // resurrect the draft. Await one explicit PATCH so failure can
      // restore the row.
      const res = await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiState: { draftComments: updated } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Draft deleted', {
        action: {
          label: 'Undo',
          onClick: () => setDrafts(previous),
        },
      });
    } catch {
      setDrafts(previous);
      toast.error('Could not delete draft. Please try again.');
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

      <div className="flex-1 overflow-y-auto">
        {!isHydrated ? (
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
                    onClick={() => deleteDraft(draft)}
                    aria-label={`Delete draft on ${draft.taskName}`}
                    title={`Delete draft on ${draft.taskName}`}
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
