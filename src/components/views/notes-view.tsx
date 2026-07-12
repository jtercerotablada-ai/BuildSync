"use client";

/**
 * Notes view — Asana's full-page note editor, cloned 1:1.
 *
 * Layout: 50px formatting toolbar, sidebar-toggle gutter button, a centered
 * ~600px document (editable title + rich-text body), template chips on an
 * empty note, and a floating "Enviar comentarios" button.
 *
 * Storage: Project.notes holds JSON {"v":1,"title","html"} via
 * PATCH /api/projects/[id]. Legacy plain-text notes are converted to
 * paragraphs on load and migrate to the JSON shape on first edit.
 * HTML is sanitized with DOMPurify on load, paste, and save.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  initialNotes: string | null | undefined;
  canEdit: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// ─── Storage ───────────────────────────────────────────────────────────

interface StoredNote {
  title: string;
  html: string;
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

// Matches the server-side zod limit on Project.notes.
const NOTES_MAX = 100000;

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

function plainTextToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => (l.trim() ? `<p>${escapeHtml(l)}</p>` : "<p><br></p>"))
    .join("");
}

function parseStoredNotes(raw: string | null | undefined): StoredNote {
  if (!raw || !raw.trim()) return { title: "", html: "" };
  if (raw.startsWith('{"v"')) {
    try {
      const p = JSON.parse(raw);
      // Exact shape check (v === 1, both fields strings) so legacy plain
      // text that happens to be foreign JSON falls through and is
      // preserved verbatim instead of being reinterpreted and overwritten.
      if (
        p && typeof p === "object" && p.v === 1 &&
        typeof p.title === "string" && typeof p.html === "string"
      ) {
        return { title: p.title, html: p.html };
      }
    } catch {
      // fall through to plain-text handling
    }
  }
  return { title: "", html: plainTextToHtml(raw) };
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
// The meeting template mirrors Asana's stock "Notas de la reunión".

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
    label: "Notas de la reunión",
    Icon: CalendarDays,
    title: "Notas de la reunión",
    html:
      "<h2>🗓️ ¿Cuál es la fecha?</h2><p><br></p>" +
      "<h2>👥 Participantes</h2><ul><li>Usa @ para incluir participantes.</li></ul>" +
      "<h2>📝 Agenda</h2><ul><li>Haz un seguimiento de los temas aquí.</li><li>Usa @ para vincular las tareas y los proyectos relevantes.</li></ul>" +
      "<h2>✍️ Notas</h2><ul><li>Agrega notas aquí.</li></ul>" +
      "<h2>🎯 Acciones pendientes</h2><ul><li>Agrega las actividades que se deben realizar.</li><li>Resalta el texto y selecciona “Crear tarea” para convertirlo en una tarea.</li></ul>" +
      "<hr>" +
      "<h2>🗓️ Fecha anterior</h2><ul><li>Las notas de las reuniones anteriores se pueden agregar aquí.</li></ul>",
  },
  {
    key: "context",
    label: "Contexto del proyecto",
    Icon: ClipboardList,
    title: "Contexto del proyecto",
    html:
      "<h2>🌟 Descripción general</h2><ul><li>¿De qué trata este proyecto, en una o dos oraciones?</li></ul>" +
      "<h2>🎯 Objetivos</h2><ul><li>¿Cómo se ve el éxito?</li></ul>" +
      "<h2>🧭 Antecedentes</h2><ul><li>¿Por qué ahora? Decisiones clave y limitaciones hasta la fecha.</li></ul>" +
      "<h2>🔗 Recursos relacionados</h2><ul><li>Vincula aquí especificaciones, planos, cálculos y documentos de referencia.</li></ul>",
  },
  {
    key: "resources",
    label: "Recursos clave",
    Icon: Link2,
    title: "Recursos clave",
    html:
      "<h2>📄 Documentos</h2><ul><li>Vincula el resumen del proyecto, los contratos y las especificaciones.</li></ul>" +
      "<h2>🔗 Enlaces</h2><ul><li>Agrega portales, unidades y herramientas externas.</li></ul>" +
      "<h2>👥 Contactos</h2><ul><li>Cliente, contratista, inspector — nombres y correos.</li></ul>",
  },
  {
    key: "weekly",
    label: "Planificación semanal",
    Icon: CalendarRange,
    title: "Planificación semanal",
    html:
      "<h2>📅 Semana del…</h2><p><br></p>" +
      "<h2>⭐ Prioridades principales</h2><ul><li>¿Qué debe completarse esta semana?</li></ul>" +
      "<h2>📋 Por hacer</h2><ul><li><br></li></ul>" +
      "<h2>🚧 Bloqueos</h2><ul><li>¿Qué está en el camino?</li></ul>" +
      "<h2>✅ Logros</h2><ul><li>¿Qué avanzó?</li></ul>",
  },
  {
    key: "blank",
    label: "Nota en blanco",
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
  { action: "p", label: "Texto normal", Icon: Pilcrow },
  { action: "h1", label: "Título 1", Icon: Heading1 },
  { action: "h2", label: "Título 2", Icon: Heading2 },
  { action: "h3", label: "Título 3", Icon: Heading3 },
  { action: "ul", label: "Lista con viñetas", Icon: List },
  { action: "ol", label: "Lista numerada", Icon: ListOrdered },
  { action: "quote", label: "Cita", Icon: TextQuote },
  { action: "codeblock", label: "Bloque de código", Icon: SquareCode },
  { action: "divider", label: "Separador", Icon: Minus },
];

const FORMAT_LABELS: Record<string, string> = {
  p: "Texto normal",
  div: "Texto normal",
  h1: "Título 1",
  h2: "Título 2",
  h3: "Título 3",
  blockquote: "Cita",
  pre: "Código",
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

export function NotesView({ projectId, initialNotes, canEdit }: NotesViewProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);

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
  const lastSavedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const savedSelectionRef = useRef<Range | null>(null);

  const buildSerialized = useCallback((): string => {
    const t = contentRef.current.title.trim();
    const html = sanitizeHtml(contentRef.current.html);
    if (!t && isHtmlBlank(html)) return "";
    return JSON.stringify({ v: 1, title: t, html });
  }, []);

  // Raw persist — no React state updates, safe from the unmount cleanup.
  // Aborts any prior in-flight save so writes stay ordered.
  const persist = useCallback(async (id: string, serialized: string) => {
    if (serialized === lastSavedRef.current) return true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: serialized }),
      signal: ac.signal,
    });
    if (res.ok) {
      lastSavedRef.current = serialized;
      return true;
    }
    // Surface the server's message (e.g. the zod size-limit error) instead
    // of a generic string.
    let msg = "No se pudo guardar la nota";
    try {
      const body = await res.json();
      if (typeof body?.error === "string" && body.error) msg = body.error;
    } catch {
      // keep the generic message
    }
    throw new Error(msg);
  }, []);

  const save = useCallback(async () => {
    const serialized = buildSerialized();
    if (serialized === lastSavedRef.current) {
      // An edit that round-tripped back to the saved value (type+undo) —
      // clear the pending "Guardando…" or it sticks forever.
      setSaveState((s) => (s === "saving" ? "idle" : s));
      return;
    }
    if (serialized.length > NOTES_MAX) {
      setSaveState("error");
      toast.error(
        "La nota supera el límite de 100.000 caracteres. Reduce el contenido para poder guardar.",
        { id: "note-too-large" }
      );
      return;
    }
    setSaveState("saving");
    try {
      await persist(projectIdRef.current, serialized);
      setSaveState("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      // Back to Asana's permanent auto-save message after a moment.
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 3000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSaveState("error");
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota");
    }
  }, [buildSerialized, persist]);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), 800);
  }, [save]);

  const flushSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void save();
  }, [save]);

  // Load / reload when the project changes underneath us. initialNotes also
  // changes on every router.refresh() after our own autosave (task panel,
  // members dialog, rename… all call refresh), so for same-project updates
  // we must NOT clobber the live DOM: skip when the incoming value is just
  // an echo of our own save, or when local edits are newer than the server
  // snapshot (a refresh can even race an in-flight save and deliver OLDER
  // data — resetting would visibly revert the note mid-typing).
  const loadedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    const parsed = parseStoredNotes(initialNotes);
    const html = sanitizeHtml(parsed.html);
    const incoming =
      !parsed.title.trim() && isHtmlBlank(html)
        ? ""
        : JSON.stringify({ v: 1, title: parsed.title.trim(), html });
    if (loadedProjectRef.current === projectId) {
      const dirty = buildSerialized() !== lastSavedRef.current;
      if (incoming === lastSavedRef.current || dirty) return;
    }
    loadedProjectRef.current = projectId;
    if (timerRef.current) clearTimeout(timerRef.current);
    contentRef.current = { title: parsed.title, html };
    lastSavedRef.current = incoming;
    if (titleRef.current) titleRef.current.textContent = parsed.title;
    if (editorRef.current) editorRef.current.innerHTML = html;
    setTitleEmpty(!parsed.title.trim());
    setBodyEmpty(computeBodyEmpty(editorRef.current));
    setSaveState("idle");
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // non-fatal
    }
  }, [projectId, initialNotes, buildSerialized]);

  // Flush pending changes on unmount (fire-and-forget; contentRef survives).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      const serialized = buildSerialized();
      if (serialized !== lastSavedRef.current && serialized.length <= NOTES_MAX) {
        persist(projectIdRef.current, serialized).catch(() => {});
      }
    };
  }, [buildSerialized, persist]);

  // React cleanups don't run on tab close / hard navigation — flush on
  // pagehide and on tab-hide with keepalive so the last debounce window
  // isn't silently lost. keepalive bodies are capped (~64KB), so very large
  // notes fall back to a best-effort plain fetch.
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const serialized = buildSerialized();
      if (serialized === lastSavedRef.current || serialized.length > NOTES_MAX) return;
      lastSavedRef.current = serialized;
      try {
        void fetch(`/api/projects/${projectIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: serialized }),
          keepalive: serialized.length < 60000,
        }).catch(() => {});
      } catch {
        // best-effort
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [buildSerialized]);

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
      toast.info("Selecciona el texto que quieres enlazar");
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
      toast.success(`Tarea creada: “${name.length > 60 ? `${name.slice(0, 57)}…` : name}”`);
    } catch {
      toast.error("No se pudo crear la tarea");
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
    setTitleEmpty(!(titleRef.current?.textContent ?? "").trim());
    contentRef.current = {
      ...contentRef.current,
      title: titleRef.current?.textContent?.trim() ?? "",
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
            // "Sin resultados": close and let Enter insert a newline.
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

  const sidebarSnippet = (editorRef.current?.textContent ?? "").trim().slice(0, 80);
  const sidebarTitle = (titleRef.current?.textContent ?? "").trim() || "Nota sin nombre";

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* ───────────── Toolbar ───────────── */}
      <div className="flex h-[50px] shrink-0 items-center gap-0.5 border-b border-[#E0E1E3] bg-white pl-5 pr-5">
        {/* Insert (+) */}
        <ToolBtn
          Icon={Plus}
          label="Insertar"
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
        <ToolBtn Icon={Undo2} label="Deshacer" disabled={!canEdit || !fmt.canUndo} onClick={() => exec("undo")} />
        <ToolBtn Icon={Redo2} label="Rehacer" disabled={!canEdit || !fmt.canRedo} onClick={() => exec("redo")} />
        <Sep />
        {/* Format selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!canEdit}>
            <button
              type="button"
              title="Formato de texto"
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
        <ToolBtn Icon={Bold} label="Negrita (Ctrl+B)" active={fmt.bold} disabled={!canEdit} onClick={() => exec("bold")} />
        <ToolBtn Icon={Italic} label="Cursiva (Ctrl+I)" active={fmt.italic} disabled={!canEdit} onClick={() => exec("italic")} />
        <ToolBtn Icon={Underline} label="Subrayado (Ctrl+U)" active={fmt.underline} disabled={!canEdit} onClick={() => exec("underline")} />
        <ToolBtn Icon={Highlighter} label="Resaltar" disabled={!canEdit} onClick={toggleHighlight} />
        <ToolBtn Icon={Strikethrough} label="Tachado" active={fmt.strike} disabled={!canEdit} onClick={() => exec("strikeThrough")} />
        <ToolBtn Icon={List} label="Lista con viñetas" active={fmt.ul} disabled={!canEdit} onClick={() => exec("insertUnorderedList")} />
        <ToolBtn Icon={ListOrdered} label="Lista numerada" active={fmt.ol} disabled={!canEdit} onClick={() => exec("insertOrderedList")} />
        <ToolBtn Icon={TextQuote} label="Cita" active={fmt.quote} disabled={!canEdit} onClick={() => applyBlockAction("quote")} />
        <ToolBtn Icon={Link2} label="Insertar enlace" active={fmt.inLink} disabled={!canEdit} onClick={onLinkButton} />
        <Sep />
        <ToolBtn Icon={Code} label="Código en línea" disabled={!canEdit} onClick={toggleInlineCode} />
        <ToolBtn Icon={SquareCode} label="Bloque de código" active={fmt.codeblock} disabled={!canEdit} onClick={() => applyBlockAction("codeblock")} />
        <Sep />
        {/* AI */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!canEdit}>
            <button
              type="button"
              title="Asistente de IA"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-[4px] text-[#9A9C9F] hover:bg-[#F7F7F7] hover:text-[#55585D] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C6C9CD]",
                !canEdit && "pointer-events-none opacity-40"
              )}
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {["Resumir la nota", "Mejorar la redacción", "Corregir ortografía y gramática"].map((l) => (
              <DropdownMenuItem
                key={l}
                className="cursor-pointer text-[13px]"
                onSelect={() => toast.info("Las funciones de IA estarán disponibles próximamente")}
              >
                <Sparkles className="mr-2 h-3.5 w-3.5 text-[#9885F1]" />
                {l}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Sep />
        {/* Crear tarea */}
        <button
          type="button"
          title="Convierte el texto seleccionado en una tarea"
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
          Crear tarea
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
              ? "Solo lectura"
              : saveState === "saving"
                ? "Guardando…"
                : saveState === "saved"
                  ? "Guardado · Ahora mismo"
                  : saveState === "error"
                    ? "No se pudo guardar"
                    : "Todos los cambios se guardarán automáticamente"}
          </span>
          <ToolBtn
            Icon={Search}
            label="Buscar en la nota"
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
          title="Lista de notas"
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

        {/* Sidebar panel */}
        {sidebarOpen && (
          <div className="absolute inset-y-0 left-0 z-10 w-[264px] border-r border-[#E0E1E3] bg-white pt-[52px]">
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-sm font-medium text-[#1E1F21]">Notas</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded text-[#9A9C9F] hover:bg-[#F7F7F7]"
                title="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-2">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  editorRef.current?.focus();
                }}
                className="w-full rounded-[6px] bg-[#F7F7F7] px-3 py-2 text-left hover:bg-[#F2F3F4]"
              >
                <p className="truncate text-[13px] font-medium text-[#1E1F21]">{sidebarTitle}</p>
                <p className="mt-0.5 truncate text-xs text-[#6B6D70]">
                  {sidebarSnippet || "Sin contenido"}
                </p>
              </button>
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
                    Nota sin nombre
                  </div>
                )}
                <div
                  ref={titleRef}
                  contentEditable={canEdit}
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Título de la nota"
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
                      title="Insertar"
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
                      Empieza a escribir o ingresa “/” para ver el menú
                    </div>
                  </>
                )}
                <div
                  ref={editorRef}
                  contentEditable={canEdit}
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Contenido de la nota"
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
                  <p className="text-[13px] text-[#9A9C9F]">Esta nota está vacía.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enviar comentarios */}
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="absolute bottom-3 right-6 z-20 h-[31px] w-[100px] rounded-[8px] border border-[#C6C9CD] bg-white text-[10px] text-[#55585D] underline hover:bg-[#F7F7F7]"
        >
          Enviar comentarios
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
              placeholder="Buscar en la nota"
              className="h-6 min-w-0 flex-1 rounded px-1.5 text-xs text-[#1E1F21] outline-none placeholder:text-[#9A9C9F]"
            />
            <span className="shrink-0 px-1 text-[11px] tabular-nums text-[#6B6D70]">
              {matches.length > 0 ? `${matchIdx + 1} de ${matches.length}` : searchQuery.trim() ? "0" : ""}
            </span>
            <button type="button" onClick={() => goToMatch(-1)} disabled={matches.length === 0} className="flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7] disabled:opacity-40" title="Anterior">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => goToMatch(1)} disabled={matches.length === 0} className="flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7] disabled:opacity-40" title="Siguiente">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setSearchOpen(false)} className="flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7]" title="Cerrar">
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
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium text-[#9A9C9F]">Insertar</p>
          {filteredBlocks.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#9A9C9F]">Sin resultados</p>
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
            placeholder="Pega o escribe un enlace"
            className="h-7 min-w-0 flex-1 rounded border border-[#E0E1E3] px-2 text-xs text-[#1E1F21] outline-none placeholder:text-[#9A9C9F] focus:border-[#C6C9CD]"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 shrink-0 rounded-[6px] border border-[#C6C9CD] bg-white px-2.5 text-xs text-[#3F4144] hover:bg-[#F7F7F7]"
          >
            Aplicar
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
            <h3 className="text-sm font-semibold text-[#1E1F21]">Enviar comentarios</h3>
            <p className="mt-1 text-xs text-[#6B6D70]">
              Cuéntanos qué te gustaría mejorar de las notas.
            </p>
            <textarea
              autoFocus
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="mt-3 h-28 w-full resize-none rounded-[6px] border border-[#E0E1E3] p-2 text-[13px] text-[#1E1F21] outline-none placeholder:text-[#9A9C9F] focus:border-[#C6C9CD]"
              placeholder="Escribe tus comentarios…"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                className="h-8 rounded-[6px] px-3 text-xs text-[#55585D] hover:bg-[#F7F7F7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!feedbackText.trim()}
                onClick={() => {
                  setFeedbackOpen(false);
                  setFeedbackText("");
                  toast.success("¡Gracias por tus comentarios!");
                }}
                className="h-8 rounded-[6px] bg-[#4273D1] px-3 text-xs font-medium text-white hover:bg-[#335FB5] disabled:opacity-40"
              >
                Enviar
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
