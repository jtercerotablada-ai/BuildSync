"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface ProjectAccessConfig {
  projectId: string;
  canComment: boolean;
  canUpload: boolean;
  canApprove: boolean;
}

export function InviteClientDialog({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<
    Record<string, ProjectAccessConfig>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function toggleProject(projectId: string) {
    setSelectedProjects((prev) => {
      if (prev[projectId]) {
        const next = { ...prev };
        delete next[projectId];
        return next;
      }
      return {
        ...prev,
        [projectId]: {
          projectId,
          canComment: true,
          canUpload: true,
          canApprove: false,
        },
      };
    });
  }

  function updatePermission(
    projectId: string,
    field: "canComment" | "canUpload" | "canApprove",
    value: boolean
  ) {
    setSelectedProjects((prev) => {
      if (!prev[projectId]) return prev;
      return {
        ...prev,
        [projectId]: { ...prev[projectId], [field]: value },
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const projectAccess = Object.values(selectedProjects);

      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, projectAccess }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send invitation");
        return;
      }

      setOpen(false);
      setEmail("");
      setSelectedProjects({});
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-email">Email Address</Label>
            <Input
              id="client-email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Project Access</Label>
            <p className="text-xs text-muted-foreground">
              Select which projects this client should have access to and configure their permissions.
            </p>
            <div className="space-y-3 border rounded-md p-3 max-h-[300px] overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No projects available.
                </p>
              ) : (
                projects.map((project) => {
                  const isSelected = !!selectedProjects[project.id];
                  const config = selectedProjects[project.id];

                  return (
                    <div
                      key={project.id}
                      className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`proj-${project.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleProject(project.id)}
                        />
                        <Label
                          htmlFor={`proj-${project.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {project.name}
                        </Label>
                      </div>

                      {isSelected && config && (
                        <div className="ml-6 flex flex-wrap gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`comment-${project.id}`}
                              checked={config.canComment}
                              onCheckedChange={(checked) =>
                                updatePermission(
                                  project.id,
                                  "canComment",
                                  checked === true
                                )
                              }
                            />
                            <Label
                              htmlFor={`comment-${project.id}`}
                              className="text-sm"
                            >
                              Can Comment
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`upload-${project.id}`}
                              checked={config.canUpload}
                              onCheckedChange={(checked) =>
                                updatePermission(
                                  project.id,
                                  "canUpload",
                                  checked === true
                                )
                              }
                            />
                            <Label
                              htmlFor={`upload-${project.id}`}
                              className="text-sm"
                            >
                              Can Upload
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`approve-${project.id}`}
                              checked={config.canApprove}
                              onCheckedChange={(checked) =>
                                updatePermission(
                                  project.id,
                                  "canApprove",
                                  checked === true
                                )
                              }
                            />
                            <Label
                              htmlFor={`approve-${project.id}`}
                              className="text-sm"
                            >
                              Can Approve
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
