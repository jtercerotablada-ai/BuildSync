"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown,
  FolderKanban,
  Briefcase,
  Target,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamHeader } from "@/components/teams/team-header";
import { TeamSetupBanner } from "@/components/teams/team-setup-banner";
import { TeamWorkSection } from "@/components/teams/team-work-section";
import { TeamMembersWidget } from "@/components/teams/team-members-widget";
import { TeamGoalsWidget } from "@/components/teams/team-goals-widget";

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

export default function TeamPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await fetch(`/api/teams/${teamId}`);
        if (res.ok) {
          const data = await res.json();
          setTeam(data);
          setDescription(data.description || "");
        }
      } catch (error) {
        console.error("Error fetching team:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeam();
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
      }
    } catch (error) {
      console.error("Error updating description:", error);
    }
    setIsEditingDescription(false);
  };

  const handleSetupStepClick = (stepId: string) => {
    switch (stepId) {
      case "description":
        setIsEditingDescription(true);
        break;
      case "members":
        // Will trigger invite modal through TeamMembersWidget
        break;
      case "work":
        // Could open a dialog to add work
        break;
    }
  };

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
          Equipo no encontrado
        </h2>
        <p className="text-gray-500 mb-4">
          El equipo que buscas no existe o no tienes acceso.
        </p>
        <Button onClick={() => router.push("/")}>Volver al inicio</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con tabs */}
      <TeamHeader team={team} activeTab="overview" />

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Team Avatar + Name + Description */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Large Avatar */}
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-4 border-white shadow-lg flex items-center justify-center mb-6">
            {team.avatar ? (
              <img
                src={team.avatar}
                alt={team.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-5xl font-light text-gray-600">
                {team.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Team Name + Create Work Button */}
          <div className="flex items-center justify-center gap-4 w-full max-w-2xl">
            <h1 className="text-2xl font-semibold text-gray-900">{team.name}</h1>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  Crear trabajo
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => router.push(`/projects/new?teamId=${teamId}`)}
                >
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Proyecto
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/portfolios/new?teamId=${teamId}`)}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Portafolio
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/goals/new?teamId=${teamId}`)}
                >
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
                className="w-full p-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe el proposito y responsabilidades del equipo..."
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
              {team.description ||
                "Haz clic para agregar la descripcion del equipo..."}
            </button>
          )}
        </div>

        {/* Setup Banner */}
        <TeamSetupBanner team={team} onStepClick={handleSetupStepClick} />

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Left column - Work Selection (2/3) */}
          <div className="lg:col-span-2">
            <TeamWorkSection teamId={teamId} />
          </div>

          {/* Right column - Members + Goals (1/3) */}
          <div className="space-y-6">
            <TeamMembersWidget teamId={teamId} members={team.members} />
            <TeamGoalsWidget teamId={teamId} goals={team.objectives} />
          </div>
        </div>
      </div>
    </div>
  );
}
