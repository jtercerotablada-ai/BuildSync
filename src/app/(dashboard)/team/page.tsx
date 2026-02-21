"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
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
import { TeamSettingsModal, LinkWorkPopover, AddFieldFlow } from "@/components/teams";

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

interface Message {
  id: string;
  content: string;
  isPinned?: boolean;
  createdAt: string;
  author: {
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
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);

        // Set the first team as current if available
        if (teamsData.length > 0) {
          setCurrentTeam(teamsData[0]);
        }
      }

      const [membersRes, projectsRes, messagesRes] = await Promise.all([
        fetch("/api/workspace/members"),
        fetch("/api/projects"),
        fetch("/api/workspace/messages"),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data);
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data);
      }
      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(data.messages || []);
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

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
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
                <DropdownMenuItem className="text-red-600" onClick={() => setShowSettingsModal(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Star */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isStarred && "text-yellow-500")}
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

      {activeTab === "members" && (
        <MembersContent
          members={members}
          onInvite={() => setShowInviteModal(true)}
          onRefresh={fetchData}
        />
      )}

      {activeTab === "work" && (
        <WorkContent projects={projects} />
      )}

      {activeTab === "messages" && (
        <MessagesContent messages={messages} onRefresh={fetchData} />
      )}

      {activeTab === "calendar" && (
        <CalendarContent projects={projects} />
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
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-100 to-gray-50 py-12">
        <div className="flex flex-col items-center text-center">
          {/* Large Avatar */}
          <div
            className="w-32 h-32 rounded-full shadow-lg flex items-center justify-center mb-6"
            style={{ backgroundColor: teamColor }}
          >
            <span className="text-5xl font-light text-white">{teamInitial}</span>
          </div>

          {/* Name + Create Work */}
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-900">{teamName}</h1>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  Create work
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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

          {/* Description */}
          {isEditingDescription ? (
            <div className="mt-4 w-full max-w-md">
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
              className="mt-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setIsEditingDescription(true)}
            >
              {team?.description || "Click to add team description..."}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
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
                        style={{ backgroundColor: project.color || "#4573D2" }}
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
                      <div className="w-8 h-8 bg-green-300 rounded" />
                      <div className="h-3 bg-gray-300 rounded w-3/4" />
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 bg-gray-300 rounded" />
                      <div className="h-3 bg-gray-300 rounded w-1/2" />
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 bg-blue-300 rounded" />
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
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
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
  members,
  onInvite,
  onRefresh,
}: {
  members: Member[];
  onInvite: () => void;
  onRefresh: () => void;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <div className="bg-white min-h-[calc(100vh-120px)]">
      <div className="px-6 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" className="gap-2" onClick={onInvite}>
            <Plus className="h-4 w-4" />
            Add member
          </Button>

          <div className="flex items-center gap-4">
            <button className="text-sm text-gray-500 hover:underline" onClick={() => window.open("mailto:feedback@buildsync.com", "_blank")}>
              Send feedback
            </button>
            <button
              className="p-2 hover:bg-gray-100 rounded"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

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
                      <DropdownMenuItem onClick={() => toast.info(`Viewing profile of ${member.user.name || member.user.email}`)}>View profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`mailto:${member.user.email}`, '_blank')}>
                        <Mail className="h-4 w-4 mr-2" />
                        Send message
                      </DropdownMenuItem>
                      {member.role !== "OWNER" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-black">
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
      </div>
    </div>
  );
}

// ========== WORK CONTENT ==========
function WorkContent({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name);
      }
      return b.name.localeCompare(a.name);
    });

  return (
    <div className="bg-white min-h-[calc(100vh-120px)]">
      <div className="p-6">
        <div className="flex gap-6">
          {/* ===== LEFT COLUMN: PROJECTS ===== */}
          <div className="flex-1 border rounded-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Projects</h2>
              <div className="flex items-center gap-2">
                {showSearch ? (
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects..."
                    className="w-48 h-8"
                    autoFocus
                    onBlur={() => {
                      if (!searchQuery) setShowSearch(false);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <Search className="h-4 w-4 text-gray-500" />
                  </button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/projects/new")}
                >
                  New project
                </Button>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b text-sm text-gray-500">
              <div className="col-span-8">Name</div>
              <div className="col-span-4 flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 hover:text-gray-700">
                      <ChevronDown className="h-3 w-3" />
                      {sortOrder === "asc" ? "A to Z" : "Z to A"}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortOrder("asc")}>
                      A to Z
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder("desc")}>
                      Z to A
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Projects List */}
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
                    {/* Name */}
                    <div className="col-span-8 flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center"
                        style={{ backgroundColor: project.color || "#6b7280" }}
                      >
                        <Settings className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{project.name}</p>
                        <p className="text-xs text-black">You joined</p>
                      </div>
                    </div>

                    {/* Space for sort column */}
                    <div className="col-span-4" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ===== RIGHT COLUMN: TEMPLATES ===== */}
          <div className="w-72">
            <h2 className="text-lg font-semibold mb-4">Templates</h2>

            <div className="space-y-3">
              {/* New template */}
              <button
                onClick={() => router.push("/templates")}
                className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col items-center gap-2"
              >
                <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-gray-400" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  New template
                </span>
              </button>

              {/* Explore all templates */}
              <button
                onClick={() => router.push("/templates")}
                className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col items-center gap-2"
              >
                <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-gray-400" />
                </div>
                <span className="text-sm font-medium text-gray-700 text-center">
                  Explore all templates
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== MESSAGES CONTENT ==========
function MessagesContent({
  messages,
  onRefresh,
}: {
  messages: Message[];
  onRefresh: () => void;
}) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/workspace/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });

      if (res.ok) {
        setNewMessage("");
        onRefresh();
      }
    } catch (error) {
      toast.error("Error sending message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Messages</h2>

      <div className="bg-white border rounded-xl overflow-hidden">
        {/* Messages list */}
        <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <div key={message.id} className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={message.author.image || undefined} />
                  <AvatarFallback className="bg-white text-black border border-black text-xs">
                    {message.author.name?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{message.author.name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{message.content}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No messages yet</p>
            </div>
          )}
        </div>

        {/* Message input */}
        <form onSubmit={handleSendMessage} className="border-t p-4 flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write a message..."
            className="flex-1 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
            disabled={isSending}
          />
          <Button type="submit" size="icon" className="h-10 w-10 rounded-full" disabled={!newMessage.trim() || isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ========== CALENDAR CONTENT ==========
function CalendarContent({ projects }: { projects: Project[] }) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Calendar</h2>
      <div className="bg-white border rounded-xl p-12 text-center">
        <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <p className="text-lg font-medium text-gray-900 mb-2">Team calendar</p>
        <p className="text-sm text-gray-500">Tasks with due dates will appear here</p>
      </div>
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
