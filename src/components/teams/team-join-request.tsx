"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface ExistingJoinRequest {
  status: string;
  message: string | null;
  createdAt: string;
}

/**
 * "Request to join" for a REQUEST_TO_JOIN team.
 *
 * Separate from JoinTeamButton because the two are different acts: that
 * one adds you, this one asks. A PENDING request renders as state, not as
 * a button that can be pressed again — the screen has to show that the
 * ask already landed, or people re-send it and the lead's queue fills
 * with the same person.
 */
export function TeamJoinRequest({
  teamId,
  existing,
}: {
  teamId: string;
  existing: ExistingJoinRequest | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Optimistic local copy so the pending state appears without a round
  // trip through the server component.
  const [request, setRequest] = useState<ExistingJoinRequest | null>(existing);

  async function handleRequest() {
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not send your request");
        return;
      }
      setRequest({
        status: "PENDING",
        message: note.trim() || null,
        createdAt: new Date().toISOString(),
      });
      toast.success("Request sent to the team leads");
      router.refresh();
    } catch {
      toast.error("Could not send your request");
    } finally {
      setBusy(false);
    }
  }

  if (request?.status === "PENDING") {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <Clock className="h-4 w-4 text-gray-500" />
          Request pending
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          A team lead has to approve you. You&apos;ll get an Inbox
          notification either way.
        </p>
        {request.message && (
          <p className="mt-2 border-l-2 border-gray-300 pl-2 text-xs italic text-gray-600">
            {request.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {request?.status === "DECLINED" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Your last request wasn&apos;t approved. You can ask again.
        </div>
      )}
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Add a note for the team leads (optional)"
        className="text-sm"
      />
      <Button
        onClick={handleRequest}
        disabled={busy}
        className="w-full bg-[#c9a84c] text-black hover:bg-[#b8973f]"
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Request to join
      </Button>
    </div>
  );
}
