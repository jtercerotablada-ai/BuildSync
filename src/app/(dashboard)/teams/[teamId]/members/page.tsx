"use client";

/**
 * /teams/[teamId]/members — Team Members (Asana "Miembros" parity).
 *
 * Asana renders team members as a spreadsheet-style grid: a toolbar
 * (Add member · Filter · Sort · Search) over a sortable table with
 * Name + Job title columns. BuildSync mirrors that here and keeps its
 * role management (make/remove lead, remove from team) on each row —
 * the equivalent of Asana's per-member controls.
 */

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  MoreHorizontal,
  UserPlus,
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
import { Badge } from "@/components/ui/badge";
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

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function fetchTeam() {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      }
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
      } else {
        toast.error("Error removing member");
      }
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
      } else {
        toast.error("Error updating role");
      }
    } catch {
      toast.error("Error updating role");
    }
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
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
        // Leads first when ascending
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

  if (!team) {
    return <div className="p-8 text-gray-500">Team not found</div>;
  }

  const totalMembers = team.members.length;

  return (
    <div className="min-h-screen bg-white">
      <TeamHeader team={team} activeTab="members" />

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* ── Toolbar (Asana: Add member · Filter · Sort · Search) ── */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => setShowInviteModal(true)}
              className="gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add member
            </Button>

            {/* Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-1.5 text-gray-600",
                    roleFilter !== "all" && "text-black bg-gray-100"
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filter
                  {roleFilter !== "all" && (
                    <span className="text-[11px] text-gray-500">
                      ({roleFilter === "LEAD" ? "Leads" : "Members"})
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
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
              <DropdownMenuContent align="start" className="w-48">
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
                  onClick={() =>
                    setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                  }
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
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            {showSearch || searchQuery ? (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  className="h-8 w-56 pl-8 pr-8 text-sm"
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
                size="sm"
                className="gap-1.5 text-gray-600"
                onClick={() => setShowSearch(true)}
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </Button>
            )}
          </div>
        </div>

        {/* ── Grid (sortable columns) ─────────────────────────────── */}
        <div className="border rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)_110px_130px_40px] items-center bg-gray-50 border-b text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <SortHeader
              label="Name"
              active={sortKey === "name"}
              dir={sortDir}
              onClick={() => toggleSort("name")}
              className="px-4 py-2.5"
            />
            <SortHeader
              label="Job title"
              active={sortKey === "jobTitle"}
              dir={sortDir}
              onClick={() => toggleSort("jobTitle")}
              className="px-3 py-2.5"
            />
            <SortHeader
              label="Role"
              active={sortKey === "role"}
              dir={sortDir}
              onClick={() => toggleSort("role")}
              className="px-3 py-2.5"
            />
            <SortHeader
              label="Joined"
              active={sortKey === "joined"}
              dir={sortDir}
              onClick={() => toggleSort("joined")}
              className="px-3 py-2.5"
            />
            <div />
          </div>

          {/* Rows */}
          {rows.map((member) => (
            <div
              key={member.id}
              className="group grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)_110px_130px_40px] items-center border-b last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              {/* Name */}
              <div className="px-4 py-2.5 flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback className="bg-gray-100 text-black text-xs">
                    {getInitials(member.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.user.name || "No name"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {member.user.email}
                  </p>
                </div>
              </div>

              {/* Job title */}
              <div className="px-3 py-2.5 text-sm text-gray-700 truncate">
                {member.user.jobTitle || (
                  <span className="text-gray-300">—</span>
                )}
              </div>

              {/* Role */}
              <div className="px-3 py-2.5">
                <Badge
                  variant={member.role === "LEAD" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {member.role === "LEAD" ? "Lead" : "Member"}
                </Badge>
              </div>

              {/* Joined */}
              <div className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">
                {formatDate(member.joinedAt)}
              </div>

              {/* Actions */}
              <div className="px-1 py-2.5 flex justify-center">
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
            </div>
          ))}

          {rows.length === 0 && (
            <div className="p-10 text-center text-sm text-gray-500">
              {searchQuery || roleFilter !== "all"
                ? "No members match your filters"
                : "No members in this team"}
            </div>
          )}
        </div>

        {/* Footer count */}
        <p className="mt-3 text-xs text-gray-500">
          {rows.length === totalMembers
            ? `${totalMembers} member${totalMembers !== 1 ? "s" : ""}`
            : `${rows.length} of ${totalMembers} member${
                totalMembers !== 1 ? "s" : ""
              }`}
        </p>
      </div>

      <InviteTeamModal
        teamId={teamId}
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSent={fetchTeam}
      />
    </div>
  );
}

function SortHeader({
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
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-left hover:text-gray-800 transition-colors",
        active && "text-gray-800",
        className
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
      )}
    </button>
  );
}
