"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Inline "Add key result" row — replaces the modal-only flow for the
 * common case. Pattern matches Asana / Linear: click the row, type
 * the name + target, press Enter to save.
 *
 * The full modal stays available from the top-of-section "Add key
 * result" button for users who want to fill in description, units,
 * format, etc. up front.
 */
export function AddKeyResultInline({
  objectiveId,
  onAdded,
}: {
  objectiveId: string;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "editing">("idle");
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number>(100);
  const [format, setFormat] = useState<
    "NUMBER" | "PERCENTAGE" | "CURRENCY" | "BOOLEAN"
  >("NUMBER");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "editing") nameRef.current?.focus();
  }, [mode]);

  function reset() {
    setName("");
    setTarget(100);
    setFormat("NUMBER");
    setUnit("");
    setMode("idle");
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/key-results`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            targetValue: target,
            startValue: 0,
            currentValue: 0,
            unit: unit || undefined,
            format,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success("Key result added");
      reset();
      onAdded();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't add key result"
      );
    } finally {
      setSaving(false);
    }
  }

  if (mode === "idle") {
    return (
      <button
        type="button"
        onClick={() => setMode("editing")}
        className="w-full border border-dashed rounded-xl px-4 py-3 text-sm text-gray-500 hover:text-black hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add key result
      </button>
    );
  }

  return (
    <div className="border rounded-xl p-3 md:p-4 bg-gray-50 ring-1 ring-gray-200">
      <div className="space-y-2.5">
        <Input
          ref={nameRef}
          placeholder="What do you want to measure?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              reset();
            }
          }}
          disabled={saving}
          className="font-medium"
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5 block">
              Target
            </label>
            <Input
              type="number"
              step="any"
              value={target}
              onChange={(e) =>
                setTarget(parseFloat(e.target.value) || 0)
              }
              disabled={saving}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5 block">
              Format
            </label>
            <Select
              value={format}
              onValueChange={(v) =>
                setFormat(v as typeof format)
              }
              disabled={saving}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NUMBER">Number</SelectItem>
                <SelectItem value="PERCENTAGE">Percent</SelectItem>
                <SelectItem value="CURRENCY">Currency</SelectItem>
                <SelectItem value="BOOLEAN">Yes / No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5 block">
              Unit
            </label>
            <Input
              placeholder={
                format === "CURRENCY"
                  ? "USD"
                  : format === "PERCENTAGE"
                    ? "%"
                    : "users, days…"
              }
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={saving}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={saving}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !name.trim()}
            className="bg-black hover:bg-gray-900 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add (Enter)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
