"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Target, ChevronDown, ChevronRight, Network, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusOption } from "@/lib/goal-utils";
import type { ViewObjective } from "./types";

/**
 * Tree / strategy-map view — vertical hierarchy. Top-level goals
 * (parentId null) render as cards; clicking the chevron lazy-loads
 * deeper children via /api/objectives?parentId=<id> so the tree can
 * go arbitrarily deep (Asana / Linear / Monday all cap at 2-3 levels
 * but we don't have to).
 *
 * The first level of children comes from the listing's `children`
 * array; deeper levels require a fetch since the listing endpoint
 * only returns one generation.
 */

interface ChildNode {
  id: string;
  name: string;
  status: string;
  progress: number;
}

export function GoalsTreeView({
  objectives,
}: {
  objectives: ViewObjective[];
}) {
  const topLevel = objectives.filter((o) => !o.parentId);

  if (topLevel.length === 0) {
    return (
      <div className="p-12 text-center">
        <Network className="h-8 w-8 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">
          Create a top-level goal to start building your strategy map.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {topLevel.map((parent) => (
        <TreeRow key={parent.id} objective={parent} level={0} />
      ))}
    </div>
  );
}

/**
 * Recursive tree row. Renders the objective at `level` indent, plus
 * an expandable subtree of children. Sub-children below the depth
 * carried in the listing payload are fetched lazily on expand.
 */
function TreeRow({
  objective,
  level,
}: {
  objective: ViewObjective | ChildNode;
  level: number;
}) {
  const [expanded, setExpanded] = useState(level === 0); // root open by default
  const [children, setChildren] = useState<ChildNode[] | null>(
    "children" in objective ? objective.children : null
  );
  const [loading, setLoading] = useState(false);

  const statusOption = getStatusOption(objective.status);

  async function ensureChildren() {
    if (children !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/objectives?parentId=${objective.id}`);
      if (res.ok) {
        const data = (await res.json()) as ChildNode[];
        setChildren(
          data.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            progress: c.progress,
          }))
        );
      } else {
        setChildren([]);
      }
    } catch {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }

  // Decide whether to render an expand chevron at all. For first-level
  // nodes we know from `_count.children` if applicable; otherwise we
  // optimistically show it and the user can find out.
  const hasMaybeChildren =
    ("_count" in objective && objective._count.children > 0) ||
    (children !== null && children.length > 0) ||
    !("children" in objective); // lazy nodes: don't know yet

  return (
    <div
      className={cn(
        "border rounded-xl bg-white",
        level === 0 ? "p-4" : "p-3"
      )}
      style={{ marginLeft: level > 0 ? Math.min(level, 3) * 12 : undefined }}
    >
      <div className="flex items-center gap-2 mb-2">
        {hasMaybeChildren ? (
          <button
            onClick={() => {
              setExpanded((v) => !v);
              ensureChildren();
            }}
            className="p-0.5 text-gray-400 hover:text-black flex-shrink-0"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <Target
          className={cn(
            "flex-shrink-0",
            level === 0 ? "h-4 w-4 text-[#c9a84c]" : "h-3 w-3 text-gray-400"
          )}
        />

        <Link
          href={`/goals/${objective.id}`}
          className="text-sm font-medium text-black hover:underline truncate flex-1 min-w-0"
        >
          {objective.name}
        </Link>

        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0",
            statusOption.color,
            statusOption.color.includes("gray-3")
              ? "text-gray-700"
              : "text-white"
          )}
        >
          {statusOption.label.toLowerCase()}
        </span>

        <span className="text-xs text-gray-500 tabular-nums flex-shrink-0 w-12 text-right">
          {objective.progress}%
        </span>
      </div>

      {/* Progress bar — only for top-level cards so the tree stays light */}
      {level === 0 && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2 ml-6">
          <div
            className="h-full bg-[#c9a84c]"
            style={{ width: `${objective.progress}%` }}
          />
        </div>
      )}

      {/* Owner badge on top-level only */}
      {level === 0 && "owner" in objective && (
        <div className="mt-2 ml-6 flex items-center gap-2 text-[11px] text-gray-500">
          <Avatar className="h-4 w-4">
            <AvatarImage src={objective.owner.image || undefined} />
            <AvatarFallback className="bg-[#c9a84c] text-white text-[8px]">
              {(objective.owner.name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{objective.owner.name || "—"}</span>
          {"period" in objective && objective.period && (
            <span>· {objective.period}</span>
          )}
        </div>
      )}

      {/* Children */}
      {expanded && (
        <div className="mt-3 pl-6 border-l-2 border-gray-100 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading sub-goals…
            </div>
          ) : children === null || children.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-1">
              No sub-goals yet.
            </p>
          ) : (
            children.map((c) => (
              <TreeRow key={c.id} objective={c} level={level + 1} />
            ))
          )}

          {/* Show KRs as leaf indicators only on the top-level node */}
          {level === 0 && "keyResults" in objective && objective.keyResults.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">
                Key results
              </p>
              <div className="space-y-1">
                {objective.keyResults.map((kr) => {
                  const range = kr.targetValue - kr.startValue;
                  const pct =
                    range === 0
                      ? kr.currentValue >= kr.targetValue
                        ? 100
                        : 0
                      : Math.min(
                          100,
                          Math.max(
                            0,
                            ((kr.currentValue - kr.startValue) / range) * 100
                          )
                        );
                  return (
                    <div
                      key={kr.id}
                      className="flex items-center gap-2 py-0.5 text-xs"
                    >
                      <Target className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-gray-600 truncate">
                        {kr.name}
                      </span>
                      <span className="text-gray-500 tabular-nums w-10 text-right">
                        {Math.round(pct)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
