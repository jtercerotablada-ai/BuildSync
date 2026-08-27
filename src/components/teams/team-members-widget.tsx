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

// Someone who joined by email invite and never set a display name would
// otherwise sit here as a bare "?"; the members list already falls back to
// the email's first two characters, so match it.
function getInitials(name: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim();
  if (!source) return "?";
  if (name?.trim()) {
    return source
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return source.slice(0, 2).toUpperCase();
}

export function TeamMembersWidget({ teamId, members }: TeamMembersWidgetProps) {
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <>
      <div className="bg-white border rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Members</h3>
          <button
            className="text-sm text-black hover:underline"
            onClick={() => router.push(`/teams/${teamId}/members`)}
          >
            View all {members.length} member{members.length !== 1 ? "s" : ""}
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
              <AvatarFallback className="text-sm bg-white text-black border border-black">
                {getInitials(member.user.name, member.user.email)}
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
