import type {
  ClientProjectView,
  ClientStatusBadge,
  ClientStage,
} from "@/lib/client-link/projection";
import { company, contact } from "@/lib/ttc/site";

/**
 * The client-facing project page.
 *
 * Presentation only: it renders a ClientProjectView and reaches for nothing
 * else. Keeping the data fetch in the route and the markup here means this
 * component can be server-rendered against a real projection in a test
 * without a request, and it keeps the "one place decides what a client sees"
 * rule honest — this file has no database access to abuse.
 *
 * House style is monochrome + gold: #a8893a (deep, text/border), #c9a84c
 * (bright fills), the tint chip bg-[#a8893a]/10 + text-[#8a7028]. There are no
 * red/green/amber traffic lights anywhere — the firm's status is only ever the
 * friendly label the projection already collapsed it into.
 *
 * Uses a plain <img> rather than next/image on purpose: one small logo on an
 * unauthenticated page does not justify routing a request through the image
 * optimizer, and it keeps the component renderable outside a Next request.
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </h2>
  );
}

function Card({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

/** The friendly status pill — gold when positive, slate when neutral. Never red/green. */
function StatusBadge({ status }: { status: ClientStatusBadge }) {
  const positive = status.tone === "positive";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        positive
          ? "bg-[#a8893a]/10 text-[#8a7028]"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          positive ? "bg-[#a8893a]" : "bg-slate-400"
        }`}
      />
      {status.label}
    </span>
  );
}

/** Gold progress ring with the percent in the middle. Stroke is gold, not green/red. */
function ProgressRing({ percent }: { percent: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0" aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="#eee5cf" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="#a8893a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
      />
      <text
        x="26"
        y="27"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-slate-900 text-[13px] font-semibold"
      >
        {percent}%
      </text>
    </svg>
  );
}

/** A little calendar chip for an inspection date. */
function DateChip({ date }: { date: Date }) {
  const month = date
    .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const day = date.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 leading-none">
      <span className="text-[9px] font-semibold tracking-wide text-[#8a7028]">
        {month}
      </span>
      <span className="mt-0.5 text-sm font-bold text-slate-900">{day}</span>
    </span>
  );
}

/** Generic person glyph — the client side of "who has the ball". Never a name/email. */
function ClientGlyph() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#a8893a]/10 text-[#8a7028]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
      </svg>
    </span>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
        {trailing}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** The real, Section-derived rail (recertifications). */
function StageRail({ stages }: { stages: ClientStage[] }) {
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 sm:flex-nowrap">
      {stages.map((s, i) => (
        <li
          key={`${s.label}-${i}`}
          className="flex min-w-0 flex-1 basis-[45%] flex-col gap-1.5 sm:basis-0"
        >
          <span
            aria-hidden
            className={`h-1.5 w-full rounded-full ${
              s.state === "current"
                ? "bg-[#a8893a]"
                : s.state === "done"
                  ? "bg-[#d8c894]"
                  : "bg-slate-200"
            }`}
          />
          <span
            className={`truncate text-[11px] sm:text-xs ${
              s.state === "current"
                ? "font-semibold text-[#8a7028]"
                : s.state === "done"
                  ? "text-slate-500"
                  : "text-slate-400"
            }`}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The generic lifecycle rail — the fallback for non-recert projects. */
function GateRail({ gate }: { gate: string | null }) {
  const current = gate ? GATE_SEQUENCE.indexOf(gate as never) : -1;
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 sm:flex-nowrap">
      {GATE_SEQUENCE.map((g, i) => {
        const done = current > -1 && i < current;
        const isCurrent = i === current;
        return (
          <li
            key={g}
            className="flex min-w-0 flex-1 basis-[45%] flex-col gap-1.5 sm:basis-0"
          >
            <span
              aria-hidden
              className={`h-1.5 w-full rounded-full ${
                isCurrent
                  ? "bg-[#a8893a]"
                  : done
                    ? "bg-[#d8c894]"
                    : "bg-slate-200"
              }`}
            />
            <span
              className={`truncate text-[11px] sm:text-xs ${
                isCurrent
                  ? "font-semibold text-[#8a7028]"
                  : done
                    ? "text-slate-500"
                    : "text-slate-400"
              }`}
            >
              {GATE_LABEL[g]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ClientProjectPage({ view }: { view: ClientProjectView }) {
  const actionCount = view.whatWeNeedFromYou.length;
  const nextAction = view.whatWeNeedFromYou[0] ?? null;
  const monthsLabel = monthsToGoLabel(view.endDate);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      {/* ── Firm identity ─────────────────────────────────────────── */}
      <header className="mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ttc/img/logo-square.png"
          alt={company.name}
          width={40}
          height={40}
          className="h-10 w-10 rounded-md object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {company.shortName}
          </p>
          <p className="truncate text-xs text-slate-500">{company.discipline}</p>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <Card className="mb-4 overflow-hidden">
        <div
          className="h-2.5 w-full"
          aria-hidden
          style={{
            background: `linear-gradient(90deg, ${view.coverColor} 0%, ${view.coverColor}99 100%)`,
          }}
        />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {view.projectNumber && (
                <span className="rounded bg-[#a8893a]/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-[#8a7028]">
                  {view.projectNumber}
                </span>
              )}
              {view.type && (
                <span className="text-xs text-slate-500">
                  {TYPE_LABEL[view.type] ?? view.type}
                </span>
              )}
            </div>
            <StatusBadge status={view.status} />
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
            {view.name}
          </h1>
          {view.location && (
            <p className="mt-1.5 text-sm text-slate-600">{view.location}</p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {view.friendlySentence}
          </p>
        </div>
      </Card>

      {/* ── FOUR STAT CARDS ───────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Overall Progress">
          {view.progress ? (
            <div className="flex items-center gap-3">
              <ProgressRing percent={view.progress.percent} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {view.progress.done} of {view.progress.total} done
                </p>
                {monthsLabel && (
                  <p className="mt-0.5 text-xs text-slate-500">{monthsLabel}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Not started yet</p>
          )}
        </StatCard>

        <StatCard label="Current Stage">
          <p className="text-sm font-semibold text-slate-900">
            {view.currentStage?.label ?? "—"}
          </p>
          {view.currentStage?.subline && (
            <p className="mt-0.5 text-xs text-slate-500">
              {view.currentStage.subline}
            </p>
          )}
        </StatCard>

        <StatCard
          label="Next Action"
          trailing={
            actionCount > 0 ? (
              <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-[#a8893a]/10 px-1.5 text-xs font-semibold text-[#8a7028]">
                {actionCount}
              </span>
            ) : undefined
          }
        >
          {nextAction ? (
            <>
              <p className="line-clamp-2 text-sm font-medium text-slate-900">
                {nextAction.name}
              </p>
              <a
                href="#action-items"
                className="mt-1.5 inline-block text-xs font-semibold text-[#8a7028] hover:underline"
              >
                View action items →
              </a>
            </>
          ) : (
            <p className="text-sm text-slate-500">You&rsquo;re all caught up</p>
          )}
        </StatCard>

        <StatCard label="Target Completion">
          <p className="text-sm font-semibold text-slate-900">
            {formatDate(view.endDate)}
          </p>
        </StatCard>
      </div>

      {/* ── STAGE RAIL ────────────────────────────────────────────── */}
      <Card className="mb-4 p-5 sm:p-6">
        <SectionTitle>Project stages</SectionTitle>
        <div className="mt-3">
          {view.stages ? (
            <StageRail stages={view.stages} />
          ) : (
            <GateRail gate={view.gate} />
          )}
        </div>
      </Card>

      {/* ── ACTION ITEMS — the reason this page exists. ───────────── */}
      <Card id="action-items" className="mb-4 scroll-mt-6 overflow-hidden">
        <div className="border-l-4 border-[#a8893a] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>What we need from you</SectionTitle>
            {actionCount > 0 && (
              <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-[#a8893a]/10 px-1.5 text-xs font-semibold text-[#8a7028]">
                {actionCount}
              </span>
            )}
          </div>
          {actionCount === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Nothing right now — there is no action waiting on you. We will post
              anything we need here.
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-sm text-slate-600">
                These items are waiting on you before we can move forward.
              </p>
              <ul className="mt-4 space-y-2.5">
                {view.whatWeNeedFromYou.map((item) => {
                  const label = dueLabel(item.dueDate);
                  const overdue = (dayCount(item.dueDate) ?? 0) < 0;
                  return (
                    <li
                      key={item.id}
                      className="rounded-lg bg-[#a8893a]/[0.06] px-3.5 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug text-slate-900">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="mt-0.5 text-xs leading-snug text-slate-500">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {label && (
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                              overdue
                                ? "bg-[#8a7028] text-white"
                                : "bg-[#a8893a]/10 text-[#8a7028]"
                            }`}
                          >
                            {label}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </Card>

      {/* ── RECENT DOCUMENTS ──────────────────────────────────────── */}
      <Card className="mb-4 p-5 sm:p-6">
        <SectionTitle>Recent documents</SectionTitle>
        {view.documents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No documents have been shared yet. Anything we release to you will
            appear here.
          </p>
        ) : (
          <ul className="mt-3.5 divide-y divide-slate-100">
            {view.documents.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 py-2.5 hover:bg-slate-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#a8893a]/10 text-[10px] font-bold text-[#8a7028]">
                    {fileKind(d.mimeType, d.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-[#8a7028]">
                      {d.name}
                    </span>
                    <span className="block text-xs text-slate-400">
                      Uploaded {formatDate(d.createdAt)} · {formatSize(d.size)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── UPCOMING INSPECTIONS ──────────────────────────────────── */}
      <Card className="mb-4 p-5 sm:p-6">
        <SectionTitle>Upcoming inspections</SectionTitle>
        {view.upcomingInspections.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No inspections are scheduled right now. We&rsquo;ll list any site
            visit here once it&rsquo;s on the calendar.
          </p>
        ) : (
          <ul className="mt-3.5 space-y-2.5">
            {view.upcomingInspections.map((insp) => (
              <li key={insp.id} className="flex items-center gap-3">
                <DateChip date={insp.dueDate} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {insp.name}
                </span>
                <span className="shrink-0 rounded-full bg-[#a8893a]/10 px-2 py-0.5 text-xs font-medium text-[#8a7028]">
                  Upcoming
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── WHO HAS THE BALL ──────────────────────────────────────── */}
      <Card className="mb-4 p-5 sm:p-6">
        <SectionTitle>Who has the ball</SectionTitle>
        <div className="mt-3 flex items-center gap-3">
          {view.whoHasTheBall.side === "US" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/ttc/img/logo-square.png"
              alt={company.shortName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full border border-slate-200 object-contain"
            />
          ) : (
            <ClientGlyph />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {view.whoHasTheBall.side === "US"
                ? "Waiting on Us"
                : "Waiting on Client"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {view.whoHasTheBall.reason}
            </p>
          </div>
        </div>
      </Card>

      {/* ── PROJECT ACTIVITY ──────────────────────────────────────── */}
      <Card className="mb-4 p-5 sm:p-6">
        <SectionTitle>Project activity</SectionTitle>
        {view.activity.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No activity to show yet. Milestones, documents and updates will
            appear here as the project moves.
          </p>
        ) : (
          <ul className="mt-3.5 space-y-3">
            {view.activity.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#a8893a]"
                />
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{e.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {timeAgo(e.at)} · by {e.actor}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <footer className="mt-8 border-t border-slate-200 pt-5">
        <p className="text-xs leading-relaxed text-slate-500">
          {/* company.name already ends in "Inc." — don't add a second period. */}
          Prepared by {company.name} This page is private to you — please do not
          forward the link.
        </p>
        <p className="mt-1.5 text-xs text-slate-500">
          Questions about this project? Email{" "}
          <a
            href={`mailto:${contact.email}`}
            className="font-medium text-[#8a7028] hover:underline"
          >
            {contact.email}
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
