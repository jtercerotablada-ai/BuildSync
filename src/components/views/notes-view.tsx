"use client";

/**
 * Notes view — a free-form project document (Asana's "Notas" tab).
 *
 * One rich-ish notes doc per project, persisted to Project.notes via
 * PATCH /api/projects/[id]. Auto-saves on a debounce + on blur, with a
 * subtle save-status indicator. Read-only for non-editors.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { NotebookPen, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface NotesViewProps {
  projectId: string;
  initialNotes: string | null | undefined;
  canEdit: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function NotesView({ projectId, initialNotes, canEdit }: NotesViewProps) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNotes ?? "");
  // Latest typed value, readable from the unmount cleanup (which closes over
  // the first render's scope, so it can't see `value` directly).
  const valueRef = useRef(initialNotes ?? "");
  // projectId in a ref for the same reason — the cleanup must PATCH the
  // project it was editing, not a later one.
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  // Cancel any in-flight save when a newer one starts, so a slow PATCH can't
  // land after (and clobber) a newer one on a slow connection.
  const abortRef = useRef<AbortController | null>(null);

  // Keep local state in sync if the project prop changes underneath us
  // (e.g. navigating between projects reuses this component).
  useEffect(() => {
    setValue(initialNotes ?? "");
    valueRef.current = initialNotes ?? "";
    lastSavedRef.current = initialNotes ?? "";
    setSaveState("idle");
  }, [projectId, initialNotes]);

  // Raw persist — no React state updates, safe to call from cleanup after
  // unmount. Aborts any prior in-flight save first so writes stay ordered.
  // Returns whether it wrote (throws AbortError if superseded).
  const persist = useCallback(async (id: string, next: string) => {
    if (next === lastSavedRef.current) return true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: next }),
      signal: ac.signal,
    });
    if (res.ok) lastSavedRef.current = next;
    return res.ok;
  }, []);

  const save = useCallback(
    async (next: string) => {
      if (next === lastSavedRef.current) return;
      setSaveState("saving");
      try {
        const ok = await persist(projectIdRef.current, next);
        if (!ok) throw new Error("Save failed");
        setSaveState("saved");
      } catch (err) {
        // Superseded by a newer save — its handler will set the state.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSaveState("error");
        toast.error(
          err instanceof Error ? err.message : "Couldn't save notes"
        );
      }
    },
    [persist]
  );

  // Flush any pending debounce on unmount so a quick tab-away (which may not
  // fire a blur) doesn't drop the last keystrokes. Fire-and-forget — the
  // fetch outlives the component.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (valueRef.current !== lastSavedRef.current) {
        void persist(projectIdRef.current, valueRef.current);
      }
    };
  }, [persist]);

  function handleChange(next: string) {
    setValue(next);
    valueRef.current = next;
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(next), 800);
  }

  function handleBlur() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value !== lastSavedRef.current) save(value);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-700">
          <NotebookPen className="h-4 w-4 text-[#a8893a]" />
          <span className="text-sm font-semibold">Notes</span>
        </div>
        <SaveIndicator state={saveState} canEdit={canEdit} />
      </div>

      {/* Document */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
          {canEdit ? (
            <textarea
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              placeholder="Take meeting notes, jot down ideas, or document decisions for this project…"
              className="w-full min-h-[60vh] resize-none border-0 outline-none text-[15px] leading-7 text-slate-800 placeholder:text-slate-400 bg-transparent"
              spellCheck
            />
          ) : value.trim() ? (
            <div className="whitespace-pre-wrap text-[15px] leading-7 text-slate-800">
              {value}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <NotebookPen className="h-8 w-8 mx-auto mb-3 opacity-60" />
              <p className="text-sm">No notes yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({
  state,
  canEdit,
}: {
  state: SaveState;
  canEdit: boolean;
}) {
  if (!canEdit) {
    return <span className="text-xs text-slate-400">Read-only</span>;
  }
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-600">
        <AlertCircle className="h-3.5 w-3.5" />
        Save failed
      </span>
    );
  }
  return <span className="text-xs text-slate-300">Auto-saves</span>;
}
