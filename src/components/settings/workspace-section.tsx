"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Mail,
  X,
  Crown,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";
import {
  canChangeWorkspaceRole,
  canRemoveWorkspaceMember,
} from "@/lib/people-types";
import { isNonContributorRole } from "@/lib/workspace-roles";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "WORKER" | "GUEST";

interface MemberRow {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    jobTitle: string | null;
  };
}

interface InvitationRow {
  id: string;
  email: string;
  role: Role;
  workspaceId?: string;
  expiresAt: string;
  createdAt: string;
}

function roleBadgeVariant(role: Role) {
  if (role === "OWNER") return "default" as const;
  if (role === "ADMIN") return "secondary" as const;
  return "outline" as const;
}

function roleIcon(role: Role) {
  if (role === "OWNER") return <Crown className="h-3 w-3" />;
  if (role === "ADMIN") return <Shield className="h-3 w-3" />;
  return <UserIcon className="h-3 w-3" />;
}

export function WorkspaceSection() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [meUserId, setMeUserId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviting, setInviting] = useState(false);
  // The workspace the admin is currently viewing — pinned from the invitation
  // list so a multi-workspace admin's actions target the right workspace and
  // not an arbitrary findFirst membership. Undefined until the list loads;
  // the API falls back to its own heuristic when we send nothing.
  const [workspaceId, setWorkspaceId] = useState<string | undefined>();
  // Invitation row whose resend/revoke request is in flight, so the row's
  // buttons can be disabled instead of accepting repeat clicks.
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  // Member awaiting removal confirmation.
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, mRes, iRes] = await Promise.all([
        fetch("/api/users/profile"),
        fetch("/api/workspace/members"),
        fetch("/api/workspace/invitations"),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setMeUserId(me.id);
      }
      if (mRes.ok) {
        const data: MemberRow[] = await mRes.json();
        setMembers(data);
      }
      if (iRes.ok) {
        const data: InvitationRow[] = await iRes.json();
        setInvitations(data);
        const wsId = data.find((i) => i.workspaceId)?.workspaceId;
        if (wsId) setWorkspaceId(wsId);
      }
    } catch {
      toast.error("Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // myRole is derived below rather than inside load(): depending on meUserId
  // there made load() a new function once the profile arrived, which re-fired
  // the mount effect and re-ran all three fetches behind a second spinner.
  // Re-derive myRole when members or me arrive
  useEffect(() => {
    if (!meUserId) return;
    const me = members.find((m) => m.userId === meUserId);
    if (me) setMyRole(me.role);
  }, [members, meUserId]);

  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  // People who can take over a removed member's open tasks.
  const taskHeirs = members
    .filter((m) => !isNonContributorRole(m.role))
    .map((m) => ({
      userId: m.userId,
      name: m.user.name || m.user.email || "Unnamed",
    }));

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Enter an email");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/workspace/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole, workspaceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not send invitation");
        return;
      }
      // The row is kept when delivery fails, and the route says so in
      // `warning`. Claiming "sent" there left the invitee waiting for an
      // email that was never going to arrive.
      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success("Invitation sent");
      }
      setInviteEmail("");
      setInviteRole("MEMBER");
      setInviteOpen(false);
      load();
    } catch {
      // A rejected fetch (offline, DNS, aborted request) never reaches the
      // res.ok branch above, so without this the click produced no feedback.
      toast.error("Network error — check your connection");
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this invitation?")) return;
    const qs = new URLSearchParams({ id });
    if (workspaceId) qs.set("workspaceId", workspaceId);
    setBusyInviteId(id);
    try {
      const res = await fetch(`/api/workspace/invitations?${qs.toString()}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Invitation revoked");
        setInvitations((prev) => prev.filter((i) => i.id !== id));
      } else {
        toast.error("Could not revoke");
      }
    } catch {
      toast.error("Network error — check your connection");
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleResend(id: string) {
    const qs = workspaceId
      ? `?${new URLSearchParams({ workspaceId }).toString()}`
      : "";
    setBusyInviteId(id);
    try {
      const res = await fetch(`/api/workspace/invitations/${id}/resend${qs}`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Invitation resent");
      } else {
        toast.error("Could not resend");
      }
    } catch {
      toast.error("Network error — check your connection");
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleRoleChange(memberUserId: string, role: Role) {
    try {
      const res = await fetch("/api/workspace/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberUserId, role }),
      });
      if (res.ok) {
        toast.success("Role updated");
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Could not update role");
      }
    } catch {
      toast.error("Network error — check your connection");
    }
  }

  function handleRemoved(
    member: MemberRow,
    result: RemoveMemberResult,
    heirName: string | null
  ) {
    setRemoveTarget(null);
    toast.success(
      removedMessage(member.user.name || member.user.email, result, heirName)
    );
    setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Workspace members</h2>
          <p className="mt-1 text-sm text-gray-500">
            People who can collaborate inside your workspace.
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setInviteOpen(true)}
            className="bg-[#c9a84c] text-black hover:bg-[#b8973f]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Invite member
          </Button>
        )}
      </div>

      {/* Members table */}
      <div className="rounded-lg border">
        {members.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            No members yet.
          </p>
        ) : (
          <ul className="divide-y">
            {members.map((m) => {
              const isSelf = m.userId === meUserId;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={m.user.image || ""} />
                      <AvatarFallback className="text-xs">
                        {(m.user.name || m.user.email || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.user.name || m.user.email}
                        {isSelf && (
                          <span className="ml-1.5 text-xs text-gray-400">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {m.user.jobTitle || m.user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canChangeWorkspaceRole(myRole, m.role, isSelf) ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          handleRoleChange(m.userId, v as Role)
                        }
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="WORKER">Worker</SelectItem>
                          {/* Listed only so an existing guest's role renders;
                              GUEST can no longer be granted. */}
                          {m.role === "GUEST" && (
                            <SelectItem value="GUEST" disabled>
                              Guest
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant={roleBadgeVariant(m.role)}
                        className="gap-1"
                      >
                        {roleIcon(m.role)}
                        {m.role}
                      </Badge>
                    )}
                    {!isSelf &&
                      canRemoveWorkspaceMember(myRole, m.role, isSelf) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-black"
                        onClick={() => setRemoveTarget(m)}
                        title="Remove from workspace"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium">Pending invitations</h3>
          <div className="rounded-lg border">
            <ul className="divide-y">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                      <Mail className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {inv.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()} ·{" "}
                        {inv.role}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleResend(inv.id)}
                        disabled={busyInviteId === inv.id}
                      >
                        {busyInviteId === inv.id && (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        )}
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-black"
                        onClick={() => handleRevoke(inv.id)}
                        disabled={busyInviteId === inv.id}
                        title="Revoke"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Remove-from-workspace confirmation */}
      <RemoveMemberDialog
        target={
          removeTarget
            ? {
                userId: removeTarget.userId,
                name:
                  removeTarget.user.name ||
                  removeTarget.user.email ||
                  "This person",
              }
            : null
        }
        heirs={taskHeirs}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onRemoved={(result, heirName) => {
          if (removeTarget) handleRemoved(removeTarget, result, heirName);
        }}
      />

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite to workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="name@firm.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as Role)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="WORKER">Worker</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="bg-black text-white hover:bg-gray-900"
            >
              {inviting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export interface RemoveMemberResult {
  openTasksReassigned?: number;
  reassignedTo?: string | null;
}

/** Toast copy after a removal, naming where the open tasks went. */
export function removedMessage(
  name: string | null | undefined,
  result: RemoveMemberResult,
  heirName: string | null
): string {
  const who = name || "Member";
  const n = result.openTasksReassigned ?? 0;
  if (n === 0) return `${who} removed from the workspace`;
  const tasks = `${n} open ${n === 1 ? "task" : "tasks"}`;
  return result.reassignedTo
    ? `${who} removed · ${tasks} reassigned${heirName ? ` to ${heirName}` : ""}`
    : `${who} removed · ${tasks} left unassigned`;
}

const UNASSIGNED = "_UNASSIGNED";

/**
 * Remove-from-workspace confirmation, shared by Settings > Workspace and the
 * People directory. It asks who takes over the person's open tasks: left on
 * them, the tasks sat in nobody's My Tasks and kept mailing reminders to an
 * account that had left the firm. DELETE /api/workspace/members applies the
 * choice in the same transaction as the removal.
 */
export function RemoveMemberDialog({
  target,
  heirs,
  onOpenChange,
  onRemoved,
}: {
  target: { userId: string; name: string } | null;
  /** Contributors of the workspace; the target itself is filtered out here. */
  heirs: { userId: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onRemoved: (result: RemoveMemberResult, heirName: string | null) => void;
}) {
  const [heirId, setHeirId] = useState<string>(UNASSIGNED);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = target?.userId ?? null;
  useEffect(() => {
    if (targetUserId) {
      setHeirId(UNASSIGNED);
      setBusy(false);
      setError(null);
    }
  }, [targetUserId]);

  const options = heirs.filter((h) => h.userId !== targetUserId);

  const confirm = async () => {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ userId: target.userId });
      if (heirId !== UNASSIGNED) qs.set("reassignTo", heirId);
      const res = await fetch(`/api/workspace/members?${qs.toString()}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Stay open with the API's own reason (last owner, projects with no
        // heir, an admin removing an admin).
        setError(data.error || "Could not remove this person");
        return;
      }
      const heirName =
        heirId === UNASSIGNED
          ? null
          : options.find((h) => h.userId === heirId)?.name ?? null;
      onRemoved(data.removed ?? {}, heirName);
    } catch {
      setError("Network error — check your connection");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Remove from workspace
          </DialogTitle>
          {target ? (
            <DialogDescription>
              {target.name} loses access to this workspace immediately.
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <ul className="list-disc space-y-1 rounded-md border border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-700">
          <li>Removed from every project and team in this workspace</li>
          <li>Projects they own are transferred to another owner or admin</li>
          <li>
            Their open tasks go to the person you pick below, or become
            unassigned
          </li>
          <li>
            Completed tasks, comments and files stay — nothing they made is
            deleted
          </li>
          <li>
            They can be invited back later, but project access must be granted
            again
          </li>
        </ul>

        <div className="space-y-1.5">
          <Label className="text-xs">Reassign their open tasks to</Label>
          <Select value={heirId} onValueChange={setHeirId} disabled={busy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[260px]">
              <SelectItem value={UNASSIGNED}>Leave unassigned</SelectItem>
              {options.map((h) => (
                <SelectItem key={h.userId} value={h.userId}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {/* Not disabled while busy: a request that never settles would
              otherwise trap the user in the dialog. */}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
