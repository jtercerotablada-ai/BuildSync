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
import { Eye } from "lucide-react";

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
  const router = useRouter();

  async function updateStatus(newStatus: string) {
    if (newStatus === currentStatus) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submissionId, status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* View full message */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
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
    </div>
  );
}
