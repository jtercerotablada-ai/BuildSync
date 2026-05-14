"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Search,
  Crown,
  Shield,
  User as UserIcon,
  ChevronDown,
  Loader2,
  Pencil,
  X,
  Check,
  Filter,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  POSITION_META,
  POSITION_ORDER,
  WORKSPACE_ROLE_META,
  type Position,
  type WorkspaceRole,
} from "@/lib/people-types";

/**
 * People Directory — workspace-wide org chart.
 *
 * One row per WorkspaceMember. Search by name/email/position, filter
 * by workspace role + position group, edit individual profiles
 * inline (subject to permission). Owner/admin can change anyone's
 * position + workspace role; everyone else can only edit their own.
 *
 * Data shape comes from /api/team/directory which also returns the
 * caller's WorkspaceRole so we can drive the permission gates here.
 */

interface DirectoryRow {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  jobTitle: string | null;
  position: Position | null;
  customTitle: string | null;
  department: string | null;
  bio: string | null;
  workspaceRole: WorkspaceRole;
  joinedAt: string;
  projectCount: number;
  isMe: boolean;
}

type PositionFilter = "ALL" | Position;
type RoleFilter = "ALL" | WorkspaceRole;

export default function PeopleDirectoryPage() {
  const [members, setMembers] = useState<DirectoryRow[]>([]);
  const [callerRole, setCallerRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [editTarget, setEditTarget] = useState<DirectoryRow | null>(null);

  const fetchDirectory = useCallback(async () => {
    try {
      const res = await fetch("/api/team/directory");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMembers(data.members || []);
      setCallerRole(data.callerRole || null);
    } catch {
      toast.error("Couldn't load directory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (positionFilter !== "ALL" && m.position !== positionFilter)
        return false;
      if (roleFilter !== "ALL" && m.workspaceRole !== roleFilter) return false;
      if (!q) return true;
      const name = (m.name || "").toLowerCase();
      const email = (m.email || "").toLowerCase();
      const positionLabel = m.position
        ? POSITION_META[m.position]?.label.toLowerCase() || ""
        : "";
      const custom = (m.customTitle || "").toLowerCase();
      const dept = (m.department || "").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        positionLabel.includes(q) ||
        custom.includes(q) ||
        dept.includes(q)
      );
    });
  }, [members, query, positionFilter, roleFilter]);

  // Sort: workspace OWNER first, then ADMIN, then by position group
  // order, then alphabetical by name.
  const sorted = useMemo(() => {
    const roleOrder: Record<WorkspaceRole, number> = {
      OWNER: 0,
      ADMIN: 1,
      MEMBER: 2,
      WORKER: 3,
      GUEST: 4,
    };
    return [...filtered].sort((a, b) => {
      const r = roleOrder[a.workspaceRole] - roleOrder[b.workspaceRole];
      if (r !== 0) return r;
      const pa = a.position ? POSITION_ORDER.indexOf(a.position) : 999;
      const pb = b.position ? POSITION_ORDER.indexOf(b.position) : 999;
      if (pa !== pb) return pa - pb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [filtered]);

  const canEditAnyone = callerRole === "OWNER" || callerRole === "ADMIN";

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* Header */}
      <div className="border-b px-6 md:px-8 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-[-0.01em]">
              People
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Your firm’s directory · {members.length}{" "}
              {members.length === 1 ? "person" : "people"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Email invitations coming next"
          >
            + Invite
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b px-6 md:px-8 py-3 flex items-center gap-3 flex-wrap bg-slate-50/50">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, position…"
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md outline-none focus:border-[#c9a84c] bg-white"
          />
        </div>

        <FilterPill
          label="Position"
          value={positionFilter === "ALL" ? "All" : POSITION_META[positionFilter].short}
          icon={Filter}
        >
          <DropdownMenuItem onClick={() => setPositionFilter("ALL")}>
            All positions
          </DropdownMenuItem>
          {POSITION_ORDER.map((p) => (
            <DropdownMenuItem key={p} onClick={() => setPositionFilter(p)}>
              {POSITION_META[p].label}
            </DropdownMenuItem>
          ))}
        </FilterPill>

        <FilterPill
          label="Workspace role"
          value={roleFilter === "ALL" ? "All" : WORKSPACE_ROLE_META[roleFilter].label}
          icon={Shield}
        >
          <DropdownMenuItem onClick={() => setRoleFilter("ALL")}>
            All roles
          </DropdownMenuItem>
          {(["OWNER", "ADMIN", "MEMBER", "WORKER", "GUEST"] as WorkspaceRole[]).map(
            (r) => (
              <DropdownMenuItem key={r} onClick={() => setRoleFilter(r)}>
                {WORKSPACE_ROLE_META[r].label}
              </DropdownMenuItem>
            )
          )}
        </FilterPill>

        {(positionFilter !== "ALL" || roleFilter !== "ALL" || query) && (
          <button
            onClick={() => {
              setPositionFilter("ALL");
              setRoleFilter("ALL");
              setQuery("");
            }}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-1">
            {sorted.map((m) => (
              <PersonRow
                key={m.id}
                row={m}
                canEdit={canEditAnyone || m.isMe}
                canChangeRole={callerRole === "OWNER" && !m.isMe}
                onEdit={() => setEditTarget(m)}
              />
            ))}
          </div>
        )}
      </div>

      {editTarget && (
        <EditPersonDialog
          row={editTarget}
          callerRole={callerRole}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            fetchDirectory();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  value,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <Icon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">{label}:</span>
          <span className="text-slate-900">{value}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[400px] overflow-auto"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonRow({
  row,
  canEdit,
  canChangeRole: _canChangeRole,
  onEdit,
}: {
  row: DirectoryRow;
  canEdit: boolean;
  canChangeRole: boolean;
  onEdit: () => void;
}) {
  const positionLabel = row.position
    ? row.position === "OTHER"
      ? row.customTitle || "Other"
      : POSITION_META[row.position]?.label
    : row.jobTitle || "—";

  const roleMeta = WORKSPACE_ROLE_META[row.workspaceRole];
  const initials = (row.name || row.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="group flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={row.image || ""} />
        <AvatarFallback className="text-xs bg-[#d4b65a] text-white">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900 truncate">
            {row.name || "—"}
          </span>
          {row.isMe && (
            <span className="text-[10px] uppercase tracking-wider text-[#a8893a] font-medium">
              You
            </span>
          )}
          {row.workspaceRole === "OWNER" && (
            <span
              title="Workspace owner"
              className="inline-flex items-center gap-0.5 text-[10px] text-[#a8893a] font-medium uppercase tracking-wider"
            >
              <Crown className="w-3 h-3" />
              Owner
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">
          {row.email}
          {row.department && (
            <span className="text-slate-400"> · {row.department}</span>
          )}
        </p>
      </div>

      <div className="hidden md:block text-xs text-slate-600 min-w-[180px] text-right">
        {positionLabel}
      </div>

      <span
        className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
        style={{
          backgroundColor: `${roleMeta.color}1A`,
          color: roleMeta.color,
        }}
      >
        {roleMeta.label}
      </span>

      <span className="hidden md:block text-[11px] text-slate-400 tabular-nums min-w-[80px] text-right">
        {row.projectCount} {row.projectCount === 1 ? "project" : "projects"}
      </span>

      {canEdit && (
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          title="Edit profile"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-[#c9a84c]/10 flex items-center justify-center mb-4">
        <Users className="w-6 h-6 text-[#a8893a]" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        No one here yet
      </h3>
      <p className="text-sm text-slate-500 max-w-md">
        Invite people to your firm’s workspace. They’ll show up here with
        their position and project history.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Edit dialog
// ──────────────────────────────────────────────────────────────

function EditPersonDialog({
  row,
  callerRole,
  onClose,
  onSaved,
}: {
  row: DirectoryRow;
  callerRole: WorkspaceRole | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [position, setPosition] = useState<Position | "">(row.position || "");
  const [customTitle, setCustomTitle] = useState(row.customTitle || "");
  const [department, setDepartment] = useState(row.department || "");
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>(
    row.workspaceRole
  );
  const [saving, setSaving] = useState(false);

  const canChangeRole = callerRole === "OWNER" && !row.isMe;

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        userId: row.id,
        position: position || null,
        customTitle: position === "OTHER" ? customTitle || null : null,
        department: department || null,
      };
      if (canChangeRole && workspaceRole !== row.workspaceRole) {
        body.workspaceRole = workspaceRole;
      }
      const res = await fetch("/api/team/directory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save");
      }
      toast.success("Profile updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={row.image || ""} />
              <AvatarFallback className="text-[10px] bg-[#d4b65a] text-white">
                {(row.name || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>Edit {row.name || "person"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Position
            </label>
            <Select
              value={position || "_NONE"}
              onValueChange={(v) =>
                setPosition(v === "_NONE" ? "" : (v as Position))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pick a position…" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="_NONE">— None —</SelectItem>
                {POSITION_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {POSITION_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {position === "OTHER" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Custom title
              </label>
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. BIM Coordinator"
                className="w-full px-3 py-1.5 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
                maxLength={120}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Department
            </label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Structural · Civil · Office"
              className="w-full px-3 py-1.5 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
              maxLength={80}
            />
          </div>

          {canChangeRole && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Workspace role
              </label>
              <Select
                value={workspaceRole}
                onValueChange={(v) => setWorkspaceRole(v as WorkspaceRole)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ["ADMIN", "MEMBER", "WORKER", "GUEST"] as WorkspaceRole[]
                  ).map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="font-medium">
                        {WORKSPACE_ROLE_META[r].label}
                      </span>
                      <span className="text-slate-500 text-[11px] ml-2">
                        {WORKSPACE_ROLE_META[r].description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                To transfer Owner, use the workspace settings page (coming
                soon).
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving}
            className="bg-black hover:bg-gray-900 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Saving…
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
