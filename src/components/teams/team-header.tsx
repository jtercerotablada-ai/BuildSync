"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronDown,
  Star,
  Users,
  LayoutGrid,
  MessageSquare,
  Calendar,
  BookOpen,
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
  const { value: starredTeams, setValue: setStarredTeams } = useUiState<
    Record<string, boolean>
  >("starredTeams", {});

  // One-time fold of the old browser-local store — an array of team ids
  // under "teams.starred", written by the Overview cover before both
  // surfaces agreed — so nobody's existing stars disappear. Dropping the
  // key makes this a no-op on every later mount.
  //
  // The preferences GET is read directly rather than folding into the hook's
  // value: `isHydrated` flips as soon as the localStorage cache is applied,
  // while the server request is still in flight, so folding then would run
  // against an empty map — hiding the stars saved on another device for the
  // rest of the session and re-starring teams that were un-starred there.
  // The legacy key is only dropped once we have something to fold it into,
  // so an offline visit can still migrate on the next mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let legacy: unknown;
    try {
      const raw = localStorage.getItem("teams.starred");
      if (!raw) return;
      legacy = JSON.parse(raw);
    } catch {
      try {
        localStorage.removeItem("teams.starred");
      } catch {
        // Storage disabled — nothing to clean up.
      }
      return;
    }
    const legacyIds = Array.isArray(legacy)
      ? (legacy as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    const dropLegacy = () => {
      try {
        localStorage.removeItem("teams.starred");
      } catch {
        // Storage disabled — the fold above is idempotent anyway.
      }
    };
    if (legacyIds.length === 0) {
      dropLegacy();
      return;
    }
    let canceled = false;
    fetch("/api/users/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (canceled || !data) return;
        const server = (data.uiState?.starredTeams ?? {}) as Record<
          string,
          boolean
        >;
        const merged = { ...server };
        let changed = false;
        for (const id of legacyIds) {
          // `undefined` only — a stored `false` is a deliberate un-star.
          if (merged[id] === undefined) {
            merged[id] = true;
            changed = true;
          }
        }
        if (changed) setStarredTeams(merged);
        dropLegacy();
      })
      .catch(() => {
        // Offline — keep the legacy key and try again on the next mount.
      });
    return () => {
      canceled = true;
    };
  }, [setStarredTeams]);

  // An un-star is stored as an explicit `false`, never as a missing key: PATCH
  // /api/users/preferences merges object-valued uiState keys one level deep,
  // so a deleted key is restored from the stored map and the un-star would
  // never reach the server.
  const isStarred = starredTeams[teamId] === true;

  const toggleStar = useCallback(() => {
    setStarredTeams((prev) => ({ ...prev, [teamId]: prev[teamId] !== true }));
  }, [teamId, setStarredTeams]);

  return { isStarred, toggleStar };
}

interface TeamMember {
  id: string;
  // Optional so a leaner caller still compiles; every page that renders this
  // header passes the raw /api/teams/:id payload, which carries it. It is what
  // decides whether the lead-only actions below are drawn at all.
  role?: string;
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
  // Our own copy of the roster — see the effect below for why the header
  // keeps one instead of trusting the prop alone.
  const [fetchedMembers, setFetchedMembers] = useState<{
    teamId: string;
    rows: TeamMember[];
  } | null>(null);
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
      if (Array.isArray(fresh.members)) {
        setFetchedMembers({ teamId: team.id, rows: fresh.members });
      }
    } catch {
      // Keep showing the last known values rather than blanking the header.
    }
  };
  // Starring lived in a local useState, so it reset every time the user
  // moved between the team's tabs (each page remounts this header) and
  // never survived a reload.
  const { isStarred, toggleStar } = useTeamStar(team.id);

  // ── Who may actually use the actions in this header ──────────────
  const { data: session } = useSession();
  const currentUserId =
    (session?.user as { id?: string } | undefined)?.id || null;
  // The primary-workspace role the jwt callback resolves. The invite route
  // checks the role in the TEAM's workspace; for a single-workspace firm
  // those are the same row, and when they aren't the route still decides —
  // this only governs whether the button is offered.
  const workspaceRole =
    (session?.user as { role?: string | null } | undefined)?.role ?? null;

  // Membership normally rides in on the prop (every page here passes the raw
  // /api/teams/:id payload). We keep our own copy anyway so adding someone
  // from the dialog updates the avatar row and the picker's exclusion list
  // without the host page refetching; and when a caller gives us no members
  // at all we resolve them rather than guess — guessing "member" paints
  // buttons that 403, guessing "not" hides Add member from a lead.
  useEffect(() => {
    if (team.members) return;
    let canceled = false;
    fetch(`/api/teams/${team.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((fresh) => {
        if (!canceled && Array.isArray(fresh?.members)) {
          setFetchedMembers({
            teamId: team.id,
            rows: fresh.members as TeamMember[],
          });
        }
      })
      .catch(() => {
        // Leave membership unknown — the actions stay hidden, which is the
        // safe direction: nothing offered is nothing that dead-ends.
      });
    return () => {
      canceled = true;
    };
  }, [team.id, team.members]);

  const members =
    fetchedMembers && fetchedMembers.teamId === team.id
      ? fetchedMembers.rows
      : team.members;
  const myMembership = currentUserId
    ? members?.find((m) => m.user.id === currentUserId)
    : undefined;
  const isLead = myMembership?.role === "LEAD";
  // Exactly the gate POST /api/teams/:teamId/invite enforces: you must be ON
  // the team, and then either its LEAD or a workspace ADMIN/OWNER. This button
  // used to render for everyone, so a colleague filled in an address and got
  // "Only team leads or workspace admins can invite members".
  const canInvite =
    !!myMembership &&
    (isLead || workspaceRole === "ADMIN" || workspaceRole === "OWNER");

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

  const memberCount = members?.length || 0;

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
                    didn't give us enough of the team to open it.

                    Delete is lead-only because DELETE /api/teams/:id is; the
                    settings dialog also carries archive/restore, which PATCH
                    opens to a workspace OWNER/ADMIN, so it follows canInvite
                    (the same on-the-team-plus-lead-or-ws-admin set) and hides
                    its own lead-only General tab for the rest. This menu used
                    to show both to every member. */}
                {(isLead || canInvite) && (
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
                )}
                <DropdownMenuItem
                  onClick={() => router.push(`/teams/${team.id}/members`)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  {canInvite ? "Manage members" : "View members"}
                </DropdownMenuItem>
                {isLead && (
                  <>
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
                  </>
                )}
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
              {members?.slice(0, 3).map((member) => (
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

            {/* Invite button — only for someone the invite route will let
                through. See canInvite above. */}
            {canInvite && (
              <Button
                className="bg-black hover:bg-black gap-2"
                onClick={() => setShowInviteModal(true)}
              >
                <Users className="h-4 w-4" />
                Add member
              </Button>
            )}
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
        privacy={view.privacy}
        existingMemberIds={members?.map((m) => m.user.id)}
        onInviteSent={reloadTeam}
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
          canEditDetails={isLead}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete team"
        // Not "everything scoped to it": the next bullet says the projects
        // survive, and a description that contradicts its own consequence list
        // teaches the reader to skip both.
        description={`"${view.name}" is deleted. This cannot be undone — here is exactly what goes and what stays.`}
        consequences={[
          "Team messages, knowledge entries and custom fields are deleted",
          // Measured, not assumed: Project.teamId is SET NULL, so the jobs and
          // their tasks survive — but a project attached to a team grants
          // Editor access to every team member dynamically, so anyone whose
          // only claim to those jobs was this team quietly loses them.
          "The team's projects, tasks and goals stay, but lose their team",
          "Anyone whose access to those projects came from this team loses it",
          "Archiving instead keeps all of it and can be undone",
        ]}
        confirmLabel="Delete team"
        requireText={view.name}
        onConfirm={deleteTeam}
      />
    </>
  );
}
