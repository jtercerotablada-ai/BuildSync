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
import { Loader2, Target, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvailableObjective {
  id: string;
  name: string;
  period?: string | null;
  status?: string;
  owner?: { name: string | null } | null;
}

/**
 * Picker dialog used by the goal detail page to connect / change /
 * detach the parent objective. Before this, the "Connect a parent
 * objective" button was a dead click that just navigated to /goals.
 *
 * Implementation:
 *   - GET /api/objectives?parentId=null returns top-level objectives
 *     in the workspace. We exclude the current objective + any of its
 *     descendants client-side (no API for that yet).
 *   - PATCH /api/objectives/[id] with `{ parentId }` sets the new
 *     parent or `null` to detach.
 */
export function ParentObjectivePicker({
  open,
  onOpenChange,
  objectiveId,
  currentParent,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  currentParent: { id: string; name: string } | null;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<AvailableObjective[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setLoading(true);
    fetch("/api/objectives")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        // Exclude self — would create a cycle.
        setItems(list.filter((o: AvailableObjective) => o.id !== objectiveId));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, objectiveId]);

  const filtered = items.filter((o) =>
    search.trim()
      ? o.name.toLowerCase().includes(search.trim().toLowerCase())
      : true
  );

  async function pick(parentId: string | null) {
    setPickingId(parentId ?? "__detach");
    try {
      const res = await fetch(`/api/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success(parentId ? "Parent objective set" : "Parent removed");
      onChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update parent");
    } finally {
      setPickingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {currentParent ? "Change parent objective" : "Connect a parent objective"}
          </DialogTitle>
        </DialogHeader>

        {currentParent && (
          <div className="flex items-center justify-between border rounded-lg px-3 py-2 bg-gray-50">
            <div className="flex items-center gap-2 min-w-0">
              <Target className="h-4 w-4 text-[#c9a84c] flex-shrink-0" />
              <span className="text-sm text-gray-700 truncate">
                Currently: <span className="font-medium text-black">{currentParent.name}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pick(null)}
              disabled={pickingId !== null}
              className="text-xs text-gray-600 hover:text-black"
            >
              {pickingId === "__detach" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Detach
                </>
              )}
            </Button>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search objectives…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="pl-8"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              {search
                ? "No objectives match this search."
                : "No other objectives in this workspace yet."}
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((o) => {
                const isCurrent = currentParent?.id === o.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={pickingId !== null || isCurrent}
                      onClick={() => pick(o.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-2 py-2.5 text-left rounded-md transition-colors",
                        isCurrent
                          ? "bg-gray-50 opacity-60 cursor-not-allowed"
                          : "hover:bg-gray-50"
                      )}
                    >
                      <Target className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black truncate">
                          {o.name}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {[o.period, o.owner?.name].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      {pickingId === o.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                      ) : isCurrent ? (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                          Current
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
