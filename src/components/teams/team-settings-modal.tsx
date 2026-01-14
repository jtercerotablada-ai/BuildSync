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
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-700">
                  {team.name} does not have a team admin.
                </p>
                <button className="text-sm text-blue-600 hover:underline">
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
                Team name <span className="text-red-500">*</span>
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
                    <BadgeCheck className="h-4 w-4 text-blue-500" />
                    <button className="text-sm text-blue-600 hover:underline">
                      Upgrade to Enterprise
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Your organization admins recommend verified teams.{" "}
                    <button className="text-blue-600 hover:underline">Learn more</button>
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
          <div className="py-4">
            <p className="text-sm text-gray-500">
              Manage team members here.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Use the Members tab on the team page to add or remove members.
            </p>
          </div>
        )}

        {activeTab === "advanced" && (
          <div className="py-4 space-y-6">
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <h4 className="text-sm font-medium text-red-800">Danger zone</h4>
              <p className="text-xs text-red-600 mt-1 mb-3">
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
