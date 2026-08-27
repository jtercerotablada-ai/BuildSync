"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  /** Route prefix of the shell that renders the dialog (e.g. "/portal"), so
   *  picking a result keeps the user inside that shell instead of jumping to
   *  the plain dashboard route. */
  basePath?: string;
}

export function SearchDialog({
  open,
  onOpenChange,
  basePath = "",
}: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    tasks: [],
    projects: [],
    teams: [],
    users: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Tracks the most recent query so a slower response for an older query
  // can't overwrite results for a newer one.
  const latestQueryRef = useRef("");
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      latestQueryRef.current = q;
      setResults({ tasks: [], projects: [], teams: [], users: [] });
      // Backspacing below 2 characters while a request is still in flight used
      // to leave the spinner up: this branch returned without clearing it, and
      // the in-flight query's finally is gated on still being the latest one.
      setIsLoading(false);
      setHasError(false);
      return;
    }

    latestQueryRef.current = q;
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (q !== latestQueryRef.current) return; // a newer query superseded this
      if (res.ok) {
        const data = await res.json();
        if (q !== latestQueryRef.current) return;
        setResults(data);
      } else {
        // Dropping the old rows matters as much as showing the message:
        // they belong to the PREVIOUS query, so leaving them under the new
        // one invites a click on something that never matched.
        setResults({ tasks: [], projects: [], teams: [], users: [] });
        setHasError(true);
      }
    } catch {
      // A failing backend must not read as "nothing matched" — surface it.
      if (q === latestQueryRef.current) {
        setResults({ tasks: [], projects: [], teams: [], users: [] });
        setHasError(true);
      }
    } finally {
      if (q === latestQueryRef.current) setIsLoading(false);
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
      setHasError(false);
    }
  }, [open]);

  function handleSelect(item: SearchResult) {
    onOpenChange(false);
    switch (item.type) {
      case "task":
        // Carry the task id in the URL the same way the inbox's links do.
        // Nothing reads `task` yet, so today the user still lands on the
        // board with nothing selected; the shape is here so that whenever
        // the destination views learn to open a task, both entry points
        // start working at once.
        if (item.extra?.projectId) {
          router.push(
            `${basePath}/projects/${item.extra.projectId}?task=${item.id}`
          );
        } else {
          router.push(`${basePath}/my-tasks?task=${item.id}`);
        }
        break;
      case "project":
        router.push(`${basePath}/projects/${item.id}`);
        break;
      case "team":
        router.push(`${basePath}/teams/${item.id}`);
        break;
      case "user":
        // Deliberately NOT prefixed: /profile/[userId] exists only in the
        // internal app, so a "/portal" prefix here would 404 the portal user.
        router.push(`/profile/${item.id}`);
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
        onValueChange={(value) => {
          setQuery(value);
          // Backspacing out of a failed search must drop the error banner
          // right away. search() also clears it, but only after the 300ms
          // debounce — until then the failure message and the "type at
          // least 2 characters" hint would both be on screen.
          if (value.length < 2) setHasError(false);
        }}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && hasError && (
          <div className="py-6 text-center text-sm text-gray-500">
            Search is unavailable right now. Try again in a moment.
          </div>
        )}

        {!isLoading && !hasError && query.length >= 2 && !hasResults && (
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
