import type { ClientProjectView } from "@/lib/client-link/projection";
import { company } from "@/lib/ttc/site";

/**
 * The client-facing project page.
 *
 * Presentation only: it renders a ClientProjectView and reaches for nothing
 * else. Keeping the data fetch in the route and the markup here means this
 * component can be server-rendered against a real projection in a test
 * without a request, and it keeps the "one place decides what a client sees"
 * rule honest — this file has no database access to abuse.
 *
 * Uses a plain <img> rather than next/image on purpose: one 40px logo on an
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

function isOverdue(due: Date | null): boolean {
  if (!due) return false;
  return due.getTime() < Date.now();
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

/** The lifecycle rail — position without ever showing the firm's status. */
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
  const openMilestones = view.milestones.filter((m) => !m.completed).length;

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
          <p className="truncate text-xs text-slate-500">
            {company.discipline}
          </p>
        </div>
      </header>

      {/* ── The project ───────────────────────────────────────────── */}
      <Card className="mb-4 p-5 sm:p-6">
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
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
          {view.name}
        </h1>
        {view.location && (
          <p className="mt-1.5 text-sm text-slate-600">{view.location}</p>
        )}

        <div className="mt-5">
          <SectionTitle>Current stage</SectionTitle>
          <div className="mt-2.5">
            <GateRail gate={view.gate} />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-slate-400">
              Started
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-800">
              {formatDate(view.startDate)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-slate-400">
              Target completion
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-800">
              {formatDate(view.endDate)}
            </dd>
          </div>
        </dl>
      </Card>

      {/* ── What we need FROM the client. The reason this page exists. ── */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-l-4 border-[#a8893a] p-5 sm:p-6">
          <SectionTitle>What we need from you</SectionTitle>
          {view.whatWeNeedFromYou.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Nothing right now — there is no action waiting on you. We will
              post anything we need here.
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-sm text-slate-600">
                These items are waiting on you before we can move forward.
              </p>
              <ul className="mt-4 space-y-2.5">
                {view.whatWeNeedFromYou.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-lg bg-[#a8893a]/[0.06] px-3.5 py-3"
                  >
                    <span className="text-sm font-medium leading-snug text-slate-900">
                      {item.name}
                    </span>
                    <span
                      className={`shrink-0 whitespace-nowrap text-xs font-medium ${
                        isOverdue(item.dueDate)
                          ? "text-[#b4462f]"
                          : "text-slate-500"
                      }`}
                    >
                      {formatDate(item.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>

      {/* ── A note from the firm ──────────────────────────────────── */}
      {view.latestUpdate && (
        <Card className="mb-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionTitle>Latest update</SectionTitle>
            <span className="text-xs text-slate-400">
              {formatDate(view.latestUpdate.postedAt)}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {view.latestUpdate.summary}
          </p>
        </Card>
      )}

      {/* ── Schedule ──────────────────────────────────────────────── */}
      <Card className="mb-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle>Milestones</SectionTitle>
          {view.milestones.length > 0 && (
            <span className="text-xs text-slate-400">
              {openMilestones} remaining of {view.milestones.length}
            </span>
          )}
        </div>
        {view.milestones.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            The schedule is not set yet. Dates will appear here as we plan them.
          </p>
        ) : (
          <ul className="mt-3.5 divide-y divide-slate-100">
            {view.milestones.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] leading-none ${
                      m.completed
                        ? "border-[#a8893a] bg-[#a8893a] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {m.completed ? "✓" : ""}
                  </span>
                  <span
                    className={`truncate text-sm ${
                      m.completed
                        ? "text-slate-400 line-through"
                        : "text-slate-800"
                    }`}
                  >
                    {m.name}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                  {formatDate(m.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Documents ─────────────────────────────────────────────── */}
      <Card className="mb-4 p-5 sm:p-6">
        <SectionTitle>Documents</SectionTitle>
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
                  className="flex items-center justify-between gap-4 py-2.5 hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-slate-800 hover:text-[#8a7028]">
                    {d.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                    {formatSize(d.size)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Who is on it ──────────────────────────────────────────── */}
      {view.contacts.length > 0 && (
        <Card className="mb-4 p-5 sm:p-6">
          <SectionTitle>Your project team</SectionTitle>
          <ul className="mt-3.5 space-y-2.5">
            {view.contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline justify-between gap-4"
              >
                <span className="text-sm font-medium text-slate-800">
                  {c.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{c.role}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <footer className="mt-8 border-t border-slate-200 pt-5">
        <p className="text-xs leading-relaxed text-slate-500">
          {/* company.name already ends in "Inc." — don't add a second period. */}
          Prepared by {company.name} This page is private to you — please do
          not forward the link. To reach us about this project, reply to the
          message that brought you here.
        </p>
      </footer>
    </div>
  );
}
