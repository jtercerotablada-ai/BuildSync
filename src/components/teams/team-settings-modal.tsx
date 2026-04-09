"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Mail,
  Lock,
  Users,
  BadgeCheck,
  Trash2,
  Loader2,
  UserPlus,
  ChevronDown,
  Pencil,
  Settings,
  Link2,
  Archive,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TeamSettingsModalProps {
  team: {
    id: string;
    name: string;
    description?: string | null;
    privacy: "PUBLIC" | "REQUEST_TO_JOIN" | "PRIVATE";
    hasAdmin?: boolean;
    workspace?: {
      name: string;
    } | null;
  };
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
  defaultTab?: "general" | "members" | "advanced";
}

export function TeamSettingsModal({
  team,
  open,
  onClose,
  onSave,
  defaultTab = "general",
}: TeamSettingsModalProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || "");
  const [privacy, setPrivacy] = useState(team.privacy);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [allowInviteLinks, setAllowInviteLinks] = useState(true);
  const [members, setMembers] = useState<{ id: string; role: string; user: { id: string; name: string | null; email: string | null; image: string | null } }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Reset form when team changes
  useEffect(() => {
    setName(team.name);
    setDescription(team.description || "");
    setPrivacy(team.privacy);
  }, [team]);

  // Fetch real members when the members tab is shown
  useEffect(() => {
    if (activeTab !== "members" || !open) return;
    let cancelled = false;
    async function fetchMembers() {
      setMembersLoading(true);
      try {
        const res = await fetch(`/api/teams/${team.id}/members`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMembers(data);
        }
      } catch {
        // silently fail - list will be empty
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }
    fetchMembers();
    return () => { cancelled = true; };
  }, [activeTab, open, team.id]);

  const tabs = [
    { id: "general", label: "General" },
    { id: "members", label: "Members" },
    { id: "advanced", label: "Advanced" },
  ];

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, privacy }),
      });

      if (res.ok) {
        toast.success("Team updated");
        onSave?.();
        onClose();
      } else {
        toast.error("Failed to update team");
      }
    } catch (error) {
      toast.error("Failed to update team");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Team deleted");
        onClose();
        window.location.href = "/";
      } else {
        toast.error("Failed to delete team");
      }
    } catch (error) {
      toast.error("Failed to delete team");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Team settings</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-6 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* TAB: General */}
          {activeTab === "general" && (
            <div className="space-y-6">
              {/* Admin Warning Banner */}
              {!team.hasAdmin && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 border rounded-lg">
                  <Shield className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">
                      {team.name} does not have a team admin.
                    </p>
                    <button className="text-sm text-blue-600 hover:underline" onClick={() => toast.info('Team admins can manage team settings, members, and permissions.')}>
                      What's a team admin?
                    </button>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const res = await fetch(`/api/teams/${team.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hasAdmin: true }),
                      });
                      if (res.ok) {
                        toast.success('You are now a team admin');
                        onSave?.();
                      }
                    } catch { toast.error('Failed to become admin'); }
                  }}>
                    Become team admin
                  </Button>
                </div>
              )}

              {/* Organization (read-only) */}
              {team.workspace?.name && (
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-700">Organization</Label>
                  <p className="text-sm font-medium">{team.workspace.name}</p>
                </div>
              )}

              {/* Team name */}
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-700">
                  Team name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-700">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Type / for menu"
                  rows={4}
                  className="focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Team status (premium - disabled) */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700">Team status</Label>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    disabled
                    className="mt-1 opacity-50"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Endorsed</span>
                      <BadgeCheck className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-amber-600 hover:underline cursor-pointer" onClick={() => toast.info('BuildSync Enterprise features coming soon')}>
                        Upgrade to BuildSync Enterprise
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Endorsed teams are recommended by admins in your organization.{" "}
                      <button className="text-blue-600 hover:underline" onClick={() => toast.info('Endorsed teams are recommended by admins and appear highlighted in team directories.')}>Learn more</button>
                    </p>
                  </div>
                </div>
              </div>

              {/* Team privacy */}
              <div className="space-y-3">
                <Label className="text-sm text-gray-700">Team privacy</Label>
                <RadioGroup value={privacy} onValueChange={(v) => setPrivacy(v as typeof privacy)}>
                  {/* Membership by request */}
                  <label className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <RadioGroupItem value="REQUEST_TO_JOIN" className="mt-1" />
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div>
                        <span className="text-sm font-medium">Membership by request</span>
                        <p className="text-xs text-gray-500">
                          A member has to request to join this team
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Private */}
                  <label className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <RadioGroupItem value="PRIVATE" className="mt-1" />
                    <div className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div>
                        <span className="text-sm font-medium">Private</span>
                        <p className="text-xs text-gray-500">
                          A member must be invited to join this team
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Public to organization */}
                  <label className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <RadioGroupItem value="PUBLIC" className="mt-1" />
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div>
                        <span className="text-sm font-medium">Public to organization</span>
                        <p className="text-xs text-gray-500">
                          Any member can join this team
                        </p>
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* TAB: Members */}
          {activeTab === "members" && (
            <div className="space-y-6">
              {/* Invite Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Invite people</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address"
                    className="flex-1"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && inviteEmail.trim()) {
                        try {
                          const res = await fetch(`/api/teams/${team.id}/invite`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: inviteEmail.trim() }),
                          });
                          if (res.ok) {
                            toast.success(`Invited ${inviteEmail.trim()}`);
                            setInviteEmail("");
                            // Refresh member list
                            const membersRes = await fetch(`/api/teams/${team.id}/members`);
                            if (membersRes.ok) setMembers(await membersRes.json());
                          } else {
                            const data = await res.json();
                            toast.error(data.error || 'Failed to invite user');
                          }
                        } catch { toast.error('Failed to invite user'); }
                      }
                    }}
                  />
                  <Button size="sm" onClick={async () => {
                    if (!inviteEmail.trim()) { toast.error('Please enter an email'); return; }
                    try {
                      const res = await fetch(`/api/teams/${team.id}/invite`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: inviteEmail.trim() }),
                      });
                      if (res.ok) {
                        toast.success(`Invited ${inviteEmail.trim()}`);
                        setInviteEmail("");
                        // Refresh member list
                        const membersRes = await fetch(`/api/teams/${team.id}/members`);
                        if (membersRes.ok) setMembers(await membersRes.json());
                      } else {
                        const data = await res.json();
                        toast.error(data.error || 'Failed to invite user');
                      }
                    } catch { toast.error('Failed to invite user'); }
                  }}>
                    Send invite
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Invited members will receive an email with a link to join the team
                </p>
              </div>

              {/* Current Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Current members</span>
                  <span className="text-xs text-gray-500">Manage team members</span>
                </div>

                <div className="border rounded-lg divide-y">
                  {membersLoading ? (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : members.length > 0 ? (
                    members.map((member) => (
                      <div key={member.user.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-medium">
                            {(member.user.name || member.user.email || "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member.user.name || "Unnamed"}</p>
                            <p className="text-xs text-gray-500">{member.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 px-2 py-1">
                            {member.role === "LEAD" ? "Lead" : member.role === "ADMIN" ? "Admin" : "Member"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No members found.
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Invitations */}
              <div className="space-y-3">
                <span className="text-sm font-medium">Pending invitations</span>
                <p className="text-xs text-gray-500">No pending invitations</p>
              </div>
            </div>
          )}

          {/* TAB: Advanced */}
          {activeTab === "advanced" && (
            <div className="space-y-6">
              {/* Editing Permissions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Editing permissions</span>
                </div>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Who can edit team settings</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                          Team admins only
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      {/* TODO: Wire to API once team permission settings endpoint exists */}
                      <DropdownMenuContent>
                        <DropdownMenuItem disabled>Team admins only</DropdownMenuItem>
                        <DropdownMenuItem disabled>All team members</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Membership Permissions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Membership permissions</span>
                </div>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Who can add team members</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                          All team members
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      {/* TODO: Wire to API once team permission settings endpoint exists */}
                      <DropdownMenuContent>
                        <DropdownMenuItem disabled>All team members</DropdownMenuItem>
                        <DropdownMenuItem disabled>Team admins only</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Who can remove team members</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                          Team admins only
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      {/* TODO: Wire to API once team permission settings endpoint exists */}
                      <DropdownMenuContent>
                        <DropdownMenuItem disabled>Team admins only</DropdownMenuItem>
                        <DropdownMenuItem disabled>All team members</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Invitations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Invitations</span>
                </div>
                <div className="space-y-2 pl-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Allow invite links</span>
                    {/* TODO: Persist invite link setting via API once endpoint exists */}
                    <Checkbox checked={allowInviteLinks} onCheckedChange={(checked) => { setAllowInviteLinks(!!checked); }} />
                  </div>
                  <p className="text-xs text-gray-500">
                    Anyone with the invite link can join the team
                  </p>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <h4 className="text-sm font-medium text-red-800 mb-1">Danger zone</h4>
                <p className="text-xs text-red-600 mb-3">
                  These actions cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-100" onClick={async () => {
                    if (!confirm('Archive this team? Members will no longer be able to access it.')) return;
                    try {
                      const res = await fetch(`/api/teams/${team.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ archived: true }),
                      });
                      if (res.ok) { toast.success('Team archived'); onClose(); window.location.href = '/'; }
                      else toast.error('Failed to archive team');
                    } catch { toast.error('Failed to archive team'); }
                  }}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive team
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete team
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - only on General tab */}
        {activeTab === "general" && (
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Team
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
