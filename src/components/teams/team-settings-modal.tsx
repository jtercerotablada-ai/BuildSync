"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  Users,
  Trash2,
  Loader2,
  UserPlus,
  Archive,
  ArchiveRestore,
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TeamSettingsModalProps {
  team: {
    id: string;
    name: string;
    description?: string | null;
    privacy: "PUBLIC" | "REQUEST_TO_JOIN" | "PRIVATE";
    isArchived?: boolean;
    workspace?: {
      name: string;
    } | null;
  };
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
  /** "advanced" is the old id of the tab that now holds only the Danger zone. */
  defaultTab?: "general" | "members" | "advanced" | "danger";
  /**
   * Whether this caller may change the team's name, description and privacy —
   * PATCH /api/teams/:id keeps those lead-only, while ARCHIVING (the Danger
   * zone) also admits a workspace OWNER/ADMIN. Passing false hides the General
   * tab entirely rather than showing fields whose Update button 403s, which is
   * how a workspace owner reaches the archive control on a team he is not the
   * lead of. Defaults to true so every existing caller is unchanged.
   */
  canEditDetails?: boolean;
}

type SettingsTab = "general" | "members" | "danger";

/** What the Danger zone needs to state the real blast radius of a delete. */
interface TeamDangerFacts {
  isArchived: boolean;
  archivedAt: string | null;
  counts: {
    projects: number;
    members: number;
    messages: number;
    knowledgeEntries: number;
    customFields: number;
  };
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function TeamSettingsModal({
  team,
  open,
  onClose,
  onSave,
  defaultTab = "general",
  canEditDetails = true,
}: TeamSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const wanted = defaultTab === "advanced" ? "danger" : defaultTab;
    // Never open on a tab this caller can't be shown.
    return wanted === "general" && !canEditDetails ? "members" : wanted;
  });
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || "");
  const [privacy, setPrivacy] = useState(team.privacy);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [members, setMembers] = useState<{ id: string; role: string; user: { id: string; name: string | null; email: string | null; image: string | null } }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [danger, setDanger] = useState<TeamDangerFacts | null>(null);

  // Reset form when the modal opens or a different team is shown. Depending on
  // the whole `team` object reset the fields on every parent re-render — the
  // caller builds it as a fresh literal — which wiped whatever was being typed.
  useEffect(() => {
    setName(team.name);
    setDescription(team.description || "");
    setPrivacy(team.privacy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id, open]);

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

  // The Danger zone quotes real numbers back at the user, and the archive
  // button has to know which direction it points. Neither caller passes any of
  // that in `team`, so read it from the team endpoint whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function fetchDangerFacts() {
      try {
        const res = await fetch(`/api/teams/${team.id}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setDanger({
          isArchived: !!data.isArchived,
          archivedAt: data.archivedAt ?? null,
          counts: {
            projects: data._count?.projects ?? 0,
            members: data._count?.members ?? 0,
            messages: data._count?.messages ?? 0,
            knowledgeEntries: data._count?.knowledgeEntries ?? 0,
            customFields: data._count?.customFields ?? 0,
          },
        });
      } catch {
        // Leave `danger` null — the delete dialog falls back to wording that
        // makes no claim about counts it could not read.
      }
    }
    fetchDangerFacts();
    return () => { cancelled = true; };
  }, [open, team.id]);

  const isArchived = danger?.isArchived ?? team.isArchived ?? false;

  const tabs: { id: SettingsTab; label: string }[] = [
    ...(canEditDetails
      ? [{ id: "general" as const, label: "General" }]
      : []),
    { id: "members", label: "Members" },
    { id: "danger", label: "Danger zone" },
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

  // Same three outcomes InviteTeamModal reports: an existing user is added
  // to the team outright, an invitation email goes out, or the invitation is
  // saved but delivery failed (HTTP 201 + `warning`). Both invite controls
  // below only checked res.ok, so the failed-delivery case toasted "Invited"
  // and the user waited for mail that was never sent.
  const sendInvite = async () => {
    const address = inviteEmail.trim();
    if (!address) {
      toast.error("Please enter an email");
      return;
    }
    try {
      const res = await fetch(`/api/teams/${team.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to invite user");
      }
      if (data?.success) {
        toast.success("Added to the team");
      } else if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success(`Invitation sent to ${address}`);
      }
      setInviteEmail("");
      // Refresh member list
      const membersRes = await fetch(`/api/teams/${team.id}/members`);
      if (membersRes.ok) setMembers(await membersRes.json());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to invite user"
      );
    }
  };

  // Archive is reversible, so it does NOT navigate away: the same button has to
  // be reachable to undo it. Success is decided by what the server sends back,
  // not by res.ok — the old handler PATCHed a key the route schema stripped and
  // toasted "Team archived" over a row that never changed.
  const setArchived = async (next: boolean) => {
    setIsArchiving(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error || (next ? "Failed to archive team" : "Failed to restore team")
        );
      }
      if (data?.isArchived !== next) {
        throw new Error("The team was not updated. Please try again.");
      }
      setDanger((prev) =>
        prev
          ? { ...prev, isArchived: next, archivedAt: data.archivedAt ?? null }
          : prev
      );
      toast.success(next ? "Team archived" : "Team restored");
      onSave?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : next
            ? "Failed to archive team"
            : "Failed to restore team"
      );
    } finally {
      setIsArchiving(false);
    }
  };

  // What a delete actually does, measured rather than guessed: Project.teamId is
  // SET NULL so the jobs and their tasks survive detached, while the team's
  // messages, knowledge entries and custom fields cascade away — and because a
  // project attached to a team grants Editor access to every team member, anyone
  // whose only claim was this team loses those jobs.
  const c = danger?.counts;
  const deleteConsequences = c
    ? [
        c.projects > 0
          ? `${plural(c.projects, "project stays", "projects stay")} — detached from this team, keeping every task, file and comment`
          : "No projects are attached to this team",
        ...(c.messages > 0
          ? [`${plural(c.messages, "team message is", "team messages are")} deleted permanently`]
          : []),
        ...(c.knowledgeEntries > 0
          ? [`${plural(c.knowledgeEntries, "knowledge entry is", "knowledge entries are")} deleted permanently`]
          : []),
        ...(c.customFields > 0
          ? [`${plural(c.customFields, "team field is", "team fields are")} deleted permanently`]
          : []),
        ...(c.projects > 0 && c.members > 0
          ? [
              `Anyone among the ${plural(c.members, "member", "members")} whose access to those projects came only through this team loses it`,
            ]
          : []),
      ]
    : [
        "Projects are detached, not deleted — they keep every task, file and comment",
        "The team's messages, knowledge entries and team fields are deleted permanently",
        "Anyone whose access to those projects came only through this team loses it",
      ];

  const handleDelete = async () => {
    const res = await fetch(`/api/teams/${team.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      // Thrown, not toasted: ConfirmDialog shows the message and keeps the
      // dialog open so the typed confirmation is not lost.
      throw new Error(data?.error || "Failed to delete team");
    }
    toast.success("Team deleted");
    setDeleteOpen(false);
    onClose();
    window.location.href = "/";
  };

  return (
    <>
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
              {/* A "<Team> does not have a team admin" banner lived here,
                  gated on a `hasAdmin` flag no API or table ever returns —
                  so it showed on EVERY team, including ones with a lead,
                  and its "Become team admin" button PATCHed a key the route
                  schema strips, then toasted success. Removed until team
                  admin is a real role. */}

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
                  Team name <span className="text-black">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="focus:ring-blue-500 focus:border-[#c9a84c]"
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
                  className="focus:ring-blue-500 focus:border-[#c9a84c] resize-none"
                />
              </div>

              {/* "Team status" block (Endorsed teams + Upgrade to TT
                  Enterprise) lived here. Both options routed to
                  "coming soon" toasts and the checkbox was hard-
                  disabled. Removed until either lands as a real
                  feature — keeps Settings honest about what works. */}

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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inviteEmail.trim()) sendInvite();
                    }}
                  />
                  <Button size="sm" onClick={sendInvite}>
                    Send invite
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Someone already in this workspace is added to the team right
                  away. Anyone else is emailed an invitation, and a workspace
                  admin has to be the one to send it.
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
                          <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white text-sm font-medium">
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

              {/* A "Pending invitations — No pending invitations" block used to
                  sit here. It was static JSX: nothing ever fetched an
                  invitation, so it reported "none" over however many were
                  outstanding, including one sent from the field directly
                  above it. Removed rather than faked; outstanding invitations
                  are listed in workspace Settings, which is the screen that
                  can also resend and revoke them. */}
            </div>
          )}

          {/* TAB: Danger zone
              This tab used to be "Advanced": four permission controls (who can
              edit, who can add, who can remove, allow invite links) under a
              banner admitting none of them saved. The real model is team LEAD
              vs MEMBER, enforced in the routes, so the mock is gone and only
              the two actions that do something are left. */}
          {activeTab === "danger" && (
            <div className="space-y-4">
              {/* Archive — reversible, and now actually persisted */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  {isArchived ? (
                    <ArchiveRestore className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Archive className="h-4 w-4 text-gray-500" />
                  )}
                  <h4 className="text-sm font-medium">
                    {isArchived ? "Restore team" : "Archive team"}
                  </h4>
                </div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  {isArchived
                    ? "This team is archived. Restoring brings it back to the team list with its projects, messages and members exactly as they are."
                    : "Puts the team out of the way without losing anything. Its projects, messages and members are kept, and you can restore it here at any time."}
                </p>
                {isArchived && danger?.archivedAt && (
                  <p className="text-xs text-gray-500 mb-3">
                    Archived on{" "}
                    {new Date(danger.archivedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-black border-gray-400"
                  disabled={isArchiving}
                  onClick={() => setArchived(!isArchived)}
                >
                  {isArchiving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : isArchived ? (
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                  ) : (
                    <Archive className="h-4 w-4 mr-2" />
                  )}
                  {isArchived ? "Restore team" : "Archive team"}
                </Button>
              </div>

              {/* Delete — the only irreversible action on this screen */}
              <div className="p-4 border border-gray-300 rounded-lg bg-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="h-4 w-4 text-black" />
                  <h4 className="text-sm font-medium text-black">Delete team</h4>
                </div>
                <p className="text-xs text-black mb-3 leading-relaxed">
                  Permanent. The team&rsquo;s projects survive on their own, but its
                  conversation is destroyed and team-granted project access is
                  revoked. Archive instead if you only want it out of the way.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-black mb-3">
                  {deleteConsequences.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete team
                </Button>
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
              className="bg-[#c9a84c] hover:bg-[#a8893a]"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Team
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Sibling of the settings dialog, not a child of its content: the typed
        confirmation has to survive whatever the tab underneath is doing. Same
        component the project delete uses — this is the harder of the two, since
        a team delete also takes access away from people who are not here. */}
    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title="Delete team"
      description={`"${team.name}" will be permanently deleted. Archiving is reversible; this is not.`}
      consequences={deleteConsequences}
      confirmLabel="Delete team"
      requireText={team.name}
      onConfirm={handleDelete}
    />
    </>
  );
}
