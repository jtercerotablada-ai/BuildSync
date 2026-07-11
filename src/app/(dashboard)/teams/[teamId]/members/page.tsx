"use client";

/**
 * /teams/[teamId]/members — Team Members (Asana "Miembros" parity).
 *
 * Full-width spreadsheet grid: toolbar (Add member · Filter · Sort ·
 * Search) over Name + Job title columns, any number of custom fields,
 * and an Asana-style "Add field" (+) supporting all seven field types
 * (single/multi select · date · people · reference · text · number).
 * Field values are editable per member and persist server-side. Role
 * management (make/remove lead, remove) lives on each row's hover menu.
 */

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
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
  Trash2,
  Pencil,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { AddFieldFlow } from "@/components/teams/add-field-flow";
import {
  TeamFieldCell,
  type TeamFieldDef,
} from "@/components/teams/team-field-cell";
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

interface FieldValueRow {
  fieldId: string;
  teamMemberId: string;
  value: unknown;
}

type SortKey = "name" | "jobTitle";
type SortDir = "asc" | "desc";
type RoleFilter = "all" | "LEAD" | "MEMBER";

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

function displayName(m: TeamMember): string {
  return m.user.name || m.user.email || "Unknown";
}

export default function TeamMembersPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const { data: session } = useSession();
  const currentUserId =
    (session?.user as { id?: string } | undefined)?.id || null;

  const [team, setTeam] = useState<Team | null>(null);
  const [fields, setFields] = useState<TeamFieldDef[]>([]);
  const [values, setValues] = useState<FieldValueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function loadAll() {
    try {
      const [tRes, fRes] = await Promise.all([
        fetch(`/api/teams/${teamId}`),
        fetch(`/api/teams/${teamId}/fields`),
      ]);
      if (tRes.ok) setTeam(await tRes.json());
      if (fRes.ok) {
        const data = await fRes.json();
        setFields(data.fields || []);
        setValues(data.values || []);
      }
    } catch (error) {
      console.error("Error fetching team:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function refetchFields() {
    const res = await fetch(`/api/teams/${teamId}/fields`);
    if (res.ok) {
      const data = await res.json();
      setFields(data.fields || []);
      setValues(data.values || []);
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Member removed from team");
        loadAll();
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
        loadAll();
      } else toast.error("Error updating role");
    } catch {
      toast.error("Error updating role");
    }
  };

  async function handleCreateField(field: {
    title: string;
    type: string;
    description?: string;
    options?: Array<{ id: string; name: string; color: string }>;
    referenceSource?: string;
    numberFormat?: string;
    decimals?: number;
  }) {
    try {
      const res = await fetch(`/api/teams/${teamId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success("Field added");
      refetchFields();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add field");
    }
  }

  async function handleDeleteField(fieldId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}/fields/${fieldId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success("Field deleted");
      refetchFields();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete field");
    }
  }

  async function handleRenameField() {
    if (!renameTarget) return;
    const name = renameDraft.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/teams/${teamId}/fields/${renameTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success("Field renamed");
      setRenameTarget(null);
      refetchFields();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename field");
    }
  }

  async function handleSaveValue(
    fieldId: string,
    teamMemberId: string,
    value: unknown
  ) {
    // Optimistic update
    setValues((prev) => {
      const others = prev.filter(
        (v) => !(v.fieldId === fieldId && v.teamMemberId === teamMemberId)
      );
      const isEmpty =
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);
      return isEmpty ? others : [...others, { fieldId, teamMemberId, value }];
    });
    try {
      const res = await fetch(
        `/api/teams/${teamId}/fields/${fieldId}/value`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamMemberId, value }),
        }
      );
      if (!res.ok) throw new Error("Failed");
    } catch {
      toast.error("Couldn't save — reverting");
      refetchFields();
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const myMembership = currentUserId
    ? team?.members.find((m) => m.user.id === currentUserId)
    : undefined;
  const isLead = myMembership?.role === "LEAD";
  const isMember = !!myMembership;

  const valueMap = useMemo(() => {
    const m: Record<string, Record<string, unknown>> = {};
    for (const v of values) {
      (m[v.teamMemberId] ||= {})[v.fieldId] = v.value;
    }
    return m;
  }, [values]);

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
      const av =
        sortKey === "name"
          ? displayName(a).toLowerCase()
          : (a.user.jobTitle || "").toLowerCase();
      const bv =
        sortKey === "name"
          ? displayName(b).toLowerCase()
          : (b.user.jobTitle || "").toLowerCase();
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
      <div className="border-t overflow-x-auto">
        <table className="w-full table-fixed text-sm min-w-[720px]">
          <colgroup>
            <col className="w-[300px] min-w-[240px]" />
            <col className="w-[220px]" />
            {fields.map((f) => (
              <col key={f.id} className="w-[180px]" />
            ))}
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
              {/* Custom field headers */}
              {fields.map((f) => (
                <th
                  key={f.id}
                  className="border-r px-3 py-2.5 text-left font-semibold"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate normal-case tracking-normal text-gray-600">
                      {f.name}
                    </span>
                    {isLead && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="opacity-40 hover:opacity-100 flex-shrink-0">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget({ id: f.id, name: f.name });
                              setRenameDraft(f.name);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename field
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-black"
                            onClick={() => handleDeleteField(f.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete field
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </th>
              ))}
              {/* Add field (+) — Asana's 7-type picker (lead-only) */}
              <th className="border-r px-1 text-center">
                {isLead ? (
                  <AddFieldFlow
                    onCreateField={handleCreateField}
                    organizationName={team.name}
                  />
                ) : null}
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
                    {member.role === "LEAD" && (
                      <span className="flex-shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        Lead
                      </span>
                    )}
                  </div>
                </td>

                {/* Job title */}
                <td className="border-r px-3 py-2.5 text-gray-700 truncate">
                  {member.user.jobTitle || ""}
                </td>

                {/* Custom field cells */}
                {fields.map((f) => (
                  <td key={f.id} className="border-r px-2 py-1.5 align-middle">
                    <TeamFieldCell
                      field={f}
                      value={valueMap[member.id]?.[f.id] ?? null}
                      canEdit={isMember}
                      onSave={(v) => handleSaveValue(f.id, member.id, v)}
                    />
                  </td>
                ))}

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
        onInviteSent={loadAll}
      />

      {/* Rename field dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename field</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameField();
            }}
            placeholder="Field name"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameField}
              disabled={!renameDraft.trim()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
