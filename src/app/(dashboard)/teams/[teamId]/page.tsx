"use client";

/**
 * /teams/[teamId] — Team Overview (Asana "Resumen" parity).
 *
 * Faithful replica of Asana's team overview page:
 *
 *   1. Cover header — team color band with the team name, a favorite
 *      star, and a palette button to recolor the team.
 *   2. Tab strip    — Overview · Members · All work · Messages ·
 *      Calendar · Knowledge, plus an "Add tab" affordance.
 *   3. Description  — click-to-edit inline description (leads only).
 *   4. Setup checklist — "Finish setting up your team" with the three
 *      Asana onboarding steps (add description / add work / add
 *      teammates), dismissible, auto-hides when complete.
 *   5. Curated work — linkable list of the team's important work.
 *   6. Members widget — avatar grid + invite.
 *   7. Goals widget — team objectives with create/empty state.
 *
 * The PMI-grade capacity matrix and project analytics that used to
 * live here now belong on the Members / All work sub-tabs; the
 * overview mirrors Asana so the two products feel identical.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Users,
  FolderKanban,
  LayoutGrid,
  MessageSquare,
  Calendar,
  BookOpen,
  Loader2,
  Settings,
  UserPlus,
  Star,
  Globe,
  Lock,
  Plus,
  Check,
  Image as ImageIcon,
  Upload,
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
import {
  InviteTeamModal,
  TeamSettingsModal,
  TeamSetupBanner,
  TeamWorkSection,
  TeamMembersWidget,
  TeamGoalsWidget,
} from "@/components/teams";
import type { TeamWorkSectionHandle } from "@/components/teams/team-work-section";

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
  color: string | null;
  avatar: string | null;
  privacy: "PUBLIC" | "REQUEST_TO_JOIN" | "PRIVATE";
  workspace?: { id: string; name: string };
  members: TeamMember[];
  objectives: {
    id: string;
    name: string;
    progress: number;
    status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | null;
  }[];
  _count: { projects: number; members: number };
}

// Asana-style cover palette. Stable per-team when no color is stored.
const COVER_COLORS = [
  "#4573d2", // blue
  "#6457c9", // indigo
  "#8f4bd6", // purple
  "#c057b8", // magenta
  "#d64b6a", // rose
  "#e07b39", // orange
  "#b8a534", // gold
  "#3aa35a", // green
  "#2aa8a8", // teal
  "#5c6a7a", // slate
];

function coverColorFor(team: Pick<Team, "id" | "color">): string {
  if (team.color && /^#[0-9a-fA-F]{6}$/.test(team.color)) return team.color;
  let sum = 0;
  for (const ch of team.id) sum += ch.charCodeAt(0);
  return COVER_COLORS[sum % COVER_COLORS.length];
}

export default function TeamOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const teamId = params.teamId as string;
  const currentUserId =
    (session?.user as { id?: string } | undefined)?.id || null;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [starred, setStarred] = useState(false);

  // Inline description editing
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Cover color + image popover
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const workSectionRef = useRef<TeamWorkSectionHandle>(null);

  const fetchTeam = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) setTeam(await res.json());
    } catch (e) {
      console.error("Error loading team:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Star state (localStorage — mirrors the goal-detail pattern).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("teams.starred");
      const list: string[] = raw ? JSON.parse(raw) : [];
      setStarred(list.includes(teamId));
    } catch {
      // ignore
    }
  }, [teamId]);

  function toggleStar() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("teams.starred");
      const list: string[] = raw ? JSON.parse(raw) : [];
      const next = list.includes(teamId)
        ? list.filter((id) => id !== teamId)
        : [...list, teamId];
      localStorage.setItem("teams.starred", JSON.stringify(next));
      setStarred(next.includes(teamId));
    } catch {
      toast.error("Couldn't update star");
    }
  }

  const myMembership = currentUserId
    ? team?.members.find((m) => m.user.id === currentUserId)
    : undefined;
  const isLead = myMembership?.role === "LEAD";
  // Any team member can edit the description (Asana parity); color/settings
  // stay lead-only.
  const isMember = !!myMembership;

  function startEditDesc() {
    if (!isMember) return;
    setDescDraft(team?.description || "");
    setEditingDesc(true);
    setTimeout(() => descRef.current?.focus(), 0);
  }

  async function saveDesc() {
    if (!team) return;
    const next = descDraft.trim();
    if (next === (team.description || "")) {
      setEditingDesc(false);
      return;
    }
    setSavingDesc(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: next || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      toast.success("Description updated");
      setEditingDesc(false);
      fetchTeam();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save description");
    } finally {
      setSavingDesc(false);
    }
  }

  async function changeColor(color: string) {
    setShowColorMenu(false);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      fetchTeam();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change color");
    }
  }

  async function handleAvatarSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    // Reset the input so selecting the same file again re-triggers change.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setShowColorMenu(false);
    setUploadingAvatar(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/teams/${teamId}/avatar`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      toast.success("Cover image updated");
      fetchTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload image");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    setShowColorMenu(false);
    try {
      const res = await fetch(`/api/teams/${teamId}/avatar`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success("Cover image removed");
      fetchTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove image");
    }
  }

  function handleSetupStep(stepId: string) {
    if (stepId === "description") startEditDesc();
    else if (stepId === "work") workSectionRef.current?.openAddWork();
    else if (stepId === "members") setShowInvite(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <h2 className="text-lg font-semibold">Team not found</h2>
        <Button onClick={() => router.push("/teams")}>Back to teams</Button>
      </div>
    );
  }

  const teamInitial = team.name.charAt(0).toUpperCase();
  const PrivacyIcon = team.privacy === "PRIVATE" ? Lock : Globe;
  const cover = coverColorFor(team);
  const memberCount = team._count.members;

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutGrid, href: `/teams/${teamId}` },
    { id: "members", label: "Members", icon: Users, href: `/teams/${teamId}/members` },
    { id: "work", label: "All work", icon: FolderKanban, href: `/teams/${teamId}/work` },
    { id: "messages", label: "Messages", icon: MessageSquare, href: `/teams/${teamId}/messages` },
    { id: "calendar", label: "Calendar", icon: Calendar, href: `/teams/${teamId}/calendar` },
    { id: "knowledge", label: "Knowledge", icon: BookOpen, href: `/teams/${teamId}/knowledge` },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* ── COVER HEADER ─────────────────────────────────────────── */}
      <div className="relative">
        <div
          className="h-32 md:h-40 w-full bg-cover bg-center"
          style={
            team.avatar
              ? { backgroundImage: `url(${team.avatar})` }
              : {
                  background: `linear-gradient(135deg, ${cover} 0%, ${cover}cc 100%)`,
                }
          }
        >
          {/* legibility overlay — a touch darker over a photo so the white
              team name + actions stay readable */}
          <div
            className={cn(
              "absolute inset-0 h-32 md:h-40",
              team.avatar
                ? "bg-gradient-to-t from-black/55 via-black/20 to-black/10"
                : "bg-gradient-to-t from-black/35 via-black/5 to-transparent"
            )}
          />

          {/* top-right cover actions */}
          <div className="absolute top-3 right-4 flex items-center gap-1.5">
            {isLead && (
              <DropdownMenu open={showColorMenu} onOpenChange={setShowColorMenu}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-medium backdrop-blur-sm transition-colors"
                    title="Change color or image"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Cover</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 p-2">
                  {/* Image */}
                  <button
                    onClick={() => {
                      setShowColorMenu(false);
                      avatarInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-2 h-8 rounded text-[13px] text-gray-700 hover:bg-black/[0.04] transition-colors"
                  >
                    <Upload className="h-4 w-4 text-gray-400" />
                    {team.avatar ? "Replace image" : "Upload image"}
                  </button>
                  {team.avatar && (
                    <button
                      onClick={removeAvatar}
                      className="w-full flex items-center gap-2 px-2 h-8 rounded text-[13px] text-gray-700 hover:bg-black/[0.04] transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-gray-400" />
                      Remove image
                    </button>
                  )}

                  <div className="my-1.5 border-t border-gray-200" />

                  {/* Color */}
                  <p className="px-2 pb-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                    Color
                  </p>
                  <div className="grid grid-cols-5 gap-1.5 px-1">
                    {COVER_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => changeColor(c)}
                        className={cn(
                          "h-6 w-6 rounded-full ring-2 ring-transparent hover:ring-gray-300 transition-all flex items-center justify-center",
                          !team.avatar &&
                            cover.toLowerCase() === c.toLowerCase() &&
                            "ring-gray-900"
                        )}
                        style={{ backgroundColor: c }}
                        title={c}
                      >
                        {!team.avatar &&
                          cover.toLowerCase() === c.toLowerCase() && (
                            <Check className="h-3.5 w-3.5 text-white" />
                          )}
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={toggleStar}
              className={cn(
                "h-8 w-8 inline-flex items-center justify-center rounded-md bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors",
                starred ? "text-[#ffd54a]" : "text-white"
              )}
              aria-label={starred ? "Unstar team" : "Star team"}
            >
              <Star className={cn("h-4 w-4", starred && "fill-current")} />
            </button>
          </div>

          {/* bottom-left identity */}
          <div className="absolute bottom-3 left-4 md:left-6 flex items-end gap-3 md:gap-4">
            <div
              className="w-14 h-14 md:w-16 md:h-16 rounded-xl ring-4 ring-white/90 flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ backgroundColor: cover }}
            >
              {team.avatar ? (
                // Team avatar is an arbitrary uploaded URL; next/image would
                // require whitelisting every possible host, so a plain img is
                // intentional here (matches team-header.tsx).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.avatar}
                  alt=""
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <span className="text-2xl md:text-3xl font-light text-white">
                  {teamInitial}
                </span>
              )}
            </div>
            <div className="min-w-0 pb-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80 flex items-center gap-1.5">
                {team.workspace?.name || "Workspace"}
                <span className="text-white/50">·</span>
                <span className="inline-flex items-center gap-1">
                  <PrivacyIcon className="h-2.5 w-2.5" />
                  {team.privacy === "PRIVATE" ? "Private" : "Public"}
                </span>
              </p>
              <h1 className="text-xl md:text-2xl font-bold text-white truncate drop-shadow-sm">
                {team.name}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB STRIP + ACTIONS ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-2 md:px-4 border-b bg-white">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === "overview";
            return (
              <Link
                key={t.id}
                href={t.href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0",
                  isActive
                    ? "border-black text-black"
                    : "border-transparent text-gray-500 hover:text-black"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </Link>
            );
          })}
          {/* Add tab */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 h-7 w-7 inline-flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Add tab"
              >
                <Plus className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem
                onClick={() => router.push(`/teams/${teamId}/knowledge`)}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Knowledge base
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/teams/${teamId}/calendar`)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Calendar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Plus className="h-4 w-4 mr-2" />
                App integrations (soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 flex-shrink-0 pr-1">
          <div className="hidden sm:flex -space-x-2">
            {team.members.slice(0, 4).map((m) => (
              <Avatar
                key={m.id}
                className="h-7 w-7 border-2 border-white"
                title={m.user.name || m.user.email || "Member"}
              >
                <AvatarImage src={m.user.image || undefined} />
                <AvatarFallback className="text-[10px] bg-gray-100 text-black">
                  {(m.user.name || m.user.email || "?")
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {memberCount > 4 && (
              <div className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                <span className="text-[10px] text-gray-600">
                  +{memberCount - 4}
                </span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInvite(true)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Invite
          </Button>
          {isLead && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden md:inline-flex"
              onClick={() => setShowSettings(true)}
              aria-label="Team settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 md:px-6 py-5 md:py-6 max-w-[1200px] mx-auto w-full space-y-5">
          {/* Description */}
          <div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  ref={descRef}
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingDesc(false);
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                      saveDesc();
                  }}
                  placeholder="Describe the purpose and responsibilities of your team…"
                  className="w-full min-h-[80px] resize-y rounded-lg border border-gray-300 focus:border-black focus:ring-0 focus:outline-none p-3 text-sm text-gray-800"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveDesc} disabled={savingDesc}>
                    {savingDesc && (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingDesc(false)}
                  >
                    Cancel
                  </Button>
                  <span className="text-[11px] text-gray-400 ml-1">
                    ⌘+Enter to save · Esc to cancel
                  </span>
                </div>
              </div>
            ) : team.description ? (
              <button
                onClick={startEditDesc}
                className={cn(
                  "block w-full text-left text-sm text-gray-700 whitespace-pre-wrap rounded-lg p-3 -m-3 transition-colors",
                  isMember && "hover:bg-gray-50 cursor-text"
                )}
                title={isMember ? "Click to edit" : undefined}
              >
                {team.description}
              </button>
            ) : (
              <button
                onClick={startEditDesc}
                disabled={!isMember}
                className={cn(
                  "block w-full text-left text-sm text-gray-400 rounded-lg p-3 -m-3 transition-colors",
                  isMember
                    ? "hover:bg-gray-50 cursor-text"
                    : "cursor-default"
                )}
              >
                {isMember
                  ? "Click to add the team description…"
                  : "No team description yet."}
              </button>
            )}
          </div>

          {/* Setup checklist — only the team's own members see onboarding */}
          {isMember && (
            <TeamSetupBanner team={team} onStepClick={handleSetupStep} />
          )}

          {/* Two-column: curated work | members + goals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <TeamWorkSection
                ref={workSectionRef}
                teamId={teamId}
                onWorkChanged={fetchTeam}
              />
            </div>
            <div className="space-y-5">
              <TeamMembersWidget teamId={teamId} members={team.members} />
              <TeamGoalsWidget teamId={teamId} goals={team.objectives} />
            </div>
          </div>
        </div>
      </div>

      <InviteTeamModal
        teamId={teamId}
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInviteSent={fetchTeam}
      />
      <TeamSettingsModal
        team={{
          id: team.id,
          name: team.name,
          description: team.description,
          privacy: team.privacy,
          workspace: team.workspace ? { name: team.workspace.name } : null,
        }}
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={fetchTeam}
      />

      {/* Hidden file input driving the cover "Upload image" action */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarSelected}
      />
    </div>
  );
}
