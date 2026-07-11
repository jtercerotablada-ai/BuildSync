"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  FileText,
  Briefcase,
  Plus,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [showLinkModal, setShowLinkModal] = useState(false);

  async function fetchWork() {
    try {
      const res = await fetch(`/api/teams/${teamId}/work`);
      if (res.ok) {
        const data = await res.json();
        setWorkItems(data);
      }
    } catch (error) {
      console.error("Error fetching team work:", error);
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

  return (
    <div className="bg-white border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Curated work</h3>
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
      </div>

      {/* Work items list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : workItems.length > 0 ? (
        <div className="space-y-1">
          {workItems.map((item) => {
            const Icon = typeIcons[item.type] ?? FolderKanban;

            return (
              <button
                key={item.id}
                onClick={() => router.push(`/${item.type}s/${item.id}`)}
                className="group w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
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
                <MoreHorizontal className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="text-center py-6">
          {/* Placeholder skeleton items */}
          <div className="space-y-3 mb-6 opacity-30">
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 bg-gray-300 rounded" />
              <div className="flex-1 h-3 bg-gray-200 rounded w-3/4" />
            </div>
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 bg-gray-200 rounded" />
              <div className="flex-1 h-3 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 bg-gray-300 rounded" />
              <div className="flex-1 h-3 bg-gray-200 rounded w-2/3" />
            </div>
          </div>

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
