"use client";

/**
 * PeopleFieldEditor — value editor for a PEOPLE custom field. Stores the
 * value denormalized as an array of { id, name, image } so the list cell
 * and panel can render avatars + names without a follow-up lookup. Reads
 * both shapes (legacy string[] of ids and the object form).
 */

import { useEffect, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PersonRef {
  id: string;
  name: string | null;
  image?: string | null;
}

interface SearchUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

function initials(name: string | null): string {
  return (name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Normalize either a string[] of ids or a PersonRef[] into PersonRef[]. */
export function readPeople(value: unknown): PersonRef[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) =>
    typeof v === "string"
      ? { id: v, name: null, image: null }
      : (v as PersonRef)
  );
}

export function PeopleFieldEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: PersonRef[]) => void;
}) {
  const selected = readPeople(value);
  const selectedIds = new Set(selected.map((p) => p.id));

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(search)}`
        );
        if (res.ok) setUsers(await res.json());
      } catch {
        /* silent — empty list renders */
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, 200);
    return () => clearTimeout(t);
  }, [search, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  function toggle(u: SearchUser) {
    if (selectedIds.has(u.id)) {
      onChange(selected.filter((p) => p.id !== u.id));
    } else {
      onChange([...selected, { id: u.id, name: u.name, image: u.image }]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0">
      {selected.map((p) => (
        <span
          key={p.id}
          className="group inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full bg-[#f3f4f6] text-[12px] text-[#1e1f21]"
          title={p.name || undefined}
        >
          <Avatar className="h-4 w-4">
            <AvatarImage src={p.image || undefined} />
            <AvatarFallback className="text-[8px] bg-[#c9a84c] text-white">
              {initials(p.name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate max-w-[90px]">{p.name || "User"}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(selected.filter((x) => x.id !== p.id));
            }}
            className="opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
            aria-label={`Remove ${p.name || "user"}`}
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
              "inline-flex items-center justify-center rounded-full border border-dashed border-[#c4c7cf] text-[#9aa0a6] hover:border-[#1e1f21] hover:bg-[#f3f4f6]",
              selected.length === 0 ? "h-6 px-2 gap-1 text-[12px]" : "h-5 w-5"
            )}
          >
            <Plus className="w-3 h-3" />
            {selected.length === 0 && <span>Assign</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[320px] p-0"
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
              placeholder="Type a name or email"
              className="flex-1 border-0 p-0 h-7 focus-visible:ring-0 text-sm"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                Searching…
              </div>
            )}
            {!loading && users.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {search ? "No users found" : "Type to search"}
              </div>
            )}
            {!loading &&
              users.map((u) => {
                const checked = selectedIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left",
                      checked && "bg-[#c9a84c]/10"
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={u.image || undefined} />
                      <AvatarFallback className="text-xs bg-[#c9a84c] text-white">
                        {initials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {u.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {u.email}
                      </p>
                    </div>
                    {checked && (
                      <span className="text-[11px] text-[#a8893a] font-medium">
                        Added
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
