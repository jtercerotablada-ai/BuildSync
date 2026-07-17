"use client";

/**
 * Notes view — Asana's full-page note editor, cloned 1:1.
 *
 * Layout: 50px formatting toolbar, notes-list gutter button, a centered
 * ~600px document (editable title + rich-text body), template chips on an
 * empty note, and a floating "Send feedback" button.
 *
 * Storage: MANY notes per project (ProjectNote rows) via
 * /api/projects/[id]/notes[/noteId]. The notes-list panel switches between
 * them. A brand-new note is a local draft until its first non-empty save,
 * so merely opening the tab never creates junk rows.
 * HTML is sanitized with DOMPurify on load, paste, and save.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  Plus,
  Undo2,
  Redo2,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Strikethrough,
  List,
  ListOrdered,
  TextQuote,
  Link2,
  Code,
  SquareCode,
  Sparkles,
  CircleCheck,
  Search,
  X,
  ChevronUp,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  CalendarDays,
  ClipboardList,
  CalendarRange,
  FileText,
  Trash2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NotesViewProps {
  projectId: string;
  canEdit: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// ─── Storage ───────────────────────────────────────────────────────────

/** A ProjectNote row as returned by /api/projects/[id]/notes. */
interface NoteRow {
  id: string;
  title: string;
  content: string;
  position: number;
  updatedAt: string;
}

interface StoredNote {
  title: string;
  html: string;
}

/** Stable key for dirty-checking a note's editor content. */
function noteKey(title: string, html: string): string {
  return JSON.stringify([title, html]);
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "div", "br", "h1", "h2", "h3",
    "b", "strong", "i", "em", "u", "s", "strike", "del",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "a", "hr", "mark", "span", "font",
  ],
  // No target/rel: createLink never emits them and a stored target=_blank
  // without rel enables reverse tabnabbing on older browsers.
  ALLOWED_ATTR: ["href", "style"],
};

// The editor only needs inline style for the highlighter's background-color,
// but DOMPurify passes ANY style value through — which allows stored CSS
// injection (position:fixed overlays, url() beacons to attacker servers).
// Use a dedicated DOMPurify instance (a global hook would strip legitimate
// styles in the other editors that share the default instance) and keep only
// plain color declarations.
const SAFE_STYLE_DECL =
  /^\s*(?:background-color|color)\s*:\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([\d.,%\s]+\)|transparent|[a-zA-Z]+)\s*$/;

const notesPurifier = typeof window !== "undefined" ? DOMPurify(window) : null;
notesPurifier?.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "style") return;
  const kept = data.attrValue
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => SAFE_STYLE_DECL.test(d));
  data.attrValue = kept.join("; ");
  if (!data.attrValue) data.keepAttr = false;
});

// Match the server-side zod limits on ProjectNote.
const NOTES_MAX = 100000;
const TITLE_MAX = 255;

function sanitizeHtml(html: string): string {
  // SSR never renders note HTML (all innerHTML writes happen in effects).
  if (!notesPurifier) return html;
  return notesPurifier.sanitize(html, SANITIZE_CONFIG);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain-text preview of a note's HTML for the notes list. */
function snippetOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// "<p><br></p>" and friends count as blank; real structure (hr/li/pre) doesn't.
function isHtmlBlank(html: string): boolean {
  if (!html) return true;
  if (/<(hr|li|img|pre)[\s>/]/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

function computeBodyEmpty(el: HTMLElement | null): boolean {
  if (!el) return true;
  if ((el.textContent || "").trim()) return false;
  return !el.querySelector("hr,li,img,pre");
}

// ─── Templates — Asana's chips on an empty note ────────────────────────
// The meeting template mirrors Asana's stock "Meeting notes".

interface NoteTemplate {
  key: string;
  label: string;
  Icon: LucideIcon;
  title: string;
  html: string;
}

const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    key: "meeting",
    label: "Meeting notes",
    Icon: CalendarDays,
    title: "Meeting notes",
    html:
      "<h2>🗓️ What's the date?</h2><p><br></p>" +
      "<h2>👥 Attendees</h2><ul><li>Use @ to include attendees.</li></ul>" +
      "<h2>📝 Agenda</h2><ul><li>Track the topics here.</li><li>Use @ to link relevant tasks and projects.</li></ul>" +
      "<h2>✍️ Notes</h2><ul><li>Add notes here.</li></ul>" +
      "<h2>🎯 Action items</h2><ul><li>Add the activities that need to happen.</li><li>Highlight text and select “Create task” to turn it into a task.</li></ul>" +
      "<hr>" +
      "<h2>🗓️ Previous date</h2><ul><li>Notes from previous meetings can be added here.</li></ul>",
  },
  {
    key: "context",
    label: "Project context",
    Icon: ClipboardList,
    title: "Project context",
    html:
      "<h2>🌟 Overview</h2><ul><li>What is this project about, in one or two sentences?</li></ul>" +
      "<h2>🎯 Goals</h2><ul><li>What does success look like?</li></ul>" +
      "<h2>🧭 Background</h2><ul><li>Why now? Key decisions and constraints so far.</li></ul>" +
      "<h2>🔗 Related resources</h2><ul><li>Link specs, drawings, calcs and reference docs here.</li></ul>",
  },
  {
    key: "resources",
    label: "Key resources",
    Icon: Link2,
    title: "Key resources",
    html:
      "<h2>📄 Documents</h2><ul><li>Link the project brief, contracts and specs.</li></ul>" +
      "<h2>🔗 Links</h2><ul><li>Add portals, drives and external tools.</li></ul>" +
      "<h2>👥 Contacts</h2><ul><li>Client, contractor, inspector — names and emails.</li></ul>",
  },
  {
    key: "weekly",
    label: "Weekly planning",
    Icon: CalendarRange,
    title: "Weekly planning",
    html:
      "<h2>📅 Week of…</h2><p><br></p>" +
      "<h2>⭐ Top priorities</h2><ul><li>What must ship this week?</li></ul>" +
      "<h2>📋 To do</h2><ul><li><br></li></ul>" +
      "<h2>🚧 Blockers</h2><ul><li>What's in the way?</li></ul>" +
      "<h2>✅ Wins</h2><ul><li>What moved forward?</li></ul>",
  },
  {
    key: "blank",
    label: "Blank note",
    Icon: FileText,
    title: "",
    html: "",
  },
];

// ─── Block insert menu (toolbar "+", first-line "+", and "/" command) ──

type BlockAction =
  | "p" | "h1" | "h2" | "h3"
  | "ul" | "ol" | "quote" | "codeblock" | "divider";

const BLOCK_ITEMS: { action: BlockAction; label: string; Icon: LucideIcon }[] = [
  { action: "p", label: "Normal text", Icon: Pilcrow },
  { action: "h1", label: "Heading 1", Icon: Heading1 },
  { action: "h2", label: "Heading 2", Icon: Heading2 },
  { action: "h3", label: "Heading 3", Icon: Heading3 },
  { action: "ul", label: "Bulleted list", Icon: List },
  { action: "ol", label: "Numbered list", Icon: ListOrdered },
  { action: "quote", label: "Quote", Icon: TextQuote },
  { action: "codeblock", label: "Code block", Icon: SquareCode },
  { action: "divider", label: "Divider", Icon: Minus },
];

const FORMAT_LABELS: Record<string, string> = {
  p: "Normal text",
  div: "Normal text",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  blockquote: "Quote",
  pre: "Code",
};

const HIGHLIGHT_COLOR = "#FEF3C7";

interface FmtState {
  inEditor: boolean;
  hasSelection: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
  quote: boolean;
  codeblock: boolean;
  inLink: boolean;
  block: string;
  canUndo: boolean;
  canRedo: boolean;
}

const DEFAULT_FMT: FmtState = {
  inEditor: false, hasSelection: false,
  bold: false, italic: false, underline: false, strike: false,
  ul: false, ol: false, quote: false, codeblock: false, inLink: false,
  block: "", canUndo: false, canRedo: false,
};

interface MenuPos {
  x: number;
  y: number;
}

// ─── Component ─────────────────────────────────────────────────────────

export function NotesView({ projectId, canEdit }: NotesViewProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);

  const [notes, setNotes] = useState<NoteRow[]>([]);
  // null = an unsaved draft (a brand-new note that has no row yet).
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [titleEmpty, setTitleEmpty] = useState(true);
  const [bodyEmpty, setBodyEmpty] = useState(true);
  const [fmt, setFmt] = useState<FmtState>(DEFAULT_FMT);

  // Menus / popovers
  const [blockMenu, setBlockMenu] = useState<(MenuPos & { fromSlash: boolean; query: string; index: number }) | null>(null);
  const [linkPop, setLinkPop] = useState<(MenuPos & { url: string }) | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<Range[]>([]);
  const [matchIdx, setMatchIdx] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  // ── Save machinery: contentRef always holds the latest title/body so the
  // unmount flush works after editorRef detaches. Sanitizes at save time.
  const contentRef = useRef<StoredNote>({ title: "", html: "" });
  const lastSavedRef = useRef<string>(noteKey("", ""));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // One AbortController PER NOTE: a save for note B must never abort note
  // A's in-flight PATCH (selectNote flushes A then rebinds to B at once).
  const abortsRef = useRef<Map<string, AbortController>>(new Map());
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  // The note the editor is currently bound to, readable synchronously from
  // save() so a debounce that fires mid-switch still targets the note it
  // was scheduled for.
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  // Identity of the current unsaved draft. Drafts have no id, so `null`
  // alone can't tell "my draft is still active" from "a DIFFERENT draft is
  // active now" — without this, a POST resolving after "+ New note" adopts
  // the created row and the next save blanks it.
  const draftSeqRef = useRef(0);
  // In-flight POST, tagged with the draft it belongs to.
  const creatingRef = useRef<{ seq: number; promise: Promise<NoteRow> } | null>(
    null
  );
  // Live mirror of `notes` for callbacks that must not read a stale closure.
  const notesRef = useRef<NoteRow[]>([]);
  notesRef.current = notes;
  const savedSelectionRef = useRef<Range | null>(null);

  /** Current editor content, sanitized. */
  const readContent = useCallback((): StoredNote => {
    return {
      title: contentRef.current.title.trim(),
      html: sanitizeHtml(contentRef.current.html),
    };
  }, []);

  const buildSerialized = useCallback(
    (): string => {
      const { title, html } = readContent();
      return noteKey(title, html);
    },
    [readContent]
  );

  const isBlank = useCallback((n: StoredNote) => !n.title && isHtmlBlank(n.html), []);

  const errorFrom = async (res: Response, fallback: string) => {
    try {
      const body = await res.json();
      if (typeof body?.error === "string" && body.error) return body.error;
    } catch {
      // keep the fallback
    }
    return fallback;
  };

  const save = useCallback(async () => {
    // Capture the target note synchronously — switching notes later must
    // not redirect this write.
    const noteId = activeIdRef.current;
    const draftSeq = draftSeqRef.current;
    const projId = projectIdRef.current;
    const content = readContent();
    const key = noteKey(content.title, content.html);
    /** Is the editor still parked on the exact note this save started on? */
    const stillMine = () =>
      activeIdRef.current === noteId &&
      (noteId !== null || draftSeqRef.current === draftSeq);

    const settle = (state: SaveState) => {
      // Only touch the indicator if we're still on the note we saved.
      if (!stillMine()) return;
      setSaveState(state);
      if (state === "saved") {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        // Back to Asana's permanent auto-save message after a moment.
        savedTimerRef.current = setTimeout(() => setSaveState("idle"), 3000);
      }
    };

    if (key === lastSavedRef.current) {
      // An edit that round-tripped back to the saved value (type+undo) —
      // clear the pending "Saving…" or it sticks forever.
      if (stillMine()) {
        setSaveState((s) => (s === "saving" ? "idle" : s));
      }
      return;
    }
    if (content.html.length > NOTES_MAX) {
      settle("error");
      toast.error(
        "This note is over the 100,000 character limit. Trim it to save.",
        { id: "note-too-large" }
      );
      return;
    }
    // An empty draft is nothing to create — Asana doesn't persist it either.
    if (noteId === null && isBlank(content)) {
      settle("idle");
      return;
    }

    settle("saving");
    try {
      if (noteId === null) {
        // Draft → create the row. Deduped PER DRAFT: a second debounce for
        // the SAME draft awaits the first POST, while a different draft
        // (after "+ New note") must create its own row.
        if (!creatingRef.current || creatingRef.current.seq !== draftSeq) {
          const promise = (async () => {
            const res = await fetch(`/api/projects/${projId}/notes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: content.title, content: content.html }),
            });
            if (!res.ok) throw new Error(await errorFrom(res, "Couldn't save the note"));
            return (await res.json()) as NoteRow;
          })();
          creatingRef.current = { seq: draftSeq, promise };
          void promise.catch(() => {}).finally(() => {
            if (creatingRef.current?.seq === draftSeq) creatingRef.current = null;
          });
        }
        const created = await creatingRef.current.promise;
        setNotes((prev) =>
          prev.some((n) => n.id === created.id) ? prev : [...prev, created]
        );
        // Adopt the new id ONLY if THIS draft is still in the editor. If the
        // user moved on (another draft, or another note), the row exists and
        // the list shows it — adopting here would retarget the next save at
        // the new row and blank it.
        if (!stillMine()) return;
        lastSavedRef.current = noteKey(created.title, created.content);
        setActiveId(created.id);
        activeIdRef.current = created.id;
        // A newer keystroke may have landed while the POST was in flight.
        if (buildSerialized() !== lastSavedRef.current) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => void save(), 0);
          return;
        }
        settle("saved");
        return;
      }

      // Mirror the edit into the list BEFORE the round-trip: notes[] is
      // what selectNote rebinds from, so leaving and re-entering a note
      // mid-PATCH must not restore its pre-edit content (which the next
      // save would then write back, undoing the edit).
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, title: content.title, content: content.html }
            : n
        )
      );
      abortsRef.current.get(noteId)?.abort();
      const ac = new AbortController();
      abortsRef.current.set(noteId, ac);
      const res = await fetch(`/api/projects/${projId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: content.title, content: content.html }),
        signal: ac.signal,
      });
      if (abortsRef.current.get(noteId) === ac) abortsRef.current.delete(noteId);
      if (!res.ok) throw new Error(await errorFrom(res, "Couldn't save the note"));
      if (stillMine()) lastSavedRef.current = key;
      settle("saved");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      settle("error");
      toast.error(err instanceof Error ? err.message : "Couldn't save the note");
    }
  }, [readContent, buildSerialized, isBlank]);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), 800);
  }, [save]);

  /** Run any pending debounce NOW, against the note it was scheduled for. */
  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void save();
  }, [save]);

  /** Point the editor at a note (or a blank draft when `note` is null). */
  const bindEditor = useCallback((note: NoteRow | null) => {
    // Every fresh draft gets a new identity, so a POST resolving later can
    // tell whether the draft it was saving is still the one on screen.
    if (note === null) draftSeqRef.current += 1;
    const title = note?.title ?? "";
    const html = sanitizeHtml(note?.content ?? "");
    contentRef.current = { title, html };
    lastSavedRef.current = noteKey(title, html);
    if (titleRef.current) titleRef.current.textContent = title;
    if (editorRef.current) editorRef.current.innerHTML = html;
    setTitleEmpty(!title.trim());
    setBodyEmpty(computeBodyEmpty(editorRef.current));
    setSaveState("idle");
  }, []);

  // ── Load the project's notes ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/notes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows: NoteRow[] = await res.json();
        if (cancelled) return;
        setNotes(rows);
        const first = rows[0] ?? null;
        setActiveId(first?.id ?? null);
        activeIdRef.current = first?.id ?? null;
        bindEditor(first);
      } catch (err) {
        console.error("Error fetching notes:", err);
        if (!cancelled) toast.error("Couldn't load notes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // non-fatal
    }
    return () => {
      cancelled = true;
    };
  }, [projectId, bindEditor]);

  // ── Teardown flush ────────────────────────────────────────────────────
  // Fire-and-forget write of the pending edit. Can't await (it runs from an
  // unmount cleanup or pagehide), so it must not go through save(): instead
  // it reuses save()'s in-flight create so a draft can never be POSTed
  // twice, and it never marks the note saved before the write lands.
  const flushedKeyRef = useRef<string | null>(null);
  const flushNow = useCallback((keepalive: boolean) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const noteId = activeIdRef.current;
    const draftSeq = draftSeqRef.current;
    const projId = projectIdRef.current;
    const content = {
      title: contentRef.current.title.trim(),
      html: sanitizeHtml(contentRef.current.html),
    };
    const key = noteKey(content.title, content.html);
    if (key === lastSavedRef.current || content.html.length > NOTES_MAX) return;
    if (noteId === null && !content.title && isHtmlBlank(content.html)) return;
    // pagehide and visibilitychange can both fire on the same teardown —
    // dedupe by content instead of lying about lastSavedRef (marking it
    // saved before the request lands turns a failed flush into silent loss).
    if (key === flushedKeyRef.current) return;
    flushedKeyRef.current = key;

    const init = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: content.title, content: content.html }),
      keepalive: keepalive && content.html.length < 60000,
    };
    try {
      if (noteId === null) {
        const inflight = creatingRef.current;
        if (inflight && inflight.seq === draftSeq) {
          // A create for this draft is already on the wire — PATCH the row
          // it produces rather than creating a second one.
          void inflight.promise
            .then((created) =>
              fetch(`/api/projects/${projId}/notes/${created.id}`, {
                method: "PATCH",
                ...init,
              })
            )
            .catch(() => {});
          return;
        }
        void fetch(`/api/projects/${projId}/notes`, {
          method: "POST",
          ...init,
        }).catch(() => {});
        return;
      }
      void fetch(`/api/projects/${projId}/notes/${noteId}`, {
        method: "PATCH",
        ...init,
      }).catch(() => {});
    } catch {
      // best-effort
    }
  }, []);

  // Flush on unmount (SPA navigation away from the tab).
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      flushNow(false);
    };
  }, [flushNow]);

  // React cleanups don't run on tab close / hard navigation — flush on
  // pagehide and on tab-hide with keepalive so the last debounce window
  // isn't silently lost. keepalive bodies are capped (~64KB), so very large
  // notes fall back to a best-effort plain fetch.
  useEffect(() => {
    const onHide = () => flushNow(true);
    const onVis = () => {
      if (document.visibilityState === "hidden") flushNow(true);
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flushNow]);

  // ── Notes-list actions ────────────────────────────────────────────────

  const selectNote = useCallback(
    (id: string | null) => {
      if (id === activeIdRef.current) return;
      flushSave(); // targets the note we're leaving (save captured its id)
      // notesRef, not the `notes` closure: flushSave's optimistic list
      // update lands synchronously in the ref, so re-entering a note that
      // is mid-save rebinds its LATEST content, not the pre-edit copy.
      const next =
        id === null ? null : notesRef.current.find((n) => n.id === id) ?? null;
      setActiveId(id);
      activeIdRef.current = id;
      bindEditor(next);
      setTimeout(() => editorRef.current?.focus(), 0);
    },
    [flushSave, bindEditor]
  );

  /** "+ New note": park the editor on a fresh draft. */
  const newNote = useCallback(() => {
    flushSave();
    setActiveId(null);
    activeIdRef.current = null;
    bindEditor(null);
    setTimeout(() => titleRef.current?.focus(), 0);
  }, [flushSave, bindEditor]);

  const deleteNote = useCallback(
    async (id: string) => {
      const row = notesRef.current.find((n) => n.id === id);
      if (!row) return;
      const label = row.title.trim() || "Untitled note";
      if (!confirm(`Delete "${label}"?`)) return;
      try {
        const res = await fetch(`/api/projects/${projectIdRef.current}/notes/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(await errorFrom(res, "Couldn't delete the note"));
        // Functional update: a note created while the DELETE was in flight
        // must not be dropped by a stale snapshot.
        setNotes((prev) => prev.filter((n) => n.id !== id));
        const remaining = notesRef.current.filter((n) => n.id !== id);
        if (activeIdRef.current === id) {
          // Cancel any pending save for the note we just deleted, or it
          // would 404 (or worse, resurrect nothing) right after.
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = null;
          const next = remaining[0] ?? null;
          setActiveId(next?.id ?? null);
          activeIdRef.current = next?.id ?? null;
          bindEditor(next);
        }
        toast.success("Note deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete the note");
      }
    },
    [bindEditor]
  );

  // ── Selection helpers ─────────────────────────────────────────────────

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (
      sel && sel.rangeCount > 0 && editorRef.current &&
      editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)
    ) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    // If the editor is still focused with a live selection inside it, keep
    // it — it's fresher than the saved ref (selectionchange fires
    // asynchronously, so savedSelectionRef can lag one edit behind and
    // restoring it would apply the command to the previous block). The
    // focus check matters: when focus is elsewhere (link popover input),
    // window.getSelection() can still report a stale editor range, and
    // focusing the editor collapses it — so we must restore the saved
    // range in that case, and only decide BEFORE calling focus().
    const active = document.activeElement;
    if (
      sel && sel.rangeCount > 0 && editor &&
      (active === editor || editor.contains(active)) &&
      editor.contains(sel.getRangeAt(0).commonAncestorContainer)
    ) {
      return;
    }
    editor?.focus();
    if (sel && savedSelectionRef.current) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
        return;
      } catch {
        // stale range — fall through
      }
    }
    if (sel && editorRef.current) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  const refreshFmt = useCallback(() => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    const anchor = sel?.anchorNode ?? null;
    const inEditor = !!(editor && anchor && editor.contains(anchor));
    const qcs = (c: string) => {
      try { return document.queryCommandState(c); } catch { return false; }
    };
    const qce = (c: string) => {
      try { return document.queryCommandEnabled(c); } catch { return false; }
    };
    if (!inEditor) {
      setFmt((f) => ({ ...DEFAULT_FMT, canUndo: f.canUndo, canRedo: f.canRedo }));
      return;
    }
    let block = "";
    try { block = String(document.queryCommandValue("formatBlock")).toLowerCase(); } catch { /* noop */ }
    const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement ?? null;
    setFmt({
      inEditor,
      hasSelection: !!sel && !sel.isCollapsed,
      bold: qcs("bold"),
      italic: qcs("italic"),
      underline: qcs("underline"),
      strike: qcs("strikeThrough"),
      ul: qcs("insertUnorderedList"),
      ol: qcs("insertOrderedList"),
      quote: block === "blockquote",
      codeblock: block === "pre",
      inLink: !!anchorEl?.closest("a"),
      block,
      canUndo: qce("undo"),
      canRedo: qce("redo"),
    });
  }, []);

  useEffect(() => {
    const onSelChange = () => {
      saveSelection();
      refreshFmt();
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, [saveSelection, refreshFmt]);

  // ── Editing primitives ────────────────────────────────────────────────

  // Bumped on every content edit so the in-note search re-collects its
  // ranges from the live DOM (stale Ranges shift/detach after edits).
  const [contentVersion, setContentVersion] = useState(0);

  const afterEdit = useCallback(() => {
    contentRef.current = {
      title: titleRef.current?.textContent?.trim() ?? "",
      html: editorRef.current?.innerHTML ?? "",
    };
    setBodyEmpty(computeBodyEmpty(editorRef.current));
    setContentVersion((v) => v + 1);
    scheduleSave();
    refreshFmt();
  }, [scheduleSave, refreshFmt]);

  const exec = useCallback(
    (command: string, value?: string) => {
      restoreSelection();
      document.execCommand(command, false, value);
      afterEdit();
    },
    [restoreSelection, afterEdit]
  );

  const applyBlockAction = useCallback(
    (action: BlockAction) => {
      switch (action) {
        case "p": exec("formatBlock", "p"); break;
        case "h1": exec("formatBlock", "h1"); break;
        case "h2": exec("formatBlock", "h2"); break;
        case "h3": exec("formatBlock", "h3"); break;
        case "ul": exec("insertUnorderedList"); break;
        case "ol": exec("insertOrderedList"); break;
        case "quote": exec("formatBlock", fmt.quote ? "p" : "blockquote"); break;
        case "codeblock": exec("formatBlock", fmt.codeblock ? "p" : "pre"); break;
        case "divider": exec("insertHTML", "<hr><p><br></p>"); break;
      }
    },
    [exec, fmt.quote, fmt.codeblock]
  );

  const toggleHighlight = useCallback(() => {
    let current = "";
    try { current = String(document.queryCommandValue("hiliteColor")); } catch { /* noop */ }
    const isOn = current.replace(/\s/g, "") === "rgb(254,243,199)";
    exec("hiliteColor", isOn ? "transparent" : HIGHLIGHT_COLOR);
  }, [exec]);

  const toggleInlineCode = useCallback(() => {
    restoreSelection();
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || !editor) return;
    const anchorEl =
      sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement ?? null;
    const codeEl = anchorEl?.closest("code");
    if (codeEl && editor.contains(codeEl) && codeEl.parentElement?.tagName !== "PRE") {
      const parent = codeEl.parentNode;
      if (parent) {
        while (codeEl.firstChild) parent.insertBefore(codeEl.firstChild, codeEl);
        parent.removeChild(codeEl);
      }
      afterEdit();
      return;
    }
    if (sel.isCollapsed) return;
    const text = sel.toString();
    document.execCommand("insertHTML", false, `<code>${escapeHtml(text)}</code>`);
    afterEdit();
  }, [restoreSelection, afterEdit]);

  const onLinkButton = useCallback(() => {
    if (fmt.inLink) {
      exec("unlink");
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !fmt.inEditor) {
      toast.info("Select the text you want to link");
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    saveSelection();
    setLinkPop({ x: rect.left, y: rect.bottom + 6, url: "" });
  }, [fmt.inLink, fmt.inEditor, exec, saveSelection]);

  const applyLink = useCallback(() => {
    if (!linkPop) return;
    let url = linkPop.url.trim();
    if (!url) { setLinkPop(null); return; }
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) url = `https://${url}`;
    setLinkPop(null);
    exec("createLink", url);
  }, [linkPop, exec]);

  const createTaskFromSelection = useCallback(async () => {
    const text = savedSelectionRef.current?.toString().trim() ?? "";
    if (!text) return;
    const name = text.length > 255 ? `${text.slice(0, 252)}…` : text;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectId: projectIdRef.current }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Task created: “${name.length > 60 ? `${name.slice(0, 57)}…` : name}”`);
    } catch {
      toast.error("Couldn't create the task");
    }
  }, []);

  // ── Templates ─────────────────────────────────────────────────────────

  const applyTemplate = useCallback(
    (t: NoteTemplate) => {
      if (titleRef.current) titleRef.current.textContent = t.title;
      if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(t.html);
      setTitleEmpty(!t.title.trim());
      contentRef.current = { title: t.title, html: t.html };
      setBodyEmpty(computeBodyEmpty(editorRef.current));
      setContentVersion((v) => v + 1);
      // Dirty check instead of `if (t.html)`: "Nota en blanco" clearing an
      // existing title must persist too, while blank-on-blank stays a no-op.
      if (buildSerialized() !== lastSavedRef.current) scheduleSave();
      // setTimeout, not rAF — rAF is throttled in background tabs.
      setTimeout(() => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 0);
    },
    [scheduleSave, buildSerialized]
  );

  // ── Title handlers ────────────────────────────────────────────────────

  const onTitleInput = useCallback(() => {
    const el = titleRef.current;
    // Hard-cap to the server's limit: a longer title 400s every save, which
    // would block the note's BODY from ever persisting too.
    if (el && (el.textContent ?? "").length > TITLE_MAX) {
      el.textContent = (el.textContent ?? "").slice(0, TITLE_MAX);
      const sel = window.getSelection();
      if (sel && el.firstChild) {
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      toast.warning(`Note titles are limited to ${TITLE_MAX} characters.`, {
        id: "note-title-too-long",
      });
    }
    setTitleEmpty(!(el?.textContent ?? "").trim());
    contentRef.current = {
      ...contentRef.current,
      title: el?.textContent?.trim() ?? "",
    };
    scheduleSave();
  }, [scheduleSave]);

  const onTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editorRef.current?.focus();
    }
    // No formatting inside the title.
    if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  }, []);

  const onTitlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
    document.execCommand("insertText", false, text);
  }, []);

  // ── Slash menu / block menu ───────────────────────────────────────────

  const filteredBlocks = blockMenu
    ? BLOCK_ITEMS.filter((b) =>
        b.label.toLowerCase().includes(blockMenu.query.toLowerCase())
      )
    : BLOCK_ITEMS;

  const closeBlockMenu = useCallback(() => setBlockMenu(null), []);

  const openBlockMenuAt = useCallback((pos: MenuPos, fromSlash: boolean) => {
    setBlockMenu({ ...pos, fromSlash, query: "", index: 0 });
  }, []);

  const pickBlockItem = useCallback(
    (item: { action: BlockAction }) => {
      if (blockMenu?.fromSlash) {
        // Remove the typed "/query" before applying the block.
        restoreSelection();
        const sel = window.getSelection() as Selection & {
          modify?: (a: string, d: string, g: string) => void;
        };
        if (sel?.modify) {
          const n = blockMenu.query.length + 1;
          for (let i = 0; i < n; i++) sel.modify("extend", "backward", "character");
          document.execCommand("delete");
        }
      }
      closeBlockMenu();
      applyBlockAction(item.action);
    },
    [blockMenu, restoreSelection, closeBlockMenu, applyBlockAction]
  );

  // Close menus on outside pointerdown.
  useEffect(() => {
    if (!blockMenu && !linkPop) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      // Menu triggers are exempt: otherwise pointerdown closes the menu and
      // the trigger's click immediately reopens it (open-only "+" button).
      if (!t.closest("[data-bs-popover],[data-bs-menu-trigger]")) {
        setBlockMenu(null);
        setLinkPop(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [blockMenu, linkPop]);

  const updateSlashQuery = useCallback(() => {
    setBlockMenu((m) => {
      if (!m || !m.fromSlash) return m;
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      if (!sel || !node || node.nodeType !== Node.TEXT_NODE) return null;
      const text = (node.textContent || "").slice(0, sel.anchorOffset);
      const i = text.lastIndexOf("/");
      if (i === -1) return null;
      const q = text.slice(i + 1);
      if (/\s/.test(q) || q.length > 24) return null;
      return { ...m, query: q, index: 0 };
    });
  }, []);

  // ── Editor handlers ───────────────────────────────────────────────────

  const onEditorInput = useCallback(() => {
    contentRef.current = {
      ...contentRef.current,
      html: editorRef.current?.innerHTML ?? "",
    };
    setBodyEmpty(computeBodyEmpty(editorRef.current));
    setContentVersion((v) => v + 1);
    updateSlashQuery();
    scheduleSave();
  }, [scheduleSave, updateSlashQuery]);

  const onEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (blockMenu?.fromSlash) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setBlockMenu((m) => m && {
            ...m,
            index: Math.min(m.index + 1, Math.max(filteredBlocks.length - 1, 0)),
          });
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setBlockMenu((m) => m && { ...m, index: Math.max(m.index - 1, 0) });
          return;
        }
        if (e.key === "Enter") {
          const item = filteredBlocks[blockMenu.index];
          if (item) {
            e.preventDefault();
            pickBlockItem(item);
          } else {
            // "No results": close and let Enter insert a newline.
            closeBlockMenu();
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeBlockMenu();
          return;
        }
        // Caret moves don't fire input, so the '/query' anchor would go
        // stale and pickBlockItem would delete the wrong characters —
        // dismiss like Asana/Notion do (without blocking the caret move).
        if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
          closeBlockMenu();
          return;
        }
      }
      if (e.key === "/" && !blockMenu && canEdit) {
        // Let the character insert first, then anchor the menu at the caret.
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          openBlockMenuAt({ x: rect.left, y: rect.bottom + 6 }, true);
        }, 0);
      }
    },
    [blockMenu, filteredBlocks, pickBlockItem, closeBlockMenu, openBlockMenuAt, canEdit]
  );

  const onEditorPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      if (html) {
        document.execCommand("insertHTML", false, sanitizeHtml(html));
      } else {
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }
      afterEdit();
    },
    [afterEdit]
  );

  const onEditorClick = useCallback((e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (a && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      window.open(a.getAttribute("href") ?? "", "_blank", "noopener,noreferrer");
    }
  }, []);

  const onEditorBlur = useCallback(() => {
    const serialized = buildSerialized();
    if (serialized !== lastSavedRef.current) flushSave();
  }, [buildSerialized, flushSave]);

  // ── Search inside the note ────────────────────────────────────────────

  const clearSearchHighlights = useCallback(() => {
    const css = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS;
    css?.highlights?.delete?.("bs-note-search");
    css?.highlights?.delete?.("bs-note-search-active");
  }, []);

  // Paints highlights only — scrolling is done by goToMatch / query changes
  // so re-collections triggered by typing don't yank the viewport around.
  const paintSearchHighlights = useCallback(
    (ranges: Range[], active: number) => {
      const g = globalThis as {
        CSS?: { highlights?: Map<string, unknown> };
        Highlight?: new (...r: Range[]) => unknown;
      };
      if (!g.CSS?.highlights || !g.Highlight) return;
      clearSearchHighlights();
      if (ranges.length === 0) return;
      g.CSS.highlights.set("bs-note-search", new g.Highlight(...ranges));
      if (ranges[active]) {
        g.CSS.highlights.set("bs-note-search-active", new g.Highlight(ranges[active]));
      }
    },
    [clearSearchHighlights]
  );

  // Re-collect ranges when the query OR the note content changes — Ranges
  // are live DOM objects that shift/detach after edits.
  const lastQueryRef = useRef("");
  useEffect(() => {
    if (!searchOpen) {
      clearSearchHighlights();
      setMatches([]);
      lastQueryRef.current = "";
      return;
    }
    const editor = editorRef.current;
    const q = searchQuery.trim().toLowerCase();
    if (!editor || !q) {
      clearSearchHighlights();
      setMatches([]);
      lastQueryRef.current = q;
      return;
    }
    const found: Range[] = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = (n.textContent || "").toLowerCase();
      let i = 0;
      while ((i = t.indexOf(q, i)) !== -1) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + q.length);
        found.push(r);
        i += q.length;
      }
    }
    const queryChanged = lastQueryRef.current !== q;
    lastQueryRef.current = q;
    setMatches(found);
    setMatchIdx((prev) =>
      queryChanged ? 0 : Math.min(prev, Math.max(found.length - 1, 0))
    );
    if (queryChanged && found[0]) {
      found[0].startContainer.parentElement?.scrollIntoView({ block: "center" });
    }
  }, [searchOpen, searchQuery, contentVersion, clearSearchHighlights]);

  // Repaint whenever the collected ranges or the active index change.
  useEffect(() => {
    if (!searchOpen) return;
    paintSearchHighlights(matches, matchIdx);
  }, [searchOpen, matches, matchIdx, paintSearchHighlights]);

  const goToMatch = useCallback(
    (dir: 1 | -1) => {
      if (matches.length === 0) return;
      const next = (matchIdx + dir + matches.length) % matches.length;
      setMatchIdx(next);
      matches[next]?.startContainer.parentElement?.scrollIntoView({ block: "center" });
    },
    [matches, matchIdx]
  );

  // ── Render ────────────────────────────────────────────────────────────

  const formatLabel =
    fmt.inEditor && !bodyEmpty ? FORMAT_LABELS[fmt.block] ?? "-" : "-";

  // The notes-list rows: saved notes, plus the live draft while it exists.
  const listRows = useMemo(() => {
    const rows = notes.map((n) => ({
      id: n.id as string | null,
      title: n.title.trim(),
      snippet: snippetOf(n.content),
      draft: false,
    }));
    if (activeId === null && !loading) {
      rows.push({ id: null, title: "", snippet: "", draft: true });
    }
    return rows;
  }, [notes, activeId, loading]);

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* ───────────── Toolbar ───────────── */}
      <div className="flex h-[50px] shrink-0 items-center gap-0.5 border-b border-[#E0E1E3] bg-white pl-5 pr-5">
        {/* Insert (+) */}
        <ToolBtn
          Icon={Plus}
          label="Insert"
          disabled={!canEdit}
          menuTrigger
          onMouseDown={saveSelection}
          onClick={(e) => {
            if (blockMenu) {
              closeBlockMenu();
              return;
            }
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            openBlockMenuAt({ x: rect.left, y: rect.bottom + 4 }, false);
          }}
        />
        <Sep />
        <ToolBtn Icon={Undo2} label="Undo" disabled={!canEdit || !fmt.canUndo} onClick={() => exec("undo")} />
        <ToolBtn Icon={Redo2} label="Redo" disabled={!canEdit || !fmt.canRedo} onClick={() => exec("redo")} />
        <Sep />
        {/* Format selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!canEdit}>
            <button
              type="button"
              title="Text format"
              onMouseDown={saveSelection}
              className={cn(
                "flex h-7 min-w-[76px] items-center justify-between gap-1 rounded-[4px] px-2 text-xs text-[#55585D] hover:bg-[#F7F7F7] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C6C9CD]",
                !canEdit && "pointer-events-none opacity-40"
              )}
            >
              <span className="truncate">{formatLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-[#9A9C9F]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {(["p", "h1", "h2", "h3"] as BlockAction[]).map((a) => (
              <DropdownMenuItem
                key={a}
                className="cursor-pointer text-[13px]"
                onSelect={() => applyBlockAction(a)}
              >
                {FORMAT_LABELS[a]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Sep />
        <ToolBtn Icon={Bold} label="Bold (Ctrl+B)" active={fmt.bold} disabled={!canEdit} onClick={() => exec("bold")} />
        <ToolBtn Icon={Italic} label="Italic (Ctrl+I)" active={fmt.italic} disabled={!canEdit} onClick={() => exec("italic")} />
        <ToolBtn Icon={Underline} label="Underline (Ctrl+U)" active={fmt.underline} disabled={!canEdit} onClick={() => exec("underline")} />
        <ToolBtn Icon={Highlighter} label="Highlight" disabled={!canEdit} onClick={toggleHighlight} />
        <ToolBtn Icon={Strikethrough} label="Strikethrough" active={fmt.strike} disabled={!canEdit} onClick={() => exec("strikeThrough")} />
        <ToolBtn Icon={List} label="Bulleted list" active={fmt.ul} disabled={!canEdit} onClick={() => exec("insertUnorderedList")} />
        <ToolBtn Icon={ListOrdered} label="Numbered list" active={fmt.ol} disabled={!canEdit} onClick={() => exec("insertOrderedList")} />
        <ToolBtn Icon={TextQuote} label="Quote" active={fmt.quote} disabled={!canEdit} onClick={() => applyBlockAction("quote")} />
        <ToolBtn Icon={Link2} label="Insert link" active={fmt.inLink} disabled={!canEdit} onClick={onLinkButton} />
        <Sep />
        <ToolBtn Icon={Code} label="Inline code" disabled={!canEdit} onClick={toggleInlineCode} />
        <ToolBtn Icon={SquareCode} label="Code block" active={fmt.codeblock} disabled={!canEdit} onClick={() => applyBlockAction("codeblock")} />
        <Sep />
        {/* AI */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!canEdit}>
            <button
              type="button"
              title="AI assistant"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9A9C9F] hover:bg-[#F7F7F7] hover:text-[#55585D] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C6C9CD]",
                !canEdit && "pointer-events-none opacity-40"
              )}
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {["Summarize the note", "Improve the writing", "Fix spelling & grammar"].map((l) => (
              <DropdownMenuItem
                key={l}
                className="cursor-pointer text-[13px]"
                onSelect={() => toast.info("AI features are coming soon")}
              >
                <Sparkles className="mr-2 h-3.5 w-3.5 text-[#9885F1]" />
                {l}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Sep />
        {/* Create task */}
        <button
          type="button"
          title="Turn the selected text into a task"
          disabled={!canEdit || !fmt.hasSelection}
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => void createTaskFromSelection()}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-xs text-[#9A9C9F] hover:bg-[#F7F7F7] hover:text-[#55585D] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C6C9CD]",
            (!canEdit || !fmt.hasSelection) && "pointer-events-none opacity-40"
          )}
        >
          <CircleCheck className="h-4 w-4" strokeWidth={1.75} />
          Create task
        </button>

        {/* Right group */}
        <div className="ml-auto flex items-center">
          <Sep />
          <span
            className={cn(
              "px-2 text-[11px] font-semibold",
              saveState === "error" ? "text-[#B4304C]" : "text-[#55585D]"
            )}
          >
            {!canEdit
              ? "Read-only"
              : saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved · Just now"
                  : saveState === "error"
                    ? "Couldn't save"
                    : "All changes are saved automatically"}
          </span>
          <ToolBtn
            Icon={Search}
            label="Find in note"
            active={searchOpen}
            onClick={() => setSearchOpen((o) => !o)}
          />
        </div>
      </div>

      {/* ───────────── Content area ───────────── */}
      <div className="relative min-h-0 flex-1">
        {/* Sidebar toggle */}
        <button
          type="button"
          title="Notes list"
          onClick={() => setSidebarOpen((o) => !o)}
          className="absolute left-[21px] top-[22px] z-20 flex h-7 w-7 items-center justify-center rounded-[4px] text-[#6B6D70] hover:bg-[#F7F7F7] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C6C9CD]"
        >
          {/* Asana's glyph is three SHORT left-aligned lines — no stock
              lucide icon matches (AlignLeft's first line is full-width). */}
          <svg
            viewBox="0 0 24 24"
            className="h-[17px] w-[17px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M15 5H3" />
            <path d="M15 12H3" />
            <path d="M15 19H3" />
          </svg>
        </button>

        {/* Sidebar panel — the project's notes list */}
        {sidebarOpen && (
          <div className="absolute inset-y-0 left-0 z-10 flex w-[264px] flex-col border-r border-[#E0E1E3] bg-white pt-[52px]">
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-sm font-medium text-[#1E1F21]">Notes</span>
              <div className="flex items-center gap-0.5">
                {canEdit && (
                  <button
                    type="button"
                    onClick={newNote}
                    className="flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7]"
                    title="New note"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded text-[#9A9C9F] hover:bg-[#F7F7F7]"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
              {loading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-[#9A9C9F]" />
                </div>
              )}
              {!loading && listRows.length === 0 && (
                <p className="px-3 py-2 text-xs text-[#9A9C9F]">No notes yet.</p>
              )}
              {listRows.map((row) => (
                <div
                  key={row.id ?? "__draft"}
                  className={cn(
                    "group relative rounded-[6px] hover:bg-[#F2F3F4]",
                    row.id === activeId && "bg-[#F7F7F7]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectNote(row.id)}
                    className="w-full px-3 py-2 pr-8 text-left"
                  >
                    <p className="truncate text-[13px] font-medium text-[#1E1F21]">
                      {row.title || "Untitled note"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#6B6D70]">
                      {row.draft ? "New note" : row.snippet || "No content"}
                    </p>
                  </button>
                  {canEdit && row.id && (
                    <button
                      type="button"
                      onClick={() => void deleteNote(row.id!)}
                      title="Delete note"
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-[#9A9C9F] opacity-0 hover:bg-white hover:text-[#B4304C] focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable document */}
        <div className="h-full overflow-y-auto">
          <div className="min-h-full px-20">
            <div className="mx-auto w-full max-w-[600px] pb-28 pt-9">
              {/* Title */}
              <div className="relative">
                {titleEmpty && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 select-none text-[28px] leading-[34px] text-[#626364]">
                    Untitled note
                  </div>
                )}
                <div
                  ref={titleRef}
                  contentEditable={canEdit}
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Note title"
                  spellCheck
                  className="min-h-[34px] whitespace-pre-wrap break-words text-[28px] font-normal leading-[34px] text-[#1E1F21] outline-none"
                  onInput={onTitleInput}
                  onKeyDown={onTitleKeyDown}
                  onPaste={onTitlePaste}
                  onBlur={onEditorBlur}
                />
              </div>

              {/* Body */}
              <div className="relative mt-7">
                {bodyEmpty && canEdit && (
                  <>
                    <button
                      type="button"
                      title="Insert"
                      data-bs-menu-trigger=""
                      onClick={(e) => {
                        if (blockMenu) {
                          closeBlockMenu();
                          return;
                        }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        editorRef.current?.focus();
                        openBlockMenuAt({ x: rect.left, y: rect.bottom + 4 }, false);
                      }}
                      className="absolute -left-8 top-0 flex h-6 w-6 items-center justify-center rounded-[4px] text-[#55585D] hover:bg-[#F7F7F7]"
                    >
                      <Plus className="h-[15px] w-[15px]" strokeWidth={2} />
                    </button>
                    <div className="pointer-events-none absolute left-0 top-0 select-none text-[12px] leading-6 text-[#6B6D70]">
                      Start typing or enter “/” to see the menu
                    </div>
                  </>
                )}
                <div
                  ref={editorRef}
                  contentEditable={canEdit}
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Note content"
                  spellCheck
                  className={cn(
                    "bs-note-editor min-h-[24px] whitespace-pre-wrap break-words text-[14px] leading-6 text-[#3F4144] outline-none",
                    !canEdit && "cursor-default"
                  )}
                  onInput={onEditorInput}
                  onKeyDown={onEditorKeyDown}
                  onPaste={onEditorPaste}
                  onClick={onEditorClick}
                  onBlur={onEditorBlur}
                  onFocus={saveSelection}
                  onMouseUp={saveSelection}
                />

                {/* Template chips — single row like Asana (the row may
                    overflow the 600px column, so no wrap and no shrink) */}
                {bodyEmpty && canEdit && (
                  <div className="mt-12 flex flex-nowrap gap-[7px]">
                    {NOTE_TEMPLATES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="inline-flex h-[25px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] border border-[#C6C9CD] bg-white px-2 text-[11px] text-[#3F4144] hover:bg-[#F7F7F7]"
                      >
                        <t.Icon className="h-3 w-3 text-[#55585D]" strokeWidth={1.75} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Read-only empty state */}
                {bodyEmpty && !canEdit && (
                  <p className="text-[13px] text-[#9A9C9F]">This note is empty.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Send feedback */}
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="absolute bottom-3 right-6 z-20 h-[31px] w-[100px] rounded-[8px] border border-[#C6C9CD] bg-white text-[10px] text-[#55585D] underline hover:bg-[#F7F7F7]"
        >
          Send feedback
        </button>

        {/* Search popover */}
        {searchOpen && (
          <div
            data-bs-popover
            className="absolute right-4 top-2 z-30 flex w-72 items-center gap-1 rounded-[8px] border border-[#E0E1E3] bg-white p-1.5 shadow-md"
          >
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToMatch(e.shiftKey ? -1 : 1);
                if (e.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Find in note"
              className="h-6 min-w-0 flex-1 rounded px-1.5 text-xs text-[#1E1F21] outline-none placeholder:text-[#9A9C9F]"
            />
            <span className="shrink-0 px-1 text-[11px] tabular-nums text-[#6B6D70]">
              {matches.length > 0 ? `${matchIdx + 1} of ${matches.length}` : searchQuery.trim() ? "0" : ""}
            </span>
            <button type="button" onClick={() => goToMatch(-1)} disabled={matches.length === 0} className="flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7] disabled:opacity-40" title="Previous">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => goToMatch(1)} disabled={matches.length === 0} className="flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7] disabled:opacity-40" title="Next">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setSearchOpen(false)} className="flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7]" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ───────────── Block insert menu (toolbar +, first-line +, "/") ───────────── */}
      {blockMenu && (
        <div
          data-bs-popover
          className="fixed z-50 w-56 rounded-[8px] border border-[#E0E1E3] bg-white py-1 shadow-lg"
          style={{ left: blockMenu.x, top: blockMenu.y }}
        >
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium text-[#9A9C9F]">Insert</p>
          {filteredBlocks.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#9A9C9F]">No results</p>
          )}
          {filteredBlocks.map((item, i) => (
            <button
              key={item.action}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickBlockItem(item)}
              onMouseEnter={() => setBlockMenu((m) => m && { ...m, index: i })}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#1E1F21]",
                blockMenu.index === i && "bg-[#F7F7F7]"
              )}
            >
              <item.Icon className="h-4 w-4 text-[#6B6D70]" strokeWidth={1.75} />
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* ───────────── Link popover ───────────── */}
      {linkPop && (
        <div
          data-bs-popover
          className="fixed z-50 flex w-80 items-center gap-1.5 rounded-[8px] border border-[#E0E1E3] bg-white p-1.5 shadow-lg"
          style={{ left: Math.min(linkPop.x, window.innerWidth - 340), top: linkPop.y }}
        >
          <input
            autoFocus
            value={linkPop.url}
            onChange={(e) => setLinkPop((p) => p && { ...p, url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink();
              if (e.key === "Escape") setLinkPop(null);
            }}
            placeholder="Paste or type a link"
            className="h-7 min-w-0 flex-1 rounded border border-[#E0E1E3] px-2 text-xs text-[#1E1F21] outline-none placeholder:text-[#9A9C9F] focus:border-[#C6C9CD]"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 shrink-0 rounded-[6px] border border-[#C6C9CD] bg-white px-2.5 text-xs text-[#3F4144] hover:bg-[#F7F7F7]"
          >
            Apply
          </button>
        </div>
      )}

      {/* ───────────── Feedback modal ───────────── */}
      {feedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={() => setFeedbackOpen(false)}
        >
          <div
            className="w-[420px] rounded-[10px] border border-[#E0E1E3] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-[#1E1F21]">Send feedback</h3>
            <p className="mt-1 text-xs text-[#6B6D70]">
              Tell us what you&apos;d like to improve about notes.
            </p>
            <textarea
              autoFocus
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="mt-3 h-28 w-full resize-none rounded-[6px] border border-[#E0E1E3] p-2 text-[13px] text-[#1E1F21] outline-none placeholder:text-[#9A9C9F] focus:border-[#C6C9CD]"
              placeholder="Share your feedback…"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="h-8 rounded-[6px] px-3 text-xs text-[#55585D] hover:bg-[#F7F7F7]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!feedbackText.trim()}
                onClick={() => {
                  setFeedbackOpen(false);
                  setFeedbackText("");
                  toast.success("Thanks for your feedback!");
                }}
                className="h-8 rounded-[6px] bg-[#4273D1] px-3 text-xs font-medium text-white hover:bg-[#335FB5] disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor content styles + search highlight colors */}
      <style>{`
        .bs-note-editor h1 { font-size: 24px; line-height: 32px; font-weight: 600; color: #1E1F21; margin: 16px 0 4px; }
        .bs-note-editor h2 { font-size: 19px; line-height: 26px; font-weight: 600; color: #1E1F21; margin: 14px 0 2px; }
        .bs-note-editor h3 { font-size: 16px; line-height: 22px; font-weight: 600; color: #1E1F21; margin: 12px 0 2px; }
        .bs-note-editor p, .bs-note-editor div { margin: 2px 0; }
        .bs-note-editor ul { list-style: disc; padding-left: 24px; margin: 4px 0; }
        .bs-note-editor ol { list-style: decimal; padding-left: 24px; margin: 4px 0; }
        .bs-note-editor li { margin: 2px 0; }
        .bs-note-editor blockquote { border-left: 3px solid #E0E1E3; padding-left: 12px; margin: 6px 0; color: #6B6D70; }
        .bs-note-editor pre { background: #F7F7F8; border: 1px solid #EDEEEF; border-radius: 6px; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; margin: 8px 0; white-space: pre-wrap; }
        .bs-note-editor code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: #F2F3F4; border-radius: 4px; padding: 1px 4px; color: #B4304C; }
        .bs-note-editor pre code { background: transparent; padding: 0; color: #3F4144; }
        .bs-note-editor a { color: #4273D1; text-decoration: underline; cursor: pointer; }
        .bs-note-editor hr { border: 0; border-top: 1px solid #E0E1E3; margin: 16px 0; }
        ::highlight(bs-note-search) { background-color: #FCE9BC; }
        ::highlight(bs-note-search-active) { background-color: #F1BD6C; }
      `}</style>
    </div>
  );
}

// ─── Small pieces ──────────────────────────────────────────────────────

function Sep() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-[#E0E1E3]" />;
}

function ToolBtn({
  Icon,
  label,
  onClick,
  onMouseDown,
  active,
  disabled,
  menuTrigger,
}: {
  Icon: LucideIcon;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Exempts the button from the outside-pointerdown menu close so its
      onClick can toggle the menu instead of always reopening it. */
  menuTrigger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      {...(menuTrigger ? { "data-bs-menu-trigger": "" } : {})}
      onMouseDown={(e) => {
        // Keep the editor selection — don't steal focus on toolbar clicks.
        e.preventDefault();
        onMouseDown?.();
      }}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[#9A9C9F] hover:bg-[#F7F7F7] hover:text-[#55585D] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C6C9CD]",
        active && "bg-[#EFEFEF] text-[#55585D]",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
