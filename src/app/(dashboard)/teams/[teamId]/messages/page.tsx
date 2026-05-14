"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { TeamHeader } from "@/components/teams/team-header";
import { MessagesView } from "@/components/views/messages-view";

/**
 * /teams/[teamId]/messages — team channel.
 *
 * Thin wrapper around the shared MessagesView component (the same
 * one project messages uses). All the heavy lifting — threads,
 * @ mentions, attachments, reactions, real-time polling — comes
 * from the shared component via `scope: { type: "team", ... }`.
 *
 * This page used to be ~800 lines of duplicated logic; centralizing
 * it eliminates drift between project + team channels and gives
 * teams threads + @ mentions for free.
 */

interface Team {
  id: string;
  name: string;
  avatar?: string | null;
  members?: Array<{
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
}

export default function TeamMessagesPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId as string;
  const { data: session } = useSession();

  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    fetch(`/api/teams/${teamId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setTeam(data ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] text-sm text-slate-500">
        Team not found.
      </div>
    );
  }

  const currentUser = session?.user
    ? {
        id: (session.user as { id?: string }).id || session.user.email || "",
        name: session.user.name || null,
        image: session.user.image || null,
      }
    : undefined;

  return (
    <div className="flex-1 flex flex-col h-full">
      <TeamHeader team={team} activeTab="messages" />
      <MessagesView
        scope={{ type: "team", teamId }}
        currentUser={currentUser}
      />
    </div>
  );
}
