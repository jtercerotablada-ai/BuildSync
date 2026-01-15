"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, FolderKanban, Briefcase, FileText, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface LinkWorkPopoverProps {
  teamId: string;
  children: React.ReactNode;
  onSuccess?: () => void;
}

interface WorkItem {
  id: string;
  name: string;
  type: "project" | "portfolio" | "template";
  color?: string;
}

const typeIcons = {
  project: FolderKanban,
  portfolio: Briefcase,
  template: FileText,
};

export function LinkWorkPopover({ teamId, children, onSuccess }: LinkWorkPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null);
  const [customName, setCustomName] = useState("");
  const [description, setDescription] = useState("");

  // Search for available work
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ["work-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const res = await fetch(`/api/work/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Mutation to link work
  const linkWorkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: selectedWork?.id,
          workType: selectedWork?.type,
          customName: customName || selectedWork?.name,
          description,
        }),
      });
      if (!res.ok) throw new Error("Failed to link work");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-work", teamId] });
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      toast.success("Work linked successfully");
      onSuccess?.();
      resetAndClose();
    },
    onError: () => {
      toast.error("Failed to link work");
    },
  });

  const resetForm = () => {
    setSearchQuery("");
    setSelectedWork(null);
    setCustomName("");
    setDescription("");
  };

  const resetAndClose = () => {
    resetForm();
    setOpen(false);
  };

  const handleSelectWork = (work: WorkItem) => {
    setSelectedWork(work);
    setCustomName(work.name);
    setSearchQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          resetForm();
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-96 p-4 bg-white shadow-lg border"
        align="center"
        side="bottom"
        sideOffset={8}
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <h3 className="font-medium text-gray-900">
              Work in Asana <span className="text-black">*</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Team members won&apos;t automatically have access to work linked in this space.{" "}
              <button type="button" className="text-black hover:underline">
                Learn more
              </button>
            </p>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects, portfolios..."
              className="pl-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && !selectedWork && (
            <div className="border rounded-lg max-h-32 overflow-y-auto">
              {searchResults.map((item: WorkItem) => {
                const Icon = typeIcons[item.type];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectWork(item)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left text-sm"
                  >
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ backgroundColor: item.color || "#6B7280" }}
                    >
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    <span>{item.name}</span>
                    <span className="text-xs text-gray-400 capitalize ml-auto">{item.type}</span>
                  </button>
                );
              })}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && !selectedWork && (
            <p className="text-sm text-gray-500 text-center py-2">
              No results found for &quot;{searchQuery}&quot;
            </p>
          )}

          {/* Selected work */}
          {selectedWork && (
            <div className="flex items-center gap-2 p-2 bg-white border border-black rounded text-sm">
              {(() => {
                const Icon = typeIcons[selectedWork.type];
                return (
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: selectedWork.color || "#6B7280" }}
                  >
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                );
              })()}
              <span className="font-medium">{selectedWork.name}</span>
              <button
                type="button"
                onClick={() => setSelectedWork(null)}
                className="ml-auto text-xs text-black hover:underline"
              >
                Change
              </button>
            </div>
          )}

          {/* Name */}
          <div>
            <Label className="text-sm">Name</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="mt-1"
              placeholder="Custom name (optional)"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-[60px]"
              placeholder="Add a description..."
            />
          </div>

          {/* Submit button */}
          <Button
            type="button"
            onClick={() => linkWorkMutation.mutate()}
            disabled={!selectedWork || linkWorkMutation.isPending}
            className="w-full bg-black hover:bg-black"
          >
            {linkWorkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add work
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
