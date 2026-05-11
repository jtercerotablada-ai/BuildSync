"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, Trash2, ChevronDown, UserPlus, Crown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WorkspaceUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface ProjectMember {
  id: string;
  role: "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface ProjectOwner {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  owner: ProjectOwner;
  onMembersChange?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  COMMENTER: "Commenter",
  VIEWER: "Viewer",
};

function initials(name: string | null, email: string): string {
  const source = name || email || "";
  return source
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProjectMembersDialog({
  open,
  onOpenChange,
  projectId,
  owner,
  onMembersChange,
}: Props) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  // Load current members when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingMembers(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/members`);
        if (res.ok && !cancelled) {
          setMembers(await res.json());
        } else if (!res.ok) {
          toast.error("Failed to load members");
        }
      } catch {
        if (!cancelled) toast.error("Failed to load members");
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // Search workspace users (debounced)
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `/api/users/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (res.ok) {
          const users: WorkspaceUser[] = await res.json();
          // Exclude users already in the project (and the owner)
          const memberIds = new Set([
            owner.id,
            ...members.map((m) => m.userId),
          ]);
          setSearchResults(users.filter((u) => !memberIds.has(u.id)));
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, members, owner.id]);

  async function addMember(user: WorkspaceUser) {
    setAdding(user.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: "EDITOR" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add member");
      }
      const created: ProjectMember = await res.json();
      setMembers((prev) => [...prev, created]);
      setSearchResults((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`${user.name || user.email} added`);
      onMembersChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add member");
    } finally {
      setAdding(null);
    }
  }

  async function removeMember(member: ProjectMember) {
    if (!confirm(`Remove ${member.user.name || member.user.email}?`)) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members?userId=${member.userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success("Member removed");
      onMembersChange?.();
    } catch {
      toast.error("Failed to remove member");
    }
  }

  async function changeRole(member: ProjectMember, role: ProjectMember["role"]) {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, role }),
      });
      if (!res.ok) throw new Error();
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role } : m))
      );
      toast.success("Role updated");
    } catch {
      toast.error("Failed to update role");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Project members
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 md:px-6 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search workspace members…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Search results */}
        {(query || searching) && (
          <div className="px-4 md:px-6 pb-2 flex-shrink-0">
            <p className="text-xs text-gray-500 mb-2">
              {searching ? "Searching…" : "Add to project"}
            </p>
            {searchResults.length === 0 && !searching && (
              <p className="text-xs text-gray-400 py-2 px-3 bg-gray-50 rounded">
                No matching workspace users.
              </p>
            )}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => addMember(u)}
                  disabled={adding === u.id}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-gray-50 text-left disabled:opacity-50"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={u.image || ""} />
                    <AvatarFallback className="text-xs bg-[#a8893a]/15 text-amber-900">
                      {initials(u.name, u.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {u.name || u.email}
                    </p>
                    {u.name && (
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    )}
                  </div>
                  {adding === u.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <UserPlus className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t flex-1 overflow-y-auto px-4 md:px-6 py-3">
          <p className="text-xs text-gray-500 mb-2">
            Members ({members.length + 1})
          </p>

          {/* Owner row (always present) */}
          <div className="flex items-center gap-2 p-2 rounded">
            <Avatar className="h-8 w-8">
              <AvatarImage src={owner.image || ""} />
              <AvatarFallback className="text-xs bg-black text-white">
                {initials(owner.name, owner.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate flex items-center gap-1">
                {owner.name || owner.email}
                <Crown className="h-3 w-3 text-[#a8893a] flex-shrink-0" />
              </p>
              {owner.name && (
                <p className="text-xs text-gray-500 truncate">{owner.email}</p>
              )}
            </div>
            <span className="text-xs text-gray-500 px-2 py-1">Owner</span>
          </div>

          {loadingMembers ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded hover:bg-gray-50 group"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.user.image || ""} />
                  <AvatarFallback className="text-xs bg-[#a8893a]/15 text-amber-900">
                    {initials(m.user.name, m.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {m.user.name || m.user.email}
                  </p>
                  {m.user.name && (
                    <p className="text-xs text-gray-500 truncate">
                      {m.user.email}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-600 h-7 px-2"
                    >
                      {ROLE_LABELS[m.role]}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"] as const).map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => changeRole(m, r)}
                      >
                        {ROLE_LABELS[r]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      className="text-black"
                      onClick={() => removeMember(m)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
