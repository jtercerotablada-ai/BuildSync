"use client";

/**
 * /teams/[teamId]/knowledge — Team Knowledge (Asana "Conocimientos"
 * parity). A glossary: term + definition entries that give teammates
 * shared context. Empty state mirrors Asana ("Add terms to give your
 * teammates shared context…" + Create entry). Any member can add/edit;
 * the author or a team lead can delete.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Plus,
  Search,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamHeader } from "@/components/teams/team-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Author {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Entry {
  id: string;
  term: string;
  definition: string;
  createdAt: string;
  updatedAt: string;
  author: Author | null;
  mine: boolean;
}

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  avatar: string | null;
  members: TeamMember[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TeamKnowledgePage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const { data: session } = useSession();
  const currentUserId =
    (session?.user as { id?: string } | undefined)?.id || null;

  const [team, setTeam] = useState<Team | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinguishes "the glossary is genuinely empty" from "the fetch failed"
  // — otherwise a failed GET would show the onboarding empty state and the
  // user would think a populated glossary was empty (and re-create terms).
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");

  // Create / edit dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);

  const fetchEntries = useCallback(async () => {
    const res = await fetch(`/api/teams/${teamId}/knowledge`);
    if (res.ok) {
      setEntries(await res.json());
      setLoadError(false);
    } else {
      setLoadError(true);
    }
  }, [teamId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, entriesRes] = await Promise.all([
        fetch(`/api/teams/${teamId}`),
        fetch(`/api/teams/${teamId}/knowledge`),
      ]);
      if (teamRes.ok) setTeam(await teamRes.json());
      if (entriesRes.ok) {
        setEntries(await entriesRes.json());
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch (e) {
      console.error("Error loading knowledge:", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const isLead = useMemo(
    () =>
      !!currentUserId &&
      team?.members.some(
        (m) => m.user.id === currentUserId && m.role === "LEAD"
      ),
    [team, currentUserId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q)
    );
  }, [entries, search]);

  function openCreate() {
    setEditingId(null);
    setTerm("");
    setDefinition("");
    setEditorOpen(true);
  }

  function openEdit(entry: Entry) {
    setEditingId(entry.id);
    setTerm(entry.term);
    setDefinition(entry.definition);
    setEditorOpen(true);
  }

  async function saveEntry() {
    const t = term.trim();
    if (!t) {
      toast.error("Enter a term");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editingId
          ? `/api/teams/${teamId}/knowledge/${editingId}`
          : `/api/teams/${teamId}/knowledge`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ term: t, definition: definition.trim() }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success(editingId ? "Entry updated" : "Entry created");
      setEditorOpen(false);
      fetchEntries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save entry");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/knowledge/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success("Entry deleted");
      setEntries((prev) => prev.filter((e) => e.id !== target.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete entry");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Team not found
      </div>
    );
  }

  const isEmpty = !loadError && entries.length === 0;

  return (
    <div className="min-h-screen bg-white">
      <TeamHeader team={team} activeTab="knowledge" />

      {loadError && entries.length === 0 ? (
        // Fetch failed — don't masquerade as an empty glossary.
        <div className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-2xl border p-10 text-center">
            <p className="mb-4 text-sm text-gray-600">
              Couldn&apos;t load this team&apos;s knowledge.
            </p>
            <Button variant="outline" onClick={loadAll} className="gap-1.5">
              <Loader2 className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      ) : isEmpty ? (
        // ── Empty state (Asana "Conocimientos") ──────────────────
        <div className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-2xl border p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <BookOpen className="h-7 w-7 text-gray-500" />
            </div>
            <p className="mx-auto mb-6 max-w-sm text-sm text-gray-500">
              Add terms to give your teammates shared context while they
              collaborate on work.
            </p>
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create entry
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Toolbar */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Knowledge
              </h2>
              <span className="text-sm text-gray-400">
                {entries.length} {entries.length === 1 ? "term" : "terms"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search terms..."
                  className="h-9 w-56 pl-8"
                />
              </div>
              <Button onClick={openCreate} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create entry
              </Button>
            </div>
          </div>

          {/* Entries */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-gray-500">
              No terms match &quot;{search}&quot;
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className="group rounded-xl border p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 break-words">
                      {entry.term}
                    </h3>
                    {/* Any team member can edit (collaborative shared
                        context); only the author or a lead can delete. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-gray-700 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(entry)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {(entry.mine || isLead) && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {entry.definition ? (
                    <p className="mt-1.5 text-sm text-gray-600 whitespace-pre-wrap break-words">
                      {entry.definition}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm text-gray-300 italic">
                      No definition
                    </p>
                  )}
                  {entry.author && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={entry.author.image || undefined} />
                        <AvatarFallback className="text-[8px] bg-gray-100 text-gray-500">
                          {(entry.author.name || entry.author.email || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {entry.author.name || entry.author.email} ·{" "}
                        {formatDate(entry.updatedAt)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit entry" : "Create entry"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="term">Term</Label>
              <Input
                id="term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. Punch list, RFI, Change order…"
                maxLength={200}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    saveEntry();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="definition">Definition</Label>
              <textarea
                id="definition"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="Explain this term so teammates share the same context…"
                maxLength={10000}
                className={cn(
                  "w-full min-h-[120px] resize-y rounded-md border border-gray-300",
                  "focus:border-black focus:ring-0 focus:outline-none p-2.5 text-sm"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    saveEntry();
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setEditorOpen(false)}
              className="gap-1.5"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={saveEntry} disabled={!term.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingId ? "Save" : "Create entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — entries are shared team context, so a
          mis-click shouldn't destroy a teammate's contribution silently. */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            &quot;{deleteTarget?.term}&quot; will be permanently removed from
            the team&apos;s knowledge. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
