"use client";

/**
 * /teams/[teamId]/members — Team Members (Asana "Miembros" parity).
 *
 * Matches Asana's members view pixel-for-pixel: a full-width,
 * spreadsheet-style grid (cell borders, Name + Job title columns, a
 * "+" add-field column) under a toolbar of Add member · Filter · Sort ·
 * Search. Role management (make/remove lead, remove) lives on each
 * row's hover menu — the equivalent of Asana's per-member controls.
 * Role / Date-joined are optional columns you switch on via "+".
 */

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  MoreHorizontal,
  Plus,
  Mail,
  Shield,
  UserMinus,
  Loader2,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamHeader } from "@/components/teams/team-header";
import { InviteTeamModal } from "@/components/teams/invite-team-modal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    jobTitle: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  avatar: string | null;
  members: TeamMember[];
}

type SortKey = "name" | "jobTitle" | "role" | "joined";
type SortDir = "asc" | "desc";
type RoleFilter = "all" | "LEAD" | "MEMBER";
type ExtraCol = "role" | "joined";

// Asana-style colored avatars, stable per person.
const AVATAR_COLORS = [
  "#4573d2", "#6457c9", "#8f4bd6", "#c057b8", "#d64b6a",
  "#e07b39", "#3aa35a", "#2aa8a8", "#b8a534", "#5c6a7a",
];
function avatarColor(seed: string): string {
  let s = 0;
  for (const c of seed) s += c.charCodeAt(0);
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email || "?").slice(0, 2).toUpperCase();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function displayName(m: TeamMember): string {
  return m.user.name || m.user.email || "Unknown";
}

export default function TeamMembersPage() {
  const params = useParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [extraCols, setExtraCols] = useState<ExtraCol[]>([]);

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function fetchTeam() {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) setTeam(await res.json());
    } catch (error) {
      console.error("Error fetching team:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Member removed from team");
        fetchTeam();
      } else toast.error("Error removing member");
    } catch {
      toast.error("Error removing member");
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast.success("Role updated");
        fetchTeam();
      } else toast.error("Error updating role");
    } catch {
      toast.error("Error updating role");
    }
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleCol(col: ExtraCol) {
    setExtraCols((cols) =>
      cols.includes(col) ? cols.filter((c) => c !== col) : [...cols, col]
    );
  }

  const rows = useMemo(() => {
    const all = team?.members ?? [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = all.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.user.name?.toLowerCase().includes(q) ||
        m.user.email?.toLowerCase().includes(q) ||
        m.user.jobTitle?.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "name") {
        av = displayName(a).toLowerCase();
        bv = displayName(b).toLowerCase();
      } else if (sortKey === "jobTitle") {
        av = (a.user.jobTitle || "").toLowerCase();
        bv = (b.user.jobTitle || "").toLowerCase();
      } else if (sortKey === "role") {
        av = a.role === "LEAD" ? 0 : 1;
        bv = b.role === "LEAD" ? 0 : 1;
      } else {
        av = new Date(a.joinedAt).getTime();
        bv = new Date(b.joinedAt).getTime();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [team?.members, searchQuery, roleFilter, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!team) return <div className="p-8 text-gray-500">Team not found</div>;

  const totalMembers = team.members.length;
  const showRole = extraCols.includes("role");
  const showJoined = extraCols.includes("joined");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TeamHeader team={team} activeTab="members" />

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInviteModal(true)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add member
        </Button>

        <div className="flex items-center gap-0.5">
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 text-gray-600",
                  roleFilter !== "all" && "text-black"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
                {roleFilter !== "all" && (
                  <span className="text-[11px] text-gray-500">
                    · {roleFilter === "LEAD" ? "Leads" : "Members"}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Role</DropdownMenuLabel>
              {(
                [
                  ["all", "All members"],
                  ["LEAD", "Leads only"],
                  ["MEMBER", "Members only"],
                ] as [RoleFilter, string][]
              ).map(([val, label]) => (
                <DropdownMenuItem
                  key={val}
                  onClick={() => setRoleFilter(val)}
                  className="justify-between"
                >
                  {label}
                  {roleFilter === val && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {(
                [
                  ["name", "Name"],
                  ["jobTitle", "Job title"],
                  ["role", "Role"],
                  ["joined", "Date joined"],
                ] as [SortKey, string][]
              ).map(([val, label]) => (
                <DropdownMenuItem
                  key={val}
                  onClick={() => setSortKey(val)}
                  className="justify-between"
                >
                  {label}
                  {sortKey === val && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="justify-between"
              >
                {sortDir === "asc" ? "Ascending" : "Descending"}
                {sortDir === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search */}
          {showSearch || searchQuery ? (
            <div className="relative ml-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members..."
                className="h-8 w-52 pl-8 pr-7 text-sm"
                autoFocus
                onBlur={() => {
                  if (!searchQuery) setShowSearch(false);
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearch(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500"
              onClick={() => setShowSearch(true)}
              title="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Full-width spreadsheet grid ─────────────────────────── */}
      <div className="border-t">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[46%] min-w-[280px]" />
            <col className="w-[240px]" />
            {showRole && <col className="w-[120px]" />}
            {showJoined && <col className="w-[150px]" />}
            <col className="w-[44px]" />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <ColHeader
                label="Name"
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => toggleSort("name")}
                className="pl-4"
              />
              <ColHeader
                label="Job title"
                active={sortKey === "jobTitle"}
                dir={sortDir}
                onClick={() => toggleSort("jobTitle")}
              />
              {showRole && (
                <ColHeader
                  label="Role"
                  active={sortKey === "role"}
                  dir={sortDir}
                  onClick={() => toggleSort("role")}
                />
              )}
              {showJoined && (
                <ColHeader
                  label="Joined"
                  active={sortKey === "joined"}
                  dir={sortDir}
                  onClick={() => toggleSort("joined")}
                />
              )}
              {/* Add field */}
              <th className="border-r px-1 text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="mx-auto flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                      title="Add field"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>Add field</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => toggleCol("role")}
                      className="justify-between"
                    >
                      Role
                      {showRole && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toggleCol("joined")}
                      className="justify-between"
                    >
                      Date joined
                      {showJoined && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr
                key={member.id}
                className="group border-b hover:bg-gray-50 transition-colors"
              >
                {/* Name */}
                <td className="border-r px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={member.user.image || undefined} />
                      <AvatarFallback
                        className="text-white text-[11px]"
                        style={{
                          backgroundColor: avatarColor(
                            member.user.email || member.user.id
                          ),
                        }}
                      >
                        {getInitials(member.user.name, member.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-gray-900">
                      {displayName(member)}
                    </span>
                  </div>
                </td>

                {/* Job title */}
                <td className="border-r px-3 py-2.5 text-gray-700 truncate">
                  {member.user.jobTitle || ""}
                </td>

                {/* Role (optional) */}
                {showRole && (
                  <td className="border-r px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        member.role === "LEAD"
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {member.role === "LEAD" ? "Lead" : "Member"}
                    </span>
                  </td>
                )}

                {/* Joined (optional) */}
                {showJoined && (
                  <td className="border-r px-3 py-2.5 text-gray-500 tabular-nums">
                    {formatDate(member.joinedAt)}
                  </td>
                )}

                {/* add-field spacer */}
                <td className="border-r" />

                {/* Row actions on hover */}
                <td className="px-2">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            (window.location.href = `/teams/${teamId}/messages`)
                          }
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Send message
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {member.role === "MEMBER" ? (
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(member.id, "LEAD")}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Make lead
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleChangeRole(member.id, "MEMBER")}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Remove as lead
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-black"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove from team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-gray-500">
            {searchQuery || roleFilter !== "all"
              ? "No members match your filters"
              : "No members in this team"}
          </div>
        )}
      </div>

      <p className="px-4 md:px-6 py-3 text-xs text-gray-500">
        {rows.length === totalMembers
          ? `${totalMembers} member${totalMembers !== 1 ? "s" : ""}`
          : `${rows.length} of ${totalMembers} member${
              totalMembers !== 1 ? "s" : ""
            }`}
      </p>

      <InviteTeamModal
        teamId={teamId}
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSent={fetchTeam}
      />
    </div>
  );
}

function ColHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={cn("border-r py-2.5 text-left", className)}>
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 hover:text-gray-800 transition-colors",
          active && "text-gray-800",
          !className && "px-3"
        )}
      >
        {label}
        {active &&
          (dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </th>
  );
}
