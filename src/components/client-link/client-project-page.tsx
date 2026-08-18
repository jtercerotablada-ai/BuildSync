import Image from "next/image";
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Flag,
  Landmark,
  MapPin,
  ShieldCheck,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  ClientProjectView,
  ClientStage,
} from "@/lib/client-link/projection";
import { heroImageFor } from "@/lib/client-link/hero-image";
import { company, contact } from "@/lib/ttc/site";
import { PortalShell } from "./portal-shell";

/**
 * The client-facing project page.
 *
 * Presentation only: it renders a ClientProjectView (and the share link's own
 * label, for the viewer chip) and reaches for nothing else. Keeping the data
 * fetch in the route and the markup here means this component can be
 * server-rendered against a real projection in a test without a request, and
 * it keeps the "one place decides what a client sees" rule honest — this file
 * has no database access to abuse.
 *
 * House style is warm near-white paper + charcoal ink + architectural gold
 * (#b98a2e), with the deep gold #8a6d24 for text and #7a5f1e for the large
 * display numerals. Green appears ONLY for a completed stage and red ONLY for a
 * genuinely overdue action item — both muted, both paired with a label/shape so
 * status is never colour alone. The friendly status enum the projection
 * collapsed to lives in the top bar; there are no red/green traffic lights for
 * the firm's own status.
 *
 * Scale is tuned for a wide (1600–1920px) executive desktop and reflows down.
 * The app shell (sidebar + top bar) is in <PortalShell>; everything below is
 * the project content it wraps.
 */

const GATE_SEQUENCE = [
  "PRE_DESIGN",
  "DESIGN",
  "PERMITTING",
  "CONSTRUCTION",
  "CLOSEOUT",
] as const;

const GATE_LABEL: Record<string, string> = {
  PRE_DESIGN: "Pre-design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

const TYPE_LABEL: Record<string, string> = {
  CONSTRUCTION: "Construction",
  DESIGN: "Design",
  RECERTIFICATION: "Building recertification",
  PERMIT: "Permit",
};

/** Dates are calendar days; render in UTC so they don't drift a day. */
function formatDate(value: Date | null): string {
  if (!value) return "To be scheduled";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Signed whole-day count to a due date; null when there is no date. */
function dayCount(due: Date | null): number | null {
  if (!due) return null;
  return Math.ceil((due.getTime() - Date.now()) / 86_400_000);
}

/** "Due in N days" / "Overdue by N days" / "Due today", or null when undated. */
function dueLabel(due: Date | null): string | null {
  const n = dayCount(due);
  if (n === null) return null;
  if (n === 0) return "Due today";
  if (n < 0) {
    const d = Math.abs(n);
    return `Overdue by ${d} ${d === 1 ? "day" : "days"}`;
  }
  return `Due in ${n} ${n === 1 ? "day" : "days"}`;
}

/** "~4.5 months to go" (or weeks when close); null when there is no end date. */
function monthsToGoLabel(end: Date | null): string | null {
  if (!end) return null;
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return null;
  const days = ms / 86_400_000;
  if (days < 45) {
    const weeks = Math.max(1, Math.round(days / 7));
    return weeks === 1 ? "~1 week to go" : `~${weeks} weeks to go`;
  }
  return `~${(days / 30.44).toFixed(1)} months to go`;
}

/** Compact relative time for the activity feed. */
function timeAgo(at: Date): string {
  const diff = Date.now() - at.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(diff / 3_600_000);
    return hours <= 0 ? "just now" : `${hours}h ago`;
  }
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** A short, monochrome kind tag for a document chip (PDF / IMG / DWG / …). */
function fileKind(mimeType: string, name: string): string {
  const m = mimeType.toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (m.includes("pdf") || ext === "pdf") return "PDF";
  if (m.startsWith("image/")) return "IMG";
  if (m.includes("word") || ext === "doc" || ext === "docx") return "DOC";
  if (
    m.includes("sheet") ||
    m.includes("excel") ||
    ext === "xls" ||
    ext === "xlsx" ||
    ext === "csv"
  )
    return "XLS";
  if (m.includes("zip") || ext === "zip") return "ZIP";
  if (ext === "dwg" || ext === "dxf") return "DWG";
  return "FILE";
}

/* ── Small presentational atoms ────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="p-h2">{children}</h2>;
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="grid h-6 min-w-[1.5rem] place-items-center rounded-full bg-[color:var(--gold-tint)] px-2 text-[12px] font-semibold text-[color:var(--gold-ink)]">
      {n}
    </span>
  );
}

/** Gold progress ring with the percent as a large, deep-gold serif numeral. */
function ProgressRing({ percent }: { percent: number }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg
      width="86"
      height="86"
      viewBox="0 0 86 86"
      className="shrink-0"
      role="img"
      aria-label={`${percent}% complete`}
    >
      <circle cx="43" cy="43" r={r} fill="none" strokeWidth="6.5" className="p-ring-track" />
      <circle
        cx="43"
        cy="43"
        r={r}
        fill="none"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 43 43)"
        className="p-ring-fill"
        style={{ "--c": `${circumference}` } as React.CSSProperties}
      />
      <text
        x="43"
        y="45"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fill: "var(--gold-deep)",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "31px",
        }}
      >
        {percent}%
      </text>
    </svg>
  );
}

/** A calendar chip for an inspection date — tinted month over a serif day. */
function DateChip({ date }: { date: Date }) {
  const month = date
    .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const day = date.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  return (
    <span className="p-cal" aria-hidden>
      <span className="p-cal__mon">{month}</span>
      <span className="p-cal__day">{day}</span>
    </span>
  );
}

/**
 * One metric card. Every card shares the same anatomy — a visual on the left
 * (an icon badge, or the ring for progress) and a label / value / subline stack
 * on the right — so the four read as a set rather than four different cards.
 */
function StatCard({
  label,
  icon: Icon,
  visual,
  trailing,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  visual?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-card p-stat">
      {visual ?? (
        Icon && (
          <span className="p-stat__icon" aria-hidden>
            <Icon size={23} strokeWidth={1.6} />
          </span>
        )
      )}
      <div className="p-stat__content">
        <div className="flex items-center justify-between gap-2">
          <p className="p-metric-label">{label}</p>
          {trailing}
        </div>
        <div className="mt-1.5">{children}</div>
      </div>
    </div>
  );
}

/** An elegant, minimal empty state — icon, one short line, generous space. */
function EmptyState({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--surface-sunk)] text-[color:var(--ink-400)] ring-1 ring-[color:var(--line)]">
        {icon}
      </span>
      <p className="max-w-[23rem] text-[13.5px] leading-relaxed text-[color:var(--ink-500)]">
        {children}
      </p>
    </div>
  );
}

/* ── Stage stepper — done / current / upcoming, precise connectors ───── */

/**
 * Icon per stage, matched on the client-facing label the projection produced.
 * A section we don't recognise still renders — it just gets the neutral clock —
 * so the rail stays driven by the real Sections rather than by this map.
 */
const STAGE_ICON: Record<string, LucideIcon> = {
  kickoff: Flag,
  "inspection & reports": FileText,
  "city review": Landmark,
  repairs: Wrench,
  recertified: ShieldCheck,
  // Gate-fallback labels, for projects with no client-visible sections.
  "pre-design": Flag,
  design: FileText,
  permitting: Landmark,
  construction: Wrench,
  closeout: ShieldCheck,
};

function stageIcon(label: string): LucideIcon {
  return STAGE_ICON[label.trim().toLowerCase()] ?? Clock3;
}

/** The node glyph. `current` (the furthest-along incomplete step) is the one
 *  solid gold marker; a non-current `active` section reads as in-progress
 *  behind it; `done` swaps its icon for a check; `upcoming` is quiet.
 *  Fill, border and glyph all differ per state, so colour is never the only
 *  signal — and the label carries the state word for assistive tech. */
function StepNode({
  state,
  current,
  label,
}: {
  state: ClientStage["state"];
  current: boolean;
  label: string;
}) {
  const Icon = state === "done" ? Check : stageIcon(label);
  const variant =
    state === "done"
      ? "p-node--done"
      : current
        ? "p-node--current"
        : state === "active"
          ? "p-node--active"
          : "p-node--upcoming";
  return (
    <span className={`p-node ${variant}`} aria-hidden>
      <Icon size={19} strokeWidth={state === "done" ? 2.6 : 1.8} />
    </span>
  );
}

function Stepper({ steps }: { steps: ClientStage[] }) {
  const currentIndex = steps.findIndex((s) => s.current);
  const started = (s: ClientStage) => s.state === "done" || s.state === "active";
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => {
        // The progress line runs up to the current step, not past it.
        const leftFill = i > 0 && i - 1 < currentIndex && started(steps[i - 1]);
        const rightFill = i < currentIndex && started(s);
        const stateWord =
          s.state === "done" ? "Completed" : s.current ? "Current" : s.state === "active" ? "In progress" : "Upcoming";
        return (
          <li key={`${s.label}-${i}`} className="p-step">
            <div className="p-step__track">
              <span
                className={`p-step__seg ${i === 0 ? "p-step__seg--hidden" : leftFill ? "p-step__seg--fill" : ""}`}
              />
              <StepNode state={s.state} current={s.current} label={s.label} />
              <span
                className={`p-step__seg ${i === steps.length - 1 ? "p-step__seg--hidden" : rightFill ? "p-step__seg--fill" : ""}`}
              />
            </div>
            <span
              className={`p-step__label ${
                s.current
                  ? "p-step__label--current"
                  : s.state === "active"
                    ? "p-step__label--active"
                    : s.state === "done"
                      ? "p-step__label--done"
                      : ""
              }`}
            >
              {/* Non-colour status cue for assistive tech and clarity. */}
              <span className="sr-only">{stateWord}: </span>
              {s.label}
            </span>
            {s.total > 0 && (
              <span
                className={`p-step__count ${s.current ? "p-step__count--current" : ""}`}
              >
                {s.done} of {s.total}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The gate-derived fallback rail — only used when a project has no
 *  client-visible sections. No task tallies exist here, so counts are 0/0
 *  (the UI omits them) and the current gate is the one `active` marker. */
function gateSteps(gate: string | null): ClientStage[] {
  const current = gate ? GATE_SEQUENCE.indexOf(gate as never) : -1;
  return GATE_SEQUENCE.map((g, i) => {
    const state: ClientStage["state"] =
      current === -1 ? "upcoming" : i < current ? "done" : i === current ? "active" : "upcoming";
    return {
      label: GATE_LABEL[g],
      state,
      done: 0,
      total: 0,
      current: i === current,
    };
  });
}

/* ── The page ──────────────────────────────────────────────────────── */

export function ClientProjectPage({
  view,
  viewerLabel,
}: {
  view: ClientProjectView;
  viewerLabel?: string | null;
}) {
  const actionCount = view.whatWeNeedFromYou.length;
  const nextAction = view.whatWeNeedFromYou[0] ?? null;
  const monthsLabel = monthsToGoLabel(view.endDate);
  const typeLabel = view.type ? (TYPE_LABEL[view.type] ?? view.type) : null;
  const steps: ClientStage[] = view.stages ?? gateSteps(view.gate);
  const ballOnClient = view.whoHasTheBall.side === "CLIENT";

  return (
    <PortalShell
      viewer={{ label: viewerLabel ?? null }}
      meta={{
        projectNumber: view.projectNumber,
        typeLabel,
        status: { label: view.status.label, tone: view.status.tone },
      }}
      contactEmail={contact.email}
    >
      <div className="w-full px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-5 sm:gap-6">
          {/* ── HERO ────────────────────────────────────────────── */}
          <section
            id="hero"
            className="p-card p-reveal scroll-mt-[96px] overflow-hidden"
          >
            <div className="p-hero">
              {/* A licensed architectural photograph from the firm's own curated
                  set, picked deterministically per project. Decorative — empty
                  alt, no caption — because it is NOT a photo of the client's
                  property; see hero-image.ts. A real Project.coverImageUrl
                  would take precedence here once that column exists. */}
              <div className="p-hero__media">
                <Image
                  src={heroImageFor(view.id)}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 640px) 100vw, 420px"
                  className="object-cover"
                />
                <span className="p-hero__wash" aria-hidden />
                <span
                  className="p-hero__accent"
                  style={{ background: view.coverColor }}
                  aria-hidden
                />
              </div>

              {/* Project info */}
              <div className="p-hero__body">
                <h1 className="p-display p-hero__title">{view.name}</h1>
                <p className="p-hero__sentence">{view.friendlySentence}</p>
                {view.location && (
                  <p className="p-hero__loc">
                    <MapPin size={15} strokeWidth={1.8} aria-hidden />
                    {view.location}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── FOUR METRICS ────────────────────────────────────── */}
          <div className="p-reveal p-reveal2 grid grid-cols-2 gap-4 sm:gap-5 xl:grid-cols-4">
            <StatCard
              label="Overall Progress"
              visual={
                view.progress ? (
                  <ProgressRing percent={view.progress.percent} />
                ) : undefined
              }
              icon={CheckCircle2}
            >
              {view.progress ? (
                <>
                  <p className="p-stat__value">
                    {view.progress.done} of {view.progress.total}
                  </p>
                  <p className="p-stat__sub">
                    {monthsLabel ? `tasks done · ${monthsLabel}` : "tasks done"}
                  </p>
                </>
              ) : (
                <p className="p-stat__value p-stat__value--quiet">Not started yet</p>
              )}
            </StatCard>

            <StatCard label="Current Stage" icon={Flag}>
              <p className="p-stat__value">{view.currentStage?.label ?? "—"}</p>
              {view.currentStage?.subline && (
                <p className="p-stat__sub">{view.currentStage.subline}</p>
              )}
            </StatCard>

            <StatCard
              label="Next Action"
              icon={ClipboardList}
              trailing={actionCount > 0 ? <CountBadge n={actionCount} /> : undefined}
            >
              {nextAction ? (
                <>
                  <p className="p-stat__value p-stat__value--sm line-clamp-2">
                    {nextAction.name}
                  </p>
                  <a href="#action-items" className="p-link mt-2">
                    <span className="p-link__ul">View action items</span>
                    <span className="p-link__arrow" aria-hidden>→</span>
                  </a>
                </>
              ) : (
                <p className="p-stat__value p-stat__value--quiet">
                  You&rsquo;re all caught up
                </p>
              )}
            </StatCard>

            <StatCard label="Target Completion" icon={CalendarDays}>
              <p className="p-stat__value">{formatDate(view.endDate)}</p>
              <p className="p-stat__sub">
                {monthsLabel ? "On the current schedule" : "Not yet on the calendar"}
              </p>
            </StatCard>
          </div>

          {/* ── STAGE STEPPER ───────────────────────────────────── */}
          <section className="p-card p-reveal p-reveal3 p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>Project stages</SectionTitle>
              {view.currentStage && (
                <span className="hidden items-center gap-2.5 sm:flex">
                  <span className="text-[13px] text-[color:var(--ink-400)]">
                    Current stage
                  </span>
                  <span className="p-pill p-pill--gold">
                    <span aria-hidden className="p-pill__dot" />
                    {view.currentStage.label}
                  </span>
                </span>
              )}
            </div>
            <div className="mt-7">
              <Stepper steps={steps} />
            </div>
          </section>

          {/* ── BODY: action / documents / rail ─────────────────── */}
          <div className="p-body p-reveal p-reveal4">
            {/* PRIMARY — What we need from you */}
            <section
              id="action-items"
              className="p-area-action p-card scroll-mt-[96px] overflow-hidden"
            >
              <div className="border-l-[3px] border-[color:var(--gold-500)] p-6 sm:p-7">
                <div className="flex items-center justify-between gap-2">
                  <SectionTitle>What we need from you</SectionTitle>
                  {actionCount > 0 && <CountBadge n={actionCount} />}
                </div>

                {actionCount === 0 ? (
                  <div className="mt-1">
                    <EmptyState
                      icon={
                        <CheckCircle2 size={22} strokeWidth={1.6} aria-hidden />
                      }
                    >
                      Nothing right now — there is no action waiting on you. We
                      will post anything we need here.
                    </EmptyState>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-[14px] text-[color:var(--ink-600)]">
                      These items are waiting on you before we can move forward.
                    </p>
                    <ul className="mt-5 space-y-3.5">
                      {view.whatWeNeedFromYou.map((item) => {
                        const label = dueLabel(item.dueDate);
                        const overdue = (dayCount(item.dueDate) ?? 0) < 0;
                        return (
                          <li
                            key={item.id}
                            className={`p-row flex items-start gap-4 px-5 py-4 ${
                              overdue ? "p-row--alert" : "p-row--tinted"
                            }`}
                          >
                            <span
                              aria-hidden
                              className="mt-0.5 h-9 w-1 shrink-0 rounded-full"
                              style={{
                                background: overdue
                                  ? "var(--alert-dot)"
                                  : "var(--gold-400)",
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-medium leading-snug text-[color:var(--ink-900)]">
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="mt-1 text-[13px] leading-snug text-[color:var(--ink-500)]">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {label && (
                              <span
                                className={`p-pill shrink-0 ${overdue ? "p-pill--alert" : "p-pill--gold"}`}
                              >
                                <span aria-hidden className="p-pill__dot" />
                                {label}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </section>

            {/* Recent documents */}
            <section
              id="documents"
              className="p-area-docs p-card scroll-mt-[96px] p-6 sm:p-7"
            >
              <SectionTitle>Recent documents</SectionTitle>
              {view.documents.length === 0 ? (
                <EmptyState
                  icon={
                    <FileText size={22} strokeWidth={1.6} aria-hidden />
                  }
                >
                  No documents have been shared yet. Anything we release to you
                  will appear here.
                </EmptyState>
              ) : (
                <ul className="mt-4 flex flex-col gap-1">
                  {view.documents.map((d) => (
                    <li key={d.id}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-row group flex items-center gap-3.5 px-3 py-3"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--gold-tint)] text-[10.5px] font-bold tracking-wide text-[color:var(--gold-ink)]">
                          {fileKind(d.mimeType, d.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-medium text-[color:var(--ink-800)] transition-colors group-hover:text-[color:var(--gold-ink)]">
                            {d.name}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] text-[color:var(--ink-400)]">
                            {formatDate(d.createdAt)} · {formatSize(d.size)}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 text-[color:var(--ink-300)] transition-all group-hover:text-[color:var(--gold-600)]"
                        >
                          <ExternalLink size={16} strokeWidth={1.8} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* RAIL — inspections / who has the ball / activity */}
            <div className="p-area-rail">
              {/* Upcoming inspections */}
              <section
                id="inspections"
                className="p-card scroll-mt-[96px] p-6 sm:p-7"
              >
                <SectionTitle>Upcoming inspections</SectionTitle>
                {view.upcomingInspections.length === 0 ? (
                  <EmptyState
                    icon={
                      <CalendarCheck2 size={22} strokeWidth={1.6} aria-hidden />
                    }
                  >
                    No inspections are scheduled right now. We&rsquo;ll list any
                    site visit here once it&rsquo;s on the calendar.
                  </EmptyState>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {view.upcomingInspections.map((insp) => (
                      <li key={insp.id} className="flex items-center gap-3.5">
                        <DateChip date={insp.dueDate} />
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-[color:var(--ink-800)]">
                          {insp.name}
                        </span>
                        <span className="p-pill p-pill--gold shrink-0">
                          <span aria-hidden className="p-pill__dot" />
                          Upcoming
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Who has the ball */}
              <section className="p-card p-6 sm:p-7">
                <SectionTitle>Who has the ball</SectionTitle>
                <div
                  className={`mt-4 flex items-center gap-4 rounded-xl border p-4 ${
                    ballOnClient
                      ? "border-[color:var(--gold-100)] bg-[color:var(--gold-wash)]"
                      : "border-[color:var(--line)] bg-[color:var(--surface-2)]"
                  }`}
                >
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                      ballOnClient
                        ? "bg-[color:var(--surface)] text-[color:var(--gold-ink)] ring-2 ring-[color:var(--gold-400)]"
                        : "bg-[color:var(--surface)] ring-1 ring-[color:var(--line-strong)]"
                    }`}
                  >
                    {view.whoHasTheBall.side === "US" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src="/ttc/img/logo-square.png"
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full object-contain"
                      />
                    ) : (
                      <User size={22} strokeWidth={1.7} aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold text-[color:var(--ink-900)]">
                      {view.whoHasTheBall.side === "US"
                        ? "Waiting on Us"
                        : "Waiting on Client"}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-[color:var(--ink-500)]">
                      {view.whoHasTheBall.reason}
                    </p>
                  </div>
                  <span
                    className={`p-pill shrink-0 ${ballOnClient ? "p-pill--gold" : "p-pill--neutral"}`}
                  >
                    <span aria-hidden className="p-pill__dot" />
                    {ballOnClient ? "Action needed" : "With our team"}
                  </span>
                </div>
              </section>

              {/* Project activity */}
              <section id="activity" className="p-card scroll-mt-[96px] p-6 sm:p-7">
                <SectionTitle>Project activity</SectionTitle>
                {view.activity.length === 0 ? (
                  <EmptyState
                    icon={
                      <Clock3 size={22} strokeWidth={1.6} aria-hidden />
                    }
                  >
                    No activity to show yet. Milestones, documents and updates
                    will appear here as the project moves.
                  </EmptyState>
                ) : (
                  <ul className="p-timeline mt-5 space-y-4 pl-1">
                    {view.activity.map((e) => (
                      <li key={e.id} className="flex gap-4">
                        <span aria-hidden className="p-tl-dot" />
                        <div className="min-w-0 flex-1 -mt-0.5">
                          <p className="text-[14px] leading-snug text-[color:var(--ink-800)]">
                            {e.text}
                          </p>
                          <p className="mt-0.5 text-[12.5px] text-[color:var(--ink-400)]">
                            {timeAgo(e.at)} · by {e.actor}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {/* ── FOOTER / private-portal notice ──────────────────── */}
          <footer className="mt-2 border-t border-[color:var(--line)] pt-6">
            <p className="text-[12.5px] leading-relaxed text-[color:var(--ink-400)]">
              {/* company.name already ends in "Inc." — don't add a second period. */}
              Prepared by {company.name} This page is private to you — please do
              not forward the link.
            </p>
            <p className="mt-1.5 text-[12.5px] text-[color:var(--ink-400)]">
              Questions about this project? Email{" "}
              <a
                href={`mailto:${contact.email}`}
                className="font-medium text-[color:var(--gold-ink)] hover:underline"
              >
                {contact.email}
              </a>
              .
            </p>
          </footer>
        </div>
      </div>
    </PortalShell>
  );
}
