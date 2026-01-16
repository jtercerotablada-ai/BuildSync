"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { InviteTeamModal, LinkWorkPopover } from "@/components/teams";
import { toast } from "sonner";

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

interface TeamObjective {
  id: string;
  name: string;
  progress: number;
  status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | null;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  color: string | null;
  members: TeamMember[];
  objectives: TeamObjective[];
  _count: {
    projects: number;
    members: number;
  };
}

interface WorkItem {
  id: string;
  name: string;
  type: "project" | "portfolio" | "template";
  color?: string;
  status?: string;
}

export default function TeamPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [teamRes, workRes] = await Promise.all([
          fetch(`/api/teams/${teamId}`),
          fetch(`/api/teams/${teamId}/work`),
        ]);

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          setTeam(teamData);
          setDescription(teamData.description || "");
        }

        if (workRes.ok) {
          const workData = await workRes.json();
          setWorkItems(workData);
        }
      } catch (error) {
        console.error("Error fetching team:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [teamId]);

  const handleSaveDescription = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (res.ok) {
        const updatedTeam = await res.json();
        setTeam(updatedTeam);
        toast.success("Description updated");
      }
    } catch (error) {
      toast.error("Error updating description");
    }
    setIsEditingDescription(false);
  };

  // Calculate setup steps completion
  const setupSteps = {
    description: !!team?.description,
    work: (team?._count?.projects || 0) > 0 || workItems.length > 0,
    members: (team?._count?.members || 0) > 1,
  };
  const completedSteps = Object.values(setupSteps).filter(Boolean).length;

  // Hide banner if all complete
  const shouldShowBanner = showSetupBanner && completedSteps < 3;

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutGrid, href: `/teams/${teamId}` },
    { id: "members", label: "Members", icon: Users, href: `/teams/${teamId}/members` },
    { id: "work", label: "All work", icon: FolderKanban, href: `/teams/${teamId}/work` },
    { id: "messages", label: "Messages", icon: MessageSquare, href: `/teams/${teamId}/messages` },
    { id: "calendar", label: "Calendar", icon: Calendar, href: `/teams/${teamId}/calendar` },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Team not found
        </h2>
        <p className="text-gray-500 mb-4">
          The team you're looking for doesn't exist or you don't have access.
        </p>
        <Button onClick={() => router.push("/")}>Go back home</Button>
      </div>
    );
  }

  const teamName = team.name;
  const teamInitial = teamName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== HEADER ========== */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Team Avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              {team.avatar ? (
                <img src={team.avatar} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : (
                <span className="text-sm font-medium text-purple-700">{teamInitial}</span>
              )}
            </div>

            {/* Team Name Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 font-semibold hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                {teamName}
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit team
                </DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
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
              {team.members.slice(0, 3).map((member) => (
                <Avatar key={member.id} className="h-8 w-8 border-2 border-white">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                    {member.user.name?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {team.members.length > 3 && (
                <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-gray-600">+{team.members.length - 3}</span>
                </div>
              )}
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2"
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
            const isActive = tab.id === "overview";
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
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ========== HERO SECTION ========== */}
      <div className="bg-gradient-to-b from-gray-100 to-gray-50 py-12">
        <div className="flex flex-col items-center text-center">
          {/* Large Avatar */}
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-4 border-white shadow-lg flex items-center justify-center mb-6">
            {team.avatar ? (
              <img src={team.avatar} alt={team.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-5xl font-light text-gray-600">{teamInitial}</span>
            )}
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
                <DropdownMenuItem onClick={() => router.push(`/projects/new?teamId=${teamId}`)}>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/portfolios/new?teamId=${teamId}`)}>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Portfolio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/goals/new?teamId=${teamId}`)}>
                  <Target className="h-4 w-4 mr-2" />
                  Goal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
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
                className="w-full p-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                placeholder="Describe the purpose and responsibilities of the team..."
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDescription(team.description || "");
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
              {team.description || "Click to add team description..."}
            </button>
          )}
        </div>
      </div>

      {/* ========== MAIN CONTENT ========== */}
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
                    completedSteps === 3 ? "border-green-500 bg-green-50" : "border-gray-300"
                  )}>
                    {completedSteps === 3 && <span className="text-green-600 text-xs">✓</span>}
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
                onClick={() => setIsEditingDescription(true)}
                className={cn(
                  "p-4 border rounded-lg text-left hover:border-gray-400 hover:shadow-sm transition-all",
                  setupSteps.description ? "bg-green-50 border-green-200" : "bg-white"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    setupSteps.description ? "bg-green-100" : "bg-gray-100"
                  )}>
                    {setupSteps.description ? (
                      <span className="text-green-600 text-sm">✓</span>
                    ) : (
                      <FileText className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h4 className={cn(
                      "font-medium text-sm",
                      setupSteps.description ? "text-green-700" : "text-gray-900"
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
              <LinkWorkPopover
                teamId={teamId}
                onSuccess={() => {
                  fetch(`/api/teams/${teamId}/work`)
                    .then((res) => res.json())
                    .then((data) => setWorkItems(data));
                }}
              >
                <button
                  className={cn(
                    "p-4 border rounded-lg text-left hover:border-gray-400 hover:shadow-sm transition-all w-full",
                    setupSteps.work ? "bg-green-50 border-green-200" : "bg-white"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      setupSteps.work ? "bg-green-100" : "bg-gray-100"
                    )}>
                      {setupSteps.work ? (
                        <span className="text-green-600 text-sm">✓</span>
                      ) : (
                        <FolderPlus className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <h4 className={cn(
                        "font-medium text-sm",
                        setupSteps.work ? "text-green-700" : "text-gray-900"
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
                  setupSteps.members ? "bg-green-50 border-green-200" : "bg-white"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    setupSteps.members ? "bg-green-100" : "bg-gray-100"
                  )}>
                    {setupSteps.members ? (
                      <span className="text-green-600 text-sm">✓</span>
                    ) : (
                      <UserPlus className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h4 className={cn(
                      "font-medium text-sm",
                      setupSteps.members ? "text-green-700" : "text-gray-900"
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
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => router.push(`/teams/${teamId}/work`)}
                >
                  View all work
                </button>
              </div>

              {workItems.length > 0 ? (
                <div className="space-y-2">
                  {workItems.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => router.push(`/${item.type}s/${item.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center"
                        style={{ backgroundColor: item.color || "#4573D2" }}
                      >
                        <FolderKanban className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    </button>
                  ))}
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
                    <LinkWorkPopover
                      teamId={teamId}
                      onSuccess={() => {
                        // Refresh work items
                        fetch(`/api/teams/${teamId}/work`)
                          .then((res) => res.json())
                          .then((data) => setWorkItems(data));
                      }}
                    >
                      <Button className="bg-blue-600 hover:bg-blue-700">
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
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => router.push(`/teams/${teamId}/members`)}
                >
                  View list of {team.members.length} item{team.members.length !== 1 ? "s" : ""}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {team.members.slice(0, 8).map((member) => (
                  <Avatar
                    key={member.id}
                    className="h-10 w-10 border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
                    title={member.user.name || member.user.email || "Member"}
                  >
                    <AvatarImage src={member.user.image || undefined} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-sm">
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
                {team.members.length > 8 && (
                  <span className="text-sm text-gray-500">+{team.members.length - 8}</span>
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
                      onClick={() => router.push(`/goals/new?teamId=${teamId}`)}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Blank goal
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer py-3">
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

              {team.objectives && team.objectives.length > 0 ? (
                <div className="space-y-3">
                  {team.objectives.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => router.push(`/goals/${goal.id}`)}
                      className="w-full text-left group"
                    >
                      <div className="w-full h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            goal.status === "ON_TRACK" ? "bg-green-500" :
                            goal.status === "AT_RISK" ? "bg-yellow-500" :
                            goal.status === "OFF_TRACK" ? "bg-red-500" : "bg-blue-500"
                          )}
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-900 group-hover:text-blue-600 transition-colors">
                          {goal.name}
                        </span>
                        <span className="text-gray-500">{goal.progress}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    This team hasn't created any goals yet
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteTeamModal
        teamId={teamId}
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSent={() => {
          // Refresh team data
          fetch(`/api/teams/${teamId}`)
            .then((res) => res.json())
            .then((data) => setTeam(data));
        }}
      />
    </div>
  );
}
