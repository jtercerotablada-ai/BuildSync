"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FolderKanban,
  FileText,
  Briefcase,
  Plus,
  Loader2,
  MoreHorizontal,
  ExternalLink,
  Link2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkWorkModal } from "./link-work-modal";

interface WorkItem {
  id: string;
  name: string;
  type: "project" | "portfolio" | "template";
  color?: string;
  icon?: string;
}

interface TeamWorkSectionProps {
  teamId: string;
  /** Bubbled up so the parent (setup checklist / counts) can refresh
   *  when work is linked or unlinked. */
  onWorkChanged?: () => void;
}

/** Imperative handle so the parent's setup-checklist "Add work" step
 *  can open the link-work modal that lives inside this section. */
export interface TeamWorkSectionHandle {
  openAddWork: () => void;
}

const typeIcons = {
  project: FolderKanban,
  portfolio: Briefcase,
  template: FileText,
};

export const TeamWorkSection = forwardRef<
  TeamWorkSectionHandle,
  TeamWorkSectionProps
>(function TeamWorkSection({ teamId, onWorkChanged }, ref) {
  const router = useRouter();
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // A failed read is NOT an empty team. /api/teams/:id/work answers 403 to a
  // non-member, and the discovery grid now sends non-members straight to this
  // page — so swallowing the error into `workItems = []` showed a team with
  // six attached projects the copy for a team that has none, above an
  // Add work button that 403s on click.
  const [loadError, setLoadError] = useState<"denied" | "failed" | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  async function fetchWork() {
    try {
      const res = await fetch(`/api/teams/${teamId}/work`);
      if (res.ok) {
        setWorkItems(await res.json());
        setLoadError(null);
      } else {
        setWorkItems([]);
        setLoadError(res.status === 403 || res.status === 404 ? "denied" : "failed");
      }
    } catch (error) {
      console.error("Error fetching team work:", error);
      setWorkItems([]);
      setLoadError("failed");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchWork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useImperativeHandle(ref, () => ({
    openAddWork: () => setShowLinkModal(true),
  }));

  const handleLinked = () => {
    fetchWork();
    onWorkChanged?.();
  };

  function copyWorkLink(item: WorkItem) {
    const url = `${window.location.origin}/${item.type}s/${item.id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Couldn't copy link")
    );
  }

  async function removeFromTeam(item: WorkItem) {
    try {
      const res = await fetch(
        `/api/teams/${teamId}/work?projectId=${item.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success("Removed from team");
      fetchWork();
      onWorkChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove work");
    }
  }

  return (
    <div className="bg-white border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Curated work</h3>
        {/* Both actions go to endpoints this caller has just been refused, so
            neither is offered once the read came back denied. */}
        {loadError !== "denied" && (
          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black"
              onClick={() => setShowLinkModal(true)}
            >
              <Plus className="h-4 w-4" />
              Add work
            </button>
            <button
              className="text-sm text-gray-500 hover:text-black hover:underline"
              onClick={() => router.push(`/teams/${teamId}/work`)}
            >
              View all work
            </button>
          </div>
        )}
      </div>

      {/* Work items list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : loadError ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {loadError === "denied"
              ? "Join this team to see the work it keeps here."
              : "Couldn't load this team's work."}
          </p>
          {loadError === "failed" && (
            <button
              className="mt-3 text-sm font-medium text-gray-900 hover:underline"
              onClick={() => {
                setIsLoading(true);
                fetchWork();
              }}
            >
              Try again
            </button>
          )}
        </div>
      ) : workItems.length > 0 ? (
        <div className="space-y-1">
          {workItems.map((item) => {
            const Icon = typeIcons[item.type] ?? FolderKanban;

            return (
              /* The row used to be a single <button>, so the "..." was just a
                 decorative icon inside it: hovering promised a menu and
                 clicking it only opened the project. The row is now a plain
                 container with the open action and a real row menu as
                 siblings, mirroring the All work tab. */
              <div
                key={item.id}
                className="group w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <button
                  onClick={() => router.push(`/${item.type}s/${item.id}`)}
                  className="flex-1 flex items-center gap-3 min-w-0 text-left"
                >
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: item.color || "#6b7280" }}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                    {item.name}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={`Options for ${item.name}`}
                      className="p-1 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/${item.type}s/${item.id}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyWorkLink(item)}>
                      <Link2 className="h-4 w-4 mr-2" />
                      Copy link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-black"
                      onClick={() => removeFromTeam(item)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove from team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="text-center py-6">
          {/* Three grey skeleton bars used to sit here as decoration. They
              are the exact shape this app draws while data is loading, so an
              empty section read as a fetch that never finished — the section
              already has a real spinner one branch up for that. */}
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Organize links to important work, such as portfolios, projects,
            templates, etc., so your team members can find them easily.
          </p>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowLinkModal(true)}
          >
            <Plus className="h-4 w-4" />
            Add work
          </Button>
        </div>
      )}

      <LinkWorkModal
        teamId={teamId}
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSuccess={handleLinked}
      />
    </div>
  );
});
