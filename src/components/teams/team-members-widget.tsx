"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InviteTeamModal } from "./invite-team-modal";

interface Member {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface TeamMembersWidgetProps {
  teamId: string;
  members: Member[];
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamMembersWidget({ teamId, members }: TeamMembersWidgetProps) {
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <>
      <div className="bg-white border rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Miembros</h3>
          <button
            className="text-sm text-blue-600 hover:underline"
            onClick={() => router.push(`/teams/${teamId}/members`)}
          >
            Ver la lista de {members.length} elemento{members.length !== 1 ? "s" : ""}
          </button>
        </div>

        {/* Members avatars */}
        <div className="flex items-center gap-2 flex-wrap">
          {members.slice(0, 8).map((member) => (
            <Avatar
              key={member.id}
              className="h-10 w-10 border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
              title={member.user.name || member.user.email || "Member"}
            >
              <AvatarImage src={member.user.image || undefined} />
              <AvatarFallback className="text-sm bg-purple-100 text-purple-700">
                {getInitials(member.user.name)}
              </AvatarFallback>
            </Avatar>
          ))}

          {/* Add member button */}
          <button
            onClick={() => setShowInviteModal(true)}
            className="h-10 w-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>

          {/* Show more indicator */}
          {members.length > 8 && (
            <span className="text-sm text-gray-500">+{members.length - 8}</span>
          )}
        </div>
      </div>

      <InviteTeamModal
        teamId={teamId}
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </>
  );
}
