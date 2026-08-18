import {
  Activity,
  Building2,
  CalendarDays,
  CalendarCheck2,
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
import { company, contact } from "@/lib/ttc/site";
import { PortalShell } from "./portal-shell";
import { PortalTabs } from "./portal-tabs";

/**
 * The client-facing project workspace.
 *
 * Presentation only: it renders a ClientProjectView (plus the share link's own
 * label) and reaches for nothing else — this file has no database access to
 * abuse, which keeps the "one place decides what a client sees" rule honest.
 *
 * Visual spec: the approved 1672×941 enterprise reference. One clean sans,
 * white cards on near-white ground, restrained gold, pale-green health, quiet
 * blue accents. Every number on screen is real projection data; where the
 * reference shows a value that does not exist yet (document status workflow,
 * client uploads, messaging) the surface renders a professional empty state or
 * an honest "Soon" — never a fabricated value or a dead control.
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
  RECERTIFICATION: "Building Recertification",
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

/** A short kind tag for a document (PDF / IMG / DWG / …). */
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

/** Client-safe "what happens next" copy per canonical stage. UI copy, not
 *  data — it explains the process, it never asserts a project-specific fact. */
const WHAT_NEXT: Record<string, string> = {
  kickoff:
    "We finalize scope and scheduling, then book the field inspection. You will be notified once the inspection is on the calendar.",
  "inspection & reports":
    "We complete the field inspection and prepare the signed & sealed reports. You will be notified when the package is submitted to the Building Official.",
  "city review":
    "The Building Official reviews the submitted package. You will be notified if additional information is required.",
  repairs:
    "Any required repairs are designed, permitted and built, then verified by re-inspection before the final submittal.",
  recertified:
    "The recertification is complete. Final documents are released to you on this page for your records.",
};

function whatNext(label: string): string {
  return (
    WHAT_NEXT[label.trim().toLowerCase()] ??
    "We will keep this page updated as the project moves to the next stage."
  );
}

/** The gate-derived fallback rail — only used when a project has no
 *  client-visible sections. No task tallies exist here (0/0 → the UI omits
 *  counts) and the current gate is the one `current` marker. */
function gateSteps(gate: string | null): ClientStage[] {
  const current = gate ? GATE_SEQUENCE.indexOf(gate as never) : -1;
  return GATE_SEQUENCE.map((g, i) => {
    const state: ClientStage["state"] =
      current === -1 ? "upcoming" : i < current ? "done" : "upcoming";
    return {
      label: GATE_LABEL[g],
      state: i === current ? "active" : state,
      done: 0,
      total: 0,
      current: i === current,
    };
  });
}

/* ── Small presentational atoms ────────────────────────────────────── */

function CardHead({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-card__head">
      <h2 className="p-h">{title}</h2>
      {action}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-empty">
      <span className="p-empty__icon" aria-hidden>
        <Icon size={18} strokeWidth={1.7} />
      </span>
      <p className="p-empty__title">{title}</p>
      <p className="p-empty__copy">{children}</p>
    </div>
  );
}

/** Gold progress ring, 84px, with the percentage as accessible text. */
function ProgressRing({ percent }: { percent: number }) {
  const r = 35;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = c * (1 - clamped / 100);
  return (
    <svg
      width="84"
      height="84"
      viewBox="0 0 84 84"
      className="shrink-0"
      role="img"
      aria-label={`${percent}% complete`}
    >
      <circle cx="42" cy="42" r={r} fill="none" strokeWidth="7" className="p-ring-track" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 42 42)"
        className="p-ring-fill"
        style={{ "--c": `${c}` } as React.CSSProperties}
      />
      <text
        x="42"
        y="43"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fill: "var(--ink-900)",
          fontSize: "19px",
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        {percent}%
      </text>
    </svg>
  );
}

function StatusBadge({
  status,
  small,
}: {
  status: ClientProjectView["status"];
  small?: boolean;
}) {
  const tone = status.tone === "positive" ? "p-badge--green" : "p-badge--gray";
  return (
    <span className={`p-badge ${tone} ${small ? "p-badge--sm" : ""}`}>
      <span aria-hidden className="p-badge__dot" />
      {status.label}
    </span>
  );
}

/* ── Timeline ──────────────────────────────────────────────────────── */

function segClass(steps: ClientStage[], i: number, currentIndex: number): string {
  // Segment between node i-1 and node i.
  if (currentIndex !== -1 && i > currentIndex) return "p-tl__seg--dash";
  const prev = steps[i - 1];
  if (prev.state === "done") return "p-tl__seg--done";
  if (prev.state === "active") return "p-tl__seg--gold";
  return "";
}

function TimelineNode({ step }: { step: ClientStage }) {
  const Icon = step.state === "done" ? Check : stageIcon(step.label);
  const cls = step.current
    ? "p-tl__node--current"
    : step.state === "done"
      ? "p-tl__node--done"
      : step.state === "active"
        ? "p-tl__node--active"
        : "p-tl__node--upcoming";
  return (
    <span className={`p-tl__node ${cls}`} aria-hidden>
      <Icon size={step.state === "done" ? 16 : 15} strokeWidth={step.state === "done" ? 2.6 : 1.8} />
    </span>
  );
}

function Timeline({ steps }: { steps: ClientStage[] }) {
  const currentIndex = steps.findIndex((s) => s.current);
  const hasActive = steps.some((s) => s.state === "active" && !s.current);
  return (
    <>
      <ol className="p-tl">
        {steps.map((s, i) => {
          const stateWord = s.current
            ? "Current"
            : s.state === "done"
              ? "Completed"
              : s.state === "active"
                ? "In progress"
                : "Upcoming";
          return (
            <li key={`${s.label}-${i}`} className="p-tl__step">
              <div className="p-tl__track">
                <span
                  className={`p-tl__seg ${i === 0 ? "p-tl__seg--hide" : segClass(steps, i, currentIndex)}`}
                />
                <TimelineNode step={s} />
                <span
                  className={`p-tl__seg ${
                    i === steps.length - 1
                      ? "p-tl__seg--hide"
                      : segClass(steps, i + 1, currentIndex)
                  }`}
                />
              </div>
              <span
                className={`p-tl__label ${
                  s.current ? "p-tl__label--current" : s.state === "done" ? "p-tl__label--done" : ""
                }`}
              >
                <span className="sr-only">{stateWord}: </span>
                {s.label}
              </span>
              {s.total > 0 && (
                <span className="p-tl__date">
                  {s.done} of {s.total} tasks
                </span>
              )}
              {s.current && <span className="p-tl__flag">Current</span>}
            </li>
          );
        })}
      </ol>
      <div className="p-legend" aria-hidden>
        <span className="p-legend__item">
          <span className="p-legend__dot" style={{ background: "var(--green)" }} />
          Completed
        </span>
        {hasActive && (
          <span className="p-legend__item">
            <span
              className="p-legend__dot"
              style={{ background: "var(--surface)", border: "2px solid var(--green)" }}
            />
            In progress
          </span>
        )}
        <span className="p-legend__item">
          <span className="p-legend__dot" style={{ background: "var(--gold)" }} />
          Current
        </span>
        <span className="p-legend__item">
          <span className="p-legend__dot" style={{ background: "var(--ink-300)" }} />
          Upcoming
        </span>
      </div>
    </>
  );
}

/* ── Cards ─────────────────────────────────────────────────────────── */

function HealthCard({ view }: { view: ClientProjectView }) {
  const positive = view.status.tone === "positive";
  return (
    <section className="p-card" aria-label="Project health">
      <CardHead title="Project Health" />
      <div className="mt-4 flex items-center gap-4">
        <span className={`p-bigicon ${positive ? "p-bigicon--green" : "p-bigicon--gray"}`} aria-hidden>
          <ShieldCheck size={26} strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <p className="p-kpi">{view.status.label}</p>
          <p className="p-sub mt-1">{view.friendlySentence}</p>
        </div>
      </div>
    </section>
  );
}

function ProgressCard({ view }: { view: ClientProjectView }) {
  return (
    <section className="p-card" aria-label="Overall progress">
      <CardHead title="Overall Progress" />
      {view.progress ? (
        <div className="mt-3 flex items-center gap-4">
          <ProgressRing percent={view.progress.percent} />
          <div className="min-w-0">
            <p className="p-kpi">
              {view.progress.done} of {view.progress.total} tasks
            </p>
            <p className="p-sub mt-0.5">completed</p>
            <a href="#progress" className="p-link mt-2">
              View progress <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState icon={CheckCircle2} title="Not started yet">
            Progress will appear here once work begins.
          </EmptyState>
        </div>
      )}
    </section>
  );
}

function MilestoneCard({ view }: { view: ClientProjectView }) {
  // The next incomplete milestone by due date (undated ones last).
  const next = [...view.milestones]
    .filter((m) => !m.completed)
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    })[0];
  return (
    <section className="p-card" aria-label="Next milestone">
      <CardHead title="Next Milestone" />
      {next ? (
        <div className="mt-4 flex items-center gap-4">
          <span className="p-bigicon p-bigicon--gold" aria-hidden>
            <CalendarDays size={25} strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <p className="p-kpi truncate">{next.name}</p>
            <p className="p-sub mt-1">{formatDate(next.dueDate)}</p>
            <a href="#progress" className="p-link mt-2">
              View timeline <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          <span className="p-bigicon p-bigicon--gold" aria-hidden>
            <CalendarDays size={25} strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <p className="p-kpi">To be scheduled</p>
            <p className="p-sub mt-1">
              We&rsquo;ll post the next milestone here once it&rsquo;s on the calendar.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function TimelineCard({ steps }: { steps: ClientStage[] }) {
  return (
    <section className="p-card" aria-label="Project timeline">
      <CardHead title="Project Timeline" />
      <Timeline steps={steps} />
    </section>
  );
}

function CurrentStageCard({ view }: { view: ClientProjectView }) {
  const label = view.currentStage?.label;
  if (!label) {
    return (
      <section className="p-card" aria-label="Current stage">
        <CardHead title="Current Stage" />
        <EmptyState icon={Flag} title="Not started yet">
          The current stage will appear here once the project is underway.
        </EmptyState>
      </section>
    );
  }
  const Icon = stageIcon(label);
  return (
    <section className="p-card" aria-label="Current stage">
      <CardHead title="Current Stage" />
      <div className="mt-4 flex items-center gap-4">
        <span className="p-bigicon p-bigicon--gold" aria-hidden>
          <Icon size={25} strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <p className="p-kpi">{label}</p>
          {view.currentStage?.subline && (
            <p className="p-sub mt-1">{view.currentStage.subline}</p>
          )}
        </div>
      </div>
      <div className="my-4 h-px bg-[color:var(--line-soft)]" />
      <p className="text-[12px] font-semibold text-[color:var(--ink-900)]">
        What happens next?
      </p>
      <p className="p-sub mt-1.5">{whatNext(label)}</p>
      <a href="#progress" className="p-link mt-3">
        View full timeline <span aria-hidden>→</span>
      </a>
    </section>
  );
}

function ActionItemsCard({
  view,
  full,
}: {
  view: ClientProjectView;
  full?: boolean;
}) {
  const items = view.whatWeNeedFromYou;
  return (
    <section className="p-card" aria-label="Your action items">
      <CardHead
        title="Your Action Items"
        action={items.length > 0 ? <span className="p-count">{items.length}</span> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="You're all caught up">
          Nothing is required from you right now. Anything we need will appear
          here.
        </EmptyState>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((item) => {
              const label = dueLabel(item.dueDate);
              const overdue = (dayCount(item.dueDate) ?? 0) < 0;
              return (
                <li key={item.id} className="p-act">
                  <span className={`p-act__icon ${overdue ? "p-act__icon--red" : ""}`} aria-hidden>
                    <ClipboardList size={17} strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="p-act__name">{item.name}</p>
                    {(label || item.dueDate) && (
                      <p className={`p-act__due ${overdue ? "p-act__due--red" : ""}`}>
                        {label}
                        {item.dueDate && (
                          <>
                            <span className="p-dotsep" aria-hidden>
                              ·
                            </span>
                            {formatDate(item.dueDate)}
                          </>
                        )}
                      </p>
                    )}
                    {full && item.description && (
                      <p className="p-sub mt-1">{item.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {!full && (
            <a href="#action-items" className="p-link mt-3.5">
              View all action items <span aria-hidden>→</span>
            </a>
          )}
        </>
      )}
    </section>
  );
}

function DocumentsCard({
  view,
  full,
}: {
  view: ClientProjectView;
  full?: boolean;
}) {
  const docs = full ? view.documents : view.documents.slice(0, 5);
  return (
    <section className="p-card" aria-label="Documents">
      <CardHead
        title="Documents"
        action={
          !full && view.documents.length > 0 ? (
            <a href="#documents" className="p-link">
              View all documents <span aria-hidden>→</span>
            </a>
          ) : undefined
        }
      />
      {docs.length === 0 ? (
        <EmptyState icon={FileText} title="No documents shared yet">
          Documents released to you will appear here.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="p-table">
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Type</th>
                <th scope="col">Size</th>
                <th scope="col">Updated</th>
                <th scope="col">
                  <span className="sr-only">Shared by</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const kind = fileKind(d.mimeType, d.name);
                return (
                  <tr key={d.id}>
                    <td>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-doc__name hover:text-[color:var(--gold-strong)]"
                      >
                        <span
                          className={`p-doc__kind ${kind === "PDF" ? "" : "p-doc__kind--generic"}`}
                          aria-hidden
                        >
                          <FileText size={14} strokeWidth={1.8} />
                        </span>
                        <span className="truncate">{d.name}</span>
                        <ExternalLink
                          size={12}
                          strokeWidth={1.8}
                          className="shrink-0 text-[color:var(--ink-300)]"
                          aria-hidden
                        />
                      </a>
                    </td>
                    <td>{kind}</td>
                    <td>{formatSize(d.size)}</td>
                    <td>{formatDate(d.createdAt)}</td>
                    <td className="text-[color:var(--ink-400)]">by {company.shortName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InspectionsCard({
  view,
  full,
}: {
  view: ClientProjectView;
  full?: boolean;
}) {
  const list = view.upcomingInspections;
  return (
    <section className="p-card" aria-label="Upcoming inspections">
      <CardHead
        title="Upcoming Inspections"
        action={
          !full && list.length > 0 ? (
            <a href="#inspections" className="p-link">
              View all
            </a>
          ) : undefined
        }
      />
      {list.length === 0 ? (
        <EmptyState icon={CalendarCheck2} title="No inspections scheduled">
          We&rsquo;ll notify you when the next inspection is on the calendar.
        </EmptyState>
      ) : (
        <div className="mt-2">
          {list.map((insp) => {
            const month = insp.dueDate
              .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
              .toUpperCase();
            const day = insp.dueDate.toLocaleDateString("en-US", {
              day: "numeric",
              timeZone: "UTC",
            });
            return (
              <div key={insp.id} className="p-insp">
                <span className="p-cal" aria-hidden>
                  <span className="p-cal__mon">{month}</span>
                  <span className="p-cal__day">{day}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="p-insp__name">{insp.name}</p>
                  <p className="p-insp__where">{formatDate(insp.dueDate)}</p>
                </div>
                <span className="p-badge p-badge--blue p-badge--sm shrink-0">
                  <span aria-hidden className="p-badge__dot" />
                  Upcoming
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BallCard({ view }: { view: ClientProjectView }) {
  const onClient = view.whoHasTheBall.side === "CLIENT";
  return (
    <section className="p-card" aria-label="Who has the ball">
      <CardHead title="Who has the ball?" />
      <div className="mt-4 flex items-start gap-4">
        <span className={`p-bigicon ${onClient ? "p-bigicon--gold" : "p-bigicon--blue"}`} aria-hidden>
          {onClient ? (
            <User size={25} strokeWidth={1.7} />
          ) : (
            <Building2 size={25} strokeWidth={1.7} />
          )}
        </span>
        <div className="min-w-0">
          <p className="p-kpi">{onClient ? "Waiting on you" : company.shortName}</p>
          <p className="p-sub mt-1">{view.whoHasTheBall.reason}</p>
          <span
            className={`p-badge p-badge--sm mt-2.5 ${onClient ? "p-badge--gold" : "p-badge--blue"}`}
          >
            <span aria-hidden className="p-badge__dot" />
            {onClient ? "Action needed" : "With our team"}
          </span>
        </div>
      </div>
    </section>
  );
}

function ActivityCard({
  view,
  full,
}: {
  view: ClientProjectView;
  full?: boolean;
}) {
  const events = full ? view.activity : view.activity.slice(0, 5);
  return (
    <section className="p-card" aria-label="Recent activity">
      <CardHead
        title="Recent Activity"
        action={
          !full && view.activity.length > 0 ? (
            <a href="#activity" className="p-link">
              View all
            </a>
          ) : undefined
        }
      />
      {events.length === 0 ? (
        <EmptyState icon={Activity} title="No recent activity">
          Project updates will appear here.
        </EmptyState>
      ) : (
        <div className="p-feed">
          {events.map((e) => (
            <div key={e.id} className="p-ev">
              <span className="p-ev__icon p-ev__icon--gold" aria-hidden>
                <Activity size={13} strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="p-ev__title">{e.text}</p>
                <p className="p-ev__when">
                  {timeAgo(e.at)} · by {e.actor}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Stage detail list (Progress tab) ──────────────────────────────── */

function StageList({ steps }: { steps: ClientStage[] }) {
  return (
    <section className="p-card" aria-label="Stage detail">
      <CardHead title="Stage Detail" />
      <ul className="mt-3 flex flex-col gap-2">
        {steps.map((s, i) => {
          const Icon = stageIcon(s.label);
          const badge = s.current
            ? { cls: "p-badge--gold", word: "Current" }
            : s.state === "done"
              ? { cls: "p-badge--green", word: "Completed" }
              : s.state === "active"
                ? { cls: "p-badge--green", word: "In progress" }
                : { cls: "p-badge--gray", word: "Upcoming" };
          return (
            <li key={`${s.label}-${i}`} className="p-act">
              <span className="p-act__icon" aria-hidden>
                <Icon size={17} strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="p-act__name">{s.label}</p>
                {s.total > 0 && (
                  <p className="p-act__due">
                    {s.done} of {s.total} tasks completed
                  </p>
                )}
              </div>
              <span className={`p-badge p-badge--sm shrink-0 ${badge.cls}`}>
                <span aria-hidden className="p-badge__dot" />
                {badge.word}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── The page ──────────────────────────────────────────────────────── */

export function ClientProjectPage({
  view,
  viewerLabel,
}: {
  view: ClientProjectView;
  viewerLabel?: string | null;
}) {
  const typeLabel = view.type ? (TYPE_LABEL[view.type] ?? view.type) : null;
  const steps: ClientStage[] = view.stages ?? gateSteps(view.gate);

  const overview = (
    <div className="p-grid">
      <div className="p-colmain">
        <div className="p-row3">
          <HealthCard view={view} />
          <ProgressCard view={view} />
          <MilestoneCard view={view} />
        </div>
        <TimelineCard steps={steps} />
        <div className="p-row2">
          <CurrentStageCard view={view} />
          <ActionItemsCard view={view} />
        </div>
        <DocumentsCard view={view} />
      </div>
      <div className="p-colrail">
        <InspectionsCard view={view} />
        <BallCard view={view} />
        <ActivityCard view={view} />
      </div>
    </div>
  );

  const progress = (
    <div className="p-colmain mt-[18px]">
      <TimelineCard steps={steps} />
      <div className="p-row2">
        <CurrentStageCard view={view} />
        <StageList steps={steps} />
      </div>
    </div>
  );

  return (
    <PortalShell
      viewer={{ label: viewerLabel ?? null }}
      project={{ number: view.projectNumber, name: view.name }}
      contactEmail={contact.email}
    >
      <div className="p-work">
        {/* ── Project workspace header ─────────────────────────── */}
        <h1 className="p-ptitle">{view.name}</h1>
        <div className="p-meta">
          {view.projectNumber && (
            <span className="p-chip p-chip--num">
              <CalendarDays size={13} strokeWidth={1.8} aria-hidden />
              {view.projectNumber}
            </span>
          )}
          {typeLabel && (
            <span className="p-chip">
              <Landmark size={13} strokeWidth={1.8} aria-hidden />
              {typeLabel}
            </span>
          )}
          {view.location && (
            <span className="p-chip">
              <MapPin size={13} strokeWidth={1.8} aria-hidden />
              {view.location}
            </span>
          )}
          <StatusBadge status={view.status} />
        </div>
        <p className="p-desc">
          Monitor progress, key milestones, documents, and required actions for
          this project.
        </p>

        {/* ── Tabs + panels — all real surfaces over the same data ── */}
        <PortalTabs
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "progress", label: "Progress" },
            { key: "action-items", label: "Action Items" },
            { key: "documents", label: "Documents" },
            { key: "inspections", label: "Inspections" },
            {
              key: "messages",
              label: "Messages",
              disabled: true,
              disabledHint: "Direct messaging with your engineer is coming soon.",
            },
            { key: "activity", label: "Activity" },
          ]}
          panels={{
            overview,
            progress,
            "action-items": (
              <div className="p-colmain mt-[18px]">
                <ActionItemsCard view={view} full />
              </div>
            ),
            documents: (
              <div className="p-colmain mt-[18px]">
                <DocumentsCard view={view} full />
              </div>
            ),
            inspections: (
              <div className="p-colmain mt-[18px]">
                <InspectionsCard view={view} full />
              </div>
            ),
            activity: (
              <div className="p-colmain mt-[18px]">
                <ActivityCard view={view} full />
              </div>
            ),
          }}
        />

        {/* ── Footer / private-portal notice ───────────────────── */}
        <footer className="p-foot">
          <p>
            {/* company.name already ends in "Inc." — don't add a second period. */}
            Prepared by {company.name} This page is private to you — please do
            not forward the link.
          </p>
          <p className="mt-0.5">
            Questions about this project? Email{" "}
            <a href={`mailto:${contact.email}`}>{contact.email}</a>.
          </p>
        </footer>
      </div>
    </PortalShell>
  );
}
