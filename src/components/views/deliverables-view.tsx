"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCheck,
  FileStack,
  MessageCircleQuestion,
  Plus,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToday } from "@/lib/use-today";
import { useUiState } from "@/hooks/use-ui-state";
import {
  holderDeskLabel,
  holderLabel,
  pipelineForType,
  type StageHolder,
} from "@/lib/pipelines";
import {
  DELIVERABLE_KINDS,
  DELIVERABLE_SUGGESTIONS,
  docTypeLabel,
  isDeliverableKind,
  type DeliverableKind,
} from "@/lib/deliverables";
import type { ProjectType } from "@prisma/client";
import {
  DeliverableCreateDialog,
  type CreatePrefill,
} from "@/components/deliverables/deliverable-create-dialog";
import { DeliverableDetailSheet } from "@/components/deliverables/deliverable-detail-sheet";
import { SealAuthorityPopover } from "@/components/deliverables/seal-authority-popover";
import { StatusPill, UserAvatar } from "@/components/deliverables/deliverable-bits";
import { apiJson } from "@/components/deliverables/deliverable-api";
import {
  daysSince,
  formatDay,
  formatDayCount,
  holderCounts,
  lastOutcome,
  matchesSearch,
  overdueDays,
} from "@/components/deliverables/deliverable-format";
import type {
  DeliverableListResponse,
  DeliverableRowJSON,
} from "@/components/deliverables/types";

const KIND_TABS: Record<DeliverableKind, string> = {
  DOCUMENT: "Documents",
  RFI: "RFIs",
  SUBMITTAL: "Submittals",
};

const ADD_LABEL: Record<DeliverableKind, string> = {
  DOCUMENT: "Add deliverable",
  RFI: "Log RFI",
  SUBMITTAL: "Log submittal",
};

const LAST_COLUMN: Record<DeliverableKind, string> = {
  DOCUMENT: "Last issue",
  RFI: "Answered",
  SUBMITTAL: "Disposition",
};

const EMPTY: Record<
  DeliverableKind,
  { Icon: LucideIcon; title: string; body: string }
> = {
  DOCUMENT: {
    Icon: FileStack,
    title: "No deliverables yet",
    body: "Track drawing sets, calculation packages, reports and letters — every revision, who sealed it, and who it was issued to.",
  },
  RFI: {
    Icon: MessageCircleQuestion,
    title: "No RFIs logged",
    body: "Log each question from the contractor, the answer you gave, and when it was due.",
  },
  SUBMITTAL: {
    Icon: ClipboardCheck,
    title: "No submittals logged",
    body: "Log shop drawings and product data you review, and the disposition you returned.",
  },
};

const SEARCH_THRESHOLD = 10;

/**
 * The Deliverables tab: the project's register of documents (drawing sets,
 * calc packages, reports, letters), RFIs and submittals — each with its
 * current revision, status, holder ("whose desk, for how long") and due
 * date. Clicking a row opens its sheet.
 *
 * Permissions come from this tab's own GET, not from the page: the page's
 * canEdit is narrower than the API's write rule. One GET loads every kind;
 * it is refetched after every mutation (mutations are not optimistic — the
 * status, holder and locks are derived server-side).
 *
 * `?deliverable=<id>` (from the Files tab, the Overview feed, a
 * notification) opens that item's sheet; opening and closing mirror the
 * param with history.replaceState, the same way `?task=` does in
 * project-content.tsx, so neither re-runs the server page.
 */
export function DeliverablesView({
  projectId,
}: {
  projectId: string;
  projectName?: string;
}) {
  const today = useToday();
  const { value: storedKind, setValue: setStoredKind } = useUiState<DeliverableKind>(
    "deliverablesKind",
    "DOCUMENT"
  );
  const kind: DeliverableKind = isDeliverableKind(storedKind) ? storedKind : "DOCUMENT";

  const [data, setData] = useState<DeliverableListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const reqRef = useRef(0);

  const [scope, setScope] = useState<"open" | "all">("open");
  const [holderFilter, setHolderFilter] = useState<StageHolder | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<CreatePrefill | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────
  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const req = ++reqRef.current;
      if (!opts.silent) {
        setLoading(true);
        setLoadError(false);
      }
      try {
        const res = await apiJson<DeliverableListResponse>(
          `/api/projects/${projectId}/deliverables`,
          {},
          "Couldn't load deliverables."
        );
        if (req !== reqRef.current) return;
        setData(res);
        setLoadError(false);
      } catch {
        if (req !== reqRef.current) return;
        // A failed background refetch keeps the register on screen.
        if (!opts.silent) setLoadError(true);
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => void load({ silent: true }), [load]);

  // ── Deep link: ?deliverable=<id> ─────────────────────────────────────
  const searchParams = useSearchParams();
  const deliverableParam = searchParams.get("deliverable");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The register loads every kind, so a param that is not in it belongs to
  // another project (or is gone): don't open it here — the sheet's stage
  // offer would move THIS project. Each param value is handled once; ids we
  // set ourselves (a row, a just-created item) are marked handled up front.
  const knownIds = data ? data.items : null;
  const handledParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deliverableParam) {
      handledParamRef.current = null;
      return;
    }
    if (!knownIds || handledParamRef.current === deliverableParam) return;
    handledParamRef.current = deliverableParam;
    if (knownIds.some((r) => r.id === deliverableParam)) {
      setSelectedId(deliverableParam);
    } else {
      toast.error("That item isn't on this project.");
      const url = new URL(window.location.href);
      url.searchParams.delete("deliverable");
      window.history.replaceState(null, "", url.toString());
    }
  }, [deliverableParam, knownIds]);

  const syncParam = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("deliverable", id);
    else url.searchParams.delete("deliverable");
    window.history.replaceState(null, "", url.toString());
  };
  const openItem = (id: string) => {
    handledParamRef.current = id;
    setSelectedId(id);
    syncParam(id);
  };
  const closeItem = () => {
    setSelectedId(null);
    syncParam(null);
  };

  // Changing kind or scope clears the desk filter it was chosen against.
  const changeKind = (k: DeliverableKind) => {
    setStoredKind(k);
    setHolderFilter(null);
    setSearch("");
  };

  // ── Derived ──────────────────────────────────────────────────────────
  const items = useMemo(() => data?.items ?? [], [data]);
  const permissions = data?.permissions;
  const canWrite = !!permissions?.canWrite;
  const ofKind = useMemo(() => items.filter((r) => r.kind === kind), [items, kind]);
  const desks = useMemo(() => holderCounts(ofKind), [ofKind]);
  const showSearch = ofKind.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    return ofKind.filter((r) => {
      if (holderFilter) {
        if (!r.open || r.holder !== holderFilter) return false;
      } else if (scope === "open" && !r.open) {
        return false;
      }
      return showSearch ? matchesSearch(r, search) : true;
    });
  }, [ofKind, holderFilter, scope, search, showSearch]);

  const existingNumbers = useMemo(() => items.map((r) => r.number), [items]);
  const pipelineId = pipelineForType(
    (data?.project.type ?? null) as ProjectType | null
  )?.id;
  const suggestions =
    kind === "DOCUMENT" && pipelineId ? DELIVERABLE_SUGGESTIONS[pipelineId] : [];

  const startCreate = (prefill: CreatePrefill | null = null) => {
    setCreatePrefill(prefill);
    setCreateOpen(true);
  };

  // ── Render ───────────────────────────────────────────────────────────
  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="tablist"
        aria-label="Deliverable kind"
        className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
      >
        {DELIVERABLE_KINDS.map((k) => {
          const active = k === kind;
          const n = data ? data.counts[k].open : null;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => changeKind(k)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm transition-colors",
                active
                  ? "bg-white font-medium text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {KIND_TABS[k]}{" "}
              <span className={cn("tabular-nums", active ? "text-[#a8893a]" : "text-slate-400")}>
                {n ?? "–"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {permissions?.isWorkspaceOwner && (
          <SealAuthorityPopover workspaceId={data?.project.workspaceId ?? null} onChanged={refresh} />
        )}
        {canWrite && (
          <Button size="sm" onClick={() => startCreate()}>
            <Plus className="h-4 w-4" />
            {ADD_LABEL[kind]}
          </Button>
        )}
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (loading && !data) {
    body = <SkeletonRows />;
  } else if (loadError && !data) {
    body = (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <p className="text-sm text-slate-500">Couldn&apos;t load deliverables.</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  } else if (ofKind.length === 0) {
    const e = EMPTY[kind];
    body = (
      <div className="mx-auto flex max-w-md flex-col items-center py-14 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#c9a84c]/10">
          <e.Icon className="h-6 w-6 text-[#a8893a]" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">{e.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{e.body}</p>
        {canWrite && (
          <>
            <Button size="sm" className="mt-4" onClick={() => startCreate()}>
              <Plus className="h-4 w-4" />
              {ADD_LABEL[kind]}
            </Button>
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => startCreate({ docType: s.docType, title: s.title })}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-[#c9a84c] hover:bg-[#c9a84c]/10 hover:text-slate-900"
                  >
                    + {s.title}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  } else {
    body = (
      <>
        {/* Holder strip + scope chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {desks
            .filter((d) => d.holder !== "NONE")
            .map((d) => {
              const active = holderFilter === d.holder;
              return (
                <button
                  key={d.holder}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setHolderFilter(active ? null : d.holder)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : d.holder === "FIRM" || d.holder === "PE"
                        ? "border-[#c9a84c]/50 bg-[#c9a84c]/10 text-slate-800 hover:bg-[#c9a84c]/20"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {holderDeskLabel(d.holder)}
                  <span className="font-semibold tabular-nums">{d.count}</span>
                </button>
              );
            })}
          <div className="ml-auto flex items-center gap-1.5">
            {showSearch && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search number or title"
                  aria-label="Search number or title"
                  className="h-8 w-44 pl-7 text-xs sm:w-56"
                />
              </div>
            )}
            {!holderFilter && (
              <div className="inline-flex rounded-full border border-slate-200 p-0.5 text-xs">
                {(["open", "all"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={scope === s}
                    onClick={() => setScope(s)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5",
                      scope === s ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {s === "open" ? "Open" : "All"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <FilteredEmpty
            holderFilter={holderFilter}
            search={showSearch ? search : ""}
            onClearFilter={() => setHolderFilter(null)}
            onClearSearch={() => setSearch("")}
            onShowAll={() => setScope("all")}
          />
        ) : (
          <>
            <RegisterTable rows={visible} kind={kind} today={today} onOpen={openItem} />
            <RegisterCards rows={visible} today={today} onOpen={openItem} />
          </>
        )}
      </>
    );
  }

  return (
    <div className="flex-1 bg-white">
      <div className="w-full space-y-4 px-4 py-4 md:px-6">
        {header}
        {body}
      </div>

      {data && (
        <DeliverableCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          kind={kind}
          existingNumbers={existingNumbers}
          assignableUsers={data.assignableUsers}
          prefill={createPrefill}
          onCreated={(item) => {
            refresh();
            openItem(item.id);
          }}
        />
      )}

      <DeliverableDetailSheet
        deliverableId={selectedId}
        projectId={projectId}
        project={data?.project ?? null}
        assignableUsers={data?.assignableUsers ?? []}
        onClose={closeItem}
        onChanged={refresh}
      />
    </div>
  );
}

// ─── Register: table (lg and up) ────────────────────────────────────────

function holderCell(row: DeliverableRowJSON, today: Date | null): string | null {
  if (row.holder === "NONE") return null;
  const days = today ? formatDayCount(daysSince(row.statusChangedAt, today)) : "—";
  return `${holderLabel(row.holder)} · ${days}`;
}

function DueCell({ row, today }: { row: DeliverableRowJSON; today: Date | null }) {
  if (!row.dueDate) return <span className="text-slate-300">—</span>;
  const late = today && row.open ? overdueDays(row.dueDate, today) : 0;
  if (late > 0) {
    return (
      <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white whitespace-nowrap">
        Overdue {late}d
      </span>
    );
  }
  return <span className="whitespace-nowrap text-slate-600">{formatDay(row.dueDate, today)}</span>;
}

function RegisterTable({
  rows,
  kind,
  today,
  onOpen,
}: {
  rows: DeliverableRowJSON[];
  kind: DeliverableKind;
  today: Date | null;
  onOpen: (id: string) => void;
}) {
  const showRev = kind !== "RFI";
  return (
    // The fixed columns alone are ~810px; below lg (and with a wide sidebar)
    // the content is narrower, so the table only appears from lg, keeps a
    // floor that leaves Title room, and scrolls sideways instead of clipping.
    <div className="hidden overflow-x-auto rounded-lg border border-slate-200 lg:block">
      <table className="w-full min-w-[1040px] table-fixed text-sm">
        <thead className="bg-slate-50 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-28 px-3 py-2">Number</th>
            <th className="px-3 py-2">Title</th>
            {showRev && <th className="w-14 px-3 py-2">Rev</th>}
            <th className="w-44 px-3 py-2">Status</th>
            <th className="w-36 px-3 py-2">Holder</th>
            <th className="w-28 px-3 py-2">Due</th>
            <th className="w-12 px-3 py-2">
              <span className="sr-only">Assignee</span>
            </th>
            <th className="w-40 px-3 py-2">{LAST_COLUMN[kind]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const holder = holderCell(r, today);
            const outcome = lastOutcome(r, today);
            return (
              <tr
                key={r.id}
                tabIndex={0}
                role="button"
                aria-label={`Open ${r.number} ${r.title}`}
                onClick={() => onOpen(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r.id);
                  }
                }}
                className={cn(
                  "cursor-pointer outline-none hover:bg-slate-50 focus-visible:bg-[#c9a84c]/10",
                  !r.open && "text-slate-400"
                )}
              >
                <td className="truncate px-3 py-2.5 font-mono text-xs font-semibold text-slate-900">
                  {r.number}
                </td>
                <td className="px-3 py-2.5">
                  <div className="truncate text-slate-900" title={r.title}>
                    {r.title}
                  </div>
                  {r.kind === "DOCUMENT" && r.docType && (
                    <div className="truncate text-[11px] text-slate-400">{docTypeLabel(r.docType)}</div>
                  )}
                </td>
                {showRev && (
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                    {r.currentRevision?.label ?? "—"}
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <StatusPill label={r.statusLabel} open={r.open} holder={r.holder} />
                </td>
                <td className="truncate px-3 py-2.5 text-xs text-slate-600">
                  {holder ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <DueCell row={r} today={today} />
                </td>
                <td className="px-3 py-2.5">
                  {r.assignee ? <UserAvatar user={r.assignee} size={22} /> : null}
                </td>
                <td className="truncate px-3 py-2.5 text-xs text-slate-600">
                  {outcome ?? <span className="text-slate-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Register: cards (below lg) ────────────────────────────────────────────

function RegisterCards({
  rows,
  today,
  onOpen,
}: {
  rows: DeliverableRowJSON[];
  today: Date | null;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="space-y-2 lg:hidden">
      {rows.map((r) => {
        const holder = holderCell(r, today);
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              className={cn(
                "w-full min-w-0 rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50",
                !r.open && "opacity-70"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-semibold text-slate-900">{r.number}</span>
                {r.currentRevision && (
                  <span className="font-mono text-[11px] text-slate-400">Rev {r.currentRevision.label}</span>
                )}
                <span className="ml-auto flex-shrink-0">
                  <StatusPill label={r.statusLabel} open={r.open} holder={r.holder} />
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-900">{r.title}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
                {holder && <span className="truncate">{holder}</span>}
                {r.dueDate && (
                  <span className="flex-shrink-0">
                    <DueCell row={r} today={today} />
                  </span>
                )}
                {r.assignee && (
                  <span className="ml-auto flex-shrink-0">
                    <UserAvatar user={r.assignee} size={18} />
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── States ─────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading deliverables">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-3">
          <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
          <div className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
          <div className="hidden h-4 w-24 animate-pulse rounded-full bg-slate-100 md:block" />
          <div className="hidden h-3 w-16 animate-pulse rounded bg-slate-100 md:block" />
        </div>
      ))}
    </div>
  );
}

function FilteredEmpty({
  holderFilter,
  search,
  onClearFilter,
  onClearSearch,
  onShowAll,
}: {
  holderFilter: StageHolder | null;
  search: string;
  onClearFilter: () => void;
  onClearSearch: () => void;
  onShowAll: () => void;
}) {
  const [text, action, onAction] = search.trim()
    ? ["No matches.", "Clear search", onClearSearch]
    : holderFilter
      ? ["No items on this desk.", "Clear filter", onClearFilter]
      : ["Nothing open here.", "Show all", onShowAll];
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 py-10">
      <p className="text-sm text-slate-500">{text}</p>
      <Button size="sm" variant="outline" onClick={onAction}>
        {search.trim() && <X className="h-3.5 w-3.5" />}
        {action}
      </Button>
    </div>
  );
}
