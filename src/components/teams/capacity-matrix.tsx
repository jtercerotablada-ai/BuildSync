"use client";

/**
 * Capacity Matrix — the centerpiece of the team workspace.
 *
 * Rows:    team members (sorted by capacity, busiest first)
 * Columns: the projects this team owns (Project.teamId = thisTeam)
 * Cells:   number of open tasks the member has on that project.
 *          Color scales gold → black with task count, so the
 *          heatmap reads like a real PM "loading chart".
 *
 * The right-most "Σ Load" column sums each member's open tasks and
 * shows them next to a horizontal bar normalized against the
 * busiest member (capacity = 100% for the most loaded person). The
 * bottom row sums per project so you can spot under- or over-
 * staffed projects at a glance.
 *
 * Why this is the differentiator: a Construction / Design firm
 * needs to see WHO IS LOADED on WHAT before approving the next
 * project. Asana / Linear / Monday show you tasks; they don't
 * answer "can we take on Brickell Phase 2 next month?". This does.
 */

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export interface MatrixMember {
  id: string;
  user: { id: string; name: string | null; image: string | null };
  role: string;
  openTasks: number;
  overdueTasks: number;
  capacityPct: number;
  taskByProject: Record<string, number>;
}

export interface MatrixProject {
  id: string;
  name: string;
  color: string;
  gate: string | null;
  projectNumber: string | null;
}

/**
 * Map a raw open-task count to a cell background. We use the team's
 * peak load to pick the scale so the matrix self-calibrates: in a
 * heavy week the same value looks lighter than in a light week.
 */
function heatColor(count: number, peak: number): string {
  if (count === 0) return "transparent";
  const ratio = Math.min(1, count / Math.max(1, peak));
  // 0..0.25 -> light gold
  // 0.25..0.6 -> mid gold
  // 0.6..1.0 -> deep gold / black
  if (ratio < 0.25) return "rgba(201, 168, 76, 0.18)";
  if (ratio < 0.6) return "rgba(201, 168, 76, 0.45)";
  if (ratio < 0.85) return "rgba(168, 137, 58, 0.75)";
  return "rgba(10, 10, 10, 0.85)";
}

function heatTextColor(count: number, peak: number): string {
  const ratio = Math.min(1, count / Math.max(1, peak));
  return ratio >= 0.85 ? "#ffffff" : "#0a0a0a";
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function CapacityMatrix({
  members,
  projects,
  maxOpenPerMember,
}: {
  members: MatrixMember[];
  projects: MatrixProject[];
  maxOpenPerMember: number;
}) {
  if (members.length === 0) {
    return (
      <div className="border border-dashed rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">
          No members on this team yet — add people to see capacity.
        </p>
      </div>
    );
  }

  // Sort members by capacity (busiest first) for a more useful read.
  const sortedMembers = [...members].sort(
    (a, b) => b.capacityPct - a.capacityPct
  );

  // Peak cell value across the matrix (max tasks any single member
  // has on any single project). Drives the heat color scale.
  let peakCell = 1;
  for (const m of members) {
    for (const v of Object.values(m.taskByProject)) {
      if (v > peakCell) peakCell = v;
    }
  }

  // Column totals — sum of open tasks across all members per project.
  const totalsByProject = new Map<string, number>();
  for (const m of members) {
    for (const [pid, count] of Object.entries(m.taskByProject)) {
      totalsByProject.set(pid, (totalsByProject.get(pid) ?? 0) + count);
    }
  }

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-black">
            Capacity matrix
          </h3>
          <p className="text-[11px] text-gray-500">
            Open tasks per member × project. Color = relative load.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ background: "rgba(201, 168, 76, 0.18)" }}
            />
            Light
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ background: "rgba(201, 168, 76, 0.45)" }}
            />
            Moderate
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ background: "rgba(168, 137, 58, 0.75)" }}
            />
            Heavy
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ background: "rgba(10, 10, 10, 0.85)" }}
            />
            Critical
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead className="bg-gray-50/60">
            <tr>
              <th className="sticky left-0 bg-gray-50/60 text-left px-3 py-2 border-b border-r border-gray-200 text-[10px] font-semibold uppercase tracking-wider text-gray-500 min-w-[220px]">
                Member
              </th>
              {projects.map((p) => (
                <th
                  key={p.id}
                  className="px-2 py-2 border-b border-r border-gray-100 text-[10px] font-medium text-gray-600 uppercase tracking-wider text-center align-bottom min-w-[64px]"
                  title={p.name}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="font-mono tabular-nums text-[9px] text-gray-500">
                      {p.projectNumber || p.name.slice(0, 6)}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 border-b border-gray-200 text-[10px] font-semibold uppercase tracking-wider text-gray-500 text-right min-w-[140px]">
                Σ Load
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50/50">
                <td className="sticky left-0 bg-white px-3 py-2 border-b border-r border-gray-100 text-left">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={m.user.image || undefined} />
                      <AvatarFallback className="bg-[#c9a84c] text-white text-[10px]">
                        {initials(m.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-black truncate">
                        {m.user.name || "—"}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                        {m.role.toLowerCase()}
                        {m.overdueTasks > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-black font-semibold">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {m.overdueTasks} overdue
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                {projects.map((p) => {
                  const count = m.taskByProject[p.id] ?? 0;
                  return (
                    <td
                      key={p.id}
                      className="border-b border-r border-gray-100 text-center align-middle"
                      style={{
                        backgroundColor: heatColor(count, peakCell),
                        color: heatTextColor(count, peakCell),
                      }}
                    >
                      <span
                        className={cn(
                          "block text-[12px] tabular-nums font-mono px-2 py-2",
                          count === 0 && "text-gray-300"
                        )}
                      >
                        {count > 0 ? count : "·"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-2 border-b border-gray-100 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex-1 max-w-[80px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          m.capacityPct >= 85
                            ? "bg-black"
                            : m.capacityPct >= 60
                              ? "bg-[#a8893a]"
                              : "bg-[#c9a84c]"
                        )}
                        style={{ width: `${m.capacityPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums font-semibold text-black w-12 text-right">
                      {m.openTasks}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {/* Column totals row */}
            <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
              <td className="sticky left-0 bg-gray-50 px-3 py-2 border-r border-gray-200 text-[10px] uppercase tracking-wider text-gray-500">
                Σ Project load
              </td>
              {projects.map((p) => {
                const total = totalsByProject.get(p.id) ?? 0;
                return (
                  <td
                    key={p.id}
                    className="border-r border-gray-100 text-center text-[12px] font-mono tabular-nums text-gray-700"
                  >
                    {total > 0 ? (
                      <Link
                        href={`/projects/${p.id}`}
                        className="block py-2 hover:bg-white hover:underline"
                      >
                        {total}
                      </Link>
                    ) : (
                      <span className="block py-2 text-gray-300">·</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right text-[12px] font-mono tabular-nums text-black">
                {Array.from(totalsByProject.values()).reduce((a, b) => a + b, 0)}
                <span className="text-[10px] text-gray-400 ml-1">tasks</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {projects.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-gray-500 border-t">
          This team isn't linked to any projects yet. Open a project's
          settings and assign this team to populate the matrix.
        </div>
      )}
    </div>
  );
}
