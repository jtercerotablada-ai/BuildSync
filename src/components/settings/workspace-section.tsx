"use client";

import { useEffect, useState, useCallback } from "react";
import {
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
        if (meUserId) {
          const me = data.find((m) => m.userId === meUserId);
          if (me) setMyRole(me.role);
        }
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
  }, [meUserId]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-derive myRole when members or me arrive
  useEffect(() => {
    if (!meUserId) return;
    const me = members.find((m) => m.userId === meUserId);
    if (me) setMyRole(me.role);
  }, [members, meUserId]);

  const canManage = myRole === "OWNER" || myRole === "ADMIN";

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Could not send invitation");
        return;
      }
      toast.success("Invitation sent");
      setInviteEmail("");
      setInviteRole("MEMBER");
      setInviteOpen(false);
      load();
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this invitation?")) return;
    const qs = new URLSearchParams({ id });
    if (workspaceId) qs.set("workspaceId", workspaceId);
    const res = await fetch(`/api/workspace/invitations?${qs.toString()}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Invitation revoked");
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } else {
      toast.error("Could not revoke");
    }
  }

  async function handleResend(id: string) {
    const qs = workspaceId
      ? `?${new URLSearchParams({ workspaceId }).toString()}`
      : "";
    const res = await fetch(`/api/workspace/invitations/${id}/resend${qs}`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Invitation resent");
    } else {
      toast.error("Could not resend");
    }
  }

  async function handleRoleChange(memberUserId: string, role: Role) {
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
  }

  async function handleRemove(memberUserId: string) {
    if (!confirm("Remove this person from the workspace?")) return;
    const res = await fetch(
      `/api/workspace/members?userId=${memberUserId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      toast.success("Member removed");
      setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Could not remove");
    }
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
              const isOwner = m.role === "OWNER";
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
                    {canManage && !isOwner && !isSelf ? (
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
                          <SelectItem value="GUEST">Guest</SelectItem>
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
                    {canManage && !isOwner && !isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-black"
                        onClick={() => handleRemove(m.userId)}
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
                      >
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-black"
                        onClick={() => handleRevoke(inv.id)}
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
                  <SelectItem value="GUEST">Guest</SelectItem>
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
