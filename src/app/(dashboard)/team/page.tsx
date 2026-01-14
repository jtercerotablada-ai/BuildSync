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

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
}

type TabType = "overview" | "members" | "work" | "messages" | "calendar";

export default function TeamPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
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

      // Mock workspace data since we don't have a separate endpoint
      setWorkspace({
        id: "workspace-1",
        name: "Mi Equipo",
        description: null,
        avatar: null,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSaveDescription = async () => {
    // In a real app, save to API
    if (workspace) {
      setWorkspace({ ...workspace, description });
      toast.success("Descripcion actualizada");
    }
    setIsEditingDescription(false);
  };

  // Calculate setup steps completion
  const setupSteps = {
    description: !!workspace?.description,
    work: projects.length > 0,
    members: members.length > 1,
  };
  const completedSteps = Object.values(setupSteps).filter(Boolean).length;
  const shouldShowBanner = showSetupBanner && completedSteps < 3;

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Resumen", icon: LayoutGrid },
    { id: "members", label: "Miembros", icon: Users },
    { id: "work", label: "Todo el trabajo", icon: FolderKanban },
    { id: "messages", label: "Mensajes", icon: MessageSquare },
    { id: "calendar", label: "Calendario", icon: Calendar },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const teamName = workspace?.name || "Mi Equipo";
  const teamInitial = teamName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== HEADER ========== */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Team Avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              {workspace?.avatar ? (
                <img src={workspace.avatar} alt="" className="w-full h-full rounded-lg object-cover" />
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
                  Editar equipo
                </DropdownMenuItem>
                <DropdownMenuItem>Configuracion</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar equipo
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
                  <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
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
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={() => setShowInviteModal(true)}
            >
              <Users className="h-4 w-4" />
              Invitar
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
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ========== CONTENT ========== */}
      {activeTab === "overview" && (
        <OverviewContent
          workspace={workspace}
          members={members}
          projects={projects}
          teamName={teamName}
          teamInitial={teamInitial}
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
    </div>
  );
}

// ========== OVERVIEW CONTENT ==========
function OverviewContent({
  workspace,
  members,
  projects,
  teamName,
  teamInitial,
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
  setActiveTab,
}: {
  workspace: Workspace | null;
  members: Member[];
  projects: Project[];
  teamName: string;
  teamInitial: string;
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
  setActiveTab: (v: TabType) => void;
}) {
  const router = useRouter();

  return (
    <>
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-100 to-gray-50 py-12">
        <div className="flex flex-col items-center text-center">
          {/* Large Avatar */}
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-4 border-white shadow-lg flex items-center justify-center mb-6">
            {workspace?.avatar ? (
              <img src={workspace.avatar} alt={teamName} className="w-full h-full rounded-full object-cover" />
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
                  Crear trabajo
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => router.push("/projects/new")}>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Proyecto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/portfolios/new")}>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Portafolio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/goals/new")}>
                  <Target className="h-4 w-4 mr-2" />
                  Objetivo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <FileText className="h-4 w-4 mr-2" />
                  Plantilla
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
                placeholder="Describe el proposito y responsabilidades del equipo..."
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDescription(workspace?.description || "");
                    setIsEditingDescription(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveDescription}>
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="mt-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setIsEditingDescription(true)}
            >
              {workspace?.description || "Haz clic para agregar la descripcion del equipo..."}
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
                <span className="font-medium text-gray-900">Termina de configurar tu equipo</span>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    completedSteps === 3 ? "border-green-500 bg-green-50" : "border-gray-300"
                  )}>
                    {completedSteps === 3 && <span className="text-green-600 text-xs">✓</span>}
                  </div>
                  <span className="text-sm text-gray-500">{completedSteps} de 3 pasos finalizados</span>
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
                      Agregar descripcion del equipo
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Describe el proposito y las responsabilidades de tu equipo
                    </p>
                  </div>
                </div>
              </button>

              {/* Step 2: Work */}
              <button
                onClick={() => setActiveTab("work")}
                className={cn(
                  "p-4 border rounded-lg text-left hover:border-gray-400 hover:shadow-sm transition-all",
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
                      Agregar trabajo
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Vincula proyectos, portafolios o plantillas existentes
                    </p>
                  </div>
                </div>
              </button>

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
                      Agregar companeros de equipo
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Invita companeros a tu nuevo equipo para colaborar
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
                <h3 className="font-semibold text-gray-900">Seleccion de trabajo</h3>
                <button
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => setActiveTab("work")}
                >
                  Ver todo el trabajo
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
                    Organiza enlaces a trabajos importantes, como portafolios, proyectos, plantillas, etc.,
                    para que los miembros de tu equipo los encuentren facilmente.
                  </p>

                  <div className="flex justify-center">
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => router.push("/projects/new")}
                    >
                      Agregar trabajo
                    </Button>
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
                <h3 className="font-semibold text-gray-900">Miembros</h3>
                <button
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => setActiveTab("members")}
                >
                  Ver la lista de {members.length} elemento{members.length !== 1 ? "s" : ""}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {members.slice(0, 8).map((member) => (
                  <Avatar
                    key={member.id}
                    className="h-10 w-10 border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
                    title={member.user.name || member.user.email || "Miembro"}
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
                {members.length > 8 && (
                  <span className="text-sm text-gray-500">+{members.length - 8}</span>
                )}
              </div>
            </div>

            {/* Goals Widget */}
            <div className="bg-white border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Objetivos</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      Crear objetivo
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push("/goals/new")}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Objetivo en blanco
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Usar plantillas de objetivos</span>
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Estandariza como se crean los objetivos en tu organizacion.
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="text-sm font-medium text-gray-900 mb-1">
                Este equipo aun no ha creado ningun objetivo
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Agrega un objetivo para que el equipo pueda ver lo que quieres lograr.
              </p>

              {/* Placeholder progress */}
              <div className="opacity-40">
                <div className="h-2 bg-gray-200 rounded-full mb-2" />
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-gray-400">En curso (0%)</span>
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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = members.filter((member) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      member.user.name?.toLowerCase().includes(searchLower) ||
      member.user.email?.toLowerCase().includes(searchLower)
    );
  });

  const roleIcons: Record<string, React.ReactNode> = {
    OWNER: <Crown className="h-4 w-4 text-amber-500" />,
    ADMIN: <Shield className="h-4 w-4 text-blue-500" />,
    MEMBER: <User className="h-4 w-4 text-gray-400" />,
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Miembros</h2>
          <p className="text-sm text-gray-500">
            {members.length} miembro{members.length !== 1 ? "s" : ""} en este equipo
          </p>
        </div>
        <Button onClick={onInvite} className="bg-green-600 hover:bg-green-700 gap-2">
          <UserPlus className="h-4 w-4" />
          Invitar miembros
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar miembros..."
          className="pl-10"
        />
      </div>

      <div className="bg-white border rounded-xl divide-y">
        {filteredMembers.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.user.image || undefined} />
                <AvatarFallback className="bg-purple-100 text-purple-700">
                  {member.user.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {member.user.name || "Sin nombre"}
                  </span>
                  <Badge variant={member.role === "OWNER" ? "default" : "secondary"} className="text-xs">
                    {member.role === "OWNER" ? "Propietario" : member.role === "ADMIN" ? "Admin" : "Miembro"}
                  </Badge>
                </div>
                <span className="text-sm text-gray-500">{member.user.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {roleIcons[member.role]}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar mensaje
                  </DropdownMenuItem>
                  {member.role !== "OWNER" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar del equipo
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
  );
}

// ========== WORK CONTENT ==========
function WorkContent({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    ON_TRACK: "bg-green-500",
    AT_RISK: "bg-yellow-500",
    OFF_TRACK: "bg-red-500",
    ON_HOLD: "bg-gray-500",
    COMPLETE: "bg-blue-500",
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Todo el trabajo</h2>
          <p className="text-sm text-gray-500">{projects.length} proyecto{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => router.push("/projects/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo proyecto
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar proyectos..."
          className="pl-10"
        />
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="bg-white border rounded-xl p-4 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: project.color || "#4573D2" }}
                >
                  <FolderKanban className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{project.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn("w-2 h-2 rounded-full", statusColors[project.status] || "bg-gray-400")} />
                    <span className="text-xs text-gray-500">{project.status.replace("_", " ")}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-12 text-center">
          <FolderKanban className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aun no hay proyectos</h3>
          <p className="text-sm text-gray-500 mb-4">Crea tu primer proyecto para empezar</p>
          <Button onClick={() => router.push("/projects/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Crear proyecto
          </Button>
        </div>
      )}
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
      toast.error("Error al enviar mensaje");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Mensajes</h2>

      <div className="bg-white border rounded-xl overflow-hidden">
        {/* Messages list */}
        <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <div key={message.id} className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={message.author.image || undefined} />
                  <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
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
              <p className="text-sm text-gray-500">No hay mensajes aun</p>
            </div>
          )}
        </div>

        {/* Message input */}
        <form onSubmit={handleSendMessage} className="border-t p-4 flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Calendario</h2>
      <div className="bg-white border rounded-xl p-12 text-center">
        <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <p className="text-lg font-medium text-gray-900 mb-2">Calendario del equipo</p>
        <p className="text-sm text-gray-500">Las tareas con fechas de entrega apareceran aqui</p>
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
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Error al copiar");
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Ingresa un correo electronico");
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
        toast.success("Invitacion enviada");
        setEmail("");
        onInviteSent();
        onClose();
      } else {
        toast.error("Error al enviar invitacion");
      }
    } catch (error) {
      toast.error("Error al enviar invitacion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar al equipo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email invite */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Invitar por correo electronico
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
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
                  <SelectItem value="MEMBER">Miembro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleInvite}
              disabled={!email.trim() || isLoading}
              className="w-full mt-3"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar invitacion"}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">o</span>
            </div>
          </div>

          {/* Copy link */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Compartir enlace de invitacion
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input value={inviteLink} readOnly className="pl-10 bg-gray-50 text-gray-600" />
              </div>
              <Button variant="outline" onClick={handleCopyLink} className="px-3">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
