"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckSquare, FolderKanban, Users, Loader2 } from "lucide-react";

interface SearchResult {
  id: string;
  name: string | null;
  type: "task" | "project" | "team" | "user";
  extra: Record<string, string | null | undefined>;
}

interface SearchResults {
  tasks: SearchResult[];
  projects: SearchResult[];
  teams: SearchResult[];
  users: SearchResult[];
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    tasks: [],
    projects: [],
    teams: [],
    users: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults({ tasks: [], projects: [], teams: [], users: [] });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({ tasks: [], projects: [], teams: [], users: [] });
    }
  }, [open]);

  function handleSelect(item: SearchResult) {
    onOpenChange(false);
    switch (item.type) {
      case "task":
        router.push(`/projects/${item.extra.projectId}`);
        break;
      case "project":
        router.push(`/projects/${item.id}`);
        break;
      case "team":
        router.push(`/teams/${item.id}`);
        break;
      case "user":
        router.push(`/settings`);
        break;
    }
  }

  const hasResults =
    results.tasks.length > 0 ||
    results.projects.length > 0 ||
    results.teams.length > 0 ||
    results.users.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search across tasks, projects, teams and people"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Search tasks, projects, teams, people..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && query.length >= 2 && !hasResults && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {!isLoading && query.length < 2 && (
          <div className="py-6 text-center text-sm text-gray-500">
            Type at least 2 characters to search...
          </div>
        )}

        {results.tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {results.tasks.map((task) => (
              <CommandItem
                key={task.id}
                value={`task-${task.id}-${task.name}`}
                onSelect={() => handleSelect(task)}
                className="cursor-pointer"
              >
                <CheckSquare className="h-4 w-4 text-gray-500" />
                <span className="flex-1 truncate">{task.name}</span>
                {task.extra.projectName && (
                  <span className="text-xs text-gray-400 truncate max-w-[150px]">
                    {task.extra.projectName}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {results.projects.map((project) => (
              <CommandItem
                key={project.id}
                value={`project-${project.id}-${project.name}`}
                onSelect={() => handleSelect(project)}
                className="cursor-pointer"
              >
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.extra.color || "#6b7280" }}
                />
                <FolderKanban className="h-4 w-4 text-gray-500" />
                <span className="flex-1 truncate">{project.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.teams.length > 0 && (
          <CommandGroup heading="Teams">
            {results.teams.map((team) => (
              <CommandItem
                key={team.id}
                value={`team-${team.id}-${team.name}`}
                onSelect={() => handleSelect(team)}
                className="cursor-pointer"
              >
                <Users className="h-4 w-4 text-gray-500" />
                <span className="flex-1 truncate">{team.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.users.length > 0 && (
          <CommandGroup heading="People">
            {results.users.map((user) => (
              <CommandItem
                key={user.id}
                value={`user-${user.id}-${user.name}`}
                onSelect={() => handleSelect(user)}
                className="cursor-pointer"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={user.extra.image || ""} />
                  <AvatarFallback className="text-[10px] bg-gray-200">
                    {user.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{user.name}</span>
                {user.extra.email && (
                  <span className="text-xs text-gray-400 truncate max-w-[180px]">
                    {user.extra.email}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
