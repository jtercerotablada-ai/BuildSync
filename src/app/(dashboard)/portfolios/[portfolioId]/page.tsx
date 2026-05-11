"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "ON_TRACK", label: "On track", color: "bg-[#c9a84c]" },
  { value: "AT_RISK", label: "At risk", color: "bg-[#a8893a]" },
  { value: "OFF_TRACK", label: "Off track", color: "bg-black" },
  { value: "ON_HOLD", label: "On hold", color: "bg-gray-400" },
  { value: "COMPLETE", label: "Complete", color: "bg-[#c9a84c]" },
];

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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  useEffect(() => {
    fetchPortfolio();
  }, [portfolioId]);

  async function fetchPortfolio() {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
        setNameDraft(data.name || "");
        setDescriptionDraft(data.description || "");
      } else if (res.status !== 404) {
        toast.error("Failed to load portfolio");
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      toast.error("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }

  async function savePortfolio(patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      const updated = await res.json();
      setPortfolio((prev) => (prev ? { ...prev, ...updated } : prev));
      return true;
    } catch (error) {
      console.error("Error saving portfolio:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
      return false;
    }
  }

  async function handleNameSave() {
    if (!nameDraft.trim() || nameDraft === portfolio?.name) {
      setEditingName(false);
      setNameDraft(portfolio?.name || "");
      return;
    }
    const ok = await savePortfolio({ name: nameDraft.trim() });
    if (ok) {
      toast.success("Name updated");
      setEditingName(false);
    }
  }

  async function handleDescriptionSave() {
    if (descriptionDraft === (portfolio?.description || "")) return;
    const ok = await savePortfolio({
      description: descriptionDraft.trim() || null,
    });
    if (ok) toast.success("Description updated");
  }

  async function handleStatusChange(status: string) {
    const ok = await savePortfolio({ status });
    if (ok) toast.success("Status updated");
  }

  async function handleDateChange(field: "startDate" | "endDate", value: string) {
    const ok = await savePortfolio({ [field]: value || null });
    if (ok) toast.success("Date updated");
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
        toast.success("Project added");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to add project");
      }
    } catch (error) {
      console.error("Error adding project:", error);
      toast.error("Failed to add project");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveProject(projectId: string) {
    if (!confirm("Remove this project from the portfolio?")) return;
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/projects?projectId=${projectId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        await fetchPortfolio();
        toast.success("Project removed");
      } else {
        toast.error("Failed to remove project");
      }
    } catch (error) {
      console.error("Error removing project:", error);
      toast.error("Failed to remove project");
    }
  }

  async function handleDeletePortfolio() {
    if (!confirm("Are you sure you want to delete this portfolio? This action cannot be undone.")) return;

    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Portfolio deleted");
        router.push("/portfolios");
      } else {
        toast.error("Failed to delete portfolio");
      }
    } catch (error) {
      console.error("Error deleting portfolio:", error);
      toast.error("Failed to delete portfolio");
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ON_TRACK":
        return "bg-[#c9a84c]/15 text-[#a8893a]";
      case "AT_RISK":
        return "bg-[#a8893a]/15 text-[#a8893a]";
      case "OFF_TRACK":
        return "bg-gray-100 text-black";
      case "COMPLETE":
        return "bg-[#c9a84c]/15 text-[#a8893a]";
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

  const dateInputValue = (date: string | null) =>
    date ? new Date(date).toISOString().split("T")[0] : "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-start gap-2 md:gap-4 mb-3 md:mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => router.push("/portfolios")}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: portfolio.color + "20" }}
          >
            <Folder className="h-5 w-5" style={{ color: portfolio.color }} />
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSave();
                  if (e.key === "Escape") {
                    setEditingName(false);
                    setNameDraft(portfolio.name);
                  }
                }}
                autoFocus
                className="h-8 text-lg md:text-xl font-semibold"
              />
            ) : (
              <h1
                className="text-lg md:text-xl font-semibold text-slate-900 truncate cursor-text hover:bg-slate-50 rounded px-1 -mx-1"
                onClick={() => setEditingName(true)}
                title="Click to edit"
              >
                {portfolio.name}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex">
                    <Badge className={cn(getStatusColor(portfolio.status), "cursor-pointer")}>
                      {getStatusLabel(portfolio.status)}
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                    >
                      <div className={cn("h-3 w-3 rounded-full mr-2", opt.color)} />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs text-gray-500">
                {portfolio._count.projects}{" "}
                {portfolio._count.projects === 1 ? "project" : "projects"}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingName(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-black"
                onClick={handleDeletePortfolio}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete portfolio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description (inline editable) */}
        <Textarea
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={handleDescriptionSave}
          placeholder="Add a description..."
          rows={2}
          className="mb-3 text-sm resize-none border-dashed"
        />

        {/* Date range */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-3 text-xs md:text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Start:</span>
            <input
              type="date"
              value={dateInputValue(portfolio.startDate)}
              onChange={(e) => handleDateChange("startDate", e.target.value)}
              className="bg-transparent border-b border-dashed border-slate-300 focus:border-slate-600 outline-none px-1"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500">End:</span>
            <input
              type="date"
              value={dateInputValue(portfolio.endDate)}
              onChange={(e) => handleDateChange("endDate", e.target.value)}
              className="bg-transparent border-b border-dashed border-slate-300 focus:border-slate-600 outline-none px-1"
            />
          </label>
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
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add project</span>
          </Button>
          <div className="flex items-center border rounded-md ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-r-none", viewMode === 'list' && "bg-slate-100")}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-l-none", viewMode === 'grid' && "bg-slate-100")}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {portfolio.projects.map((pp) => (
              <div
                key={pp.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white relative group"
                onClick={() => router.push(`/projects/${pp.project.id}`)}
              >
                <div className="flex items-center gap-2 mb-3 pr-8">
                  <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: pp.project.color }} />
                  <span className="font-medium text-sm truncate">{pp.project.name}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Progress value={pp.project.stats.progress} className="h-2 flex-1" />
                  <span className="text-xs text-slate-500 whitespace-nowrap">{pp.project.stats.progress}%</span>
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
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-black"
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
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border">
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 border-b text-xs font-medium text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Progress</div>
              <div className="col-span-2">Due date</div>
              <div className="col-span-1">Owner</div>
              <div className="col-span-1"></div>
            </div>

            {/* Rows */}
            {portfolio.projects.map((pp) => (
              <div
                key={pp.id}
                className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                onClick={() => router.push(`/projects/${pp.project.id}`)}
              >
                {/* Desktop row */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 items-center">
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: pp.project.color }}
                    />
                    <span className="font-medium text-slate-900 truncate">
                      {pp.project.name}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <Badge className={getStatusColor(pp.project.status)}>
                      {getStatusLabel(pp.project.status)}
                    </Badge>
                  </div>
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
                  <div className="col-span-2 flex items-center gap-1 text-sm text-slate-600 min-w-0">
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">
                      {formatDate(pp.project.startDate)} -{" "}
                      {formatDate(pp.project.endDate)}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={pp.project.owner.image || ""} />
                      <AvatarFallback className="text-xs bg-slate-200">
                        {pp.project.owner.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
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
                          className="text-black"
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

                {/* Mobile row (card layout) */}
                <div className="md:hidden px-3 py-3 flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: pp.project.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-slate-900 truncate text-sm">
                        {pp.project.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress
                        value={pp.project.stats.progress}
                        className="h-1.5 flex-1 max-w-[100px]"
                      />
                      <span className="text-[11px] text-slate-500">
                        {pp.project.stats.progress}%
                      </span>
                      <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor(pp.project.status))}>
                        {getStatusLabel(pp.project.status)}
                      </Badge>
                    </div>
                  </div>
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarImage src={pp.project.owner.image || ""} />
                    <AvatarFallback className="text-xs bg-slate-200">
                      {pp.project.owner.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-black"
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
