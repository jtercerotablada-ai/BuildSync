"use client";

import { useState } from "react";
import {
  X,
  AlertTriangle,
  Mail,
  Lock,
  Globe,
  ExternalLink,
  BadgeCheck,
  Trash2,
  Loader2,
  UserPlus,
  ChevronDown,
  Pencil,
  Users,
  Link2,
  Settings,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TeamSettingsModalProps {
  team: {
    id: string;
    name: string;
    description?: string | null;
    privacy: "PUBLIC" | "REQUEST_TO_JOIN" | "PRIVATE";
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
  const [isApproved, setIsApproved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        toast.success("Team settings saved");
        onSave?.();
        onClose();
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Team settings</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-6 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "general" && (
          <div className="space-y-6 py-4">
            {/* Admin Warning Banner */}
            <div className="flex items-start gap-3 p-4 bg-white border border-black rounded-lg">
              <AlertTriangle className="h-5 w-5 text-black flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-700">
                  {team.name} does not have a team admin.
                </p>
                <button className="text-sm text-black hover:underline">
                  What is a team admin?
                </button>
              </div>
              <Button variant="outline" size="sm">
                Become team admin
              </Button>
            </div>

            {/* Organization */}
            <div>
              <Label className="text-sm text-gray-500">Organization</Label>
              <p className="text-sm font-medium mt-1">
                {team.workspace?.name || "My organization"}
              </p>
            </div>

            {/* Team Name */}
            <div>
              <Label htmlFor="team-name" className="text-sm">
                Team name <span className="text-black">*</span>
              </Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="team-description" className="text-sm">
                Description
              </Label>
              <Textarea
                id="team-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose and responsibilities of your team"
                className="mt-1 min-h-[100px]"
              />
            </div>

            {/* Team Status (Approved) */}
            <div>
              <Label className="text-sm">Team status</Label>
              <div className="mt-2 flex items-start gap-3">
                <Checkbox
                  id="approved"
                  checked={isApproved}
                  onCheckedChange={(checked) => setIsApproved(checked as boolean)}
                  disabled
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <label htmlFor="approved" className="text-sm font-medium">
                      Approved
                    </label>
                    <BadgeCheck className="h-4 w-4 text-black" />
                    <button className="text-sm text-black hover:underline">
                      Upgrade to Enterprise
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Your organization admins recommend verified teams.{" "}
                    <button className="text-black hover:underline">Learn more</button>
                  </p>
                </div>
              </div>
            </div>

            {/* Team Privacy */}
            <div>
              <Label className="text-sm">Team privacy</Label>
              <RadioGroup
                value={privacy}
                onValueChange={(value) => setPrivacy(value as typeof privacy)}
                className="mt-3 space-y-3"
              >
                {/* Membership by request */}
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="REQUEST_TO_JOIN" id="privacy-request" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <label htmlFor="privacy-request" className="text-sm font-medium">
                        Membership by request
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Members must request to join the team
                    </p>
                  </div>
                </div>

                {/* Private */}
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="PRIVATE" id="privacy-private" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-gray-500" />
                      <label htmlFor="privacy-private" className="text-sm font-medium">
                        Private
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Members must be invited to join the team
                    </p>
                  </div>
                </div>

                {/* Public */}
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="PUBLIC" id="privacy-public" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <label htmlFor="privacy-public" className="text-sm font-medium">
                        Public to organization
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Anyone in the organization can join this team
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div className="py-4 space-y-6">
            {/* Invite Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Invite people</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email addresses"
                  className="flex-1"
                />
                <Button size="sm">
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
                <span className="text-xs text-gray-500">2 members</span>
              </div>

              <div className="border rounded-lg divide-y">
                {/* Member Row Example */}
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white text-sm font-medium">
                      JT
                    </div>
                    <div>
                      <p className="text-sm font-medium">Juan Tercero</p>
                      <p className="text-xs text-gray-500">juan@example.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100">
                      Team lead
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white text-sm font-medium">
                      TM
                    </div>
                    <div>
                      <p className="text-sm font-medium">Team Member</p>
                      <p className="text-xs text-gray-500">member@example.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100">
                      Member
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Invitations */}
            <div className="space-y-3">
              <span className="text-sm font-medium">Pending invitations</span>
              <p className="text-xs text-gray-500">No pending invitations</p>
            </div>
          </div>
        )}

        {activeTab === "advanced" && (
          <div className="py-4 space-y-6">
            {/* Editing Permissions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Editing permissions</span>
              </div>
              <div className="space-y-2 pl-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Who can edit team name and description</span>
                  <button className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                    Team admins only
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Who can edit team privacy</span>
                  <button className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                    Team admins only
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Fields Configuration */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Fields configuration</span>
              </div>
              <div className="space-y-2 pl-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Who can add and edit fields</span>
                  <button className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                    All team members
                    <ChevronDown className="h-3 w-3" />
                  </button>
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
                  <button className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                    All team members
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Who can remove team members</span>
                  <button className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                    Team admins only
                    <ChevronDown className="h-3 w-3" />
                  </button>
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
                  <Checkbox
                    checked={true}
                    disabled
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Anyone with the invite link can join the team
                </p>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-4 border border-black rounded-lg bg-white">
              <h4 className="text-sm font-medium text-black">Danger zone</h4>
              <p className="text-xs text-black mt-1 mb-3">
                These actions are irreversible
              </p>
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
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
