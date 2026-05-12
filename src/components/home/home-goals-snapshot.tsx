"use client";

/**
 * Goals snapshot — top 4 OKRs sorted by progress. Pulls
 * /api/objectives client-side. Each card links to the goal detail.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Objective {
  id: string;
  name: string;
  status: string;
  progress: number;
  confidenceScore?: number | null;
  period: string | null;
}

export function HomeGoalsSnapshot() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    fetch("/api/objectives?parentId=null")
      .then((r) => r.json())
      .then((data) => {
        if (canceled) return;
        const list = Array.isArray(data) ? data : [];
        // Sort: at-risk first, then by progress ascending (so things
        // needing attention bubble up).
        list.sort((a, b) => {
          const aw = a.status === "AT_RISK" || a.status === "OFF_TRACK" ? 0 : 1;
          const bw = b.status === "AT_RISK" || b.status === "OFF_TRACK" ? 0 : 1;
          if (aw !== bw) return aw - bw;
          return a.progress - b.progress;
        });
        setObjectives(list.slice(0, 4));
      })
      .catch(() => setObjectives([]))
      .finally(() => !canceled && setLoading(false));
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-black leading-tight">
            Goals
          </h3>
          <p className="text-[11px] text-gray-500">
            Top OKRs · attention first
          </p>
        </div>
        <Link
          href="/goals"
          className="text-[11px] text-gray-500 hover:text-black inline-flex items-center gap-0.5"
        >
          All <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : objectives.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <Target className="h-6 w-6 text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 max-w-[240px]">
            No goals yet. Define quarterly OKRs to surface them here.
          </p>
          <Link
            href="/goals"
            className="text-[11px] text-black underline mt-1"
          >
            Open Goals
          </Link>
        </div>
      ) : (
        <ul className="divide-y">
          {objectives.map((o) => {
            const onTrack = o.status === "ON_TRACK" || o.status === "ACHIEVED";
            return (
              <li key={o.id}>
                <Link
                  href={`/goals/${o.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <Target
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0",
                      onTrack ? "text-[#c9a84c]" : "text-black"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-black truncate">
                      {o.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[180px]">
                        <div
                          className={cn(
                            "h-full",
                            onTrack ? "bg-[#c9a84c]" : "bg-black"
                          )}
                          style={{ width: `${o.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-gray-600 w-8 text-right">
                        {o.progress}%
                      </span>
                      {o.confidenceScore && (
                        <span
                          className="text-[10px] font-mono tabular-nums px-1 py-0.5 rounded bg-gray-100 text-gray-600"
                          title={`Owner confidence ${o.confidenceScore}/10`}
                        >
                          {o.confidenceScore}/10
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
