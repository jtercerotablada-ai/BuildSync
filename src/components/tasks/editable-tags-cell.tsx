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
 * Each library row also has a "..." that edits the tag itself — rename,
 * recolor (PATCH /api/tags/:tagId) or delete (DELETE, confirmed inline).
 * Those change the shared workspace tag everywhere, not just this task.
 *
 * Visual matches BuiltinFieldCell's tags renderer (chips, +N
 * overflow, hover title) so the row doesn't jump when the popover
 * opens.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Check,
  Loader2,
  MoreHorizontal,
  Trash2,
  Tag as TagIcon,
} from "lucide-react";
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
  // Library editing: the tag whose rename/recolor/delete row is open, its
  // drafts, and whether the delete confirmation is showing.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const current = optimistic ?? value;

  // Last tag set the server confirmed. A failed save rolls back to THIS, not
  // to the mount-time prop, which would hide tags an earlier save already
  // stored.
  const confirmedRef = useRef<TaskTag[]>(value);
  const savingRef = useRef(false);

  // When the parent hands in a different tag set (a refetch, or an edit made
  // in the task panel) it wins over the local copy — otherwise the cell kept
  // showing its own optimistic tags forever. Keyed on the ids, because
  // callers often pass a fresh array with the same tags on every render.
  // Skipped mid-save: a parent that mirrors onChange optimistically would
  // otherwise make the unconfirmed set the rollback target.
  const valueKey = value.map((t) => t.tag.id).join(",");
  useEffect(() => {
    if (savingRef.current) return;
    confirmedRef.current = value;
    setOptimistic(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);
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
        // Scope the library to the TASK's workspace, so every tag offered
        // here is one PUT /api/tasks/:id/tags will accept.
        const res = await fetch(
          `/api/tags?taskId=${encodeURIComponent(taskId)}`
        );
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
  }, [open, loaded, taskId]);

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
    savingRef.current = true;
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
      confirmedRef.current = updatedRows;
      setOptimistic(updatedRows);
      onChange?.(updatedRows);
    } catch {
      const confirmed = confirmedRef.current;
      setOptimistic(confirmed); // roll back to the last saved set
      onChange?.(confirmed);
      toast.error("Couldn't update tags");
    } finally {
      savingRef.current = false;
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
        body: JSON.stringify({ name, color, taskId }),
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

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setConfirmDelete(false);
  }

  function stopEdit() {
    setEditingId(null);
    setConfirmDelete(false);
  }

  // Replace (or, with null, drop) a tag in both the library and this task's
  // rows. The server already applied the change, so the task's rows are
  // updated locally rather than re-PUT.
  function applyTagChange(tagId: string, next: Tag | null) {
    setAllTags((prev) =>
      next
        ? prev
            .map((t) => (t.id === tagId ? next : t))
            .sort((a, b) => a.name.localeCompare(b.name))
        : prev.filter((t) => t.id !== tagId)
    );
    const patchRows = (rows: TaskTag[]) =>
      next
        ? rows.map((r) => (r.tag.id === tagId ? { tag: next } : r))
        : rows.filter((r) => r.tag.id !== tagId);
    if (current.some((r) => r.tag.id === tagId)) {
      const nextRows = patchRows(current);
      confirmedRef.current = patchRows(confirmedRef.current);
      setOptimistic(nextRows);
      onChange?.(nextRows);
    }
  }

  async function tagRequestError(res: Response, fallback: string) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 409) return body.error || "A tag with that name already exists";
    if (res.status === 404) return "This tag no longer exists";
    if (res.status === 403) return "You don't have permission to edit tags";
    return body.error || fallback;
  }

  async function saveTagEdit(tag: Tag) {
    const name = editName.trim();
    if (!name) {
      toast.error("Tag name can't be empty");
      return;
    }
    const patch: { name?: string; color?: string } = {};
    if (name !== tag.name) patch.name = name;
    if (editColor !== tag.color) patch.color = editColor;
    if (!patch.name && !patch.color) {
      stopEdit();
      return;
    }
    setEditBusy(true);
    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const message = await tagRequestError(res, "Couldn't update tag");
        if (res.status === 404) {
          applyTagChange(tag.id, null);
          stopEdit();
        }
        toast.error(message);
        return;
      }
      const updated = (await res.json()) as Tag;
      applyTagChange(tag.id, {
        id: updated.id,
        name: updated.name,
        color: updated.color,
      });
      stopEdit();
    } catch {
      toast.error("Couldn't update tag");
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteTag(tag: Tag) {
    setEditBusy(true);
    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        toast.error(await tagRequestError(res, "Couldn't delete tag"));
        return;
      }
      // 404 = someone else already deleted it; either way it is gone.
      applyTagChange(tag.id, null);
      stopEdit();
      toast.success(`Tag "${tag.name}" deleted`);
    } catch {
      toast.error("Couldn't delete tag");
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) stopEdit();
      }}
    >
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
                if (editingId === t.id) {
                  return (
                    <li
                      key={t.id}
                      className="px-2 py-2 bg-slate-50 border-y border-slate-100 space-y-2"
                    >
                      {confirmDelete ? (
                        <>
                          <p className="text-[12px] text-slate-700">
                            Delete &quot;{t.name}&quot;? It is removed from every
                            task in the workspace. This can&apos;t be undone.
                          </p>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(false)}
                              disabled={editBusy}
                              className="px-2 py-1 rounded text-[12px] text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTag(t)}
                              disabled={editBusy}
                              className="px-2 py-1 rounded text-[12px] font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                            >
                              Delete tag
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={60}
                            className="h-7 text-[13px]"
                            aria-label="Tag name"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void saveTagEdit(t);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                stopEdit();
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {NEW_TAG_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditColor(c)}
                                aria-label={`Color ${c}`}
                                className={cn(
                                  "w-4 h-4 rounded-full border-2",
                                  editColor.toLowerCase() === c
                                    ? "border-slate-900"
                                    : "border-transparent"
                                )}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(true)}
                              disabled={editBusy}
                              className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[12px] text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={stopEdit}
                                disabled={editBusy}
                                className="px-2 py-1 rounded text-[12px] text-slate-600 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveTagEdit(t)}
                                disabled={editBusy || !editName.trim()}
                                className="px-2 py-1 rounded text-[12px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                              >
                                {editBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={t.id} className="group/tag relative">
                    <button
                      type="button"
                      onClick={() => toggleTag(t)}
                      disabled={saving}
                      className="w-full flex items-center gap-2 pl-2 pr-8 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors text-left"
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
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover/tag:opacity-100 focus-visible:opacity-100 transition-opacity"
                      aria-label={`Edit tag ${t.name}`}
                      title="Rename, recolor or delete"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
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
