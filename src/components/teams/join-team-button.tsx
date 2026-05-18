"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function JoinTeamButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleJoin() {
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/join`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Could not join team");
        return;
      }
      toast.success("Joined team");
      router.push(`/teams/${teamId}`);
      router.refresh();
    } catch {
      toast.error("Could not join team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={handleJoin}
      disabled={busy}
      className="w-full bg-[#c9a84c] text-black hover:bg-[#b8973f]"
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Join this team
    </Button>
  );
}
