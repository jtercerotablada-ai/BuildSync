"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2,
  Plus,
  Loader2,
  Crown,
  MoreHorizontal,
  Trash2,
  Pencil,
  X,
  UserPlus,
  Star,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  COMPANY_ROLE_META,
  COMPANY_ROLE_ORDER,
  PROJECT_ROLE_META,
  POSITION_META,
  type CompanyRole,
  type ProjectRole,
  type Position,
} from "@/lib/people-types";

/**
 * Project Team view — shows every firm participating in this project,
 * grouped as cards. Each card lists that firm's members (people from
 * that firm working on this project) with their per-project role.
 *
 * The host firm (isOwn=true) renders first with a gold "YOU" badge.
 * Add Company / Add Member buttons are gated by the project's write
 * permission (Owner or Admin).
 */

interface ProjectMemberRow {
  id: string;
  userId: string;
  projectRole: ProjectRole;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    jobTitle: string | null;
    position: Position | null;
    customTitle: string | null;
  };
}

interface CompanyRow {
  id: string;
  name: string;
  role: CompanyRole;
  logoUrl: string | null;
  domain: string | null;
  isOwn: boolean;
  linkedWorkspaceId: string | null;
  createdAt: string;
  members: ProjectMemberRow[];
}

interface WorkspaceMemberLite {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  position: Position | null;
  customTitle: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  // The project's owner — rendered as a special crown row regardless
  // of company assignment.
  projectOwner?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

export function ProjectTeamView({
  projectId,
  projectName,
  projectOwner,
}: Props) {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<CompanyRow | null>(null);
  const [addMemberFor, setAddMemberFor] = useState<CompanyRow | null>(null);

  // Workspace directory for the Add Member search.
  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceMemberLite[]
  >([]);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/companies`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setCompanies(data.companies || []);
      setCanWrite(!!data.canWrite);
    } catch {
      toast.error("Couldn't load project team");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Pull the workspace directory once — used by the Add Member
  // typeahead. Failure here just disables the picker UX.
  useEffect(() => {
    fetch("/api/team/directory")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d: { members?: WorkspaceMemberLite[] }) =>
        setWorkspaceMembers(d.members || [])
      )
      .catch(() => {});
  }, []);

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Project team
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Firms and people on {projectName}.
            </p>
          </div>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => setAddCompanyOpen(true)}
              className="bg-black hover:bg-gray-900 text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add company
            </Button>
          )}
        </div>

        {/* Empty state */}
        {companies.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-xl py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-[#c9a84c]/10 mx-auto flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-[#a8893a]" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              No firms on this project yet
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
              Add the structural firm, the architect, the GC and any
              consultants. Each firm has its own team within the project.
            </p>
            {canWrite && (
              <Button
                size="sm"
                onClick={() => setAddCompanyOpen(true)}
                className="bg-black hover:bg-gray-900 text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add the first company
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {companies.map((c) => (
              <CompanyCard
                key={c.id}
                company={c}
                canWrite={canWrite}
                projectOwnerId={projectOwner?.id}
                onEdit={() => setEditCompany(c)}
                onAddMember={() => setAddMemberFor(c)}
                onRefresh={fetchTeam}
                projectId={projectId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {addCompanyOpen && (
        <AddCompanyDialog
          projectId={projectId}
          onClose={() => setAddCompanyOpen(false)}
          onSaved={() => {
            setAddCompanyOpen(false);
            fetchTeam();
          }}
          existingCompanies={companies}
        />
      )}
      {editCompany && (
        <EditCompanyDialog
          projectId={projectId}
          company={editCompany}
          onClose={() => setEditCompany(null)}
          onSaved={() => {
            setEditCompany(null);
            fetchTeam();
          }}
        />
      )}
      {addMemberFor && (
        <AddMemberDialog
          projectId={projectId}
          company={addMemberFor}
          workspaceMembers={workspaceMembers}
          alreadyOnProject={companies.flatMap((c) =>
            c.members.map((m) => m.userId)
          )}
          onClose={() => setAddMemberFor(null)}
          onSaved={() => {
            setAddMemberFor(null);
            fetchTeam();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Company card
// ──────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  canWrite,
  projectOwnerId,
  onEdit,
  onAddMember,
  onRefresh,
  projectId,
}: {
  company: CompanyRow;
  canWrite: boolean;
  projectOwnerId?: string;
  onEdit: () => void;
  onAddMember: () => void;
  onRefresh: () => void;
  projectId: string;
}) {
  const meta = COMPANY_ROLE_META[company.role];

  const handleRemove = async () => {
    if (
      !confirm(
        `Remove "${company.name}" from this project? Its members will stay on the project but unaffiliated.`
      )
    )
      return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/companies/${company.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success("Company removed");
      onRefresh();
    } catch {
      toast.error("Couldn't remove company");
    }
  };

  return (
    <div
      className={cn(
        "border rounded-xl bg-white overflow-hidden",
        company.isOwn && "border-[#c9a84c]/40 shadow-sm"
      )}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-3 border-b"
        style={
          company.isOwn ? { backgroundColor: "rgba(201,168,76,0.05)" } : undefined
        }
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
            style={{ backgroundColor: meta.color }}
          >
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {company.name}
              </h3>
              {company.isOwn && (
                <span
                  title="Your firm"
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a8893a]"
                >
                  <Star className="w-3 h-3 fill-[#c9a84c] text-[#c9a84c]" />
                  YOU
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {meta.label}
              {company.domain && (
                <span className="text-slate-400"> · @{company.domain}</span>
              )}
              <span className="text-slate-400">
                {" · "}
                {company.members.length}{" "}
                {company.members.length === 1 ? "member" : "members"}
              </span>
            </p>
          </div>
        </div>

        {canWrite && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onAddMember}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Add member
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit firm
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleRemove}
                  className="text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Remove firm
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="px-2 py-1">
        {company.members.length === 0 ? (
          <p className="text-xs text-slate-400 px-2 py-3">
            No members yet. {canWrite && "Use Add member."}
          </p>
        ) : (
          company.members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              canWrite={canWrite}
              isProjectOwner={m.userId === projectOwnerId}
              projectId={projectId}
              onRefresh={onRefresh}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  canWrite,
  isProjectOwner,
  projectId,
  onRefresh,
}: {
  member: ProjectMemberRow;
  canWrite: boolean;
  isProjectOwner: boolean;
  projectId: string;
  onRefresh: () => void;
}) {
  const positionLabel = member.user.position
    ? member.user.position === "OTHER"
      ? member.user.customTitle || "Other"
      : POSITION_META[member.user.position]?.short
    : member.user.jobTitle || "—";

  const initials = (member.user.name || member.user.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const updateRole = async (role: ProjectRole) => {
    if (isProjectOwner) {
      toast.error("Can't change the project owner's role here");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, role }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Role updated");
      onRefresh();
    } catch {
      toast.error("Couldn't update role");
    }
  };

  const remove = async () => {
    if (isProjectOwner) {
      toast.error("Can't remove the project owner — transfer ownership first");
      return;
    }
    if (!confirm(`Remove ${member.user.name || "this person"} from the project?`))
      return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members?userId=${member.userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success("Member removed");
      onRefresh();
    } catch {
      toast.error("Couldn't remove member");
    }
  };

  return (
    <div className="group flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 transition-colors">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={member.user.image || ""} />
        <AvatarFallback className="text-[10px] bg-[#d4b65a] text-white">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900 truncate">
            {member.user.name || "—"}
          </span>
          {isProjectOwner && (
            <span
              title="Project owner"
              className="inline-flex items-center gap-0.5 text-[10px] text-[#a8893a] font-medium uppercase tracking-wider"
            >
              <Crown className="w-3 h-3" />
              Owner
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate">
          {positionLabel}
          <span className="text-slate-400"> · {member.user.email}</span>
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!canWrite || isProjectOwner}>
          <button
            className={cn(
              "px-2 py-1 rounded text-[11px] font-medium uppercase tracking-wider",
              canWrite && !isProjectOwner
                ? "hover:bg-slate-100 text-slate-600"
                : "text-slate-400 cursor-default"
            )}
            style={{
              color: PROJECT_ROLE_META[member.projectRole].color,
              backgroundColor: `${PROJECT_ROLE_META[member.projectRole].color}1A`,
            }}
          >
            {PROJECT_ROLE_META[member.projectRole].label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"] as ProjectRole[]).map(
            (r) => (
              <DropdownMenuItem key={r} onClick={() => updateRole(r)}>
                {member.projectRole === r && (
                  <Check className="w-3.5 h-3.5 mr-2" />
                )}
                <span className={cn(member.projectRole !== r && "ml-5")}>
                  <span className="font-medium">
                    {PROJECT_ROLE_META[r].label}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1.5">
                    {PROJECT_ROLE_META[r].description}
                  </span>
                </span>
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWrite && !isProjectOwner && (
        <button
          onClick={remove}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
          title="Remove from project"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Add Company dialog
// ──────────────────────────────────────────────────────────────

function AddCompanyDialog({
  projectId,
  onClose,
  onSaved,
  existingCompanies,
}: {
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
  existingCompanies: CompanyRow[];
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<CompanyRole>("STRUCTURAL_ENGINEER");
  const [domain, setDomain] = useState("");
  const [isOwn, setIsOwn] = useState(existingCompanies.length === 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          domain: domain.trim() || null,
          isOwn,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed");
      }
      toast.success("Company added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a firm to this project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Firm name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ARQ Studio, MEP Solutions Inc"
              className="w-full px-3 py-1.5 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Role on this project
            </label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as CompanyRole)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {COMPANY_ROLE_ORDER.map((r) => (
                  <SelectItem key={r} value={r}>
                    {COMPANY_ROLE_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Email domain (optional)
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="arqstudio.com"
              className="w-full px-3 py-1.5 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
              maxLength={255}
            />
            <p className="text-[11px] text-slate-400">
              Emails ending with this domain are auto-routed to this firm
              when added to the project.
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isOwn}
              onChange={(e) => setIsOwn(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">This is our firm</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Marks this as the host firm. Only one per project.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={!name.trim() || saving}
            className="bg-black hover:bg-gray-900 text-white"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              "Add company"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCompanyDialog({
  projectId,
  company,
  onClose,
  onSaved,
}: {
  projectId: string;
  company: CompanyRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [role, setRole] = useState<CompanyRole>(company.role);
  const [domain, setDomain] = useState(company.domain || "");
  const [isOwn, setIsOwn] = useState(company.isOwn);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/companies/${company.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            role,
            domain: domain.trim() || null,
            isOwn,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed");
      }
      toast.success("Company updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit firm</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Role</label>
            <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {COMPANY_ROLE_ORDER.map((r) => (
                  <SelectItem key={r} value={r}>
                    {COMPANY_ROLE_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Email domain
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
              maxLength={255}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isOwn}
              onChange={(e) => setIsOwn(e.target.checked)}
            />
            This is our firm
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={!name.trim() || saving}
            className="bg-black hover:bg-gray-900 text-white"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────
// Add Member dialog
// ──────────────────────────────────────────────────────────────

function AddMemberDialog({
  projectId,
  company,
  workspaceMembers,
  alreadyOnProject,
  onClose,
  onSaved,
}: {
  projectId: string;
  company: CompanyRow;
  workspaceMembers: WorkspaceMemberLite[];
  alreadyOnProject: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<WorkspaceMemberLite | null>(null);
  const [role, setRole] = useState<ProjectRole>("EDITOR");
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const onProj = new Set(alreadyOnProject);
    const q = query.trim().toLowerCase();
    return workspaceMembers
      .filter((m) => !onProj.has(m.id))
      .filter((m) => {
        if (!q) return true;
        const name = (m.name || "").toLowerCase();
        const email = (m.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 8);
  }, [workspaceMembers, alreadyOnProject, query]);

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: picked.id,
          role,
          companyId: company.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed");
      }
      toast.success(`Added to ${company.name}`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add member to {company.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {picked ? (
            <div className="flex items-center gap-3 p-2 rounded-md border bg-slate-50">
              <Avatar className="h-9 w-9">
                <AvatarImage src={picked.image || ""} />
                <AvatarFallback className="text-xs bg-[#d4b65a] text-white">
                  {(picked.name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {picked.name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {picked.email}
                </p>
              </div>
              <button
                onClick={() => setPicked(null)}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Search your firm’s directory
                </label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or email…"
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
                />
              </div>
              <div className="max-h-[260px] overflow-auto -mx-2">
                {candidates.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2 py-3 text-center">
                    No matches. Email-invite flow coming soon.
                  </p>
                ) : (
                  candidates.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPicked(m)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-slate-50 text-left"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={m.image || ""} />
                        <AvatarFallback className="text-[10px] bg-[#d4b65a] text-white">
                          {(m.name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {m.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {m.email}
                          {m.position && (
                            <span className="text-slate-400">
                              {" · "}
                              {POSITION_META[m.position]?.short || m.position}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Project role
            </label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as ProjectRole)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"] as ProjectRole[]).map(
                  (r) => (
                    <SelectItem key={r} value={r}>
                      <span className="font-medium">
                        {PROJECT_ROLE_META[r].label}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-2">
                        {PROJECT_ROLE_META[r].description}
                      </span>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={!picked || saving}
            className="bg-black hover:bg-gray-900 text-white"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
