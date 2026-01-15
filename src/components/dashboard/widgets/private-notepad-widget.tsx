'use client';

import { useEffect, useState, useCallback } from 'react';
import { StickyNote, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'buildsync-private-notepad';

export function PrivateNotepadWidget() {
  const [content, setContent] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setContent(data.content || '');
        setLastSaved(data.savedAt ? new Date(data.savedAt) : null);
      } catch {
        setContent(saved);
      }
    }
  }, []);

  const saveNote = useCallback(() => {
    const data = {
      content,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setIsSaved(true);
    setLastSaved(new Date());
  }, [content]);

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (isSaved) return;
    const timer = setTimeout(saveNote, 2000);
    return () => clearTimeout(timer);
  }, [content, isSaved, saveNote]);

  const handleChange = (value: string) => {
    setContent(value);
    setIsSaved(false);
  };

  const formatLastSaved = () => {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return lastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between -mt-1">
        <span className="text-sm text-slate-500">
          Only visible to you
        </span>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-slate-400">
              {isSaved ? `Saved ${formatLastSaved()}` : 'Saving...'}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              isSaved ? "text-slate-400" : "text-black"
            )}
            onClick={saveNote}
            disabled={isSaved}
          >
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <Textarea
        placeholder="Add a quick note or link to an important resource..."
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-[120px] resize-none text-sm"
      />

      {!content && (
        <div className="text-center py-4">
          <StickyNote className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-xs text-slate-400">
            Your notes are stored locally and only visible to you
          </p>
        </div>
      )}
    </div>
  );
}
