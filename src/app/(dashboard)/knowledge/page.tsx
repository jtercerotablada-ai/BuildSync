"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Book,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KnowledgeTabs } from "@/components/knowledge/knowledge-tabs";

interface KnowledgeRow {
  id: string;
  term: string;
  definition: string;
  category: string | null;
  tags: string[];
  viewCount: number;
  updatedAt: string;
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeRow | null>(null);
  const [form, setForm] = useState({
    term: "",
    definition: "",
    category: "",
    tagsInput: "",
  });
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<KnowledgeRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (activeCategory) qs.set("category", activeCategory);
      const res = await fetch(`/api/workspace/knowledge?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEntries(data.entries || []);
      setCategories(data.categories || []);
    } catch {
      toast.error("Failed to load knowledge base");
    } finally {
      setLoading(false);
    }
  }, [search, activeCategory]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm({ term: "", definition: "", category: "", tagsInput: "" });
    setEditorOpen(true);
  }

  function openEdit(entry: KnowledgeRow) {
    setEditing(entry);
    setForm({
      term: entry.term,
      definition: entry.definition,
      category: entry.category || "",
      tagsInput: (entry.tags || []).join(", "),
    });
    setEditorOpen(true);
  }

  async function handleSave() {
    if (!form.term.trim() || !form.definition.trim()) {
      toast.error("Term and definition are required");
      return;
    }
    setSaving(true);
    const tags = form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const res = editing
        ? await fetch("/api/workspace/knowledge", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: editing.id,
              term: form.term.trim(),
              definition: form.definition.trim(),
              category: form.category.trim() || null,
              tags,
            }),
          })
        : await fetch("/api/workspace/knowledge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              term: form.term.trim(),
              definition: form.definition.trim(),
              category: form.category.trim() || null,
              tags,
            }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Could not save");
        return;
      }
      toast.success(editing ? "Entry updated" : "Entry created");
      setEditorOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: KnowledgeRow) {
    if (!confirm(`Delete "${entry.term}"?`)) return;
    const res = await fetch(`/api/workspace/knowledge?id=${entry.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Deleted");
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } else {
      toast.error("Could not delete");
    }
  }

  async function handleView(entry: KnowledgeRow) {
    setViewing(entry);
    fetch("/api/workspace/knowledge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, incrementView: true }),
    }).catch(() => {});
  }

  const filtered = useMemo(() => entries, [entries]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Book className="h-5 w-5 text-gray-600" />
          <h1 className="text-lg font-semibold">Knowledge base</h1>
        </div>
        <Button
          onClick={openNew}
          size="sm"
          className="bg-black text-white hover:bg-gray-900"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New entry
        </Button>
      </div>

      <KnowledgeTabs />

      {/* Toolbar */}
      <div className="border-b px-4 md:px-8 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms and definitions…"
            className="pl-8 h-9"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                !activeCategory
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  activeCategory === c
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Book className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium">
              {search || activeCategory
                ? "No matching entries"
                : "No knowledge entries yet"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Capture engineering definitions, code refs, and process notes.
            </p>
            {!search && !activeCategory && (
              <Button
                onClick={openNew}
                size="sm"
                variant="outline"
                className="mt-4"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create first entry
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleView(entry)}
                className="text-left rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm">{entry.term}</h3>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(entry);
                      }}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700"
                    >
                      <Edit2 className="h-3 w-3" />
                    </span>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(entry);
                      }}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-black"
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-gray-600 line-clamp-3">
                  {entry.definition}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {entry.category && (
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.category}
                      </Badge>
                    )}
                    {entry.tags?.slice(0, 2).map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[10px] gap-0.5"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Eye className="h-2.5 w-2.5" />
                    {entry.viewCount}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit entry" : "New entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs">Term</Label>
              <Input
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                placeholder="e.g. Live load reduction (LL/Aₜ)"
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Definition</Label>
              <Textarea
                value={form.definition}
                onChange={(e) =>
                  setForm({ ...form, definition: e.target.value })
                }
                placeholder="Per ASCE 7 §4.7…"
                rows={6}
                className="mt-1.5 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  placeholder="e.g. ASCE 7"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">Tags (comma separated)</Label>
                <Input
                  value={form.tagsInput}
                  onChange={(e) =>
                    setForm({ ...form, tagsInput: e.target.value })
                  }
                  placeholder="loads, code, design"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.term.trim() || !form.definition.trim()}
              className="bg-black text-white hover:bg-gray-900"
            >
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {editing ? "Save changes" : "Create entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Viewer dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{viewing?.term}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 py-1">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {viewing.definition}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t">
                {viewing.category && (
                  <Badge variant="secondary">{viewing.category}</Badge>
                )}
                {viewing.tags?.map((t) => (
                  <Badge key={t} variant="outline" className="gap-0.5">
                    <Tag className="h-2.5 w-2.5" />
                    {t}
                  </Badge>
                ))}
                <span className="ml-auto text-[11px] text-gray-400">
                  {viewing.viewCount} views · updated{" "}
                  {new Date(viewing.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewing(null)}>
              Close
            </Button>
            {viewing && (
              <Button
                onClick={() => {
                  setViewing(null);
                  openEdit(viewing);
                }}
              >
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
