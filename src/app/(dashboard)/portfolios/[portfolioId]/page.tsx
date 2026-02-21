"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Loader2,
  Folder,
  Calendar,
  Trash2,
  List,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  stats: {
    total: number;
    completed: number;
    overdue: number;
    progress: number;
  };
}

interface PortfolioProject {
  id: string;
  position: number;
  project: Project;
}

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  projects: PortfolioProject[];
  _count: {
    projects: number;
  };
}

interface AvailableProject {
  id: string;
  name: string;
  color: string;
}

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = params.portfolioId as string;

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [adding, setAdding] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    fetchPortfolio();
  }, [portfolioId]);

  async function fetchPortfolio() {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        // Filter out projects already in portfolio
        const existingIds = new Set(portfolio?.projects.map((p) => p.project.id) || []);
        setAvailableProjects(data.filter((p: AvailableProject) => !existingIds.has(p.id)));
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }

  async function handleAddProject() {
    if (!selectedProjectId) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });

      if (res.ok) {
        await fetchPortfolio();
        setAddProjectOpen(false);
        setSelectedProjectId("");
      }
    } catch (error) {
      console.error("Error adding project:", error);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveProject(projectId: string) {
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/projects?projectId=${projectId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        await fetchPortfolio();
      }
    } catch (error) {
      console.error("Error removing project:", error);
    }
  }

  async function handleDeletePortfolio() {
    if (!confirm("Are you sure you want to delete this portfolio?")) return;

    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/portfolios");
      }
    } catch (error) {
      console.error("Error deleting portfolio:", error);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ON_TRACK":
        return "bg-green-100 text-green-700";
      case "AT_RISK":
        return "bg-yellow-100 text-yellow-700";
      case "OFF_TRACK":
        return "bg-red-100 text-red-700";
      case "COMPLETE":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ON_TRACK":
        return "On track";
      case "AT_RISK":
        return "At risk";
      case "OFF_TRACK":
        return "Off track";
      case "ON_HOLD":
        return "On hold";
      case "COMPLETE":
        return "Complete";
      default:
        return status;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-slate-500">Portfolio not found</p>
        <Button variant="link" onClick={() => router.push("/portfolios")}>
          Go back to portfolios
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/portfolios")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: portfolio.color + "20" }}
            >
              <Folder className="h-5 w-5" style={{ color: portfolio.color }} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {portfolio.name}
              </h1>
              {portfolio.description && (
                <p className="text-sm text-slate-500">{portfolio.description}</p>
              )}
            </div>
          </div>
          <Badge className={getStatusColor(portfolio.status)}>
            {getStatusLabel(portfolio.status)}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={handleDeletePortfolio}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete portfolio
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAddProjectOpen(true);
              fetchAvailableProjects();
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add project
          </Button>
          <div className="flex items-center border rounded-md ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-r-none", viewMode === 'list' && "bg-slate-100")}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-l-none", viewMode === 'grid' && "bg-slate-100")}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {portfolio.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Folder className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-medium text-slate-900 mb-2">
              No projects in this portfolio
            </h2>
            <p className="text-sm text-slate-500 max-w-md mb-4">
              Add projects to track their progress together.
            </p>
            <Button
              onClick={() => {
                setAddProjectOpen(true);
                fetchAvailableProjects();
              }}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add project
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {portfolio.projects.map((pp) => (
              <div
                key={pp.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                onClick={() => router.push(`/projects/${pp.project.id}`)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: pp.project.color }} />
                  <span className="font-medium text-sm truncate">{pp.project.name}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Progress value={pp.project.stats.progress} className="h-2 flex-1" />
                  <span className="text-xs text-slate-500">{pp.project.stats.progress}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge className={getStatusColor(pp.project.status)}>
                    {getStatusLabel(pp.project.status)}
                  </Badge>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={pp.project.owner.image || ""} />
                    <AvatarFallback className="text-xs bg-slate-200">
                      {pp.project.owner.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b text-xs font-medium text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Progress</div>
              <div className="col-span-2">Due date</div>
              <div className="col-span-1">Owner</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Rows */}
            {portfolio.projects.map((pp) => (
              <div
                key={pp.id}
                className="grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-0 items-center hover:bg-slate-50 cursor-pointer"
                onClick={() => router.push(`/projects/${pp.project.id}`)}
              >
                {/* Name */}
                <div className="col-span-4 flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: pp.project.color }}
                  />
                  <span className="font-medium text-slate-900 truncate">
                    {pp.project.name}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <Badge className={getStatusColor(pp.project.status)}>
                    {getStatusLabel(pp.project.status)}
                  </Badge>
                </div>

                {/* Progress */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={pp.project.stats.progress}
                      className="h-2 flex-1"
                    />
                    <span className="text-sm text-slate-600 w-10">
                      {pp.project.stats.progress}%
                    </span>
                  </div>
                </div>

                {/* Due Date */}
                <div className="col-span-2 flex items-center gap-1 text-sm text-slate-600">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDate(pp.project.startDate)} -{" "}
                    {formatDate(pp.project.endDate)}
                  </span>
                </div>

                {/* Owner */}
                <div className="col-span-1">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={pp.project.owner.image || ""} />
                    <AvatarFallback className="text-xs bg-slate-200">
                      {pp.project.owner.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveProject(pp.project.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove from portfolio
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add project to portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 text-center">
                    No available projects
                  </div>
                ) : (
                  availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800"
              onClick={handleAddProject}
              disabled={adding || !selectedProjectId}
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add project"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
