"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Send,
  Folder,
  Calendar,
  Target,
  Lightbulb,
  Sparkles,
  Plus,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useUiState } from "@/hooks/use-ui-state";

type PortfolioStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

interface StatusUpdate {
  id: string;
  status: PortfolioStatus;
  summary: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

// Goals ("Objectives") linked to a portfolio. ObjectiveStatus is a distinct
// enum from PortfolioStatus — it adds ACHIEVED/PARTIAL/MISSED/DROPPED.
type ObjectiveStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ACHIEVED"
  | "PARTIAL"
  | "MISSED"
  | "DROPPED";

interface PortfolioGoal {
  /** PortfolioObjective join-row id (present on linked rows; absent in picker). */
  linkId?: string;
  id: string;
  name: string;
  status: ObjectiveStatus;
  progress: number;
  ownerId: string | null;
  owner: { id: string; name: string | null; image: string | null } | null;
  team: { id: string; name: string; color: string | null } | null;
  period: string | null;
}

const GOAL_STATUS_META: Record<
  ObjectiveStatus,
  { label: string; dot: string; chip: string; bar: string }
> = {
  ON_TRACK: {
    label: "On track",
    dot: "bg-green-500",
    chip: "bg-green-100 text-green-800",
    bar: "bg-green-500",
  },
  AT_RISK: {
    label: "At risk",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
  },
  OFF_TRACK: {
    label: "Off track",
    dot: "bg-red-500",
    chip: "bg-red-100 text-red-800",
    bar: "bg-red-500",
  },
  ACHIEVED: {
    label: "Achieved",
    dot: "bg-blue-500",
    chip: "bg-blue-100 text-blue-800",
    bar: "bg-blue-500",
  },
  PARTIAL: {
    label: "Partial",
    dot: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800",
    bar: "bg-violet-500",
  },
  MISSED: {
    label: "Missed",
    dot: "bg-gray-500",
    chip: "bg-gray-200 text-gray-700",
    bar: "bg-gray-500",
  },
  DROPPED: {
    label: "Dropped",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-600",
    bar: "bg-gray-400",
  },
};

interface Props {
  portfolioId: string;
  status: PortfolioStatus;
  portfolioName: string;
  description: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  endDate: string | null;
  inProgress: number;
  atRisk: number;
  offTrack: number;
  total: number;
  updates: StatusUpdate[];
  updatesLoading: boolean;
  onPost: (status: PortfolioStatus, summary: string) => Promise<boolean>;
}

const STATUS_META: Record<
  PortfolioStatus,
  {
    label: string;
    sentence: string;
    dot: string;
    chip: string;
    text: string;
    accent: string;
  }
> = {
  ON_TRACK: {
    label: "On track",
    sentence: "on track",
    dot: "bg-[#c9a84c]",
    chip: "bg-[#c9a84c]/15 text-[#a8893a]",
    text: "text-[#a8893a]",
    accent: "#c9a84c",
  },
  AT_RISK: {
    label: "At risk",
    sentence: "at risk",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
    text: "text-amber-700",
    accent: "#f59e0b",
  },
  OFF_TRACK: {
    label: "Off track",
    sentence: "off track",
    dot: "bg-black",
    chip: "bg-gray-100 text-black",
    text: "text-black",
    accent: "#000000",
  },
  ON_HOLD: {
    label: "On hold",
    sentence: "on hold",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-700",
    text: "text-gray-700",
    accent: "#9ca3af",
  },
  COMPLETE: {
    label: "Complete",
    sentence: "complete",
    dot: "bg-[#a8893a]",
    chip: "bg-[#a8893a]/15 text-[#a8893a]",
    text: "text-[#a8893a]",
    accent: "#a8893a",
  },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDueDate(iso: string | null) {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PortfolioProgressView({
  portfolioId,
  status,
  portfolioName,
  description,
  owner,
  endDate,
  inProgress,
  atRisk,
  offTrack,
  total,
  updates,
  updatesLoading,
  onPost,
}: Props) {
  const [draft, setDraft] = useState({
    status: "ON_TRACK" as PortfolioStatus,
    summary: "",
  });
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    if (!draft.summary.trim()) return;
    setPosting(true);
    const ok = await onPost(draft.status, draft.summary.trim());
    setPosting(false);
    if (ok) setDraft({ status: draft.status, summary: "" });
  }

  const portfolioMeta = STATUS_META[status];
  const latest = updates[0] ?? null;
  const rest = updates.slice(1);

  return (
    <div className="space-y-5">
      {/* ── Headline ────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-black">
          This portfolio is{" "}
          <span className={portfolioMeta.text}>{portfolioMeta.sentence}</span>.
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          A quick read on where {portfolioName || "this portfolio"} stands right
          now.
        </p>
      </div>

      {/* ── Top status metric cards ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard label="Projects in progress" value={inProgress} />
        <StatusCard
          label="Projects at risk"
          value={atRisk}
          accent={atRisk > 0}
        />
        <StatusCard
          label="Projects off track"
          value={offTrack}
          accent={offTrack > 0}
        />
        <StatusCard label="Projects total" value={total} />
      </div>

      {/* ── Two-column layout ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left main (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Portfolio summary (rule-based) card */}
          <SummaryCard
            portfolioId={portfolioId}
            portfolioName={portfolioName}
            status={status}
            inProgress={inProgress}
            atRisk={atRisk}
            offTrack={offTrack}
            total={total}
            latest={latest}
          />

          {/* Status composer */}
          <div className="bg-white rounded-lg border">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-medium text-black">
                Post a portfolio status update
              </h3>
            </div>
            <div className="px-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <Select
                  value={draft.status}
                  onValueChange={(v) =>
                    setDraft({ ...draft, status: v as PortfolioStatus })
                  }
                >
                  <SelectTrigger className="sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_META) as PortfolioStatus[]).map((s) => {
                      const m = STATUS_META[s];
                      return (
                        <SelectItem key={s} value={s}>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                m.dot
                              )}
                            />
                            {m.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={draft.summary}
                onChange={(e) =>
                  setDraft({ ...draft, summary: e.target.value })
                }
                placeholder="What is the current state of this portfolio? Wins, blockers, and next steps…"
                rows={4}
                className="text-sm"
              />
              <div className="flex justify-end mt-3">
                <Button
                  onClick={handlePost}
                  disabled={posting || !draft.summary.trim()}
                  className="bg-black hover:bg-gray-800"
                  size="sm"
                >
                  {posting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Post update
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Latest status update card */}
          {updatesLoading ? (
            <div className="bg-white rounded-lg border p-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : latest ? (
            <LatestUpdateCard
              update={latest}
              portfolioName={portfolioName}
            />
          ) : (
            <div className="bg-white rounded-lg border p-8 text-center text-sm text-gray-500">
              No status updates yet. Post the first one above to keep your team
              in the loop.
            </div>
          )}

          {/* Recent status updates timeline */}
          {rest.length > 0 && (
            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 flex items-center justify-between border-b">
                <h3 className="text-sm font-medium text-black">
                  Recent status updates
                </h3>
                <button className="text-xs text-[#a8893a] hover:underline">
                  View all
                </button>
              </div>
              <ol className="px-4 py-3 space-y-2">
                {rest.map((u) => {
                  const m = STATUS_META[u.status];
                  return (
                    <li
                      key={u.id}
                      className="flex items-start gap-3 text-sm py-1.5"
                    >
                      <span
                        className={cn(
                          "w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0",
                          m.dot
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn(m.chip, "text-[10px]")}>
                            {m.label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {timeAgo(u.createdAt)}
                            {u.author?.name ? ` · ${u.author.name}` : ""}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 mt-0.5 line-clamp-2 break-words">
                          {u.summary}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        {/* Right sidebar (1 col) */}
        <div className="space-y-4">
          <AboutCard
            portfolioName={portfolioName}
            description={description}
            owner={owner}
            endDate={endDate}
            status={status}
            total={total}
          />
          <GoalsCard portfolioId={portfolioId} />
          <TipCard />
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────

function StatusCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-4 md:p-5",
        accent && "border-[#a8893a]/40 bg-[#a8893a]/5"
      )}
    >
      <div className="text-3xl md:text-4xl font-semibold text-black tabular-nums">
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// Build a concise, rule-based portfolio summary from the aggregate
// stats. This ships parity today without an AI dependency; if an
// assistant endpoint is added later it can replace this generator.
function buildSummary(args: {
  portfolioName: string;
  status: PortfolioStatus;
  inProgress: number;
  atRisk: number;
  offTrack: number;
  total: number;
  latest: StatusUpdate | null;
}): string[] {
  const { portfolioName, status, inProgress, atRisk, offTrack, total, latest } =
    args;
  const name = portfolioName || "This portfolio";
  const lines: string[] = [];

  if (total === 0) {
    lines.push(
      `${name} has no projects yet. Add projects to start tracking health and progress.`
    );
    return lines;
  }

  const healthy = Math.max(total - atRisk - offTrack, 0);
  const headline =
    status === "ON_TRACK"
      ? `${name} is on track.`
      : status === "AT_RISK"
        ? `${name} is at risk and needs attention.`
        : status === "OFF_TRACK"
          ? `${name} is off track.`
          : status === "COMPLETE"
            ? `${name} is complete.`
            : `${name} is on hold.`;
  lines.push(headline);

  lines.push(
    `${total} ${total === 1 ? "project" : "projects"} in total — ` +
      `${healthy} healthy, ${atRisk} at risk, and ${offTrack} off track. ` +
      `${inProgress} ${inProgress === 1 ? "is" : "are"} actively in progress.`
  );

  if (atRisk + offTrack > 0) {
    lines.push(
      `Focus this period: the ${atRisk + offTrack} ${
        atRisk + offTrack === 1 ? "project" : "projects"
      } flagged at risk or off track. Review blockers and reset expectations where needed.`
    );
  } else {
    lines.push(
      `No projects are currently flagged. Keep momentum and watch upcoming due dates.`
    );
  }

  if (latest) {
    const excerpt =
      latest.summary.length > 160
        ? latest.summary.slice(0, 157).trimEnd() + "…"
        : latest.summary;
    lines.push(
      `Latest update${latest.author?.name ? ` from ${latest.author.name}` : ""}: “${excerpt}”`
    );
  }

  return lines;
}

function SummaryCard({
  portfolioId,
  portfolioName,
  status,
  inProgress,
  atRisk,
  offTrack,
  total,
  latest,
}: {
  portfolioId: string;
  portfolioName: string;
  status: PortfolioStatus;
  inProgress: number;
  atRisk: number;
  offTrack: number;
  total: number;
  latest: StatusUpdate | null;
}) {
  const [expanded, setExpanded] = useState(false);
  // Per-user, per-portfolio "receive periodic updates" preference.
  const { value: periodicMap, setValue: setPeriodicMap } = useUiState<
    Record<string, boolean>
  >("portfolioPeriodicSummary", {});
  const periodic = !!periodicMap[portfolioId];

  const lines = buildSummary({
    portfolioName,
    status,
    inProgress,
    atRisk,
    offTrack,
    total,
    latest,
  });
  const preview = lines[0];
  const rest = lines.slice(1);

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-black inline-flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#a8893a]" />
          Portfolio summary
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
          Auto-generated
        </span>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">
        <p className="font-medium text-black">{preview}</p>
        {expanded &&
          rest.map((line, i) => (
            <p key={i} className="text-gray-600">
              {line}
            </p>
          ))}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <Switch
            checked={periodic}
            onCheckedChange={(v) =>
              setPeriodicMap((prev) => ({ ...prev, [portfolioId]: v }))
            }
          />
          Receive periodic updates
        </label>
        {rest.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide summary" : "View summary"}
          </Button>
        )}
      </div>
    </div>
  );
}

function LatestUpdateCard({
  update,
  portfolioName,
}: {
  update: StatusUpdate;
  portfolioName: string;
}) {
  const m = STATUS_META[update.status];
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="h-1" style={{ background: m.accent }} />
      <div className="p-4 md:p-5">
        <h3 className="text-base md:text-lg font-semibold text-black">
          This portfolio is{" "}
          <span className={m.text}>{m.sentence}</span>.
        </h3>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={update.author?.image || ""} />
            <AvatarFallback className="text-xs bg-gray-200">
              {update.author?.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-black">
            {update.author?.name || "Unknown"}
          </span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500">
            {timeAgo(update.createdAt)}
          </span>
          <span className="text-xs text-gray-400">·</span>
          <Badge className={cn(m.chip, "text-[10px]")}>{m.label}</Badge>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-600 inline-flex items-center gap-1">
            <Folder className="h-3 w-3" />
            {portfolioName}
          </span>
        </div>
        <div className="mt-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Summary
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
            {update.summary}
          </p>
        </div>
      </div>
    </div>
  );
}

function AboutCard({
  portfolioName,
  description,
  owner,
  endDate,
  status,
  total,
}: {
  portfolioName: string;
  description: string | null;
  owner: { id: string; name: string | null; image: string | null } | null;
  endDate: string | null;
  status: PortfolioStatus;
  total: number;
}) {
  const m = STATUS_META[status];
  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-sm font-medium text-black mb-3">
        About this portfolio
      </h3>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <dt className="w-20 text-xs text-gray-500">Owner</dt>
          <dd className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarImage src={owner?.image || ""} />
              <AvatarFallback className="text-[10px] bg-gray-200">
                {owner?.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-gray-700">{owner?.name || "—"}</span>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-20 text-xs text-gray-500">Due date</dt>
          <dd className="text-gray-700 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            {formatDueDate(endDate)}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-20 text-xs text-gray-500">Status</dt>
          <dd>
            <Badge className={cn(m.chip, "text-[10px]")}>{m.label}</Badge>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-20 text-xs text-gray-500">Projects</dt>
          <dd className="text-gray-700 tabular-nums">{total}</dd>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <dt className="text-xs text-gray-500 mb-1">Description</dt>
          <dd className="text-sm text-gray-600">
            {description ? description : (
              <span className="italic text-gray-400">
                Add a portfolio description from the header.
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ── Goals card ──────────────────────────────────────────────
//
// "Goals this portfolio works toward" (Asana parity). Fetches the linked
// objectives from GET /api/portfolios/[id]/goals on mount, renders each with
// its ObjectiveStatus pill + progress bar, links each row to /goals/[id], and
// (for editors) offers an "Add goal" picker (?available=1 → POST) and per-row
// unlink (DELETE). Persisted through PortfolioObjective.

function GoalsCard({ portfolioId }: { portfolioId: string }) {
  const router = useRouter();
  const [goals, setGoals] = useState<PortfolioGoal[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [available, setAvailable] = useState<PortfolioGoal[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/portfolios/${portfolioId}/goals`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { goals: PortfolioGoal[]; canEdit: boolean }) => {
        if (cancelled) return;
        setGoals(data.goals ?? []);
        setCanEdit(!!data.canEdit);
      })
      .catch(() => {
        if (!cancelled) setGoals([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolioId]);

  const loadAvailable = useCallback(async () => {
    setAvailableLoading(true);
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/goals?available=1`
      );
      if (!res.ok) throw new Error();
      const data: PortfolioGoal[] = await res.json();
      setAvailable(data);
    } catch {
      setAvailable([]);
      toast.error("Failed to load goals");
    } finally {
      setAvailableLoading(false);
    }
  }, [portfolioId]);

  function handlePickerOpenChange(open: boolean) {
    setPickerOpen(open);
    if (open) loadAvailable();
  }

  async function handleLink(objective: PortfolioGoal) {
    setLinkingId(objective.id);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectiveId: objective.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add goal");
      }
      const linked: PortfolioGoal = await res.json();
      setGoals((prev) =>
        prev.some((g) => g.id === linked.id) ? prev : [...prev, linked]
      );
      setAvailable((prev) => prev.filter((g) => g.id !== objective.id));
      toast.success("Goal added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add goal");
    } finally {
      setLinkingId(null);
    }
  }

  async function handleUnlink(goal: PortfolioGoal) {
    setRemovingId(goal.id);
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/goals?objectiveId=${encodeURIComponent(
          goal.id
        )}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove goal");
      }
      setGoals((prev) => prev.filter((g) => g.id !== goal.id));
      toast.success("Goal removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove goal");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-black inline-flex items-center gap-1.5">
          <Target className="h-4 w-4 text-[#a8893a]" />
          Goals this portfolio works toward
        </h3>
        {canEdit && (
          <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add goal
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search goals..." />
                <CommandList>
                  {availableLoading ? (
                    <div className="py-6 flex justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>No goals available to link.</CommandEmpty>
                      <CommandGroup>
                        {available.map((obj) => {
                          const m = GOAL_STATUS_META[obj.status];
                          const isLinking = linkingId === obj.id;
                          return (
                            <CommandItem
                              key={obj.id}
                              value={`${obj.name} ${obj.id}`}
                              onSelect={() => handleLink(obj)}
                              disabled={isLinking}
                              className="flex items-center gap-2"
                            >
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0",
                                  m?.dot
                                )}
                              />
                              <span className="flex-1 truncate">
                                {obj.name}
                              </span>
                              {isLinking ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                              ) : (
                                <Check className="h-3.5 w-3.5 opacity-0" />
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : goals.length === 0 ? (
        <p className="text-xs text-gray-500">
          {canEdit
            ? "No goals linked yet. Use “Add goal” to connect this portfolio to company or team goals."
            : "No goals are linked to this portfolio yet."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {goals.map((goal) => {
            const m = GOAL_STATUS_META[goal.status];
            const isRemoving = removingId === goal.id;
            return (
              <li key={goal.id} className="group">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/goals/${goal.id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-black truncate hover:underline">
                        {goal.name}
                      </span>
                      <Badge className={cn(m?.chip, "text-[10px]")}>
                        {m?.label ?? goal.status}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", m?.bar)}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, goal.progress)
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">
                        {Math.round(goal.progress)}%
                      </span>
                    </div>
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleUnlink(goal)}
                      disabled={isRemoving}
                      aria-label={`Remove ${goal.name}`}
                      className="mt-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50"
                    >
                      {isRemoving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TipCard() {
  return (
    <div className="bg-[#c9a84c]/5 rounded-lg border border-[#c9a84c]/30 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Lightbulb className="h-4 w-4 text-[#a8893a]" />
        <h3 className="text-sm font-medium text-black">Tip</h3>
      </div>
      <p className="text-xs text-gray-700 leading-relaxed">
        When a portfolio changes status, post a clear update so stakeholders
        can understand the reason and what comes next.
      </p>
    </div>
  );
}
