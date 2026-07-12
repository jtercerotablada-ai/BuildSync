"use client";

/**
 * Workload view — Asana's "Gestión de recursos" timeline, cloned 1:1.
 *
 * Layout: 50px toolbar (Agregar tarea, ‹ Hoy ›, and the right-side controls
 * Días (pequeño) / Filtrar / Agrupar / Cantidad de tareas / Opciones /
 * Enviar comentarios), a 265px fixed resource column, and a horizontally
 * scrollable day timeline with month/day headers, weekend bands, a today
 * line with dot, per-row stepped lavender load charts, and a custom bottom
 * scrollbar with arrow buttons.
 *
 * Data: GET /api/projects/[id]/workload → { tasks, assignees }. A task
 * loads every day of its [startDate, dueDate] span (dueDate-only tasks
 * load that single day). Measures: task count (default) or estimated
 * hours from TIME_TRACKING (spread evenly across the span).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { dueDateToLocalMidnight } from "@/lib/date-only";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ListFilter,
  LayoutGrid,
  CircleCheck,
  SlidersHorizontal,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────

interface WTask {
  id: string;
  name: string;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedMinutes: number;
}

interface WAssignee {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  jobTitle: string | null;
  position: string | null;
  customTitle: string | null;
}

interface WProject {
  id: string;
  name: string;
  color: string | null;
}

interface WorkloadViewProps {
  projectId: string;
  canEdit: boolean;
}

// ─── Layout constants (measured from the Asana reference) ──────────────

const LEFT_W = 265;
const HEADER_H = 41;
const MONTH_ROW_H = 20;
const ROW_H = 41;
const SUB_ROW_H = 36;
const SCROLLBAR_H = 16;
const DAYS_BEFORE_TODAY = 30;
const TOTAL_DAYS = 121;
// Today sits ~10 day-columns from the timeline's left edge on load.
const TODAY_VIEW_OFFSET = 10;

const ZOOMS = [
  { key: "day-lg", label: "Días (grande)", width: 66 },
  { key: "day-sm", label: "Días (pequeño)", width: 33 },
  { key: "weeks", label: "Semanas", width: 12 },
] as const;
type ZoomKey = (typeof ZOOMS)[number]["key"];

type Measure = "count" | "hours";
type GroupBy = "assignee" | "project";

const DAY_MS = 86400000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayIndexOf(rangeStart: Date, d: Date): number {
  return Math.round((startOfDay(d).getTime() - rangeStart.getTime()) / DAY_MS);
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Cargo shown next to the name: "CEO", jobTitle, or a friendly enum. */
function roleLabelOf(a: WAssignee): string {
  if (a.jobTitle) return a.jobTitle;
  if (a.customTitle) return a.customTitle;
  if (!a.position) return "";
  return a.position
    .split("_")
    .map((w) => (w.length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

function initialsOf(name: string | null, email: string | null): string {
  const n = (name || email || "?").trim();
  return n.slice(0, 2).charAt(0).toUpperCase() + n.slice(1, 2).toLowerCase();
}

// Asana-style deterministic avatar colors ([bg, letters]); picked by a
// stable hash of the user id so each person keeps their color.
const AVATAR_COLORS: [string, string][] = [
  ["#F06A6A", "#5E1B1B"],
  ["#EC8D71", "#61301C"],
  ["#F1BD6C", "#6B4E16"],
  ["#AECF55", "#3F4A17"],
  ["#5DA283", "#1D3A2D"],
  ["#4573D2", "#16294D"],
  ["#F1BD6C", "#6B4E16"],
  ["#B36BD4", "#3E1A4E"],
];

function avatarColorOf(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** [startIdx, endIdx] day-range of a task within the window, or null.
 *  Dates are stored as UTC midnight — parse via dueDateToLocalMidnight
 *  (like Gantt/List/Calendar) or every task lands one column early for
 *  viewers west of UTC. */
function taskSpan(t: WTask, rangeStart: Date): [number, number] | null {
  const due = t.dueDate ? dueDateToLocalMidnight(t.dueDate) : null;
  const start = t.startDate ? dueDateToLocalMidnight(t.startDate) : null;
  const a = start ?? due;
  const b = due ?? start;
  if (!a || !b) return null;
  const i = dayIndexOf(rangeStart, a);
  const j = dayIndexOf(rangeStart, b);
  return i <= j ? [i, j] : [j, i];
}

// ─── Component ─────────────────────────────────────────────────────────

export function WorkloadView({ projectId, canEdit }: WorkloadViewProps) {
  const [tasks, setTasks] = useState<WTask[]>([]);
  const [assignees, setAssignees] = useState<WAssignee[]>([]);
  const [project, setProject] = useState<WProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // View state
  const [zoom, setZoom] = useState<ZoomKey>("day-sm");
  const [measure, setMeasure] = useState<Measure>("count");
  const [groupBy, setGroupBy] = useState<GroupBy>("assignee");
  const [hiddenAssignees, setHiddenAssignees] = useState<Set<string>>(new Set());
  const [shadeWeekends, setShadeWeekends] = useState(true);
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const dayW = ZOOMS.find((z) => z.key === zoom)!.width;
  const zoomLabel = ZOOMS.find((z) => z.key === zoom)!.label;

  // Date window: today-30 … today+90. Computed once per mount.
  const [today] = useState(() => startOfDay(new Date()));
  const rangeStart = useMemo(() => addDays(today, -DAYS_BEFORE_TODAY), [today]);
  const days = useMemo(
    () => Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(rangeStart, i)),
    [rangeStart]
  );
  const timelineW = TOTAL_DAYS * dayW;

  // ── Data fetch ────────────────────────────────────────────────────────
  // Only the FIRST load shows the spinner: reloads (after Agregar tarea)
  // must not unmount the scroll DOM or the timeline would snap back to the
  // window start and desync the custom scrollbar thumb.
  const firstLoadRef = useRef(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (firstLoadRef.current) setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/workload`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setTasks(data.tasks ?? []);
        setAssignees(data.assignees ?? []);
        setProject(data.projects?.[0] ?? null);
      } catch (err) {
        console.error("Error fetching workload:", err);
        if (!cancelled) toast.error("No se pudo cargar la gestión de recursos");
      } finally {
        if (!cancelled) {
          setLoading(false);
          firstLoadRef.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  // ── Load math ─────────────────────────────────────────────────────────

  // Hidden people AND a hidden "Sin asignar" row both leave the totals —
  // otherwise the total row disagrees with the sum of visible rows.
  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.assigneeId) return !hiddenAssignees.has(t.assigneeId);
        return showUnassigned;
      }),
    [tasks, hiddenAssignees, showUnassigned]
  );

  const loadOf = useCallback(
    (taskList: WTask[]): number[] => {
      const vals = new Array<number>(TOTAL_DAYS).fill(0);
      for (const t of taskList) {
        const span = taskSpan(t, rangeStart);
        if (!span) continue;
        const [i0, j0] = span;
        const i = Math.max(0, i0);
        const j = Math.min(TOTAL_DAYS - 1, j0);
        if (i > j) continue;
        const spanDays = j0 - i0 + 1;
        const perDay =
          measure === "count" ? 1 : t.estimatedMinutes / 60 / spanDays;
        for (let k = i; k <= j; k++) vals[k] += perDay;
      }
      return vals;
    },
    [rangeStart, measure]
  );

  // Row model — grouping decides the middle rows; total is always first.
  const rows = useMemo(() => {
    const list: {
      key: string;
      kind: "assignee" | "project" | "unassigned";
      assignee?: WAssignee;
      label: string;
      tasks: WTask[];
    }[] = [];
    if (groupBy === "assignee") {
      const sorted = [...assignees]
        .filter((a) => !hiddenAssignees.has(a.id))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      for (const a of sorted) {
        list.push({
          key: a.id,
          kind: "assignee",
          assignee: a,
          label: a.name || a.email || "—",
          tasks: visibleTasks.filter((t) => t.assigneeId === a.id),
        });
      }
      if (showUnassigned) {
        list.push({
          key: "__unassigned",
          kind: "unassigned",
          label: "Sin asignar",
          tasks: visibleTasks.filter((t) => !t.assigneeId),
        });
      }
    } else {
      list.push({
        key: project?.id ?? "__project",
        kind: "project",
        label: project?.name ?? "Proyecto",
        tasks: visibleTasks,
      });
    }
    return list;
  }, [groupBy, assignees, hiddenAssignees, visibleTasks, showUnassigned, project]);

  const totalLoad = useMemo(() => loadOf(visibleTasks), [loadOf, visibleTasks]);

  // ── Scrolling: one scroll container; left column + header are sticky.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 40 });

  const syncThumb = useCallback(() => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const viewportW = el.clientWidth - LEFT_W;
    const contentW = timelineW;
    const trackW = track.clientWidth;
    let next: { left: number; width: number };
    if (contentW <= viewportW) {
      next = { left: 0, width: trackW };
    } else {
      const w = Math.max(30, (viewportW / contentW) * trackW);
      const maxScroll = contentW - viewportW;
      next = { left: (el.scrollLeft / maxScroll) * (trackW - w), width: w };
    }
    // Bail when unchanged — this runs on EVERY scroll event (vertical
    // included) and a fresh state object would re-render the whole view.
    setThumb((prev) =>
      Math.abs(prev.left - next.left) < 0.5 &&
      Math.abs(prev.width - next.width) < 0.5
        ? prev
        : next
    );
  }, [timelineW]);

  useEffect(() => {
    syncThumb();
    const onResize = () => syncThumb();
    window.addEventListener("resize", onResize);
    // The container also resizes without a window resize (sidebar
    // collapse/expand) — observe it directly.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && scrollRef.current) {
      ro = new ResizeObserver(() => syncThumb());
      ro.observe(scrollRef.current);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [syncThumb, loading]);

  // Plain scrollLeft assignment, not behavior:"smooth" — smooth scrolling
  // is rAF-driven and silently no-ops in throttled/background tabs.
  const scrollToDay = useCallback(
    (dayIdx: number) => {
      const el = scrollRef.current;
      if (el) el.scrollLeft = dayIdx * dayW;
    },
    [dayW]
  );

  // Land with today ~10 columns in from the left edge (like the reference).
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current || loading) return;
    didInitialScroll.current = true;
    scrollToDay(DAYS_BEFORE_TODAY - TODAY_VIEW_OFFSET);
  }, [loading, scrollToDay]);

  const onThumbPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = scrollRef.current;
      const track = trackRef.current;
      if (!el || !track) return;
      e.preventDefault();
      const thumbEl = e.currentTarget as HTMLElement;
      const startX = e.clientX;
      const startScroll = el.scrollLeft;
      const viewportW = el.clientWidth - LEFT_W;
      const maxScroll = timelineW - viewportW;
      if (maxScroll <= 0) return;
      const trackW = track.clientWidth;
      const thumbW = Math.max(30, (viewportW / timelineW) * trackW);
      const denom = trackW - thumbW;
      if (denom <= 0) return;
      // Pointer capture routes move/up/cancel to the thumb even when the
      // pointer leaves the window, and pointercancel (touch pan takeover)
      // can't leak the listeners like a document-level pair would.
      thumbEl.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        el.scrollLeft = startScroll + ((ev.clientX - startX) / denom) * maxScroll;
      };
      const end = () => {
        thumbEl.removeEventListener("pointermove", move);
        thumbEl.removeEventListener("pointerup", end);
        thumbEl.removeEventListener("pointercancel", end);
      };
      thumbEl.addEventListener("pointermove", move);
      thumbEl.addEventListener("pointerup", end);
      thumbEl.addEventListener("pointercancel", end);
    },
    [timelineW]
  );

  const nudge = useCallback(
    (dir: 1 | -1) => {
      const el = scrollRef.current;
      if (el) el.scrollLeft += dir * dayW * 7;
    },
    [dayW]
  );

  // Zoom keeps the left-edge DATE anchored: the browser preserves pixel
  // scrollLeft across the width change, which would jump the view by weeks.
  const pendingAnchorRef = useRef<number | null>(null);
  const changeZoom = useCallback(
    (key: ZoomKey) => {
      const el = scrollRef.current;
      if (el) pendingAnchorRef.current = el.scrollLeft / dayW;
      setZoom(key);
    },
    [dayW]
  );
  useLayoutEffect(() => {
    if (pendingAnchorRef.current == null) return;
    const el = scrollRef.current;
    if (el) el.scrollLeft = pendingAnchorRef.current * dayW;
    pendingAnchorRef.current = null;
    syncThumb();
  }, [dayW, syncThumb]);

  // ── Derived header data ───────────────────────────────────────────────
  const monthMarks = useMemo(() => {
    const marks: { idx: number; label: string }[] = [];
    days.forEach((d, i) => {
      if (i === 0 || d.getDate() === 1) {
        marks.push({ idx: i, label: MONTH_NAMES[d.getMonth()] });
      }
    });
    return marks;
  }, [days]);

  const todayIdx = DAYS_BEFORE_TODAY;
  const showDayNumbers = dayW >= 24;

  // ── Add-task modal state ──────────────────────────────────────────────
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: "",
    assigneeId: "",
    startDate: "",
    dueDate: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!addOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const seen = new Set<string>();
        const list: { id: string; name: string }[] = [];
        const push = (u?: { id: string; name: string | null; email: string | null }) => {
          if (!u || seen.has(u.id)) return;
          seen.add(u.id);
          list.push({ id: u.id, name: u.name || u.email || "—" });
        };
        push(data.owner);
        for (const m of data.members ?? []) push(m.user);
        setMembers(list);
      } catch {
        // selector stays empty — task can still be created unassigned
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addOpen, projectId]);

  const submitTask = useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          projectId,
          assigneeId: form.assigneeId || null,
          startDate: form.startDate || null,
          dueDate: form.dueDate || form.startDate || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Tarea creada");
      setAddOpen(false);
      setForm({ name: "", assigneeId: "", startDate: "", dueDate: "" });
      setReloadKey((k) => k + 1);
    } catch {
      toast.error("No se pudo crear la tarea");
    } finally {
      setSaving(false);
    }
  }, [form, projectId]);

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ───────────── Toolbar ───────────── */}
      <div className="flex h-[50px] shrink-0 items-center border-b border-[#E0E1E3] bg-white pl-[19px] pr-4">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setAddOpen(true)}
          className={cn(
            "flex h-7 items-center gap-1 rounded-[6px] border border-[#C6C9CD] bg-white px-2.5 text-[11px] text-[#44464B] hover:bg-[#F7F7F7]",
            !canEdit && "pointer-events-none opacity-40"
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Agregar tarea
        </button>
        <button
          type="button"
          title="Período anterior"
          onClick={() => nudge(-1)}
          className="ml-3 flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => scrollToDay(DAYS_BEFORE_TODAY - TODAY_VIEW_OFFSET)}
          className="px-1 text-[11px] text-[#44464B] hover:underline"
        >
          Hoy
        </button>
        <button
          type="button"
          title="Período siguiente"
          onClick={() => nudge(1)}
          className="flex h-6 w-6 items-center justify-center rounded text-[#6B6D70] hover:bg-[#F7F7F7]"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-1">
          <ToolMenu Icon={ZoomIn} label={zoomLabel}>
            {ZOOMS.map((z) => (
              <DropdownMenuCheckboxItem
                key={z.key}
                checked={zoom === z.key}
                onSelect={() => changeZoom(z.key)}
                className="cursor-pointer text-[12px]"
              >
                {z.label}
              </DropdownMenuCheckboxItem>
            ))}
          </ToolMenu>
          <VSep />
          <ToolMenu Icon={ListFilter} label="Filtrar">
            <DropdownMenuLabel className="text-[11px] font-normal text-[#9A9C9F]">
              Mostrar personas
            </DropdownMenuLabel>
            {assignees.length === 0 && (
              <p className="px-2 py-1.5 text-[11px] text-[#9A9C9F]">
                Sin personas con tareas
              </p>
            )}
            {assignees.map((a) => (
              <DropdownMenuCheckboxItem
                key={a.id}
                checked={!hiddenAssignees.has(a.id)}
                onSelect={(e) => {
                  e.preventDefault();
                  setHiddenAssignees((prev) => {
                    const next = new Set(prev);
                    if (next.has(a.id)) next.delete(a.id);
                    else next.add(a.id);
                    return next;
                  });
                }}
                className="cursor-pointer text-[12px]"
              >
                {a.name || a.email}
              </DropdownMenuCheckboxItem>
            ))}
          </ToolMenu>
          <VSep />
          <ToolMenu Icon={LayoutGrid} label="Agrupar">
            <DropdownMenuCheckboxItem
              checked={groupBy === "assignee"}
              onSelect={() => setGroupBy("assignee")}
              className="cursor-pointer text-[12px]"
            >
              Persona responsable
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={groupBy === "project"}
              onSelect={() => setGroupBy("project")}
              className="cursor-pointer text-[12px]"
            >
              Proyecto
            </DropdownMenuCheckboxItem>
          </ToolMenu>
          <VSep />
          <ToolMenu
            Icon={CircleCheck}
            label={measure === "count" ? "Cantidad de tareas" : "Horas estimadas"}
          >
            <DropdownMenuCheckboxItem
              checked={measure === "count"}
              onSelect={() => setMeasure("count")}
              className="cursor-pointer text-[12px]"
            >
              Cantidad de tareas
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={measure === "hours"}
              onSelect={() => setMeasure("hours")}
              className="cursor-pointer text-[12px]"
            >
              Horas estimadas
            </DropdownMenuCheckboxItem>
          </ToolMenu>
          <VSep />
          <ToolMenu Icon={SlidersHorizontal} label="Opciones">
            <DropdownMenuCheckboxItem
              checked={shadeWeekends}
              onSelect={(e) => {
                e.preventDefault();
                setShadeWeekends((v) => !v);
              }}
              className="cursor-pointer text-[12px]"
            >
              Sombrear fines de semana
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showUnassigned}
              onSelect={(e) => {
                e.preventDefault();
                setShowUnassigned((v) => !v);
              }}
              className="cursor-pointer text-[12px]"
            >
              Mostrar “Sin asignar”
            </DropdownMenuCheckboxItem>
          </ToolMenu>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="ml-2 text-[11px] text-[#55585D] underline hover:text-[#1E1F21]"
          >
            Enviar comentarios
          </button>
        </div>
      </div>

      {/* ───────────── Timeline ───────────── */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={syncThumb}
          className="bs-workload-scroll h-full overflow-auto"
          style={{ paddingBottom: SCROLLBAR_H }}
        >
          <div
            className="relative flex min-h-full flex-col"
            style={{ width: LEFT_W + timelineW }}
          >
            {/* Background layer: base tint, weekend bands, month lines, today line */}
            <div
              className="absolute inset-y-0 z-0 bg-[#FAFAFB]"
              style={{ left: LEFT_W, width: timelineW }}
            >
              {shadeWeekends &&
                days.map((d, i) =>
                  d.getDay() === 0 || d.getDay() === 6 ? (
                    <div
                      key={i}
                      className="absolute inset-y-0 bg-[#F0F1F3]"
                      style={{ left: i * dayW, width: dayW }}
                    />
                  ) : null
                )}
              {monthMarks.map(
                (m) =>
                  m.idx > 0 && (
                    <div
                      key={`ml-${m.idx}`}
                      className="absolute inset-y-0 w-px bg-[#E4E5E7]"
                      style={{ left: m.idx * dayW }}
                    />
                  )
              )}
              {/* Today line */}
              <div
                className="absolute inset-y-0 w-px bg-[#B5CBF7]"
                style={{ left: todayIdx * dayW + dayW / 2 }}
              />
            </div>

            {/* Header (sticky top) */}
            <div
              className="sticky top-0 z-30 flex shrink-0"
              style={{ height: HEADER_H }}
            >
              <div
                className="sticky left-0 z-40 shrink-0 border-b border-r border-[#E0E1E3] bg-white"
                style={{ width: LEFT_W }}
              />
              <div
                className="relative border-b border-[#E0E1E3] bg-white"
                style={{ width: timelineW }}
              >
                {/* weekend tint inside the header too */}
                {shadeWeekends &&
                  days.map((d, i) =>
                    d.getDay() === 0 || d.getDay() === 6 ? (
                      <div
                        key={i}
                        className="absolute bottom-0 bg-[#F0F1F3]"
                        style={{
                          left: i * dayW,
                          width: dayW,
                          top: MONTH_ROW_H,
                        }}
                      />
                    ) : null
                  )}
                {/* Month labels — each lives in its month-wide clipping
                    strip and sticks to the viewport's left edge while its
                    month is in view (Asana pins the current month). */}
                {monthMarks.map((m, mi) => {
                  const nextIdx = monthMarks[mi + 1]?.idx ?? TOTAL_DAYS;
                  return (
                    <div key={`m-${m.idx}`}>
                      {/* No overflow-hidden here — it would become the
                          span's scrollport and kill position:sticky; the
                          sticky constraint alone keeps the label inside. */}
                      <div
                        className="absolute top-0 flex"
                        style={{
                          left: m.idx * dayW,
                          width: (nextIdx - m.idx) * dayW,
                          height: MONTH_ROW_H,
                        }}
                      >
                        <span
                          className="whitespace-nowrap pt-[4px] text-[9px] text-[#9A9C9F]"
                          style={{ position: "sticky", left: LEFT_W + 4 }}
                        >
                          {m.label}
                        </span>
                      </div>
                      {m.idx > 0 && (
                        <div
                          className="absolute inset-y-0 w-px bg-[#E4E5E7]"
                          style={{ left: m.idx * dayW }}
                        />
                      )}
                    </div>
                  );
                })}
                {/* Day numbers — centered per column; at Semanas zoom only
                    Mondays are labeled, left-aligned at their column. */}
                {days.map((d, i) =>
                  showDayNumbers ? (
                    <span
                      key={`d-${i}`}
                      className="absolute text-center text-[10px] leading-[21px] text-[#6B6D70]"
                      style={{ left: i * dayW, width: dayW, top: MONTH_ROW_H }}
                    >
                      {d.getDate()}
                    </span>
                  ) : d.getDay() === 1 ? (
                    <span
                      key={`d-${i}`}
                      className="absolute text-[10px] leading-[21px] text-[#6B6D70]"
                      style={{ left: i * dayW + 2, top: MONTH_ROW_H }}
                    >
                      {d.getDate()}
                    </span>
                  ) : null
                )}
                {/* Today dot at the header/body boundary */}
                <div
                  className="absolute z-10 h-[7px] w-[7px] rounded-full bg-[#3B62C6]"
                  style={{
                    left: todayIdx * dayW + dayW / 2 - 3,
                    bottom: -4,
                  }}
                />
              </div>
            </div>

            {/* ── Total row ── */}
            <Row
              laneW={timelineW}
              left={
                <div className="flex items-center gap-2 pl-[14px]">
                  <CircleCheck
                    className="h-4 w-4 text-[#B7B9BD]"
                    strokeWidth={1.5}
                  />
                  <span className="text-[12px] text-[#44464B]">
                    Tareas en total
                  </span>
                </div>
              }
            >
              <LoadChart
                vals={totalLoad}
                dayW={dayW}
                measure={measure}
                showNumbers={showDayNumbers}
              />
            </Row>

            {/* ── Grouped rows ── */}
            {rows.map((row) => {
              const isOpen = expanded.has(row.key);
              const vals = loadOf(row.tasks);
              return (
                <div key={row.key} className="contents">
                  <Row
                    laneW={timelineW}
                    left={
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.key)) next.delete(row.key);
                            else next.add(row.key);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-1.5 pl-[6px] text-left"
                      >
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-[#9A9C9F] transition-transform",
                            isOpen && "rotate-90"
                          )}
                        />
                        {row.kind === "assignee" && row.assignee && (
                          <>
                            {row.assignee.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.assignee.image}
                                alt=""
                                className="h-6 w-6 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
                                style={{
                                  background: avatarColorOf(row.assignee.id)[0],
                                  color: avatarColorOf(row.assignee.id)[1],
                                }}
                              >
                                {initialsOf(row.assignee.name, row.assignee.email)}
                              </span>
                            )}
                            <span className="truncate text-[12px] font-medium text-[#1E1F21]">
                              {row.label}
                            </span>
                            {roleLabelOf(row.assignee) && (
                              <span className="ml-1 shrink-0 truncate text-[10px] text-[#9A9C9F]">
                                {roleLabelOf(row.assignee)}
                              </span>
                            )}
                          </>
                        )}
                        {row.kind === "project" && (
                          <>
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                              style={{ background: project?.color ?? "#C6C9CD" }}
                            />
                            <span className="truncate text-[12px] font-medium text-[#1E1F21]">
                              {row.label}
                            </span>
                          </>
                        )}
                        {row.kind === "unassigned" && (
                          <span className="text-[12px] text-[#44464B]">
                            Sin asignar
                          </span>
                        )}
                      </button>
                    }
                  >
                    <LoadChart
                      vals={vals}
                      dayW={dayW}
                      measure={measure}
                      showNumbers={showDayNumbers}
                    />
                  </Row>

                  {/* Expanded task sub-rows */}
                  {isOpen &&
                    (row.tasks.length === 0 ? (
                      <Row height={SUB_ROW_H} laneW={timelineW} left={
                        <span className="pl-[46px] text-[11px] text-[#9A9C9F]">
                          Sin tareas
                        </span>
                      }>
                        {null}
                      </Row>
                    ) : (
                      row.tasks.map((t) => {
                        const span = taskSpan(t, rangeStart);
                        return (
                          <Row
                            key={t.id}
                            height={SUB_ROW_H}
                            laneW={timelineW}
                            left={
                              <span
                                className="block truncate pl-[46px] pr-2 text-[11px] text-[#44464B]"
                                title={t.name}
                              >
                                {t.name}
                              </span>
                            }
                          >
                            {span && span[1] >= 0 && span[0] < TOTAL_DAYS && (
                              <div
                                className="absolute flex items-center overflow-hidden rounded-[4px] border border-[#A5A3E8] bg-[#CBC9F2] px-1.5"
                                style={{
                                  left: Math.max(0, span[0]) * dayW + 1,
                                  width:
                                    (Math.min(TOTAL_DAYS - 1, span[1]) -
                                      Math.max(0, span[0]) +
                                      1) *
                                      dayW -
                                    2,
                                  height: 18,
                                  top: (SUB_ROW_H - 18) / 2,
                                }}
                              >
                                <span className="truncate text-[10px] leading-none text-[#3F3D6E]">
                                  {t.name}
                                </span>
                              </div>
                            )}
                          </Row>
                        );
                      })
                    ))}
                </div>
              );
            })}

            {/* Filler keeps the left column white and bands visible below */}
            <div className="flex min-h-[60px] flex-1">
              <div
                className="sticky left-0 z-20 shrink-0 border-r border-[#E0E1E3] bg-white"
                style={{ width: LEFT_W }}
              />
              <div style={{ width: timelineW }} />
            </div>
          </div>
        </div>

        {/* ── Custom bottom scrollbar (calendar area only) ── */}
        <div
          className="absolute bottom-0 right-0 z-40 flex items-center border-t border-[#EDEEEF] bg-white"
          style={{ left: LEFT_W, height: SCROLLBAR_H }}
        >
          <button
            type="button"
            aria-label="Desplazar a la izquierda"
            onClick={() => nudge(-1)}
            className="flex h-full w-5 items-center justify-center text-[#9A9C9F] hover:text-[#55585D]"
          >
            <svg width="7" height="8" viewBox="0 0 7 8" fill="currentColor">
              <path d="M7 0L0 4l7 4z" />
            </svg>
          </button>
          <div ref={trackRef} className="relative h-full flex-1">
            <div
              onPointerDown={onThumbPointerDown}
              className="absolute top-1/2 h-[11px] -translate-y-1/2 cursor-pointer touch-none select-none rounded-full bg-[#6F7175] hover:bg-[#55585D]"
              style={{ left: thumb.left, width: thumb.width }}
            />
          </div>
          <button
            type="button"
            aria-label="Desplazar a la derecha"
            onClick={() => nudge(1)}
            className="flex h-full w-5 items-center justify-center text-[#9A9C9F] hover:text-[#55585D]"
          >
            <svg width="7" height="8" viewBox="0 0 7 8" fill="currentColor">
              <path d="M0 0l7 4-7 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ───────────── Add-task modal ───────────── */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="w-[420px] rounded-[10px] border border-[#E0E1E3] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-[#1E1F21]">
              Agregar tarea
            </h3>
            <div className="mt-3 space-y-2.5">
              <label className="block">
                <span className="text-[11px] text-[#6B6D70]">Nombre</span>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-0.5 h-8 w-full rounded-[6px] border border-[#E0E1E3] px-2 text-[13px] text-[#1E1F21] outline-none focus:border-[#C6C9CD]"
                  placeholder="Nombre de la tarea"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-[#6B6D70]">Responsable</span>
                <select
                  value={form.assigneeId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assigneeId: e.target.value }))
                  }
                  className="mt-0.5 h-8 w-full rounded-[6px] border border-[#E0E1E3] bg-white px-2 text-[13px] text-[#1E1F21] outline-none focus:border-[#C6C9CD]"
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <label className="block flex-1">
                  <span className="text-[11px] text-[#6B6D70]">
                    Fecha de inicio
                  </span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                    className="mt-0.5 h-8 w-full rounded-[6px] border border-[#E0E1E3] px-2 text-[12px] text-[#1E1F21] outline-none focus:border-[#C6C9CD]"
                  />
                </label>
                <label className="block flex-1">
                  <span className="text-[11px] text-[#6B6D70]">
                    Fecha de entrega
                  </span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dueDate: e.target.value }))
                    }
                    className="mt-0.5 h-8 w-full rounded-[6px] border border-[#E0E1E3] px-2 text-[12px] text-[#1E1F21] outline-none focus:border-[#C6C9CD]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] text-[#6B6D70]">Proyecto</span>
                <input
                  disabled
                  value={project?.name ?? ""}
                  className="mt-0.5 h-8 w-full rounded-[6px] border border-[#E0E1E3] bg-[#F7F7F7] px-2 text-[13px] text-[#6B6D70]"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="h-8 rounded-[6px] px-3 text-xs text-[#55585D] hover:bg-[#F7F7F7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!form.name.trim() || saving}
                onClick={() => void submitTask()}
                className="h-8 rounded-[6px] bg-[#4273D1] px-3 text-xs font-medium text-white hover:bg-[#335FB5] disabled:opacity-40"
              >
                {saving ? "Creando…" : "Crear tarea"}
              </button>
            </div>
          </div>
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
            <h3 className="text-sm font-semibold text-[#1E1F21]">
              Enviar comentarios
            </h3>
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

      <style>{`
        .bs-workload-scroll { scrollbar-width: none; }
        .bs-workload-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ─── Row shell: sticky-left cell + timeline lane ───────────────────────

function Row({
  left,
  children,
  laneW,
  height = ROW_H,
}: {
  left: React.ReactNode;
  children: React.ReactNode;
  laneW: number;
  height?: number;
}) {
  return (
    <div className="flex shrink-0" style={{ height }}>
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center border-b border-r border-[#E7E8EA] bg-white"
        style={{ width: LEFT_W }}
      >
        <div className="min-w-0 flex-1">{left}</div>
      </div>
      <div
        className="relative z-10 border-b border-[#E7E8EA]"
        style={{ width: laneW }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Stepped lavender load chart ───────────────────────────────────────

function LoadChart({
  vals,
  dayW,
  measure,
  showNumbers,
}: {
  vals: number[];
  dayW: number;
  measure: Measure;
  showNumbers: boolean;
}) {
  const H = ROW_H;
  const total = vals.length;
  // Level height: count 1 → 13px, 2 → 20px…, hours scale on an 8h day.
  const unit = measure === "count" ? 1 : 8;
  const hOf = (v: number) =>
    v > 0 ? Math.min(H - 12, 6 + (v / unit) * 7) : 0;
  const s = Math.min(8, dayW / 4); // ramp half-width at level changes

  const { area, line, labels } = useMemo(() => {
    const pts: [number, number][] = [];
    let started = false;
    let startX = 0;
    const areas: string[] = [];
    const lines: string[] = [];
    const labels: { x: number; y: number; text: string }[] = [];
    // Ramps at the window edges must not run outside the SVG viewport.
    const clampX = (x: number) => Math.max(0, Math.min(total * dayW, x));

    const flush = () => {
      if (!pts.length) return;
      const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
      const area = `${line} L${pts[pts.length - 1][0]},${H} L${startX},${H} Z`;
      areas.push(area);
      lines.push(line);
      pts.length = 0;
    };

    for (let k = 0; k <= total; k++) {
      const prev = k > 0 ? hOf(vals[k - 1]) : 0;
      const cur = k < total ? hOf(vals[k]) : 0;
      const xb = k * dayW;
      if (prev !== cur) {
        if (!started && cur > 0) {
          started = true;
          startX = clampX(xb - s);
          pts.push([startX, H]);
        }
        if (started) {
          if (prev > 0) pts.push([clampX(xb - s), H - prev]);
          if (cur > 0) pts.push([clampX(xb + s), H - cur]);
          else {
            pts.push([clampX(xb + s), H]);
            flush();
            started = false;
          }
        }
      }
      if (k < total && vals[k] > 0 && showNumbers) {
        const text =
          measure === "count"
            ? String(Math.round(vals[k]))
            : (Math.round(vals[k] * 10) / 10).toString();
        labels.push({ x: k * dayW + dayW / 2, y: H - hOf(vals[k]) - 3, text });
      }
    }
    flush();
    return { area: areas.join(" "), line: lines.join(" "), labels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals, dayW, measure, showNumbers]);

  if (!area) {
    return <div style={{ width: total * dayW, height: H }} />;
  }

  return (
    <svg
      width={total * dayW}
      height={H}
      className="block"
      aria-hidden="true"
    >
      <path d={area} fill="#8B87E8" fillOpacity={0.12} />
      <path d={line} fill="none" stroke="#B3B0EE" strokeWidth={1} />
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          fontSize={9}
          fill="#6B6D70"
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}

// ─── Toolbar bits ──────────────────────────────────────────────────────

function VSep() {
  return <div className="mx-1 h-4 w-px bg-[#E0E1E3]" />;
}

function ToolMenu({
  Icon,
  label,
  children,
}: {
  Icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-[11px] text-[#44464B] hover:bg-[#F7F7F7]"
        >
          <Icon className="h-3.5 w-3.5 text-[#6B6D70]" strokeWidth={1.75} />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
