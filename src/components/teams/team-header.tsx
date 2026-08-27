"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Star,
  Users,
  LayoutGrid,
  MessageSquare,
  Calendar,
  BookOpen,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUiState } from "@/hooks/use-ui-state";
import { InviteTeamModal } from "./invite-team-modal";
import { TeamSettingsModal } from "./team-settings-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Starring a team is a per-user preference, so it belongs in server-backed
 * uiState — it follows the user across devices instead of dying with a
 * browser profile.
 *
 * Both surfaces that draw a star for the same team share this hook: this
 * header (rendered on Members / All work / Messages / Calendar / Knowledge)
 * and the Overview cover. They used to keep two independent stores, so
 * starring on one tab left the other showing a hollow star.
 */
export function useTeamStar(teamId: string) {
  const {
    value: starredTeams,
    setValue: setStarredTeams,
    isHydrated,
  } = useUiState<Record<string, boolean>>("starredTeams", {});

  // One-time fold of the old browser-local store — an array of team ids
  // under "teams.starred", written by the Overview cover before both
  // surfaces agreed — so nobody's existing stars disappear. Removing the
  // key makes this a no-op on every later mount.
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    let legacy: unknown;
    try {
      const raw = localStorage.getItem("teams.starred");
      if (!raw) return;
      legacy = JSON.parse(raw);
      localStorage.removeItem("teams.starred");
    } catch {
      return;
    }
    if (!Array.isArray(legacy) || legacy.length === 0) return;
    setStarredTeams((prev) => {
      const next = { ...prev };
      for (const id of legacy as unknown[]) {
        if (typeof id === "string") next[id] = true;
      }
      return next;
    });
  }, [isHydrated, setStarredTeams]);

  const isStarred = !!starredTeams[teamId];

  const toggleStar = useCallback(() => {
    setStarredTeams((prev) => {
      const next = { ...prev };
      if (next[teamId]) delete next[teamId];
      else next[teamId] = true;
      return next;
    });
  }, [teamId, setStarredTeams]);

  return { isStarred, toggleStar };
}

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface TeamHeaderProps {
  team: {
    id: string;
    name: string;
    avatar?: string | null;
    members?: TeamMember[];
    // Fed straight through to the settings dialog. Every page that
    // renders this header passes the raw /api/teams/:id payload, which
    // carries these; they stay optional so a leaner caller still compiles.
    description?: string | null;
    privacy?: "PUBLIC" | "REQUEST_TO_JOIN" | "PRIVATE";
    workspace?: { name: string } | null;
  };
  activeTab: "overview" | "members" | "work" | "messages" | "calendar" | "knowledge";
}

export function TeamHeader({ team, activeTab }: TeamHeaderProps) {
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Every page that renders this header holds the team in its own client
  // state, loaded once with fetch(), so router.refresh() — which only re-runs
  // server components — never repainted a rename saved in the settings
  // dialog. Re-read the team here and render our copy on top of the prop.
  const [edited, setEdited] = useState<{
    teamId: string;
    name: string;
    description: string | null;
    avatar: string | null;
    privacy: TeamHeaderProps["team"]["privacy"];
  } | null>(null);
  const view = edited && edited.teamId === team.id ? { ...team, ...edited } : team;

  const reloadTeam = async () => {
    try {
      const res = await fetch(`/api/teams/${team.id}`);
      if (!res.ok) return;
      const fresh = await res.json();
      setEdited({
        teamId: team.id,
        name: fresh.name,
        description: fresh.description ?? null,
        avatar: fresh.avatar ?? null,
        privacy: fresh.privacy,
      });
    } catch {
      // Keep showing the last known values rather than blanking the header.
    }
  };
  // Starring lived in a local useState, so it reset every time the user
  // moved between the team's tabs (each page remounts this header) and
  // never survived a reload.
  const { isStarred, toggleStar } = useTeamStar(team.id);

  // Deleting a team cascades to its messages, custom fields and knowledge
  // entries; its projects AND goals are only DETACHED (both FKs are
  // onDelete: SetNull). This used to fire straight from the dropdown, one row
  // under "Settings", with no confirmation at all.
  const deleteTeam = async () => {
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed");
      }
      toast.success("Team deleted");
      setShowDeleteConfirm(false);
      router.push("/teams");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message !== "Failed"
          ? error.message
          : "Failed to delete team"
      );
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutGrid, href: `/teams/${team.id}` },
    { id: "members", label: "Members", icon: Users, href: `/teams/${team.id}/members` },
    { id: "work", label: "All work", icon: LayoutGrid, href: `/teams/${team.id}/work` },
    { id: "messages", label: "Messages", icon: MessageSquare, href: `/teams/${team.id}/messages` },
    { id: "calendar", label: "Calendar", icon: Calendar, href: `/teams/${team.id}/calendar` },
    { id: "knowledge", label: "Knowledge", icon: BookOpen, href: `/teams/${team.id}/knowledge` },
  ];

  const memberCount = team.members?.length || 0;

  return (
    <>
      <div className="bg-white border-b sticky top-0 z-10">
        {/* Top row: Team name + actions */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Team Avatar */}
            <div className="w-8 h-8 rounded-lg bg-white border border-black flex items-center justify-center">
              {view.avatar ? (
                <img src={view.avatar} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : (
                <span className="text-sm font-medium text-black">
                  {view.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Team name dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-base font-semibold hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                  {view.name}
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {/* "Edit team" and "Settings" were two entries that both
                    navigated to the members tab. One entry, opening the
                    settings dialog — or the members tab when the caller
                    didn't give us enough of the team to open it. */}
                <DropdownMenuItem
                  onSelect={(e) => {
                    if (!view.privacy) {
                      router.push(`/teams/${team.id}/members`);
                      return;
                    }
                    e.preventDefault();
                    setShowSettings(true);
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Team settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/teams/${team.id}/members`)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage members
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-black"
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowDeleteConfirm(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Star button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isStarred && "text-black")}
              aria-label={isStarred ? "Unstar team" : "Star team"}
              onClick={toggleStar}
            >
              <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
            </Button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Member avatars preview */}
            <div className="flex -space-x-2">
              {team.members?.slice(0, 3).map((member) => (
                <Avatar key={member.id} className="h-8 w-8 border-2 border-white">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback className="text-xs bg-white text-black border border-black">
                    {member.user.name?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {memberCount > 3 && (
                <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-gray-600">+{memberCount - 3}</span>
                </div>
              )}
            </div>

            {/* Invite button */}
            <Button
              className="bg-black hover:bg-black gap-2"
              onClick={() => setShowInviteModal(true)}
            >
              <Users className="h-4 w-4" />
              Invite
            </Button>
          </div>
        </div>

        {/* Tabs row */}
        <div className="px-6 flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}

        </div>
      </div>

      {/* Invite Modal */}
      <InviteTeamModal
        teamId={team.id}
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {view.privacy && (
        <TeamSettingsModal
          team={{
            id: team.id,
            name: view.name,
            description: view.description,
            privacy: view.privacy,
            workspace: view.workspace,
          }}
          open={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={reloadTeam}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete team"
        description={`"${view.name}" and everything scoped to it will be permanently deleted. This cannot be undone.`}
        consequences={[
          "Team messages, knowledge entries and custom fields are deleted",
          "Members lose access; their tasks are not deleted",
          "The team's projects and goals stay, but lose their team",
        ]}
        confirmLabel="Delete team"
        requireText={view.name}
        onConfirm={deleteTeam}
      />
    </>
  );
}
