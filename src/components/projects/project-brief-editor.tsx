"use client";

/**
 * Project brief editor — Asana's "Brief del proyecto", a full-screen
 * rich-text document (one per project). Breadcrumb + autosave + Done in the
 * header, a floating black formatting toolbar at the bottom, a right
 * "Suggested content" rail whose chips insert sections, and a "/" insert
 * menu. Content persists to /api/projects/[id]/brief.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightToLine,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Sparkles,
  ChevronDown,
  MoreHorizontal,
  AlignLeft as ExecSummaryIcon,
  LayoutList,
  Flag,
  Star,
  HelpCircle,
  AlertTriangle,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  TextQuote,
  SquareCode,
  Minus,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  sanitizeRichText,
  isRichTextBlank,
} from "@/lib/rich-text-sanitize";

const BRIEF_MAX = 200000;

interface ProjectBriefEditorProps {
  projectId: string;
  projectName: string;
  canEdit: boolean;
  /** Close the editor. `saved` is true if the brief now has content. */
  onClose: (saved: boolean) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// Suggested-content sections — Asana's right rail. Each inserts a heading
// plus an empty line at the caret.
const SUGGESTED: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "summary", label: "Executive summary", Icon: ExecSummaryIcon },
  { key: "context", label: "Context", Icon: LayoutList },
  { key: "problem", label: "Problem statement", Icon: Flag },
  { key: "solution", label: "Proposed solution", Icon: Star },
  { key: "questions", label: "Open questions", Icon: HelpCircle },
  { key: "risks", label: "Risks", Icon: AlertTriangle },
];

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

const HIGHLIGHT = "#FEF3C7";

function computeEmpty(el: HTMLElement | null): boolean {
  if (!el) return true;
  if ((el.textContent || "").trim()) return false;
  return !el.querySelector("hr,li,img,pre");
}

export function ProjectBriefEditor({
  projectId,
  projectName,
  canEdit,
  onClose,
}: ProjectBriefEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [empty, setEmpty] = useState(true);
  const [loading, setLoading] = useState(true);
  const [slash, setSlash] = useState<{ x: number; y: number; query: string; index: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const contentRef = useRef<string>("");
  const lastSavedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const everSavedRef = useRef(false);
  // Set when the brief is deleted from the header menu, so the unmount flush
  // doesn't re-PUT the still-in-DOM content and resurrect the row.
  const deletedRef = useRef(false);

  // ── Persistence ───────────────────────────────────────────────────────
  const persist = useCallback(async (html: string) => {
    if (html === lastSavedRef.current) return true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const res = await fetch(`/api/projects/${projectId}/brief`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: html }),
      signal: ac.signal,
    });
    if (res.ok) {
      lastSavedRef.current = html;
      if (!isRichTextBlank(html)) everSavedRef.current = true;
      return true;
    }
    let msg = "Couldn't save the brief";
    try {
      const b = await res.json();
      if (typeof b?.error === "string" && b.error) msg = b.error;
    } catch { /* keep generic */ }
    throw new Error(msg);
  }, [projectId]);

  const save = useCallback(async () => {
    const html = sanitizeRichText(contentRef.current);
    if (html === lastSavedRef.current) {
      setSaveState((s) => (s === "saving" ? "idle" : s));
      return;
    }
    if (html.length > BRIEF_MAX) {
      setSaveState("error");
      toast.error("The brief is over the size limit. Trim it to save.", {
        id: "brief-too-large",
      });
      return;
    }
    setSaveState("saving");
    try {
      await persist(html);
      setSaveState("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 3000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSaveState("error");
      toast.error(err instanceof Error ? err.message : "Couldn't save the brief");
    }
  }, [persist]);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), 700);
  }, [save]);

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/brief`);
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        const html = sanitizeRichText(data?.content ?? "");
        contentRef.current = html;
        lastSavedRef.current = html;
        everSavedRef.current = !isRichTextBlank(html);
        if (editorRef.current) editorRef.current.innerHTML = html;
        setEmpty(computeEmpty(editorRef.current));
      } catch {
        if (!cancelled) toast.error("Couldn't load the brief");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch { /* non-fatal */ }
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Flush on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (deletedRef.current) return; // brief was deleted — don't resurrect it
      const html = sanitizeRichText(contentRef.current);
      if (html !== lastSavedRef.current && html.length <= BRIEF_MAX) {
        persist(html).catch(() => {});
      }
    };
  }, [persist]);

  // ── Selection ─────────────────────────────────────────────────────────
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (
      sel && sel.rangeCount > 0 && editorRef.current &&
      editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)
    ) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      setHasSelection(!sel.isCollapsed);
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    const sel = window.getSelection();
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
      } catch { /* stale range */ }
    }
    if (sel && editor) {
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }, []);

  const afterEdit = useCallback(() => {
    contentRef.current = editorRef.current?.innerHTML ?? "";
    setEmpty(computeEmpty(editorRef.current));
    scheduleSave();
  }, [scheduleSave]);

  const exec = useCallback(
    (command: string, value?: string) => {
      restoreSelection();
      document.execCommand(command, false, value);
      afterEdit();
    },
    [restoreSelection, afterEdit]
  );

  const applyBlock = useCallback(
    (action: BlockAction) => {
      let block = "";
      try { block = String(document.queryCommandValue("formatBlock")).toLowerCase(); } catch { /* noop */ }
      switch (action) {
        case "p": exec("formatBlock", "p"); break;
        case "h1": exec("formatBlock", "h1"); break;
        case "h2": exec("formatBlock", "h2"); break;
        case "h3": exec("formatBlock", "h3"); break;
        case "ul": exec("insertUnorderedList"); break;
        case "ol": exec("insertOrderedList"); break;
        case "quote": exec("formatBlock", block === "blockquote" ? "p" : "blockquote"); break;
        case "codeblock": exec("formatBlock", block === "pre" ? "p" : "pre"); break;
        case "divider": exec("insertHTML", "<hr><p><br></p>"); break;
      }
    },
    [exec]
  );

  const toggleHighlight = useCallback(() => {
    let cur = "";
    try { cur = String(document.queryCommandValue("hiliteColor")); } catch { /* noop */ }
    const on = cur.replace(/\s/g, "") === "rgb(254,243,199)";
    exec("hiliteColor", on ? "transparent" : HIGHLIGHT);
  }, [exec]);

  const toggleInlineCode = useCallback(() => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString();
    document.execCommand(
      "insertHTML",
      false,
      `<code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`
    );
    afterEdit();
  }, [restoreSelection, afterEdit]);

  // Insert a suggested section (heading + empty line) at the end.
  const insertSection = useCallback(
    (label: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(r);
      document.execCommand(
        "insertHTML",
        false,
        `<h2>${label}</h2><p><br></p>`
      );
      afterEdit();
    },
    [afterEdit]
  );

  const createTaskFromSelection = useCallback(async () => {
    const text = savedSelectionRef.current?.toString().trim() ?? "";
    if (!text) {
      toast.info("Select the text to turn into a task");
      return;
    }
    const name = text.length > 255 ? `${text.slice(0, 252)}…` : text;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectId }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Task created: “${name.length > 60 ? `${name.slice(0, 57)}…` : name}”`);
    } catch {
      toast.error("Couldn't create the task");
    }
  }, [projectId]);

  // ── Slash menu ────────────────────────────────────────────────────────
  const filteredBlocks = slash
    ? BLOCK_ITEMS.filter((b) => b.label.toLowerCase().includes(slash.query.toLowerCase()))
    : BLOCK_ITEMS;

  const closeSlash = useCallback(() => setSlash(null), []);

  const pickSlash = useCallback(
    (item: { action: BlockAction }) => {
      restoreSelection();
      const sel = window.getSelection() as Selection & {
        modify?: (a: string, d: string, g: string) => void;
      };
      if (slash && sel?.modify) {
        const n = slash.query.length + 1;
        for (let i = 0; i < n; i++) sel.modify("extend", "backward", "character");
        document.execCommand("delete");
      }
      closeSlash();
      applyBlock(item.action);
    },
    [slash, restoreSelection, closeSlash, applyBlock]
  );

  useEffect(() => {
    if (!slash) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-brief-slash]")) setSlash(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [slash]);

  const updateSlashQuery = useCallback(() => {
    setSlash((m) => {
      if (!m) return m;
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

  const onInput = useCallback(() => {
    contentRef.current = editorRef.current?.innerHTML ?? "";
    setEmpty(computeEmpty(editorRef.current));
    updateSlashQuery();
    scheduleSave();
  }, [scheduleSave, updateSlashQuery]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (slash) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlash((m) => m && { ...m, index: Math.min(m.index + 1, Math.max(filteredBlocks.length - 1, 0)) });
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlash((m) => m && { ...m, index: Math.max(m.index - 1, 0) });
          return;
        }
        if (e.key === "Enter") {
          const item = filteredBlocks[slash.index];
          if (item) { e.preventDefault(); pickSlash(item); } else closeSlash();
          return;
        }
        if (e.key === "Escape") { e.preventDefault(); closeSlash(); return; }
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { closeSlash(); return; }
      }
      if (e.key === "/" && !slash && canEdit) {
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          setSlash({ x: rect.left, y: rect.bottom + 6, query: "", index: 0 });
        }, 0);
      }
    },
    [slash, filteredBlocks, pickSlash, closeSlash, canEdit]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      if (html) document.execCommand("insertHTML", false, sanitizeRichText(html));
      else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      afterEdit();
    },
    [afterEdit]
  );

  const doDone = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // AWAIT the save so the PUT commits before onClose triggers the
    // Overview's loadBrief() GET — otherwise the lighter read wins the race
    // and the banner shows the old/blank preview until a manual reload.
    try { await save(); } catch { /* save() surfaces its own errors */ }
    onClose(everSavedRef.current || !isRichTextBlank(sanitizeRichText(contentRef.current)));
  }, [save, onClose]);

  const title = `Project brief ${projectName}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ───────── Header ───────── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-5">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4573D2]" />
          <span className="text-slate-500">{projectName}</span>
          <span className="text-slate-300">›</span>
          <span className="font-medium text-slate-800">Project brief</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-xs",
              saveState === "saved"
                ? "text-[#14865E]"
                : saveState === "error"
                  ? "text-[#B4304C]"
                  : "text-slate-400"
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                title="More"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                className="cursor-pointer text-[13px]"
                onSelect={() => {
                  navigator.clipboard
                    ?.writeText(
                      `${window.location.origin}/projects/${projectId}?view=overview&brief=1`
                    )
                    .then(() => toast.success("Link copied"))
                    .catch(() => toast.error("Couldn't copy the link"));
                }}
              >
                Copy brief link
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-[13px] text-[#B4304C] focus:text-[#B4304C]"
                    onSelect={() => {
                      if (!confirm("Delete the project brief?")) return;
                      // Cancel any pending debounce AND abort an in-flight
                      // autosave PUT before deleting — an upsert that lands
                      // after the DELETE would re-create the row.
                      if (timerRef.current) clearTimeout(timerRef.current);
                      abortRef.current?.abort();
                      deletedRef.current = true;
                      everSavedRef.current = false;
                      fetch(`/api/projects/${projectId}/brief`, { method: "DELETE" })
                        .then((r) => {
                          if (!r.ok) throw new Error();
                          toast.success("Brief deleted");
                          onClose(false);
                        })
                        .catch(() => {
                          deletedRef.current = false; // let a retry save again
                          toast.error("Couldn't delete the brief");
                        });
                    }}
                  >
                    Delete brief
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={doDone}
            className="h-8 rounded-md bg-[#4573D2] px-4 text-sm font-medium text-white hover:bg-[#335FB5]"
          >
            Done
          </button>
        </div>
      </div>

      {/* ───────── Body ───────── */}
      <div className="flex min-h-0 flex-1">
        {/* Document */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[720px] px-8 pb-40 pt-10">
            <h1 className="mb-6 text-[28px] font-semibold leading-9 text-slate-900">
              {title}
            </h1>
            <div className="relative">
              {empty && canEdit && (
                <div className="pointer-events-none absolute inset-x-0 top-0 select-none text-[15px] leading-7 text-slate-400">
                  Explain the what and why of this project to your team.
                  <ul className="mt-1 list-disc pl-6">
                    <li>Drag suggested content here from the right, or just let the words flow.</li>
                    <li>Type / to insert elements like Figma files or YouTube videos.</li>
                    <li>Highlight text to turn it into a task.</li>
                  </ul>
                </div>
              )}
              <div
                ref={editorRef}
                contentEditable={canEdit}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Project brief"
                spellCheck
                className={cn(
                  "bs-brief-editor min-h-[50vh] whitespace-pre-wrap break-words text-[15px] leading-7 text-[#3F4144] outline-none",
                  !canEdit && "cursor-default"
                )}
                onInput={onInput}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={() => {
                  if (timerRef.current) { clearTimeout(timerRef.current); void save(); }
                }}
                onFocus={saveSelection}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
              />
            </div>
          </div>
        </div>

        {/* Suggested content rail */}
        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-slate-100 bg-slate-50/40 px-5 py-8 lg:block">
          <button
            type="button"
            onClick={doDone}
            title="Close brief"
            className="mb-6 flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
          >
            <ArrowRightToLine className="h-4 w-4" />
          </button>
          <h3 className="mb-3 text-base font-medium text-slate-800">
            Suggested content
          </h3>
          <div className="space-y-2">
            {SUGGESTED.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={!canEdit}
                onClick={() => insertSection(s.label)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <s.Icon className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                {s.label}
              </button>
            ))}
          </div>

          <h3 className="mb-2 mt-8 text-base font-medium text-slate-800">
            Connected work
          </h3>
          <p className="text-sm text-slate-400">
            Connected milestones and goals will appear here automatically.
          </p>
        </aside>
      </div>

      {/* ───────── Floating toolbar ───────── */}
      {canEdit && !loading && (
        <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex justify-center lg:right-[320px]">
          <div
            className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-[#1E1F21] px-2 py-1.5 text-white shadow-xl"
            onMouseDown={(e) => {
              // Keep the editor selection — don't steal focus on toolbar clicks.
              e.preventDefault();
              saveSelection();
            }}
          >
            <TBtn label="Heading 1" onClick={() => applyBlock("h1")}>
              <span className="text-[13px] font-semibold">H<sub>1</sub></span>
            </TBtn>
            <TBtn label="Heading 2" onClick={() => applyBlock("h2")}>
              <span className="text-[13px] font-semibold">H<sub>2</sub></span>
            </TBtn>
            <TSep />
            <TBtn label="Bold" onClick={() => exec("bold")}><Bold className="h-4 w-4" /></TBtn>
            <TBtn label="Italic" onClick={() => exec("italic")}><Italic className="h-4 w-4" /></TBtn>
            <TBtn label="Underline" onClick={() => exec("underline")}><Underline className="h-4 w-4" /></TBtn>
            <TBtn label="Highlight" onClick={toggleHighlight}><Highlighter className="h-4 w-4" /></TBtn>
            <TBtn label="Strikethrough" onClick={() => exec("strikeThrough")}><Strikethrough className="h-4 w-4" /></TBtn>
            <TBtn label="Inline code" onClick={toggleInlineCode}><Code className="h-4 w-4" /></TBtn>
            <TSep />
            <TBtn label="Bulleted list" onClick={() => applyBlock("ul")}><List className="h-4 w-4" /></TBtn>
            <TBtn label="Numbered list" onClick={() => applyBlock("ol")}><ListOrdered className="h-4 w-4" /></TBtn>
            <TSep />
            <TBtn label="AI assistant" onClick={() => toast.info("AI features are coming soon")}>
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </TBtn>
            <TSep />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] hover:bg-white/10"
                >
                  Insert <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52">
                {BLOCK_ITEMS.map((b) => (
                  <DropdownMenuItem
                    key={b.action}
                    className="cursor-pointer text-[13px]"
                    onSelect={() => applyBlock(b.action)}
                  >
                    <b.Icon className="mr-2 h-4 w-4 text-slate-500" />
                    {b.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-[13px]"
                  disabled={!hasSelection}
                  onSelect={() => void createTaskFromSelection()}
                >
                  <CircleCheck className="mr-2 h-4 w-4 text-slate-500" />
                  Create task from selection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Slash insert menu */}
      {slash && (
        <div
          data-brief-slash
          className="fixed z-[60] w-56 rounded-[8px] border border-[#E0E1E3] bg-white py-1 shadow-lg"
          style={{ left: slash.x, top: slash.y }}
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
              onClick={() => pickSlash(item)}
              onMouseEnter={() => setSlash((m) => m && { ...m, index: i })}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#1E1F21]",
                slash.index === i && "bg-[#F7F7F7]"
              )}
            >
              <item.Icon className="h-4 w-4 text-[#6B6D70]" strokeWidth={1.75} />
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor content styles */}
      <style>{`
        .bs-brief-editor h1 { font-size: 24px; line-height: 32px; font-weight: 600; color: #1E1F21; margin: 16px 0 4px; }
        .bs-brief-editor h2 { font-size: 19px; line-height: 26px; font-weight: 600; color: #1E1F21; margin: 14px 0 2px; }
        .bs-brief-editor h3 { font-size: 16px; line-height: 22px; font-weight: 600; color: #1E1F21; margin: 12px 0 2px; }
        .bs-brief-editor p, .bs-brief-editor div { margin: 2px 0; }
        .bs-brief-editor ul { list-style: disc; padding-left: 24px; margin: 4px 0; }
        .bs-brief-editor ol { list-style: decimal; padding-left: 24px; margin: 4px 0; }
        .bs-brief-editor li { margin: 2px 0; }
        .bs-brief-editor blockquote { border-left: 3px solid #E0E1E3; padding-left: 12px; margin: 6px 0; color: #6B6D70; }
        .bs-brief-editor pre { background: #F7F7F8; border: 1px solid #EDEEEF; border-radius: 6px; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; margin: 8px 0; white-space: pre-wrap; }
        .bs-brief-editor code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: #F2F3F4; border-radius: 4px; padding: 1px 4px; color: #B4304C; }
        .bs-brief-editor pre code { background: transparent; padding: 0; color: #3F4144; }
        .bs-brief-editor a { color: #4273D1; text-decoration: underline; }
        .bs-brief-editor hr { border: 0; border-top: 1px solid #E0E1E3; margin: 16px 0; }
      `}</style>
    </div>
  );
}

function TSep() {
  return <div className="mx-1 h-5 w-px bg-white/15" />;
}

function TBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
    >
      {children}
    </button>
  );
}
