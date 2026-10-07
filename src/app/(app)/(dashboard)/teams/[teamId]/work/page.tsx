"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  ArrowUpDown,
  Plus,
  FileText,
  Settings,
  Loader2,
  FolderKanban,
  MoreHorizontal,
  ExternalLink,
  Link2,
  Trash2,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TeamHeader } from "@/components/teams/team-header";

interface Project {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  members: Array<{
    id: string;
    name: string;
    image?: string;
  }>;
  isJoined?: boolean;
  /** Whether the viewer manages the project, when the list sends it. */
  canManage?: boolean;
}

/** A failed fetch that remembers its HTTP status, so a 403 reads differently. */
class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export default function TeamAllWorkPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [removeTarget, setRemoveTarget] = useState<Project | null>(null);
  const queryClient = useQueryClient();

  // The create page takes the team as a query param and sends it with the
  // POST, so the new project lands on this team's list. The shared gallery
  // dialog does not carry a team through its create paths yet.
  function createProjectInTeam() {
    router.push(`/projects/new?teamId=${encodeURIComponent(teamId)}`);
  }

  function copyProjectLink(projectId: string) {
    const url = `${window.location.origin}/projects/${projectId}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Project link copied"),
      () => toast.error("Couldn't copy link")
    );
  }

  // Throws on failure so the confirmation dialog stays open and shows the
  // route's reason (DELETE requires managing the project itself).
  async function removeFromTeam(projectId: string) {
    const res = await fetch(
      `/api/teams/${teamId}/work?projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Couldn't remove project");
    }
    setRemoveTarget(null);
    toast.success("Removed from team");
    queryClient.invalidateQueries({ queryKey: ["team-projects", teamId] });
  }

  // Fetch team data
  const { data: team, isLoading: isLoadingTeam } = useQuery({
    queryKey: ["team", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}`);
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json();
    },
  });

  // The caller's standing on the team. Unlinking a project revokes the whole
  // team's access to it, and the route allows it only to someone who manages
  // that project. The list does not always say who manages what, so a lead or
  // workspace OWNER/ADMIN sees the action on every row and anyone else on the
  // projects they belong to; the dialog shows the route's reason if refused.
  const { data: viewer } = useQuery({
    queryKey: ["team-viewer", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/members?viewer=1`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data.viewer ?? null) as { canManageMembers?: boolean } | null;
    },
  });
  const canUnlinkProjects = !!viewer?.canManageMembers;
  const canUnlink = (project: Project) =>
    project.canManage ?? (canUnlinkProjects || !!project.isJoined);

  // Fetch projects. A failure is an error state, not an empty list: turning
  // a 403 into [] told a non-member the team had no projects at all.
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
    error: projectsError,
    refetch: refetchProjects,
    isFetching: isFetchingProjects,
  } = useQuery({
    queryKey: ["team-projects", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/projects`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new HttpError(
          err.error || "Couldn't load this team's projects",
          res.status
        );
      }
      return res.json();
    },
    retry: false,
    // "New project" leaves for the create page and comes back here; the
    // global staleTime would otherwise show the list without the project
    // that was just created for this team.
    refetchOnMount: "always",
  });
  const projectsForbidden =
    projectsError instanceof HttpError && projectsError.status === 403;

  // Filter and sort projects
  const filteredProjects = projects
    .filter((p: Project) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: Project, b: Project) => {
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name);
      }
      return b.name.localeCompare(a.name);
    });

  if (isLoadingTeam) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Team not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <TeamHeader team={team} activeTab="work" />

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
                  onClick={createProjectInTeam}
                >
                  New project
                </Button>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b text-sm text-gray-500">
              <div className="col-span-7">Name</div>
              <div className="col-span-3">Members</div>
              <div className="col-span-2 flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 hover:text-gray-700">
                      <ArrowUpDown className="h-3 w-3" />
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
              {isLoadingProjects ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : projectsError ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 mb-3">
                    {projectsForbidden
                      ? "Join this team to see its projects."
                      : "Couldn't load this team's projects."}
                  </p>
                  {!projectsForbidden && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchProjects()}
                      disabled={isFetchingProjects}
                    >
                      <RotateCw className="h-4 w-4 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              ) : filteredProjects.length === 0 ? (
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
                      onClick={createProjectInTeam}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create project
                    </Button>
                  )}
                </div>
              ) : (
                filteredProjects.map((project: Project) => (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="group grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  >
                    {/* Name */}
                    <div className="col-span-7 flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center"
                        style={{ backgroundColor: project.color || "#6b7280" }}
                      >
                        {project.icon ? (
                          <span className="text-white text-sm">
                            {project.icon}
                          </span>
                        ) : (
                          <Settings className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {project.name}
                        </p>
                        {project.isJoined && (
                          <p className="text-xs text-[#a8893a]">You joined</p>
                        )}
                      </div>
                    </div>

                    {/* Members */}
                    <div className="col-span-3 flex items-center">
                      <div className="flex -space-x-2">
                        {project.members.slice(0, 5).map((member) => (
                          <Avatar
                            key={member.id}
                            className="h-6 w-6 border-2 border-white"
                          >
                            <AvatarImage src={member.image} />
                            <AvatarFallback className="text-xs bg-gray-100 text-black">
                              {member.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {project.members.length > 5 && (
                          <div className="h-6 w-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                            <span className="text-xs text-gray-600">
                              +{project.members.length - 5}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row options ("..." menu) — Asana "Mostrar opciones" */}
                    <div
                      className="col-span-2 flex items-center justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/projects/${project.id}`)
                            }
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open project
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copyProjectLink(project.id)}
                          >
                            <Link2 className="h-4 w-4 mr-2" />
                            Copy project link
                          </DropdownMenuItem>
                          {canUnlink(project) && (
                            <DropdownMenuItem
                              className="text-black"
                              onClick={() => setRemoveTarget(project)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove from team
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
              {/* New template */}
              <button
                onClick={() => router.push("/templates?new=1")}
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

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove project from team"
        description={
          removeTarget
            ? `"${removeTarget.name}" will no longer belong to ${team.name}. The project itself is not deleted.`
            : undefined
        }
        consequences={[
          "Team members whose access came only through this team lose access to the project",
        ]}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removeTarget) return;
          await removeFromTeam(removeTarget.id);
        }}
      />
    </div>
  );
}
