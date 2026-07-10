"use client";

/**
 * ReferenceFieldEditor — value editor for a REFERENCE custom field.
 * Links the task to other Tasks / Projects. Value is stored as an array
 * of { kind, id, name } so the cell/panel render a chip without a lookup.
 */

import { useEffect, useRef, useState } from "react";
import { Plus, Search, X, CheckSquare, Folder, Link2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface EntityRef {
  kind: "task" | "project";
  id: string;
  name: string;
}

export function readRefs(value: unknown): EntityRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is EntityRef =>
      !!v &&
      typeof v === "object" &&
      typeof (v as EntityRef).id === "string" &&
      typeof (v as EntityRef).name === "string"
  );
}

export function ReferenceFieldEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: EntityRef[]) => void;
}) {
  const selected = readRefs(value);
  const selectedKey = new Set(selected.map((r) => `${r.kind}:${r.id}`));

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EntityRef[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const run = async () => {
      setLoading(true);
      try {
        const [taskRes, projRes] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/projects"),
        ]);
        const tasks = taskRes.ok ? await taskRes.json() : [];
        const projects = projRes.ok ? await projRes.json() : [];
        const merged: EntityRef[] = [
          ...(Array.isArray(projects) ? projects : []).map(
            (p: { id: string; name: string }) => ({
              kind: "project" as const,
              id: p.id,
              name: p.name,
            })
          ),
          ...(Array.isArray(tasks) ? tasks : []).map(
            (t: { id: string; name: string }) => ({
              kind: "task" as const,
              id: t.id,
              name: t.name,
            })
          ),
        ];
        setResults(merged);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = results
    .filter((r) => !q || r.name.toLowerCase().includes(q))
    .slice(0, 50);

  function toggle(r: EntityRef) {
    const key = `${r.kind}:${r.id}`;
    if (selectedKey.has(key)) {
      onChange(selected.filter((x) => `${x.kind}:${x.id}` !== key));
    } else {
      onChange([...selected, r]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0">
      {selected.map((r) => (
        <span
          key={`${r.kind}:${r.id}`}
          className="group inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[12px] text-[#1e1f21]"
          title={`${r.kind}: ${r.name}`}
        >
          {r.kind === "project" ? (
            <Folder className="w-3 h-3 text-slate-400 flex-shrink-0" />
          ) : (
            <CheckSquare className="w-3 h-3 text-slate-400 flex-shrink-0" />
          )}
          <span className="truncate max-w-[120px]">{r.name}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(
                selected.filter((x) => `${x.kind}:${x.id}` !== `${r.kind}:${r.id}`)
              );
            }}
            className="opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
            aria-label={`Remove ${r.name}`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-dashed border-[#c4c7cf] text-[#9aa0a6] hover:border-[#1e1f21] hover:bg-[#f3f4f6]",
              selected.length === 0 ? "h-6 px-2 text-[12px]" : "h-5 w-5 justify-center"
            )}
          >
            {selected.length === 0 ? (
              <>
                <Link2 className="w-3 h-3" />
                <span>Link</span>
              </>
            ) : (
              <Plus className="w-3 h-3" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[340px] p-0"
          align="start"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center border-b p-2 gap-2">
            <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks or projects"
              className="flex-1 border-0 p-0 h-7 focus-visible:ring-0 text-sm"
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                Loading…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No matches
              </div>
            )}
            {!loading &&
              filtered.map((r) => {
                const checked = selectedKey.has(`${r.kind}:${r.id}`);
                return (
                  <button
                    key={`${r.kind}:${r.id}`}
                    type="button"
                    onClick={() => toggle(r)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left",
                      checked && "bg-[#c9a84c]/10"
                    )}
                  >
                    {r.kind === "project" ? (
                      <Folder className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <CheckSquare className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900">
                      {r.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {r.kind}
                    </span>
                  </button>
                );
              })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
