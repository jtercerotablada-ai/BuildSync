"use client";

/**
 * Inline-editable Tags cell for the My Tasks list view.
 *
 * Click the chips → popover with a search input, the workspace tag
 * list (toggleable checkboxes), and a "+ Create '<name>'" footer
 * when the search has no exact match.
 *
 * Persists via PUT /api/tasks/:id/tags (full replace, server-side
 * diffs). On create the new tag goes through POST /api/tags first,
 * then the task is re-PUT with the new id appended.
 *
 * Visual matches BuiltinFieldCell's tags renderer (chips, +N
 * overflow, hover title) so the row doesn't jump when the popover
 * opens.
 */

import { useState, useEffect, useMemo } from "react";
import { Plus, Check, Loader2, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TaskTag {
  tag: Tag;
}

// Soft palette for new tags — mirrors Asana's defaults so a freshly
// created tag is never neon-bright. The picker cycles through these
// when a user creates a tag without specifying color.
const NEW_TAG_COLORS = [
  "#94a3b8",
  "#a8893a",
  "#c9a84c",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
];

export function EditableTagsCell({
  taskId,
  value,
  onChange,
}: {
  taskId: string;
  value: TaskTag[];
  onChange?: (next: TaskTag[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<TaskTag[] | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const current = optimistic ?? value;
  const selectedIds = useMemo(
    () => new Set(current.map((t) => t.tag.id)),
    [current]
  );

  // Lazy-load the workspace tag list the first time the popover opens
  // — most home loads never need it.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/tags");
        if (res.ok && !cancelled) {
          const data = (await res.json()) as Tag[];
          setAllTags(Array.isArray(data) ? data : []);
          setLoaded(true);
        }
      } catch {
        // swallow — empty list still lets the user create one
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return allTags.some((t) => t.name.toLowerCase() === q);
  }, [allTags, query]);

  async function commitTagSet(nextIds: string[], nextRows: TaskTag[]) {
    setOptimistic(nextRows);
    onChange?.(nextRows);
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: nextIds }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updatedTags = (await res.json()) as Tag[];
      const updatedRows = updatedTags.map((t) => ({ tag: t }));
      setOptimistic(updatedRows);
      onChange?.(updatedRows);
    } catch {
      setOptimistic(value); // roll back
      onChange?.(value);
      toast.error("Couldn't update tags");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTag(tag: Tag) {
    const isSelected = selectedIds.has(tag.id);
    const nextRows = isSelected
      ? current.filter((t) => t.tag.id !== tag.id)
      : [...current, { tag }];
    const nextIds = nextRows.map((t) => t.tag.id);
    await commitTagSet(nextIds, nextRows);
  }

  async function createTag() {
    const name = query.trim();
    if (!name) return;
    const color =
      NEW_TAG_COLORS[allTags.length % NEW_TAG_COLORS.length] || "#94a3b8";
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const tag = (await res.json()) as Tag;
      setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setQuery("");
      // Auto-apply the freshly created tag to this task.
      const nextRows = [...current, { tag }];
      await commitTagSet(nextRows.map((t) => t.tag.id), nextRows);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't create tag");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 min-w-0 hover:bg-slate-100 -mx-1 px-1 -my-0.5 py-0.5 rounded transition-colors w-full text-left"
          title={
            current.length === 0
              ? "Click to add tags"
              : current.map((t) => t.tag.name).join(", ")
          }
        >
          {current.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-slate-400">
              <TagIcon className="w-3 h-3" />
              <span className="opacity-0 group-hover/cell:opacity-100">Add</span>
            </span>
          ) : (
            <>
              {current.slice(0, 2).map((t) => (
                <span
                  key={t.tag.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium truncate max-w-[80px]"
                  style={{
                    backgroundColor: `${t.tag.color}1a`,
                    color: t.tag.color,
                  }}
                >
                  {t.tag.name}
                </span>
              ))}
              {current.length > 2 && (
                <span className="text-[11px] text-slate-400 tabular-nums">
                  +{current.length - 2}
                </span>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b border-slate-100">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find or create a tag…"
            className="h-8 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim() && !exactMatch) {
                e.preventDefault();
                void createTag();
              }
            }}
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 && !query.trim() ? (
            <div className="px-3 py-4 text-[12px] text-slate-400 text-center">
              No tags yet — type to create one.
            </div>
          ) : (
            <ul>
              {filtered.map((t) => {
                const checked = selectedIds.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggleTag(t)}
                      disabled={saving}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors text-left"
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                          checked
                            ? "bg-slate-900 border-slate-900"
                            : "border-slate-300"
                        )}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium truncate"
                        style={{
                          backgroundColor: `${t.color}1a`,
                          color: t.color,
                        }}
                      >
                        {t.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {query.trim() && !exactMatch && !loading && (
          <button
            type="button"
            onClick={createTag}
            className="w-full flex items-center gap-2 px-3 py-2 border-t border-slate-100 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            Create <span className="font-medium">&quot;{query.trim()}&quot;</span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
