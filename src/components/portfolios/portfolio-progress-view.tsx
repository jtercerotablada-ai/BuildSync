"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

interface Props {
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
  { label: string; dot: string; chip: string }
> = {
  ON_TRACK: {
    label: "On track",
    dot: "bg-[#c9a84c]",
    chip: "bg-[#c9a84c]/15 text-[#a8893a]",
  },
  AT_RISK: {
    label: "At risk",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
  },
  OFF_TRACK: {
    label: "Off track",
    dot: "bg-black",
    chip: "bg-gray-100 text-black",
  },
  ON_HOLD: {
    label: "On hold",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-700",
  },
  COMPLETE: {
    label: "Complete",
    dot: "bg-[#a8893a]",
    chip: "bg-[#a8893a]/15 text-[#a8893a]",
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

export function PortfolioProgressView({
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

  return (
    <div className="space-y-4">
      {/* Top counts row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CountCard label="Projects in progress" value={inProgress} />
        <CountCard label="Projects at risk" value={atRisk} accent={atRisk > 0} />
        <CountCard
          label="Projects off track"
          value={offTrack}
          accent={offTrack > 0}
        />
        <CountCard label="Projects total" value={total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Updates feed (left, 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Post update */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-black mb-3">
              Post a portfolio status update
            </h3>
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
                          <div className={cn("w-2 h-2 rounded-full", m.dot)} />
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
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              placeholder="What's the current state of this portfolio? Wins, blockers, what's next..."
              rows={3}
              className="text-sm"
            />
            <div className="flex justify-end mt-2">
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

          {/* Feed */}
          <div className="bg-white rounded-lg border divide-y">
            <div className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Latest updates
            </div>
            {updatesLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : updates.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No status updates yet. Post the first one above to keep your
                team in the loop.
              </div>
            ) : (
              updates.map((u) => {
                const m = STATUS_META[u.status];
                return (
                  <div key={u.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.author?.image || ""} />
                        <AvatarFallback className="text-xs bg-gray-200">
                          {u.author?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-black">
                            {u.author?.name || "Unknown"}
                          </span>
                          <Badge className={cn(m.chip, "text-xs")}>
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full mr-1",
                                m.dot
                              )}
                            />
                            {m.label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {timeAgo(u.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                          {u.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* About panel (right, 1 col) */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-black mb-2">
              About this portfolio
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Updates here drive the portfolio status badge. Post regular
              check-ins so stakeholders can see direction without opening every
              project.
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-black mb-1">Tip</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              When a portfolio drifts to <strong>At risk</strong>, the badge
              propagates here. Posting a clear next step keeps the team aligned.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CountCard({
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
        "rounded-lg border bg-white p-3 md:p-4 text-center",
        accent && "border-[#a8893a]/50 bg-[#a8893a]/5"
      )}
    >
      <div className="text-3xl md:text-4xl font-semibold text-black tabular-nums">
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
