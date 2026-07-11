"use client";

import { useState } from "react";
import { Search, X, Folder, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface LinkWorkModalProps {
  teamId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface WorkItem {
  id: string;
  name: string;
  // Only projects are linkable today; /api/work/search returns projects only.
  type: "project";
  color?: string;
}

export function LinkWorkModal({
  teamId,
  open,
  onClose,
  onSuccess,
}: LinkWorkModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [searchResults, setSearchResults] = useState<WorkItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/work/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectWork = (work: WorkItem) => {
    setSelectedWork(work);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleLink = async () => {
    if (!selectedWork) {
      toast.error("Please select a project to link");
      return;
    }

    setIsLinking(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: selectedWork.id,
          workType: selectedWork.type,
        }),
      });

      if (res.ok) {
        toast.success("Project added to the team");
        onSuccess?.();
        handleClose();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to add project");
      }
    } catch {
      toast.error("Failed to add project");
    } finally {
      setIsLinking(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedWork(null);
    setSearchResults([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add existing work</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search for existing project */}
          {!selectedWork ? (
            <div className="space-y-2">
              <Label className="text-sm">Search for a project to add</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search projects by name..."
                  className="pl-9"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelectWork(result)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                    >
                      <div
                        className="h-8 w-8 rounded flex items-center justify-center text-white"
                        style={{ backgroundColor: result.color || "#6B7280" }}
                      >
                        <Folder className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{result.name}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {result.type}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 &&
                searchResults.length === 0 &&
                !isSearching && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No projects found for &quot;{searchQuery}&quot;
                  </p>
                )}
            </div>
          ) : (
            /* Selected project */
            <div className="space-y-2">
              <Label className="text-sm">Selected project</Label>
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                <div
                  className="h-8 w-8 rounded flex items-center justify-center text-white"
                  style={{ backgroundColor: selectedWork.color || "#6B7280" }}
                >
                  <Folder className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedWork.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {selectedWork.type}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedWork(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                This adds the project to the team&apos;s work. It won&apos;t
                rename the project or change its contents.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedWork || isLinking}>
            {isLinking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add work
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
