import type {
  ClientProjectView,
  ClientStage,
} from "@/lib/client-link/projection";
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
 * House style is warm paper + charcoal ink + architectural gold (#b98a2e), with
 * the deep gold #8a6d24 for text and #7a5f1e for the large display numerals.
 * Green appears ONLY for a completed stage and red ONLY for a genuinely overdue
 * action item — both muted, both paired with a label/shape so status is never
 * colour alone. The friendly status enum the projection collapsed to lives in
 * the top bar; there are no red/green traffic lights for the firm's own status.
 *
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
  return <h2 className="p-eyebrow">{children}</h2>;
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-[color:var(--gold-tint)] px-1.5 text-[11px] font-semibold text-[color:var(--gold-ink)]">
      {n}
    </span>
  );
}

/** Gold progress ring with the percent as a large, deep-gold serif numeral. */
function ProgressRing({ percent }: { percent: number }) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      className="shrink-0"
      role="img"
      aria-label={`${percent}% complete`}
    >
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="5.5" className="p-ring-track" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        className="p-ring-fill"
        style={{ "--c": `${circumference}` } as React.CSSProperties}
      />
      <text
        x="36"
        y="37.5"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fill: "var(--gold-deep)",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "20px",
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

/** Generic person glyph — the client side of "who has the ball". Never a name. */
function ClientGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
    </svg>
  );
}

function StatCard({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-card flex flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="p-eyebrow">{label}</p>
        {trailing}
      </div>
      <div className="mt-3 flex-1">{children}</div>
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
    <div className="flex flex-col items-center gap-3 px-4 py-9 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[color:var(--surface-sunk)] text-[color:var(--ink-400)] ring-1 ring-[color:var(--line)]">
        {icon}
      </span>
      <p className="max-w-[22rem] text-[13px] leading-relaxed text-[color:var(--ink-500)]">
        {children}
      </p>
    </div>
  );
}

/* ── Stage stepper — done / current / upcoming, precise connectors ───── */

function StepNode({ state }: { state: ClientStage["state"] }) {
  if (state === "done") {
    return (
      <span className="p-node p-node--done">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="p-node p-node--current">
        <span className="p-node__dot" />
      </span>
    );
  }
  return (
    <span className="p-node p-node--upcoming">
      <span className="p-node__dot" />
    </span>
  );
}

function Stepper({ steps }: { steps: ClientStage[] }) {
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => {
        const leftFill = i > 0 && steps[i - 1].state === "done";
        const rightFill = s.state === "done";
        return (
          <li key={`${s.label}-${i}`} className="p-step">
            <div className="p-step__track">
              <span
                className={`p-step__seg ${i === 0 ? "p-step__seg--hidden" : leftFill ? "p-step__seg--fill" : ""}`}
              />
              <StepNode state={s.state} />
              <span
                className={`p-step__seg ${i === steps.length - 1 ? "p-step__seg--hidden" : rightFill ? "p-step__seg--fill" : ""}`}
              />
            </div>
            <span
              className={`p-step__label ${
                s.state === "current"
                  ? "p-step__label--current"
                  : s.state === "done"
                    ? "p-step__label--done"
                    : ""
              }`}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Turn a gate value into the same {label,state}[] the real rail produces. */
function gateSteps(gate: string | null): ClientStage[] {
  const current = gate ? GATE_SEQUENCE.indexOf(gate as never) : -1;
  return GATE_SEQUENCE.map((g, i) => ({
    label: GATE_LABEL[g],
    state:
      current === -1
        ? "upcoming"
        : i < current
          ? "done"
          : i === current
            ? "current"
            : "upcoming",
  }));
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
      <div className="mx-auto w-full max-w-[1240px] px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-5 sm:gap-6">
          {/* ── HERO ────────────────────────────────────────────── */}
          <section
            id="hero"
            className="p-card p-reveal scroll-mt-[88px] overflow-hidden"
          >
            <div
              aria-hidden
              className="h-1.5 w-full"
              style={{
                background: `linear-gradient(90deg, ${view.coverColor} 0%, ${view.coverColor}cc 42%, ${view.coverColor}44 100%)`,
              }}
            />
            <div className="relative p-6 sm:p-8">
              {/* Nearly-imperceptible architectural contour on the right. */}
              <svg
                aria-hidden
                className="pointer-events-none absolute right-0 top-0 hidden h-full w-2/5 sm:block"
                viewBox="0 0 300 220"
                fill="none"
                preserveAspectRatio="xMaxYMid slice"
              >
                <g stroke="var(--ink-900)" strokeWidth="1" opacity="0.05">
                  <path d="M300 40H150M300 70H120M300 100H140M300 130H110M300 160H150M300 190H130" />
                  <path d="M200 220V60l40-22 40 22v160" />
                  <path d="M200 92h80M200 124h80M200 156h80M200 188h80" />
                </g>
              </svg>

              <p className="p-eyebrow">Project</p>
              <h2 className="p-display mt-2 text-[26px] leading-[1.08] sm:text-[38px]">
                {view.name}
              </h2>
              {view.location && (
                <p className="mt-2.5 flex items-center gap-1.5 text-sm text-[color:var(--ink-600)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-[color:var(--gold-600)]">
                    <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z" />
                    <circle cx="12" cy="11" r="2.2" />
                  </svg>
                  {view.location}
                </p>
              )}
              <p className="relative mt-3.5 max-w-2xl text-[15px] leading-relaxed text-[color:var(--ink-600)]">
                {view.friendlySentence}
              </p>
            </div>
          </section>

          {/* ── FOUR METRICS ────────────────────────────────────── */}
          <div className="p-reveal p-reveal2 grid grid-cols-2 gap-4 sm:gap-5 xl:grid-cols-4">
            <StatCard label="Overall Progress">
              {view.progress ? (
                <div className="flex items-center gap-4">
                  <ProgressRing percent={view.progress.percent} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[color:var(--ink-900)]">
                      {view.progress.done} of {view.progress.total} done
                    </p>
                    {monthsLabel && (
                      <p className="mt-1 text-xs text-[color:var(--ink-500)]">
                        {monthsLabel}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[color:var(--ink-500)]">Not started yet</p>
              )}
            </StatCard>

            <StatCard label="Current Stage">
              <p className="text-[17px] font-semibold leading-tight text-[color:var(--ink-900)]">
                {view.currentStage?.label ?? "—"}
              </p>
              {view.currentStage?.subline && (
                <p className="mt-1 text-xs text-[color:var(--ink-500)]">
                  {view.currentStage.subline}
                </p>
              )}
            </StatCard>

            <StatCard
              label="Next Action"
              trailing={actionCount > 0 ? <CountBadge n={actionCount} /> : undefined}
            >
              {nextAction ? (
                <>
                  <p className="line-clamp-2 text-sm font-medium text-[color:var(--ink-900)]">
                    {nextAction.name}
                  </p>
                  <a href="#action-items" className="p-link mt-2">
                    <span className="p-link__ul">View action items</span>
                    <span className="p-link__arrow" aria-hidden>→</span>
                  </a>
                </>
              ) : (
                <p className="text-sm text-[color:var(--ink-500)]">
                  You&rsquo;re all caught up
                </p>
              )}
            </StatCard>

            <StatCard label="Target Completion">
              <p className="text-[17px] font-semibold leading-tight text-[color:var(--ink-900)]">
                {formatDate(view.endDate)}
              </p>
              {monthsLabel && (
                <p className="mt-1 text-xs text-[color:var(--ink-500)]">
                  On the current schedule
                </p>
              )}
            </StatCard>
          </div>

          {/* ── STAGE STEPPER ───────────────────────────────────── */}
          <section className="p-card p-reveal p-reveal3 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Project stages</SectionTitle>
              {view.currentStage && (
                <span className="p-pill p-pill--gold">
                  <span aria-hidden className="p-pill__dot" />
                  {view.currentStage.label}
                </span>
              )}
            </div>
            <div className="mt-5">
              <Stepper steps={steps} />
            </div>
          </section>

          {/* ── BODY: action / documents / rail ─────────────────── */}
          <div className="p-body p-reveal p-reveal4">
            {/* PRIMARY — What we need from you */}
            <section
              id="action-items"
              className="p-area-action p-card scroll-mt-[88px] overflow-hidden"
            >
              <div className="border-l-[3px] border-[color:var(--gold-500)] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <SectionTitle>What we need from you</SectionTitle>
                  {actionCount > 0 && <CountBadge n={actionCount} />}
                </div>

                {actionCount === 0 ? (
                  <div className="mt-1">
                    <EmptyState
                      icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      }
                    >
                      Nothing right now — there is no action waiting on you. We
                      will post anything we need here.
                    </EmptyState>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-[color:var(--ink-600)]">
                      These items are waiting on you before we can move forward.
                    </p>
                    <ul className="mt-4 space-y-3">
                      {view.whatWeNeedFromYou.map((item) => {
                        const label = dueLabel(item.dueDate);
                        const overdue = (dayCount(item.dueDate) ?? 0) < 0;
                        return (
                          <li
                            key={item.id}
                            className={`p-row flex items-start gap-3.5 px-4 py-3.5 ${
                              overdue ? "p-row--alert" : "p-row--tinted"
                            }`}
                          >
                            <span
                              aria-hidden
                              className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
                              style={{
                                background: overdue
                                  ? "var(--alert-dot)"
                                  : "var(--gold-400)",
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug text-[color:var(--ink-900)]">
                                {item.name}
                              </p>
                              {item.description && (
                                <p className="mt-1 text-xs leading-snug text-[color:var(--ink-500)]">
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
              className="p-area-docs p-card scroll-mt-[88px] p-5 sm:p-6"
            >
              <SectionTitle>Recent documents</SectionTitle>
              {view.documents.length === 0 ? (
                <EmptyState
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M7 3.5h6l4.5 4.5V20a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
                      <path d="M13 3.5V9h4.5" />
                    </svg>
                  }
                >
                  No documents have been shared yet. Anything we release to you
                  will appear here.
                </EmptyState>
              ) : (
                <ul className="mt-3 flex flex-col gap-1">
                  {view.documents.map((d) => (
                    <li key={d.id}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-row group flex items-center gap-3 px-3 py-2.5"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--gold-tint)] text-[10px] font-bold tracking-wide text-[color:var(--gold-ink)]">
                          {fileKind(d.mimeType, d.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[color:var(--ink-800)] transition-colors group-hover:text-[color:var(--gold-ink)]">
                            {d.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-[color:var(--ink-400)]">
                            {formatDate(d.createdAt)} · {formatSize(d.size)}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 text-[color:var(--ink-300)] transition-all group-hover:text-[color:var(--gold-600)]"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17 17 7M9 7h8v8" />
                          </svg>
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
                className="p-card scroll-mt-[88px] p-5 sm:p-6"
              >
                <SectionTitle>Upcoming inspections</SectionTitle>
                {view.upcomingInspections.length === 0 ? (
                  <EmptyState
                    icon={
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="4" y="5" width="16" height="16" rx="2" />
                        <path d="M4 9h16M8 3.5v3M16 3.5v3" />
                      </svg>
                    }
                  >
                    No inspections are scheduled right now. We&rsquo;ll list any
                    site visit here once it&rsquo;s on the calendar.
                  </EmptyState>
                ) : (
                  <ul className="mt-3.5 space-y-2.5">
                    {view.upcomingInspections.map((insp) => (
                      <li key={insp.id} className="flex items-center gap-3">
                        <DateChip date={insp.dueDate} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--ink-800)]">
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
              <section className="p-card p-5 sm:p-6">
                <SectionTitle>Who has the ball</SectionTitle>
                <div
                  className={`mt-3.5 flex items-center gap-3.5 rounded-xl border p-4 ${
                    ballOnClient
                      ? "border-[color:var(--gold-100)] bg-[color:var(--gold-wash)]"
                      : "border-[color:var(--line)] bg-[color:var(--surface-2)]"
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
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
                        width={26}
                        height={26}
                        className="h-[26px] w-[26px] rounded-full object-contain"
                      />
                    ) : (
                      <ClientGlyph />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[color:var(--ink-900)]">
                      {view.whoHasTheBall.side === "US"
                        ? "Waiting on Us"
                        : "Waiting on Client"}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-[color:var(--ink-500)]">
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
              <section id="activity" className="p-card scroll-mt-[88px] p-5 sm:p-6">
                <SectionTitle>Project activity</SectionTitle>
                {view.activity.length === 0 ? (
                  <EmptyState
                    icon={
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 7v5l3 2" />
                        <circle cx="12" cy="12" r="8.5" />
                      </svg>
                    }
                  >
                    No activity to show yet. Milestones, documents and updates
                    will appear here as the project moves.
                  </EmptyState>
                ) : (
                  <ul className="p-timeline mt-4 space-y-4 pl-1">
                    {view.activity.map((e) => (
                      <li key={e.id} className="flex gap-3.5">
                        <span aria-hidden className="p-tl-dot" />
                        <div className="min-w-0 flex-1 -mt-0.5">
                          <p className="text-sm leading-snug text-[color:var(--ink-800)]">
                            {e.text}
                          </p>
                          <p className="mt-0.5 text-xs text-[color:var(--ink-400)]">
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
          <footer className="mt-2 border-t border-[color:var(--line)] pt-5">
            <p className="text-xs leading-relaxed text-[color:var(--ink-400)]">
              {/* company.name already ends in "Inc." — don't add a second period. */}
              Prepared by {company.name} This page is private to you — please do
              not forward the link.
            </p>
            <p className="mt-1.5 text-xs text-[color:var(--ink-400)]">
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
