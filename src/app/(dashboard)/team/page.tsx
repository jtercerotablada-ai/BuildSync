"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Star,
  Users,
  Plus,
  FileText,
  FolderKanban,
  FolderPlus,
  UserPlus,
  X,
  LayoutGrid,
  MessageSquare,
  Calendar,
  BookOpen,
  Target,
  Briefcase,
  ExternalLink,
  Link2,
  Paperclip,
  Loader2,
  Settings,
  Trash2,
  Mail,
  Copy,
  Check,
  Search,
  MoreHorizontal,
  Crown,
  Shield,
  User,
  Send,
  Pin,
  Circle,
  CheckSquare,
  Type,
  Hash,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  TeamSettingsModal,
  LinkWorkPopover,
  AddFieldFlow,
  CapacityMatrix,
  type MatrixMember,
  type MatrixProject,
} from "@/components/teams";

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    jobTitle?: string | null;
  };
}

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
  _count?: { tasks: number };
}

interface MessageReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

interface Message {
  id: string;
  content: string;
  isPinned?: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  };
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  privacy: "PUBLIC" | "REQUEST_TO_JOIN" | "PRIVATE";
  _count?: {
    members: number;
    projects: number;
  };
}

type TabType = "overview" | "members" | "work" | "messages" | "calendar";

export default function TeamPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      // First, fetch teams to get the real team data
      const teamsRes = await fetch("/api/teams/list");
      let firstTeamId: string | null = null;
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);

        // Set the first team as current if available
        if (teamsData.length > 0) {
          setCurrentTeam(teamsData[0]);
          firstTeamId = teamsData[0].id;
        }
      }

      // Messages are scoped to the team — fetch from the team
      // endpoint so reactions + attachments come back along with
      // the messages themselves.
      const messagesUrl = firstTeamId
        ? `/api/teams/${firstTeamId}/messages`
        : null;

      const [membersRes, projectsRes, messagesRes] = await Promise.all([
        fetch("/api/workspace/members"),
        fetch("/api/projects"),
        messagesUrl ? fetch(messagesUrl) : Promise.resolve(null),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data);
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data);
      }
      if (messagesRes && messagesRes.ok) {
        const data = await messagesRes.json();
        // Team endpoint returns an array directly.
        setMessages(Array.isArray(data) ? data : data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSaveDescription = async () => {
    if (currentTeam) {
      setCurrentTeam({ ...currentTeam, description });
      try {
        const res = await fetch(`/api/teams/${currentTeam.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        });
        if (!res.ok) throw new Error("Failed to update description");
        toast.success("Description updated");
      } catch {
        toast.error("Failed to save description");
      }
    }
    setIsEditingDescription(false);
  };

  // Calculate setup steps completion
  const setupSteps = {
    description: !!currentTeam?.description,
    work: projects.length > 0,
    members: members.length > 1,
  };
  const completedSteps = Object.values(setupSteps).filter(Boolean).length;
  const shouldShowBanner = showSetupBanner && completedSteps < 3;

  const tabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "members", label: "Members", icon: Users },
    { id: "work", label: "All work", icon: FolderKanban },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "calendar", label: "Calendar", icon: Calendar },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // If no teams exist, show empty state
  if (!currentTeam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">No teams yet</h1>
          <p className="text-gray-500 mb-6">
            Create your first team to collaborate with your teammates on projects, goals, and more.
          </p>
          <Button
            onClick={() => router.push("/teams/new")}
            className="bg-black hover:bg-gray-800 gap-2"
          >
            <Plus className="h-4 w-4" />
            Create a team
          </Button>
        </div>
      </div>
    );
  }

  const teamName = currentTeam.name;
  const teamInitial = teamName.charAt(0).toUpperCase();
  const teamColor = currentTeam.color || "#000000";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== HEADER ========== */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Team Avatar */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: teamColor }}
            >
              <span className="text-sm font-medium text-white">{teamInitial}</span>
            </div>

            {/* Team Name Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 font-semibold hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                {teamName}
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {/* Show all teams for switching */}
                {teams.length > 1 && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-gray-500 font-medium">Switch team</div>
                    {teams.map((team) => (
                      <DropdownMenuItem
                        key={team.id}
                        onClick={() => setCurrentTeam(team)}
                        className={cn(
                          "flex items-center gap-2",
                          team.id === currentTeam.id && "bg-gray-100"
                        )}
                      >
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center text-xs text-white"
                          style={{ backgroundColor: team.color || "#000" }}
                        >
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                        {team.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit team
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/teams/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create new team
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-black" onClick={() => setShowSettingsModal(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Star */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isStarred && "text-[#a8893a]")}
              onClick={() => setIsStarred(!isStarred)}
            >
              <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
            </Button>
          </div>

          {/* Right: Avatars + Invite */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 3).map((member) => (
                <Avatar key={member.id} className="h-8 w-8 border-2 border-white">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback className="text-xs bg-white text-black border border-black">
                    {member.user.name?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {members.length > 3 && (
                <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-gray-600">+{members.length - 3}</span>
                </div>
              )}
            </div>
            <Button
              className="bg-black hover:bg-black gap-2"
              onClick={() => setShowInviteModal(true)}
            >
              <Users className="h-4 w-4" />
              Invite
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setActiveTab("overview")}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                Overview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab("work")}>
                <FolderKanban className="h-4 w-4 mr-2" />
                All work
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab("calendar")}>
                <Calendar className="h-4 w-4 mr-2" />
                Calendar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ========== CONTENT ========== */}
      {activeTab === "overview" && (
        <OverviewContent
          team={currentTeam}
          members={members}
          projects={projects}
          teamName={teamName}
          teamInitial={teamInitial}
          teamColor={teamColor}
          isEditingDescription={isEditingDescription}
          setIsEditingDescription={setIsEditingDescription}
          description={description}
          setDescription={setDescription}
          handleSaveDescription={handleSaveDescription}
          shouldShowBanner={shouldShowBanner}
          setShowSetupBanner={setShowSetupBanner}
          setupSteps={setupSteps}
          completedSteps={completedSteps}
          setShowInviteModal={setShowInviteModal}
          setShowSettingsModal={setShowSettingsModal}
          setActiveTab={setActiveTab}
        />
      )}

      {activeTab === "members" && currentTeam && (
        <MembersContent
          teamId={currentTeam.id}
          members={members}
          onInvite={() => setShowInviteModal(true)}
          onRefresh={fetchData}
        />
      )}

      {activeTab === "work" && currentTeam && (
        <WorkContent teamId={currentTeam.id} projects={projects} />
      )}

      {activeTab === "messages" && currentTeam && (
        <MessagesContent
          teamId={currentTeam.id}
          messages={messages}
          onRefresh={fetchData}
        />
      )}

      {activeTab === "calendar" && currentTeam && (
        <CalendarContent teamId={currentTeam.id} projects={projects} />
      )}

      {/* Invite Modal */}
      <InviteModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSent={fetchData}
      />

      {/* Settings Modal */}
      {currentTeam && (
        <TeamSettingsModal
          team={{
            id: currentTeam.id,
            name: currentTeam.name,
            description: currentTeam.description,
            privacy: currentTeam.privacy,
            workspace: { name: currentTeam.name },
          }}
          open={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onSave={fetchData}
        />
      )}
    </div>
  );
}

// ========== OVERVIEW CONTENT ==========
function OverviewContent({
  team,
  members,
  projects,
  teamName,
  teamInitial,
  teamColor,
  isEditingDescription,
  setIsEditingDescription,
  description,
  setDescription,
  handleSaveDescription,
  shouldShowBanner,
  setShowSetupBanner,
  setupSteps,
  completedSteps,
  setShowInviteModal,
  setShowSettingsModal,
  setActiveTab,
}: {
  team: Team;
  members: Member[];
  projects: Project[];
  teamName: string;
  teamInitial: string;
  teamColor: string;
  isEditingDescription: boolean;
  setIsEditingDescription: (v: boolean) => void;
  description: string;
  setDescription: (v: string) => void;
  handleSaveDescription: () => void;
  shouldShowBanner: boolean;
  setShowSetupBanner: (v: boolean) => void;
  setupSteps: { description: boolean; work: boolean; members: boolean };
  completedSteps: number;
  setShowInviteModal: (v: boolean) => void;
  setShowSettingsModal: (v: boolean) => void;
  setActiveTab: (v: TabType) => void;
}) {
  const router = useRouter();

  return (
    <>
      {/* Hero band — flat light-gray strip a-la Asana. The avatar
          sits at the boundary between the band and the content
          below it, half-overlapping each side. Team name + Create
          work button align horizontally below the avatar, inside
          the main content area (not in the band itself). */}
      <div className="relative">
        <div className="bg-gray-100 h-[140px]" />
        <div className="max-w-6xl mx-auto px-6">
          {/* Avatar — gray neutral, like Asana. Overlaps the band/
              content boundary by half its own height. */}
          <div className="relative -mt-[68px] flex justify-center">
            <div className="w-[136px] h-[136px] rounded-full bg-gray-300 flex items-center justify-center ring-4 ring-white">
              <span className="text-5xl font-light text-gray-600">
                {teamInitial}
              </span>
            </div>
          </div>

          {/* Team name + Create work — single horizontal row,
              centered under the avatar. */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <h1 className="text-[22px] font-semibold text-gray-900">
              {teamName}
            </h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  Create work
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => router.push("/projects/new")}>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/portfolios/new")}>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Portfolio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/goals/new")}>
                  <Target className="h-4 w-4 mr-2" />
                  Goal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/templates")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description (editable) */}
          <div className="flex justify-center mt-1.5 mb-6">
            {isEditingDescription ? (
              <div className="w-full max-w-md">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  rows={3}
                  placeholder="Describe the purpose and responsibilities of the team..."
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDescription(team?.description || "");
                      setIsEditingDescription(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveDescription}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <button
                className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
                onClick={() => setIsEditingDescription(true)}
              >
                {team?.description || "Click to add team description..."}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        {/* Setup Banner */}
        {shouldShowBanner && (
          <div className="bg-white border rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-900">Finish setting up your team</span>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    completedSteps === 3 ? "border-black bg-white" : "border-gray-300"
                  )}>
                    {completedSteps === 3 && <span className="text-black text-xs">✓</span>}
                  </div>
                  <span className="text-sm text-gray-500">{completedSteps} of 3 steps completed</span>
                </div>
              </div>
              <button
                onClick={() => setShowSetupBanner(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1: Description */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className={cn(
                  "p-4 border rounded-lg text-left hover:border-gray-400 hover:shadow-sm transition-all",
                  setupSteps.description ? "bg-white border-black" : "bg-white"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    setupSteps.description ? "bg-white border border-black" : "bg-gray-100"
                  )}>
                    {setupSteps.description ? (
                      <span className="text-black text-sm">✓</span>
                    ) : (
                      <FileText className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h4 className={cn(
                      "font-medium text-sm",
                      setupSteps.description ? "text-black" : "text-gray-900"
                    )}>
                      Add team description
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Describe the purpose and responsibilities of your team
                    </p>
                  </div>
                </div>
              </button>

              {/* Step 2: Work */}
              <LinkWorkPopover teamId={team?.id || ""}>
                <button
                  type="button"
                  className={cn(
                    "p-4 border rounded-lg text-left hover:border-gray-400 hover:shadow-sm transition-all w-full",
                    setupSteps.work ? "bg-white border-black" : "bg-white"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      setupSteps.work ? "bg-white border border-black" : "bg-gray-100"
                    )}>
                      {setupSteps.work ? (
                        <span className="text-black text-sm">✓</span>
                      ) : (
                        <FolderPlus className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h4 className={cn(
                        "font-medium text-sm",
                        setupSteps.work ? "text-black" : "text-gray-900"
                      )}>
                        Add work
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Link existing projects, portfolios, or templates
                      </p>
                    </div>
                  </div>
                </button>
              </LinkWorkPopover>

              {/* Step 3: Members */}
              <button
                onClick={() => setShowInviteModal(true)}
                className={cn(
                  "p-4 border rounded-lg text-left hover:border-gray-400 hover:shadow-sm transition-all",
                  setupSteps.members ? "bg-white border-black" : "bg-white"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    setupSteps.members ? "bg-white border border-black" : "bg-gray-100"
                  )}>
                    {setupSteps.members ? (
                      <span className="text-black text-sm">✓</span>
                    ) : (
                      <UserPlus className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h4 className={cn(
                      "font-medium text-sm",
                      setupSteps.members ? "text-black" : "text-gray-900"
                    )}>
                      Add teammates
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Invite teammates to your new team to collaborate
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Work Selection (2/3) */}
          <div className="lg:col-span-2">
            <div className="bg-white border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Work selection</h3>
                <button
                  className="text-sm text-black hover:underline"
                  onClick={() => setActiveTab("work")}
                >
                  View all work
                </button>
              </div>

              {projects.length > 0 ? (
                <div className="space-y-2">
                  {projects.slice(0, 5).map((project) => (
                    <button
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center"
                        style={{ backgroundColor: project.color || "#c9a84c" }}
                      >
                        <FolderKanban className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{project.name}</span>
                    </button>
                  ))}
                  <div className="flex justify-center pt-4">
                    <LinkWorkPopover teamId={team?.id || ""}>
                      <Button variant="outline" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add work
                      </Button>
                    </LinkWorkPopover>
                  </div>
                </div>
              ) : (
                <>
                  {/* Skeleton placeholder items */}
                  <div className="space-y-3 opacity-30 mb-6">
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 bg-[#d4b65a] rounded" />
                      <div className="h-3 bg-gray-300 rounded w-3/4" />
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 bg-gray-300 rounded" />
                      <div className="h-3 bg-gray-300 rounded w-1/2" />
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 bg-[#c9a84c]/35 rounded" />
                      <div className="h-3 bg-gray-300 rounded w-2/3" />
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 text-center mb-4">
                    Organize links to important work, like portfolios, projects, templates, etc.,
                    so your team members can easily find them.
                  </p>

                  <div className="flex justify-center">
                    <LinkWorkPopover teamId={team?.id || ""}>
                      <Button className="bg-black hover:bg-black">
                        Add work
                      </Button>
                    </LinkWorkPopover>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6">
            {/* Members Widget */}
            <div className="bg-white border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Members</h3>
                <button
                  className="text-sm text-black hover:underline"
                  onClick={() => setActiveTab("members")}
                >
                  View list of {members.length} item{members.length !== 1 ? "s" : ""}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {members.slice(0, 8).map((member) => (
                  <Avatar
                    key={member.id}
                    className="h-10 w-10 border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
                    title={member.user.name || member.user.email || "Member"}
                  >
                    <AvatarImage src={member.user.image || undefined} />
                    <AvatarFallback className="bg-white text-black border border-black text-sm">
                      {member.user.name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                ))}
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="h-10 w-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
                {members.length > 8 && (
                  <span className="text-sm text-gray-500">+{members.length - 8}</span>
                )}
              </div>
            </div>

            {/* Goals Widget */}
            <div className="bg-white border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Goals</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      Create goal
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push("/goals/new")}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Blank goal
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer py-3" onClick={() => router.push("/templates")}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Use goal templates</span>
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Standardize how goals are created in your organization.
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="text-sm font-medium text-gray-900 mb-1">
                This team hasn&apos;t created any goals yet
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Add a goal so the team can see what you want to achieve.
              </p>

              {/* Placeholder progress */}
              <div className="opacity-40">
                <div className="h-2 bg-gray-200 rounded-full mb-2" />
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
                    <span className="text-gray-400">In progress (0%)</span>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Field types for add field dropdown
const fieldTypes = [
  { id: "single_select", label: "Single select", icon: Circle },
  { id: "multi_select", label: "Multi select", icon: CheckSquare },
  { id: "date", label: "Date", icon: Calendar },
  { id: "people", label: "People", icon: User },
  { id: "reference", label: "Reference", icon: Link2 },
  { id: "text", label: "Text", icon: Type },
  { id: "number", label: "Number", icon: Hash },
];

// ========== MEMBERS CONTENT ==========
function MembersContent({
  teamId,
  members,
  onInvite,
  onRefresh,
}: {
  teamId: string;
  members: Member[];
  onInvite: () => void;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from this team?`)) return;
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success(`${memberName} removed from team`);
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove member"
      );
    }
  }
  const [customFields, setCustomFields] = useState<Array<{
    id: string;
    name: string;
    type: string;
    options?: Array<{ id: string; name: string; color: string }>;
  }>>([]);

  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      member.user.name?.toLowerCase().includes(searchLower) ||
      member.user.email?.toLowerCase().includes(searchLower)
    );
  });

  const roleLabels: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: "Member",
  };

  const roleColors: Record<string, string> = {
    OWNER: "text-black",
    ADMIN: "text-black",
    MEMBER: "text-gray-600",
  };

  const handleCreateField = (field: {
    title: string;
    type: string;
    description?: string;
    options?: Array<{ id: string; name: string; color: string }>;
  }) => {
    setCustomFields([...customFields, {
      id: Date.now().toString(),
      name: field.title,
      type: field.type,
      options: field.options,
    }]);
    toast.success(`Field "${field.title}" added`);
  };

  // Capacity matrix view — pulled lazily from the workload endpoint
  // when the user toggles to "Capacity". Without this toggle the
  // expensive heat-map computation never runs.
  type MembersView = "list" | "capacity";
  const [membersView, setMembersView] = useState<MembersView>("list");
  const [workload, setWorkload] = useState<{
    members: MatrixMember[];
    projects: MatrixProject[];
    maxOpenPerMember: number;
  } | null>(null);
  const [loadingWorkload, setLoadingWorkload] = useState(false);

  useEffect(() => {
    if (membersView !== "capacity") return;
    let cancelled = false;
    setLoadingWorkload(true);
    fetch(`/api/teams/${teamId}/workload`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setWorkload({
          members: data.members || [],
          projects: data.projects || [],
          maxOpenPerMember: data.summary?.maxOpenPerMember ?? 1,
        });
      })
      .catch(() => !cancelled && setWorkload(null))
      .finally(() => !cancelled && setLoadingWorkload(false));
    return () => {
      cancelled = true;
    };
  }, [membersView, teamId]);

  return (
    <div className="bg-white min-h-[calc(100vh-120px)]">
      <div className="px-6 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={onInvite}>
              <Plus className="h-4 w-4" />
              Add member
            </Button>
            {/* View toggle — List (default member table) vs
                Capacity (the heat-map matrix that shows who is
                loaded on what across this team's projects). */}
            <div className="inline-flex h-8 rounded-md border bg-white overflow-hidden">
              <button
                onClick={() => setMembersView("list")}
                className={cn(
                  "px-3 text-[13px] font-medium",
                  membersView === "list"
                    ? "bg-black text-white"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                List
              </button>
              <button
                onClick={() => setMembersView("capacity")}
                className={cn(
                  "px-3 text-[13px] font-medium border-l",
                  membersView === "capacity"
                    ? "bg-black text-white"
                    : "text-gray-600 hover:bg-gray-50"
                )}
                title="Show who's loaded on what across team projects"
              >
                Capacity
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-sm text-gray-500 hover:underline" onClick={() => window.open("mailto:feedback@ttcivilstructural.com", "_blank")}>
              Send feedback
            </button>
            {membersView === "list" && (
              <button
                className="p-2 hover:bg-gray-100 rounded"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search className="h-4 w-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>

        {/* Capacity view — render matrix and bail out before the
            list table below. */}
        {membersView === "capacity" && (
          <>
            {loadingWorkload ? (
              <div className="border rounded-xl p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : workload ? (
              <CapacityMatrix
                members={workload.members}
                projects={workload.projects}
                maxOpenPerMember={workload.maxOpenPerMember}
              />
            ) : (
              <div className="border rounded-xl p-12 text-center">
                <p className="text-sm text-gray-500">
                  Couldn&apos;t load workload data.
                </p>
              </div>
            )}
            {/* Hide the table below by short-circuiting the parent
                Fragment — wrap the rest in a conditional. */}
          </>
        )}

        {membersView === "list" && (
        <>
        {/* Search input (toggleable) */}
        {showSearch && (
          <div className="mb-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="max-w-sm"
              autoFocus
            />
          </div>
        )}

        {/* Members Table - Full width with gray header */}
        <div className="w-full border rounded-lg overflow-hidden overflow-x-auto">
          {/* Header */}
          <div className="flex items-center bg-gray-50 border-b text-sm font-medium text-gray-500">
            {/* Name column - fixed initially, flex when fields added */}
            <div className={cn(
              "px-4 py-3",
              customFields.length > 0 ? "flex-1 min-w-[250px]" : "w-[300px]"
            )}>
              Name
            </div>

            {/* Job title column - fixed initially, flex when fields added */}
            <div className={cn(
              "px-4 py-3 border-l",
              customFields.length > 0 ? "flex-1 min-w-[180px]" : "w-[200px]"
            )}>
              Job title
            </div>

            {/* Custom field columns - all flex-1 to distribute evenly */}
            {customFields.map((field) => (
              <div key={field.id} className="flex-1 min-w-[150px] px-4 py-3 border-l">
                {field.name}
              </div>
            ))}

            {/* Add field button */}
            <div className="w-12 px-2 py-3 border-l flex justify-center">
              <AddFieldFlow
                onCreateField={handleCreateField}
                organizationName="your workspace"
              />
            </div>
          </div>

          {/* Body */}
          <div className="divide-y">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center hover:bg-gray-50 group"
              >
                {/* Name + Avatar + Role Dropdown */}
                <div className={cn(
                  "px-4 py-3 flex items-center gap-3",
                  customFields.length > 0 ? "flex-1 min-w-[250px]" : "w-[300px]"
                )}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.user.image || undefined} />
                    <AvatarFallback className="text-xs bg-white text-black border border-black">
                      {member.user.name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <span className="font-medium text-gray-900">
                    {member.user.name || "No name"}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-1 text-sm px-2 py-0.5 rounded hover:bg-gray-100",
                          roleColors[member.role] || "text-gray-600"
                        )}
                      >
                        {roleLabels[member.role] || "Member"}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => toast.success(`${member.user.name || 'User'} set as Admin`)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Admin
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success(`${member.user.name || 'User'} set as Member`)}>Member</DropdownMenuItem>
                      {member.role !== "OWNER" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-black" onClick={() => {
                            if (confirm(`Remove ${member.user.name || member.user.email} from the team?`)) {
                              toast.success(`${member.user.name || 'User'} removed from team`);
                            }
                          }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from team
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Job Title - Editable */}
                <div className={cn(
                  "px-4 py-3 border-l",
                  customFields.length > 0 ? "flex-1 min-w-[180px]" : "w-[200px]"
                )}>
                  <input
                    type="text"
                    placeholder="Add job title..."
                    defaultValue={member.user.jobTitle || ""}
                    className="w-full bg-transparent text-sm text-gray-500 placeholder:text-gray-400 focus:outline-none"
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value !== (member.user.jobTitle || "")) {
                        fetch(`/api/users/${member.user.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ jobTitle: value }),
                        }).then(res => {
                          if (res.ok) toast.success('Job title updated');
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                </div>

                {/* Custom field values - all flex-1 to distribute evenly */}
                {customFields.map((field) => (
                  <div key={field.id} className="flex-1 min-w-[150px] px-4 py-3 border-l">
                    <input
                      type="text"
                      placeholder="—"
                      className="w-full bg-transparent text-sm text-gray-500 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                ))}

                {/* Actions */}
                <div className="w-12 px-2 py-3 border-l flex justify-center opacity-0 group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-gray-200 rounded">
                        <MoreHorizontal className="h-4 w-4 text-gray-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/profile/${member.user.id}`)}
                      >
                        View profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`mailto:${member.user.email}`, '_blank')}>
                        <Mail className="h-4 w-4 mr-2" />
                        Send message
                      </DropdownMenuItem>
                      {member.role !== "OWNER" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-black focus:text-black"
                            onClick={() =>
                              handleRemoveMember(
                                member.id,
                                member.user.name || member.user.email || "this member"
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from team
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// ========== WORK CONTENT ==========
interface TeamTask {
  id: string;
  name: string;
  dueDate: string | null;
  completed: boolean;
  project: { id: string; name: string; color: string } | null;
  assignee: { id: string; name: string | null; image: string | null } | null;
}

type WorkView = "projects" | "tasks";
type GroupBy = "none" | "project" | "status" | "assignee";

function WorkContent({
  teamId,
  projects,
}: {
  teamId: string;
  projects: Project[];
}) {
  const router = useRouter();
  const [view, setView] = useState<WorkView>("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<GroupBy>("project");
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Fetch tasks lazily — only when the user switches to the Tasks view
  useEffect(() => {
    if (view !== "tasks") return;
    let cancelled = false;
    setLoadingTasks(true);
    fetch(`/api/teams/${teamId}/tasks`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTasks(Array.isArray(data) ? data : []);
      })
      .catch(() => !cancelled && setTasks([]))
      .finally(() => !cancelled && setLoadingTasks(false));
    return () => {
      cancelled = true;
    };
  }, [view, teamId]);

  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name);
      }
      return b.name.localeCompare(a.name);
    });

  // Build task groups for the Tasks view based on groupBy + search.
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) => !q || t.name.toLowerCase().includes(q) || (t.project?.name || "").toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  const taskGroups = useMemo(() => {
    if (groupBy === "none") {
      return [{ key: "all", label: "All tasks", tasks: filteredTasks }];
    }
    const buckets = new Map<
      string,
      { key: string; label: string; tasks: TeamTask[] }
    >();
    for (const t of filteredTasks) {
      let key: string;
      let label: string;
      if (groupBy === "project") {
        key = t.project?.id || "no-project";
        label = t.project?.name || "No project";
      } else if (groupBy === "status") {
        key = t.completed ? "done" : "open";
        label = t.completed ? "Completed" : "Open";
      } else {
        key = t.assignee?.id || "unassigned";
        label = t.assignee?.name || "Unassigned";
      }
      if (!buckets.has(key)) buckets.set(key, { key, label, tasks: [] });
      buckets.get(key)!.tasks.push(t);
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [filteredTasks, groupBy]);

  return (
    <div className="bg-white min-h-[calc(100vh-120px)]">
      <div className="p-6">
        {/* View toggle — Projects (default) vs Tasks aggregated
            from team's projects. Asana shows both; we mirror that. */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex h-8 rounded-md border bg-white overflow-hidden">
            <button
              onClick={() => setView("projects")}
              className={cn(
                "px-3 text-[13px] font-medium",
                view === "projects"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              Projects
            </button>
            <button
              onClick={() => setView("tasks")}
              className={cn(
                "px-3 text-[13px] font-medium border-l",
                view === "tasks"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              Tasks
            </button>
          </div>
          <div className="flex items-center gap-2">
            {showSearch ? (
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={view === "tasks" ? "Search tasks..." : "Search projects..."}
                className="w-56 h-8"
                autoFocus
                onBlur={() => {
                  if (!searchQuery) setShowSearch(false);
                }}
              />
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 hover:bg-gray-100 rounded"
                title="Search"
              >
                <Search className="h-4 w-4 text-gray-500" />
              </button>
            )}
            {view === "tasks" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2.5 h-8 border rounded-md text-[13px] text-gray-700 hover:bg-gray-50">
                    Group: {groupBy === "none" ? "None" : groupBy === "project" ? "Project" : groupBy === "status" ? "Status" : "Assignee"}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setGroupBy("project")}>By project</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGroupBy("status")}>By status</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGroupBy("assignee")}>By assignee</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGroupBy("none")}>None</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {view === "projects" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1 px-2.5 h-8 border rounded-md text-[13px] text-gray-700 hover:bg-gray-50">
                    Sort: {sortOrder === "asc" ? "A → Z" : "Z → A"}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortOrder("asc")}>A to Z</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder("desc")}>Z to A</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/projects/new")}
            >
              <Plus className="h-4 w-4 mr-1" />
              New project
            </Button>
          </div>
        </div>

        {view === "projects" ? (
          <div className="flex gap-6">
            {/* ===== LEFT COLUMN: PROJECTS LIST ===== */}
            <div className="flex-1 border rounded-lg">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b text-sm text-gray-500">
                <div className="col-span-12">Name</div>
              </div>

              <div className="divide-y">
                {filteredProjects.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                      <FolderKanban className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-3">
                      {searchQuery
                        ? `No projects found for "${searchQuery}"`
                        : "No projects in this team yet"}
                    </p>
                    {!searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/projects/new")}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create project
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="col-span-12 flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center"
                          style={{ backgroundColor: project.color || "#6b7280" }}
                        >
                          <Settings className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{project.name}</p>
                          <p className="text-xs text-gray-500">You joined</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ===== RIGHT COLUMN: TEMPLATES ===== */}
            <div className="w-72">
              <h2 className="text-lg font-semibold mb-4">Templates</h2>
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/templates")}
                  className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">New template</span>
                </button>
                <button
                  onClick={() => router.push("/templates")}
                  className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 text-center">Explore all templates</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ===== TASKS VIEW — aggregated from team's projects ===== */
          <div className="border rounded-lg">
            {loadingTasks ? (
              <div className="p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-12 text-center">
                <FolderKanban className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {searchQuery
                    ? `No tasks match "${searchQuery}"`
                    : "No tasks with due dates in this team's projects yet"}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {taskGroups.map((group) => (
                  <div key={group.key}>
                    {groupBy !== "none" && (
                      <div className="px-4 py-2 bg-gray-50 border-b text-[12px] font-semibold text-gray-700 flex items-center gap-2">
                        <span>{group.label}</span>
                        <span className="text-gray-400 font-mono tabular-nums">{group.tasks.length}</span>
                      </div>
                    )}
                    {group.tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => t.project && router.push(`/projects/${t.project.id}`)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                            t.completed
                              ? "bg-[#c9a84c] border-[#c9a84c]"
                              : "border-gray-300"
                          )}
                        >
                          {t.completed && (
                            <Check className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "flex-1 text-[13px] truncate",
                            t.completed
                              ? "line-through text-gray-400"
                              : "text-gray-900"
                          )}
                        >
                          {t.name}
                        </span>
                        {t.project && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
                            <span
                              className="w-1.5 h-1.5 rounded-sm"
                              style={{ backgroundColor: t.project.color }}
                            />
                            {t.project.name}
                          </span>
                        )}
                        {t.dueDate && (
                          <span className="text-[11px] text-gray-500 tabular-nums flex-shrink-0">
                            {new Date(t.dueDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        {t.assignee && (
                          <Avatar className="h-5 w-5 flex-shrink-0">
                            <AvatarImage src={t.assignee.image || undefined} />
                            <AvatarFallback className="text-[9px] bg-[#c9a84c] text-white">
                              {(t.assignee.name || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== MESSAGES CONTENT ==========
function MessagesContent({
  teamId,
  messages,
  onRefresh,
}: {
  teamId: string;
  messages: Message[];
  onRefresh: () => void;
}) {
  const [newMessage, setNewMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common emoji set — Asana / Slack use a similar quick palette.
  const QUICK_EMOJIS = ["👍", "❤️", "🎉", "🙏", "✅", "🔥", "😂", "👀"];

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const hasText = newMessage.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The API requires non-empty content, so a single space is
          // the minimum payload for an attachment-only message.
          content: hasText ? newMessage : " ",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const created = await res.json();

      // Upload each pending file to the message endpoint.
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        try {
          const upRes = await fetch(
            `/api/teams/${teamId}/messages/${created.id}/attachments`,
            { method: "POST", body: fd }
          );
          if (!upRes.ok) {
            const upErr = await upRes.json().catch(() => ({}));
            throw new Error(upErr.error || `HTTP ${upRes.status}`);
          }
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `${file.name}: ${err.message}`
              : `${file.name}: upload failed`
          );
        }
      }

      setNewMessage("");
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error sending message"
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: exceeds 10 MB limit`);
        continue;
      }
      ok.push(f);
    }
    setPendingFiles((prev) => [...prev, ...ok]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function toggleReaction(messageId: string, emoji: string) {
    try {
      const res = await fetch(
        `/api/teams/${teamId}/messages/${messageId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update reaction"
      );
    }
    setReactionPickerFor(null);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Messages</h2>

      <div className="bg-white border rounded-xl overflow-hidden">
        {/* Messages list */}
        <div className="max-h-[600px] overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((message) => {
              const reactions = message.reactions || [];
              const attachments = message.attachments || [];
              return (
                <div
                  key={message.id}
                  className="flex items-start gap-3 group"
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={message.author.image || undefined} />
                    <AvatarFallback className="bg-white text-black border border-black text-xs">
                      {message.author.name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {message.author.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                      {/* React-to-message button — hidden until row
                          is hovered to avoid visual noise. */}
                      <Popover
                        open={reactionPickerFor === message.id}
                        onOpenChange={(open) =>
                          setReactionPickerFor(open ? message.id : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 ml-1"
                            title="Add reaction"
                          >
                            <span className="text-base leading-none">😊</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1.5" align="start">
                          <div className="flex gap-1">
                            {QUICK_EMOJIS.map((e) => (
                              <button
                                key={e}
                                onClick={() => toggleReaction(message.id, e)}
                                className="h-8 w-8 rounded hover:bg-gray-100 text-lg leading-none"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {message.content && message.content.trim() && (
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    )}

                    {/* Attachments */}
                    {attachments.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 max-w-md">
                        {attachments.map((a) => {
                          const isImg = a.mimeType.startsWith("image/");
                          return (
                            <a
                              key={a.id}
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2 border rounded-md p-1.5 bg-white hover:border-gray-400 hover:bg-gray-50 transition-colors",
                                isImg && "flex-col items-stretch p-0 overflow-hidden"
                              )}
                              title={a.name}
                            >
                              {isImg ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={a.url}
                                    alt={a.name}
                                    className="w-full h-24 object-cover"
                                  />
                                  <div className="px-2 py-1">
                                    <p className="text-[10px] font-medium text-black truncate">
                                      {a.name}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="h-8 w-8 rounded bg-gray-100 border flex items-center justify-center flex-shrink-0">
                                    <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-medium text-black truncate">
                                      {a.name}
                                    </p>
                                  </div>
                                </>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {/* Reaction pills */}
                    {reactions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {reactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => toggleReaction(message.id, r.emoji)}
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px]",
                              r.hasReacted
                                ? "bg-[#c9a84c]/15 border-[#c9a84c] text-[#a8893a]"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <span className="text-sm leading-none">
                              {r.emoji}
                            </span>
                            <span className="font-mono tabular-nums">
                              {r.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No messages yet</p>
            </div>
          )}
        </div>

        {/* Message composer */}
        <form
          onSubmit={handleSendMessage}
          className="border-t p-3 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesPicked}
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                pendingFiles.length > 0
                  ? "Caption (optional)…"
                  : "Write a message..."
              }
              className="flex-1 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={isSending}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 rounded-full flex-shrink-0"
              disabled={
                isSending ||
                (!newMessage.trim() && pendingFiles.length === 0)
              }
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border bg-gray-50 text-[11px] text-black"
                >
                  <Paperclip className="h-3 w-3 text-gray-500" />
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                    className="text-gray-400 hover:text-black"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ========== CALENDAR CONTENT ==========
interface CalendarTask {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
  project: { id: string; name: string; color: string } | null;
  assignee: { id: string; name: string | null; image: string | null } | null;
}

function CalendarContent({
  teamId,
  projects,
}: {
  teamId: string;
  projects: Project[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  // Anchor month/year for the visible grid.
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(
    () => {
      const t = new Date();
      return { year: t.getFullYear(), month: t.getMonth() };
    }
  );
  // Inline quick-add state — click a day cell to start.
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/teams/${teamId}/tasks`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTasks(Array.isArray(data) ? data : []);
      })
      .catch(() => !cancelled && setTasks([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // Group tasks by local-date string for O(1) cell lookup.
  const tasksByDate = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const t of tasks) {
      const key = new Date(t.dueDate).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  // Build the visible grid: weeks of Mon-Sun covering this month.
  const grid = useMemo(() => {
    const first = new Date(viewMonth.year, viewMonth.month, 1);
    // Mon-first offset (US calendar uses Sun, but the rest of
    // BuildSync renders Mon-first — keep consistent).
    const dow = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - dow);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [viewMonth]);

  const todayStr = new Date().toDateString();
  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  async function commitInlineTask(forDate: Date) {
    const name = newTaskName.trim();
    if (!name) {
      setAddingDate(null);
      setNewTaskName("");
      return;
    }
    if (projects.length === 0) {
      toast.error("Team needs at least one project to add tasks");
      setAddingDate(null);
      setNewTaskName("");
      return;
    }
    setCreating(true);
    try {
      const iso = `${forDate.getFullYear()}-${String(
        forDate.getMonth() + 1
      ).padStart(2, "0")}-${String(forDate.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/teams/${teamId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dueDate: iso }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setTasks((prev) => [...prev, created]);
      toast.success(`Added "${name}"`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't create task"
      );
    } finally {
      setCreating(false);
      setAddingDate(null);
      setNewTaskName("");
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Calendar</h2>
          <span className="text-sm text-gray-500">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const t = new Date();
              setViewMonth({ year: t.getFullYear(), month: t.getMonth() });
            }}
          >
            Today
          </Button>
          <button
            onClick={() =>
              setViewMonth(({ year, month }) =>
                month === 0
                  ? { year: year - 1, month: 11 }
                  : { year, month: month - 1 }
              )
            }
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border hover:bg-gray-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-black tabular-nums min-w-[140px] text-center">
            {monthLabel}
          </span>
          <button
            onClick={() =>
              setViewMonth(({ year, month }) =>
                month === 11
                  ? { year: year + 1, month: 0 }
                  : { year, month: month + 1 }
              )
            }
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border hover:bg-gray-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <div
                key={d}
                className={cn(
                  "py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500",
                  i > 0 && "border-l"
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {grid.map((date, i) => {
              const dateStr = date.toDateString();
              const dayTasks = tasksByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              const inMonth = date.getMonth() === viewMonth.month;
              const dow = i % 7;
              const isWeekend = dow >= 5;
              const isAdding = addingDate === dateStr;
              const visible = dayTasks.slice(0, 3);
              const extra = dayTasks.length - visible.length;

              return (
                <div
                  key={dateStr + i}
                  onClick={(e) => {
                    if (e.currentTarget === e.target && !isAdding) {
                      setAddingDate(dateStr);
                      setNewTaskName("");
                    }
                  }}
                  className={cn(
                    "min-h-[110px] p-1.5 cursor-pointer relative flex flex-col gap-1 group",
                    dow > 0 && "border-l",
                    Math.floor(i / 7) > 0 && "border-t",
                    !inMonth && "bg-gray-50/40",
                    isWeekend && inMonth && "bg-gray-50/20",
                    isToday && "bg-[#c9a84c]/5",
                    isAdding && "ring-2 ring-[#c9a84c]/60 ring-inset"
                  )}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between pointer-events-none">
                    <span
                      className={cn(
                        "text-[11px] font-mono tabular-nums",
                        !inMonth && "text-gray-300",
                        inMonth && !isToday && "text-gray-700",
                        isToday &&
                          "bg-black text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold text-[10px]"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {dayTasks.length > 3 && (
                      <span className="text-[9px] font-mono tabular-nums text-gray-400">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task pills */}
                  {visible.map((t) => (
                    <button
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/projects/${t.project?.id || ""}`);
                      }}
                      title={`${t.name}${t.project ? ` · ${t.project.name}` : ""}`}
                      className={cn(
                        "w-full text-left text-[10px] leading-tight px-1.5 py-[2px] truncate rounded-sm font-medium",
                        t.completed
                          ? "bg-gray-100 text-gray-400 line-through"
                          : "bg-[#c9a84c] text-white hover:bg-[#a8893a]"
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                  {extra > 0 && (
                    <span className="text-[9px] text-gray-500 pl-1">
                      +{extra} more
                    </span>
                  )}

                  {/* Inline add input */}
                  {isAdding && (
                    <div
                      className="bg-white border border-[#c9a84c] rounded-sm shadow-sm mt-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        type="text"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitInlineTask(date);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setAddingDate(null);
                            setNewTaskName("");
                          }
                        }}
                        onBlur={() => commitInlineTask(date)}
                        disabled={creating}
                        placeholder="Task name…"
                        className="w-full px-1.5 py-1 text-[10px] bg-transparent border-none outline-none placeholder:text-gray-400"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projects.length === 0 && !loading && (
        <p className="text-xs text-gray-500 mt-3">
          This team has no linked projects yet. Add a project to start tracking
          tasks on the calendar.
        </p>
      )}
    </div>
  );
}

// ========== INVITE MODAL ==========
function InviteModal({
  open,
  onClose,
  onInviteSent,
}: {
  open: boolean;
  onClose: () => void;
  onInviteSent: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/invite/team` : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Error copying link");
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Enter an email address");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/workspace/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (res.ok) {
        toast.success("Invitation sent");
        setEmail("");
        onInviteSent();
        onClose();
      } else {
        toast.error("Error sending invitation");
      }
    } catch (error) {
      toast.error("Error sending invitation");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to team</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email invite */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Invite by email
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleInvite}
              disabled={!email.trim() || isLoading}
              className="w-full mt-3"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invitation"}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">or</span>
            </div>
          </div>

          {/* Copy link */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Share invite link
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={inviteLink} readOnly className="pl-10 bg-gray-50 text-gray-600" />
              </div>
              <Button variant="outline" onClick={handleCopyLink} className="px-3">
                {copied ? <Check className="h-4 w-4 text-black" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
