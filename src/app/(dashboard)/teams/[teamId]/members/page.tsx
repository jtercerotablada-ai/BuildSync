"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  MoreHorizontal,
  UserPlus,
  Mail,
  Shield,
  UserMinus,
  Loader2,
  Search,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamHeader } from "@/components/teams/team-header";
import { InviteTeamModal } from "@/components/teams/invite-team-modal";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    jobTitle: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  avatar: string | null;
  members: TeamMember[];
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TeamMembersPage() {
  const params = useParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    fetchTeam();
  }, [teamId]);

  async function fetchTeam() {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      }
    } catch (error) {
      console.error("Error fetching team:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Member removed from team");
        fetchTeam();
      } else {
        toast.error("Error removing member");
      }
    } catch (error) {
      toast.error("Error removing member");
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        toast.success("Role updated");
        fetchTeam();
      } else {
        toast.error("Error updating role");
      }
    } catch (error) {
      toast.error("Error updating role");
    }
  };

  const filteredMembers =
    team?.members.filter((member) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        member.user.name?.toLowerCase().includes(searchLower) ||
        member.user.email?.toLowerCase().includes(searchLower)
      );
    }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return <div>Team not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamHeader team={team} activeTab="members" />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Members</h2>
            <p className="text-sm text-gray-500">
              {team.members.length} member{team.members.length !== 1 ? "s" : ""}{" "}
              in this team
            </p>
          </div>

          <Button
            onClick={() => setShowInviteModal(true)}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Invite members
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members..."
            className="pl-10"
          />
        </div>

        {/* Members list */}
        <div className="bg-white border rounded-xl divide-y">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback className="bg-purple-100 text-purple-700">
                    {getInitials(member.user.name)}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {member.user.name || "No name"}
                    </span>
                    <Badge
                      variant={member.role === "LEAD" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {member.role === "LEAD" ? "Lead" : "Member"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{member.user.email}</span>
                    {member.user.jobTitle && (
                      <>
                        <span>•</span>
                        <span>{member.user.jobTitle}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Joined {formatDate(member.joinedAt)}
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Mail className="h-4 w-4 mr-2" />
                      Send message
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {member.role === "MEMBER" ? (
                      <DropdownMenuItem
                        onClick={() => handleChangeRole(member.id, "LEAD")}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Make lead
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleChangeRole(member.id, "MEMBER")}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Remove as lead
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove from team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {filteredMembers.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {searchQuery
                ? "No members found"
                : "No members in this team"}
            </div>
          )}
        </div>
      </div>

      <InviteTeamModal
        teamId={teamId}
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSent={fetchTeam}
      />
    </div>
  );
}
