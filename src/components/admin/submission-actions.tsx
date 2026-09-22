"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

async function errorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

interface SubmissionActionsProps {
  submissionId: string;
  currentStatus: string;
  fullMessage: string;
}

export function SubmissionActions({
  submissionId,
  currentStatus,
  fullMessage,
}: SubmissionActionsProps) {
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();

  async function updateStatus(newStatus: string) {
    if (newStatus === currentStatus || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submissionId, status: newStatus }),
      });
      if (!res.ok) {
        // The Select is controlled by the server value, so it snaps back on
        // its own; without a message the owner would not know why.
        toast.error(await errorMessage(res, "Failed to update status"));
        return;
      }
      router.refresh();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSubmission() {
    const res = await fetch(
      `/api/admin/submissions?id=${encodeURIComponent(submissionId)}`,
      { method: "DELETE" }
    );
    // A 404 means it is already gone; refreshing is the right outcome.
    if (!res.ok && res.status !== 404) {
      // ConfirmDialog shows the thrown message and stays open.
      throw new Error(await errorMessage(res, "Failed to delete submission"));
    }
    setConfirmDelete(false);
    toast.success("Submission deleted");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {/* View full message */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="View full message">
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Full Message</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground max-h-[400px] overflow-y-auto">
            {fullMessage}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status selector */}
      <Select
        value={currentStatus}
        onValueChange={updateStatus}
        disabled={loading}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NEW">New</SelectItem>
          <SelectItem value="REVIEWED">Reviewed</SelectItem>
          <SelectItem value="CONTACTED">Contacted</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        aria-label="Delete submission"
        title="Delete submission"
        disabled={loading}
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this submission?"
        description="Use this for spam or test entries. The message and its attached files are removed permanently."
        onConfirm={deleteSubmission}
      />
    </div>
  );
}
