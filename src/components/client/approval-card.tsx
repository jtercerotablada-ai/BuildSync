"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";

interface Approval {
  id: string;
  title: string;
  description: string | null;
  status: string;
  comments: string | null;
  createdAt: string;
  projectId: string;
  projectName: string;
  taskId: string | null;
  taskName: string | null;
}

interface ApprovalCardProps {
  approval: Approval;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return { icon: Clock, bg: "bg-[#a8893a]/100/10", text: "text-[#a8893a]", label: "Pending" };
    case "APPROVED":
      return { icon: CheckCircle, bg: "bg-[#c9a84c]/100/10", text: "text-[#a8893a]", label: "Approved" };
    case "REJECTED":
      return { icon: XCircle, bg: "bg-gray-1000/10", text: "text-black", label: "Rejected" };
    case "CHANGES_REQUESTED":
      return { icon: AlertTriangle, bg: "bg-[#a8893a]/100/10", text: "text-[#a8893a]", label: "Changes Requested" };
    default:
      return { icon: Clock, bg: "bg-gray-500/10", text: "text-gray-400", label: status };
  }
}

export function ApprovalCard({ approval }: ApprovalCardProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(approval.status);

  const statusInfo = getStatusBadge(currentStatus);
  const isPending = currentStatus === "PENDING";

  async function handleAction(action: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") {
    setSubmitting(true);
    try {
      const res = await fetch("/api/client/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId: approval.id,
          status: action,
          comments: comment || undefined,
        }),
      });

      if (res.ok) {
        setCurrentStatus(action);
        setComment("");
      }
    } catch (error) {
      console.error("Failed to update approval:", error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-white/10 bg-[#151515]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-white">{approval.title}</h3>
              <Badge className={`${statusInfo.bg} ${statusInfo.text} border-0 text-[10px]`}>
                <statusInfo.icon className="mr-1 h-3 w-3" />
                {statusInfo.label}
              </Badge>
            </div>
            {approval.description && (
              <p className="mt-2 text-sm text-white/60">{approval.description}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
              <span>{approval.projectName}</span>
              {approval.taskName && (
                <>
                  <span>&middot;</span>
                  <span>{approval.taskName}</span>
                </>
              )}
              <span>&middot;</span>
              <span>{new Date(approval.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {approval.comments && !isPending && (
          <div className="mt-3 rounded-lg bg-white/5 px-4 py-3">
            <p className="text-xs text-white/40 mb-1">Your feedback:</p>
            <p className="text-sm text-white/70">{approval.comments}</p>
          </div>
        )}

        {isPending && (
          <div className="mt-4 space-y-3">
            <Textarea
              placeholder="Add feedback or comments (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="border-white/10 bg-[#0a0a0a] text-white placeholder:text-white/30 focus-visible:ring-[#c9a84c]/30 resize-none"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleAction("APPROVED")}
                disabled={submitting}
                className="bg-[#a8893a] text-white hover:bg-[#a8893a]"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                onClick={() => handleAction("CHANGES_REQUESTED")}
                disabled={submitting}
                variant="outline"
                className="border-[#a8893a]/30 text-[#a8893a] hover:bg-yellow-600/10 hover:text-yellow-300"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Request Changes
              </Button>
              <Button
                onClick={() => handleAction("REJECTED")}
                disabled={submitting}
                variant="outline"
                className="border-gray-400 text-black hover:bg-black/10 hover:text-red-300"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
