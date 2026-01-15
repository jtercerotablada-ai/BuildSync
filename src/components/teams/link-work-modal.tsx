"use client";

import { useState } from "react";
import { Search, X, Folder, Briefcase, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  type: "project" | "portfolio" | "template";
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [searchResults, setSearchResults] = useState<WorkItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Mock search results - in real implementation, this would fetch from API
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock results
    const allResults: WorkItem[] = [
      { id: "1", name: "Marketing Campaign", type: "project" as const, color: "#4CAF50" },
      { id: "2", name: "Product Launch", type: "project" as const, color: "#2196F3" },
      { id: "3", name: "Q4 Portfolio", type: "portfolio" as const, color: "#9C27B0" },
      { id: "4", name: "Sprint Template", type: "template" as const, color: "#FF9800" },
    ];
    const mockResults = allResults.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );

    setSearchResults(mockResults);
    setIsSearching(false);
  };

  const handleSelectWork = (work: WorkItem) => {
    setSelectedWork(work);
    setName(work.name);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleLink = async () => {
    if (!selectedWork) {
      toast.error("Please select a work item to link");
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
          name,
          description,
        }),
      });

      if (res.ok) {
        toast.success("Work linked successfully");
        onSuccess?.();
        handleClose();
      } else {
        toast.error("Failed to link work");
      }
    } catch (error) {
      toast.error("Failed to link work");
    } finally {
      setIsLinking(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedWork(null);
    setName("");
    setDescription("");
    setSearchResults([]);
    onClose();
  };

  const getWorkIcon = (type: WorkItem["type"]) => {
    switch (type) {
      case "project":
        return <Folder className="h-4 w-4" />;
      case "portfolio":
        return <Briefcase className="h-4 w-4" />;
      case "template":
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link existing work</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search for existing work */}
          {!selectedWork ? (
            <div className="space-y-2">
              <Label className="text-sm">
                Search for projects, portfolios, or templates
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="pl-9"
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
                        {getWorkIcon(result.type)}
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
                    No results found for "{searchQuery}"
                  </p>
                )}
            </div>
          ) : (
            <>
              {/* Selected Work */}
              <div className="space-y-2">
                <Label className="text-sm">Selected work</Label>
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                  <div
                    className="h-8 w-8 rounded flex items-center justify-center text-white"
                    style={{
                      backgroundColor: selectedWork.color || "#6B7280",
                    }}
                  >
                    {getWorkIcon(selectedWork.type)}
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
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="work-name" className="text-sm">
                  Name
                </Label>
                <Input
                  id="work-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Work name"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="work-description" className="text-sm">
                  Description
                </Label>
                <Textarea
                  id="work-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="min-h-[80px]"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedWork || isLinking}
          >
            {isLinking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Add work
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
