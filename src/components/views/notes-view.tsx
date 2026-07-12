"use client";

/**
 * Notes view — a free-form project document (Asana's "Notas" tab).
 *
 * One rich-ish notes doc per project, persisted to Project.notes via
 * PATCH /api/projects/[id]. Auto-saves on a debounce + on blur, with a
 * subtle save-status indicator. Read-only for non-editors.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NotebookPen,
  Check,
  Loader2,
  AlertCircle,
  CalendarDays,
  ClipboardList,
  Link2,
  CalendarRange,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

interface NotesViewProps {
  projectId: string;
  initialNotes: string | null | undefined;
  canEdit: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// ─── Note templates — Asana's chips on an empty note. The meeting
// template mirrors Asana's stock "Notas de la reunión" structure. ───

const NOTE_TEMPLATES: {
  key: string;
  label: string;
  Icon: LucideIcon;
  content: string;
}[] = [
  {
    key: "meeting",
    label: "Meeting notes",
    Icon: CalendarDays,
    content: `Meeting notes

🗓️ What's the date?

👥 Attendees
• Use @ to include attendees.

📝 Agenda
• Track the topics here.
• Link the relevant tasks and projects.

✍️ Notes
• Add notes here.

🎯 Action items
• Add the activities that need to happen.
• Turn action items into project tasks so they get done.

────────────────────────

🗓️ Previous date
• Notes from previous meetings can be added here.
`,
  },
  {
    key: "context",
    label: "Project context",
    Icon: ClipboardList,
    content: `Project context

🌟 Overview
• What is this project about, in one or two sentences?

🎯 Goals
• What does success look like?

🧭 Background
• Why now? Key decisions and constraints so far.

🔗 Related resources
• Link specs, drawings, calcs, and reference docs here.
`,
  },
  {
    key: "resources",
    label: "Key resources",
    Icon: Link2,
    content: `Key resources

📄 Documents
• Link the project brief, contracts, and specs.

🔗 Links
• Add portals, drives, and external tools.

👥 Contacts
• Client, contractor, inspector — names and emails.
`,
  },
  {
    key: "weekly",
    label: "Weekly planning",
    Icon: CalendarRange,
    content: `Weekly planning

📅 Week of …

⭐ Top priorities
• What must ship this week?

📋 To do
• …

🚧 Blockers
• What's in the way?

✅ Wins
• What moved forward?
`,
  },
  {
    key: "blank",
    label: "Blank note",
    Icon: FileText,
    content: "",
  },
];

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

  // Template chips (Asana's empty-note gallery) — insert the template
  // body and focus the editor; "Blank note" just focuses.
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  function applyTemplate(content: string) {
    if (content) handleChange(content);
    // setTimeout, not rAF — rAF is throttled in background tabs and the
    // focus would silently never happen.
    setTimeout(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(0, 0);
      editorRef.current?.scrollTo?.(0, 0);
    }, 0);
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
            <>
              {/* Asana's empty-note ghost title */}
              {!value.trim() && (
                <p className="text-[28px] leading-9 font-medium text-slate-300 text-center mb-6 select-none pointer-events-none">
                  Untitled note
                </p>
              )}
              <textarea
                ref={editorRef}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="Start writing…"
                className={cnNotes(
                  "w-full resize-none border-0 outline-none text-[15px] leading-7 text-slate-800 placeholder:text-slate-400 bg-transparent",
                  value.trim() ? "min-h-[60vh]" : "min-h-[3rem] text-center"
                )}
                spellCheck
              />
              {/* Template chips — Asana shows these on an empty note */}
              {!value.trim() && (
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {NOTE_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => applyTemplate(t.content)}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] bg-white border border-[#C4C6C8] text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                      <t.Icon className="w-3.5 h-3.5 text-slate-500" />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
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
      <span className="flex items-center gap-1.5 text-xs text-[#14865E]">
        <Check className="h-3.5 w-3.5" />
        Saved · Just now
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[#B4304C]">
        <AlertCircle className="h-3.5 w-3.5" />
        Save failed
      </span>
    );
  }
  // Asana: "Todos los cambios se guardarán automáticamente"
  return (
    <span className="text-xs text-slate-400">
      All changes are saved automatically
    </span>
  );
}

// Tiny local class combiner — keeps this file dependency-free.
function cnNotes(...classes: (string | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
