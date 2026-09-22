"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Calendar, Mail, User } from "lucide-react";
import { toast } from "sonner";

interface DeletionPreview {
  requiresPassword: boolean;
  blockers: {
    workspaceId: string;
    workspaceName: string;
    reason: "sole-owner" | "no-heir";
  }[];
  transfers: {
    workspaceId: string;
    workspaceName: string;
    heirName: string;
    counts: {
      projects: number;
      uploads: number;
      templates: number;
      goals?: number;
      portfolios?: number;
    };
  }[];
  soloWorkspaces: { workspaceId: string; workspaceName: string }[];
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function blockerNames(
  blockers: DeletionPreview["blockers"],
  reason: DeletionPreview["blockers"][number]["reason"]
) {
  return blockers
    .filter((b) => b.reason === reason)
    .map((b) => b.workspaceName)
    .join(", ");
}

/** "a, b and c" */
function listJoin(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

interface AccountSectionProps {
  name: string | null;
  email: string | null;
  createdAt: string;
}

export function AccountSection({ name, email, createdAt }: AccountSectionProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // The server decides who inherits what; ask it every time the dialog
  // opens so the confirmation describes what will actually happen.
  async function loadPreview() {
    setLoadingPreview(true);
    setPreview(null);
    setPreviewError(null);
    try {
      const res = await fetch("/api/users/account");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load account details");
      }
      setPreview(data as DeletionPreview);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Failed to load account details"
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setConfirmation("");
      setPassword("");
      void loadPreview();
    }
  }

  const blocked = !!preview && preview.blockers.length > 0;
  const canSubmit =
    !!preview &&
    !blocked &&
    confirmation === "DELETE" &&
    (!preview.requiresPassword || password.length > 0) &&
    !deleting;

  const memberSince = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleDelete() {
    if (confirmation !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/users/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete account");
      }

      toast.success("Account deleted");
      signOut({ callbackUrl: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="rounded-lg border p-4 space-y-3 max-w-md">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{name || "No name set"}</span>
        </div>
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{email}</span>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Member since {memberSince}</span>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-gray-300 p-4 space-y-4 max-w-md">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-black" />
          <h3 className="text-sm font-semibold text-black">Danger zone</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Once you delete your account, there is no going back. Project files,
          attachments, templates and goal updates you added stay with your
          team and are handed to another member.
        </p>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Delete account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. Your sign-in, memberships,
                notifications, private dashboards and direct messages will be
                permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {loadingPreview && (
                <p className="text-muted-foreground">Checking your workspaces...</p>
              )}
              {previewError && (
                <div className="space-y-2">
                  <p className="text-red-600">{previewError}</p>
                  <Button variant="outline" size="sm" onClick={() => void loadPreview()}>
                    Try again
                  </Button>
                </div>
              )}
              {preview && blocked && (
                <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                  {blockerNames(preview.blockers, "sole-owner") && (
                    <p>
                      You are the only owner of{" "}
                      {blockerNames(preview.blockers, "sole-owner")}, which still
                      has other members. Ownership can&apos;t be transferred in
                      the app, so remove the other members from it before
                      deleting your account.
                    </p>
                  )}
                  {blockerNames(preview.blockers, "no-heir") && (
                    <p>
                      Nobody in {blockerNames(preview.blockers, "no-heir")} can
                      take over what you own there: it has no other owner or
                      admin, and only an owner can change roles. Ask your
                      firm&apos;s administrator to add an owner or admin to it
                      before deleting your account.
                    </p>
                  )}
                </div>
              )}
              {preview && !blocked && preview.transfers.length > 0 && (
                <ul className="space-y-2">
                  {preview.transfers.map((t) => (
                    <li key={t.workspaceId} className="rounded-md border p-3">
                      <span className="font-medium">{t.workspaceName}:</span>{" "}
                      {listJoin([
                        `${plural(t.counts.projects, "project")} you own`,
                        ...(t.counts.goals
                          ? [`${plural(t.counts.goals, "goal")} you own`]
                          : []),
                        ...(t.counts.portfolios
                          ? [`${plural(t.counts.portfolios, "portfolio")} you own`]
                          : []),
                        plural(t.counts.uploads, "uploaded file"),
                        plural(t.counts.templates, "template"),
                      ])}
                      , plus your goal and status updates, will be transferred
                      to{" "}
                      <span className="font-medium">{t.heirName}</span>.
                    </li>
                  ))}
                </ul>
              )}
              {preview && !blocked && preview.soloWorkspaces.length > 0 && (
                <p className="text-muted-foreground">
                  You are the only member of{" "}
                  {preview.soloWorkspaces.map((w) => w.workspaceName).join(", ")}
                  . Content there will be deleted with your account.
                </p>
              )}
            </div>
            {preview && !blocked && (
              <div className="space-y-4 py-2">
                {preview.requiresPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="delete-password">Your password</Label>
                    <Input
                      id="delete-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="confirm">
                    Type <span className="font-semibold">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!canSubmit}
              >
                {deleting ? "Deleting..." : "Delete account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
