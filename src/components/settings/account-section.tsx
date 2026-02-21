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

interface AccountSectionProps {
  name: string | null;
  email: string | null;
  createdAt: string;
}

export function AccountSection({ name, email, createdAt }: AccountSectionProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

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
        body: JSON.stringify({ confirmation }),
      });

      if (!res.ok) {
        const data = await res.json();
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
      <div>
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">
          Account information and danger zone
        </p>
      </div>

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
      <div className="rounded-lg border border-red-200 p-4 space-y-4 max-w-md">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h3 className="text-sm font-semibold text-red-600">Danger zone</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Once you delete your account, there is no going back. All your data
          will be permanently removed.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Delete account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your
                account and remove all your data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmation !== "DELETE" || deleting}
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
