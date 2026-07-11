"use client";

/**
 * /teams/[teamId]/knowledge — Team Knowledge tab (Asana "Conocimientos"
 * parity). A lightweight team wiki: the team's "About" description plus
 * the curated work links, so members have one place to find the team's
 * reference material.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BookOpen, FileText, Loader2, Info } from "lucide-react";
import { TeamHeader } from "@/components/teams/team-header";
import { TeamWorkSection } from "@/components/teams/team-work-section";

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  members: TeamMember[];
}

export default function TeamKnowledgePage() {
  const params = useParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/teams/${teamId}`);
        if (res.ok) setTeam(await res.json());
      } catch (e) {
        console.error("Error loading team:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Team not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamHeader team={team} activeTab="knowledge" />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-500" />
          <h2 className="text-xl font-semibold text-gray-900">Knowledge</h2>
        </div>

        {/* About */}
        <div className="bg-white border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900">About this team</h3>
          </div>
          {team.description ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {team.description}
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              No description yet. Add one from the team Overview so teammates
              understand what this team owns.
            </p>
          )}
        </div>

        {/* Resources = curated work */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Resources &amp; links</h3>
          </div>
          <TeamWorkSection teamId={teamId} />
        </div>
      </div>
    </div>
  );
}
