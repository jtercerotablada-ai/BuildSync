"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

interface ProjectAccess {
  id: string;
  projectId: string;
  projectName: string;
  canComment: boolean;
  canUpload: boolean;
  canApprove: boolean;
}

interface Project {
  id: string;
  name: string;
}

interface ClientAccessTableProps {
  clientId: string;
  clientName: string;
  accesses: ProjectAccess[];
  projects: Project[];
}

export function ClientAccessTable({
  clientId,
  clientName,
  accesses,
  projects,
}: ClientAccessTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [addProjectId, setAddProjectId] = useState("");
  const router = useRouter();

  // Filter out projects the client already has access to
  const availableProjects = projects.filter(
    (p) => !accesses.some((a) => a.projectId === p.id)
  );

  async function togglePermission(
    projectId: string,
    field: "canComment" | "canUpload" | "canApprove",
    currentValue: boolean
  ) {
    setLoading(`${projectId}-${field}`);
    try {
      await fetch(`/api/admin/clients/${clientId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, [field]: !currentValue }),
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to update permission:", error);
    } finally {
      setLoading(null);
    }
  }

  async function removeAccess(projectId: string) {
    setLoading(`remove-${projectId}`);
    try {
      await fetch(
        `/api/admin/clients/${clientId}/access?projectId=${projectId}`,
        { method: "DELETE" }
      );
      router.refresh();
    } catch (error) {
      console.error("Failed to remove access:", error);
    } finally {
      setLoading(null);
    }
  }

  async function addAccess() {
    if (!addProjectId) return;
    setLoading("add");
    try {
      await fetch(`/api/admin/clients/${clientId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: addProjectId,
          canComment: true,
          canUpload: true,
          canApprove: false,
        }),
      });
      setAddProjectId("");
      router.refresh();
    } catch (error) {
      console.error("Failed to add access:", error);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        Project Access for {clientName}
      </h4>

      {accesses.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-center">Comment</TableHead>
              <TableHead className="text-center">Upload</TableHead>
              <TableHead className="text-center">Approve</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accesses.map((access) => (
              <TableRow key={access.id}>
                <TableCell className="font-medium">
                  {access.projectName}
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={access.canComment}
                    disabled={loading === `${access.projectId}-canComment`}
                    onCheckedChange={() =>
                      togglePermission(
                        access.projectId,
                        "canComment",
                        access.canComment
                      )
                    }
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={access.canUpload}
                    disabled={loading === `${access.projectId}-canUpload`}
                    onCheckedChange={() =>
                      togglePermission(
                        access.projectId,
                        "canUpload",
                        access.canUpload
                      )
                    }
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={access.canApprove}
                    disabled={loading === `${access.projectId}-canApprove`}
                    onCheckedChange={() =>
                      togglePermission(
                        access.projectId,
                        "canApprove",
                        access.canApprove
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loading === `remove-${access.projectId}`}
                    onClick={() => removeAccess(access.projectId)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">
          No project access configured.
        </p>
      )}

      {/* Add project access */}
      {availableProjects.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={addProjectId} onValueChange={setAddProjectId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Add project access..." />
            </SelectTrigger>
            <SelectContent>
              {availableProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={addAccess}
            disabled={!addProjectId || loading === "add"}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
