"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FolderKanban,
  Briefcase,
  FileText,
  Plus,
  Search,
  LayoutGrid,
  List,
  Loader2,
  ChevronDown,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamHeader } from "@/components/teams/team-header";
import { cn } from "@/lib/utils";

interface WorkItem {
  id: string;
  name: string;
  type: "project" | "portfolio" | "template";
  color?: string;
  status?: string;
  description?: string;
  _count?: {
    tasks: number;
  };
}

interface Team {
  id: string;
  name: string;
  avatar: string | null;
  members: Array<{
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
}

const typeIcons = {
  project: FolderKanban,
  portfolio: Briefcase,
  template: FileText,
};

const typeLabels = {
  project: "Proyecto",
  portfolio: "Portafolio",
  template: "Plantilla",
};

const statusColors: Record<string, string> = {
  ON_TRACK: "bg-green-500",
  AT_RISK: "bg-yellow-500",
  OFF_TRACK: "bg-red-500",
  ON_HOLD: "bg-gray-500",
  COMPLETE: "bg-blue-500",
};

export default function TeamWorkPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<string>("all");

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
        }

        if (workRes.ok) {
          const workData = await workRes.json();
          setWorkItems(workData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [teamId]);

  const filteredItems = workItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return <div>Equipo no encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TeamHeader team={team} activeTab="work" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Todo el trabajo
            </h2>
            <p className="text-sm text-gray-500">
              {workItems.length} elemento{workItems.length !== 1 ? "s" : ""}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar trabajo
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => router.push(`/projects/new?teamId=${teamId}`)}
              >
                <FolderKanban className="h-4 w-4 mr-2" />
                Nuevo proyecto
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/portfolios/new?teamId=${teamId}`)}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Nuevo portafolio
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/goals/new?teamId=${teamId}`)}
              >
                <Target className="h-4 w-4 mr-2" />
                Nuevo objetivo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <FileText className="h-4 w-4 mr-2" />
                Vincular existente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar trabajo..."
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-10 px-3 border rounded-lg text-sm bg-white"
            >
              <option value="all">Todos los tipos</option>
              <option value="project">Proyectos</option>
              <option value="portfolio">Portafolios</option>
              <option value="template">Plantillas</option>
            </select>

            <div className="flex border rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "grid"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "list"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Work items */}
        {filteredItems.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const Icon = typeIcons[item.type];
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(`/${item.type}s/${item.id}`)}
                    className="bg-white border rounded-xl p-4 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          item.color || "bg-gray-100"
                        )}
                        style={
                          item.color
                            ? { backgroundColor: item.color }
                            : undefined
                        }
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {typeLabels[item.type]}
                        </p>
                        {item.status && (
                          <div className="flex items-center gap-2 mt-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                statusColors[item.status] || "bg-gray-400"
                              )}
                            />
                            <span className="text-xs text-gray-500">
                              {item.status.replace("_", " ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border rounded-xl divide-y">
              {filteredItems.map((item) => {
                const Icon = typeIcons[item.type];
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(`/${item.type}s/${item.id}`)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        item.color || "bg-gray-100"
                      )}
                      style={
                        item.color ? { backgroundColor: item.color } : undefined
                      }
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">
                        {typeLabels[item.type]}
                      </p>
                    </div>

                    {item.status && (
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            statusColors[item.status] || "bg-gray-400"
                          )}
                        />
                        <span className="text-sm text-gray-500">
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                    )}

                    {item._count?.tasks !== undefined && (
                      <span className="text-sm text-gray-400">
                        {item._count.tasks} tareas
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="bg-white border rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <FolderKanban className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery
                ? "No se encontraron resultados"
                : "Aun no hay trabajo"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery
                ? "Intenta con otra busqueda"
                : "Agrega proyectos, portafolios o plantillas para organizar el trabajo del equipo"}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => router.push(`/projects/new?teamId=${teamId}`)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Crear proyecto
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
