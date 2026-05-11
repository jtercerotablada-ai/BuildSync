"use client";

/**
 * Compact PMI rows for the projects this team owns. Reuses the same
 * EVM machinery as /projects/all so the team workspace and the
 * portfolio listing tell the same story.
 */

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Folder, AlertTriangle } from "lucide-react";
import {
  computePmiSnapshot,
  formatCompactCurrency,
  formatIndex,
  healthVisual,
} from "@/lib/pmi-metrics";
import { cn } from "@/lib/utils";

export interface TeamProjectRow {
  id: string;
  name: string;
  color: string;
  projectNumber: string | null;
  status: string;
  gate: string | null;
  budget: number | string | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  owner: { id: string; name: string | null; image: string | null } | null;
  tasks: { id: string; completed: boolean; dueDate?: string | null }[];
  totalTaskCount: number;
}

const GATE_LABEL: Record<string, string> = {
  PRE_DESIGN: "Pre-design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function TeamProjectsPanel({
  projects,
}: {
  projects: TeamProjectRow[];
}) {
  if (projects.length === 0) {
    return (
      <div className="border border-dashed rounded-xl p-8 text-center">
        <Folder className="h-6 w-6 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          No projects assigned to this team yet.
        </p>
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
          Open a project's settings and set "Responsible team" to this team to
          surface it here.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <table className="w-full text-[12px] border-collapse">
        <thead className="bg-gray-50/60 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left border-b border-r border-gray-200 min-w-[260px]">
              Project
            </th>
            <th className="px-3 py-2 text-left border-b border-r border-gray-100 w-[110px]">
              Gate
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[90px]">
              % Comp
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[80px]">
              BAC
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[80px]">
              EAC
            </th>
            <th className="px-2 py-2 text-right border-b border-r border-gray-100 w-[60px]">
              SPI
            </th>
            <th className="px-2 py-2 text-right border-b border-r border-gray-100 w-[60px]">
              CPI
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[80px]">
              Float
            </th>
            <th className="px-3 py-2 text-left border-b border-r border-gray-100 w-[100px]">
              Health
            </th>
            <th className="px-2 py-2 text-center border-b border-gray-100 w-[56px]">
              Owner
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const completed = p.tasks.filter((t) => t.completed).length;
            const pmi = computePmiSnapshot({
              startDate: p.startDate,
              endDate: p.endDate,
              budget: p.budget,
              status: p.status,
              taskCount: p.totalTaskCount,
              completedTaskCount: completed,
            });
            const hv = healthVisual(pmi.health);
            const overdue =
              pmi.floatDays !== null &&
              pmi.floatDays < 0 &&
              p.status !== "COMPLETED";
            const currency = p.currency || "USD";

            return (
              <tr
                key={p.id}
                className="hover:bg-gray-50/50 border-b border-gray-100"
              >
                <td className="px-3 py-2 border-r border-gray-100">
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-2 min-w-0 group"
                  >
                    <div
                      className="w-1.5 h-8 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-black truncate group-hover:underline">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono tabular-nums">
                        {p.projectNumber || "—"}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-2 border-r border-gray-100">
                  <span className="text-[10px] font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                    {p.gate ? GATE_LABEL[p.gate] : "—"}
                  </span>
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-[12px] font-mono tabular-nums font-semibold text-black">
                      {pmi.percentComplete}%
                    </span>
                    <span className="text-[9px] font-mono tabular-nums text-gray-400">
                      /{pmi.percentPlanned}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right font-mono tabular-nums text-[11px] text-gray-700">
                  {formatCompactCurrency(pmi.bac, currency)}
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right font-mono tabular-nums text-[11px]">
                  <span
                    className={cn(
                      pmi.eac > pmi.bac * 1.05 && "text-black font-semibold"
                    )}
                  >
                    {formatCompactCurrency(pmi.eac, currency)}
                  </span>
                </td>
                <td className="px-2 py-2 border-r border-gray-100 text-right">
                  <SpiCpiCell value={pmi.spi} />
                </td>
                <td className="px-2 py-2 border-r border-gray-100 text-right">
                  <SpiCpiCell value={pmi.cpi} />
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right">
                  {pmi.floatDays === null ? (
                    <span className="text-[11px] text-gray-300">—</span>
                  ) : pmi.floatDays < 0 ? (
                    <span className="text-[11px] font-mono tabular-nums font-semibold text-black inline-flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      -{Math.abs(pmi.floatDays)}d
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono tabular-nums text-gray-700">
                      {pmi.floatDays}d
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-gray-100">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: hv.hex, color: hv.textHex }}
                  >
                    {overdue && "▲ "}
                    {hv.label}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  {p.owner ? (
                    <Avatar className="h-6 w-6 mx-auto">
                      <AvatarImage src={p.owner.image || undefined} />
                      <AvatarFallback className="bg-[#c9a84c] text-white text-[10px]">
                        {initials(p.owner.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpiCpiCell({ value }: { value: number }) {
  if (!value || value === 0)
    return <span className="text-[11px] text-gray-300 font-mono">—</span>;
  const formatted = formatIndex(value);
  let color = "text-gray-700";
  let weight = "font-mono";
  if (value >= 1) {
    color = "text-[#a8893a]";
    weight = "font-mono font-semibold";
  } else if (value < 0.85) {
    color = "text-black";
    weight = "font-mono font-bold";
  } else if (value < 0.95) {
    color = "text-black";
    weight = "font-mono font-semibold";
  }
  return (
    <span className={`text-[11px] tabular-nums ${color} ${weight}`}>
      {formatted}
    </span>
  );
}
