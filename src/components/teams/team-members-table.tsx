"use client";

/**
 * Dense, action-rich members table for the team workspace.
 *
 * Columns: Member | Role | Open | Overdue | Done 30d | Projects | Capacity | Joined | Actions
 *
 * The "Capacity" cell is a small horizontal bar (0-100%) normalized
 * against the busiest member, so you can scan who's slammed and who's
 * free without doing arithmetic.
 *
 * Role + Remove are wired to the existing endpoints:
 *   PATCH /api/teams/[teamId]/members  { userId, role }
 *   DELETE /api/teams/[teamId]/members?userId=
 */

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface MemberRow {
  id: string;
  role: string;
  joinedAt: string | Date;
  user: { id: string; name: string | null; email: string | null; image: string | null };
  openTasks: number;
  overdueTasks: number;
  completedLast30Days: number;
  projectsActive: number;
  capacityPct: number;
}

// Team roles per the Prisma TeamRole enum: LEAD (admin) and MEMBER.
// A future schema migration could add VIEWER for read-only audiences.
const ROLES = [
  { value: "LEAD", label: "Lead" },
  { value: "MEMBER", label: "Member" },
] as const;

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamMembersTable({
  teamId,
  members,
  currentUserId,
  onChanged,
}: {
  teamId: string;
  members: MemberRow[];
  currentUserId: string | null;
  onChanged: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function changeRole(userId: string, role: string) {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success("Role updated");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeMember(userId: string, name: string | null) {
    if (
      !confirm(
        `Remove ${name || "this member"} from the team? Their work history stays intact; they just lose team access.`
      )
    )
      return;
    setUpdatingId(userId);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/members?userId=${userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success("Member removed");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove member");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <table className="w-full text-[12px] border-collapse">
        <thead className="bg-gray-50/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left border-b border-r border-gray-200 min-w-[220px]">
              Member
            </th>
            <th className="px-3 py-2 text-left border-b border-r border-gray-100 w-[120px]">
              Role
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[72px]">
              Open
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[80px]">
              Overdue
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[80px]">
              Done 30d
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[80px]">
              Projects
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[160px]">
              Capacity
            </th>
            <th className="px-3 py-2 text-right border-b border-r border-gray-100 w-[110px]">
              Joined
            </th>
            <th className="px-2 py-2 text-center border-b border-gray-100 w-[56px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isUpdating = updatingId === m.user.id;
            const isSelf = currentUserId === m.user.id;
            return (
              <tr key={m.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                <td className="px-3 py-2 border-r border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={m.user.image || undefined} />
                      <AvatarFallback className="bg-[#c9a84c] text-white text-[11px]">
                        {initials(m.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-black truncate">
                        {m.user.name || "—"}
                        {isSelf && (
                          <span className="ml-1.5 text-[10px] text-gray-400 font-normal">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {m.user.email || "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 border-r border-gray-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider text-gray-700 bg-gray-100 hover:bg-gray-200"
                      >
                        {m.role === "LEAD" && (
                          <ShieldCheck className="h-3 w-3 text-[#c9a84c]" />
                        )}
                        {m.role.toLowerCase()}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {ROLES.map((r) => (
                        <DropdownMenuItem
                          key={r.value}
                          onClick={() => changeRole(m.user.id, r.value)}
                          disabled={r.value === m.role}
                        >
                          {r.value === "LEAD" && (
                            <ShieldCheck className="h-3.5 w-3.5 mr-2 text-[#c9a84c]" />
                          )}
                          {r.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right font-mono tabular-nums text-[12px] text-gray-700">
                  {m.openTasks}
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right font-mono tabular-nums text-[12px]">
                  {m.overdueTasks > 0 ? (
                    <span className="inline-flex items-center gap-1 text-black font-semibold">
                      <AlertTriangle className="h-3 w-3" />
                      {m.overdueTasks}
                    </span>
                  ) : (
                    <span className="text-gray-300">·</span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right font-mono tabular-nums text-[12px] text-gray-700">
                  {m.completedLast30Days}
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right font-mono tabular-nums text-[12px] text-gray-700">
                  {m.projectsActive}
                </td>
                <td className="px-3 py-2 border-r border-gray-100">
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex-1 max-w-[90px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full",
                          m.capacityPct >= 85
                            ? "bg-black"
                            : m.capacityPct >= 60
                              ? "bg-[#a8893a]"
                              : "bg-[#c9a84c]"
                        )}
                        style={{ width: `${m.capacityPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-gray-700 w-9 text-right">
                      {m.capacityPct}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 border-r border-gray-100 text-right text-[11px] text-gray-500 font-mono tabular-nums">
                  {new Date(m.joinedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })}
                </td>
                <td className="px-2 py-2 text-center">
                  {isUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 mx-auto" />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-black"
                          onClick={() => removeMember(m.user.id, m.user.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Remove from team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
