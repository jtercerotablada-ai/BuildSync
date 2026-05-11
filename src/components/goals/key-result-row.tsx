"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Edit2, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { calculateKRProgress } from "@/lib/goal-utils";

interface KeyResult {
  id: string;
  name: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  startValue: number;
  unit: string | null;
  format: string;
}

/**
 * Key Result row with inline editing — Asana / Linear pattern.
 *
 * Click anywhere on the value (`5 / 10 users`) and you get an inline
 * number input that saves on Enter or blur, no modal. Click on the
 * name and you get an inline text input. The "Update" button + dialog
 * pattern stays only as a power-user path when adding a note (e.g.
 * "Bumped by 3 because we closed the Acme contract").
 *
 * State machine:
 *   idle → editingValue (click value) → saving → idle
 *   idle → editingName (click name) → saving → idle
 *   idle → openUpdateDialog (click Update button) — handled by parent
 */
export function KeyResultRow({
  kr,
  objectiveId,
  onChanged,
  onDelete,
  onOpenNoteDialog,
}: {
  kr: KeyResult;
  objectiveId: string;
  onChanged: () => void;
  onDelete: (krId: string) => void;
  onOpenNoteDialog: (kr: KeyResult) => void;
}) {
  const [mode, setMode] = useState<"idle" | "editName" | "editValue">("idle");
  const [name, setName] = useState(kr.name);
  const [value, setValue] = useState(kr.currentValue);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(kr.name);
    setValue(kr.currentValue);
  }, [kr.name, kr.currentValue, kr.id]);

  useEffect(() => {
    if (mode === "editName") {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    } else if (mode === "editValue") {
      valueInputRef.current?.focus();
      valueInputRef.current?.select();
    }
  }, [mode]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === kr.name) {
      setName(kr.name);
      setMode("idle");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/key-results?keyResultId=${kr.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Key result renamed");
      onChanged();
      setMode("idle");
    } catch {
      toast.error("Couldn't rename key result");
      setName(kr.name);
    } finally {
      setSaving(false);
    }
  }

  async function saveValue() {
    if (value === kr.currentValue) {
      setMode("idle");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/key-results?keyResultId=${kr.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentValue: value }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const delta = value - kr.currentValue;
      toast.success(
        `Updated ${delta > 0 ? `+${delta}` : delta}${kr.unit ? " " + kr.unit : ""}`
      );
      onChanged();
      setMode("idle");
    } catch {
      toast.error("Couldn't update value");
      setValue(kr.currentValue);
    } finally {
      setSaving(false);
    }
  }

  const progress = calculateKRProgress(kr);

  return (
    <div className="border rounded-xl p-3 md:p-4 hover:shadow-sm transition-shadow group">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0 flex-1">
          {/* Inline name edit */}
          {mode === "editName" ? (
            <div className="flex items-center gap-2">
              <Input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveName();
                  } else if (e.key === "Escape") {
                    setName(kr.name);
                    setMode("idle");
                  }
                }}
                disabled={saving}
                className="text-base font-medium h-8"
              />
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMode("editName")}
              className="font-medium text-gray-900 break-words text-left hover:underline decoration-dotted underline-offset-4"
            >
              {kr.name}
            </button>
          )}
          {kr.description && (
            <p className="text-sm text-gray-500 mt-1 break-words">
              {kr.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenNoteDialog(kr)}
            className="px-2 md:px-3"
          >
            <Edit2 className="h-3 w-3 md:mr-1" />
            <span className="hidden md:inline">Update with note</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setMode("editName")}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-black"
                onClick={() => onDelete(kr.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={progress} className="flex-1 h-2" />

        {/* Inline value edit */}
        {mode === "editValue" ? (
          <div className="flex items-center gap-1">
            <Input
              ref={valueInputRef}
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
              onBlur={saveValue}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveValue();
                } else if (e.key === "Escape") {
                  setValue(kr.currentValue);
                  setMode("idle");
                }
              }}
              disabled={saving}
              className="h-7 w-20 text-xs text-right"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">
              / {kr.targetValue}
              {kr.unit ? ` ${kr.unit}` : ""}
            </span>
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
            ) : (
              <Check className="h-3 w-3 text-[#c9a84c]" />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMode("editValue")}
            className={cn(
              "text-xs md:text-sm font-medium text-gray-700 text-right whitespace-nowrap hover:text-black",
              "hover:underline decoration-dotted underline-offset-4"
            )}
            title="Click to update progress"
          >
            {kr.currentValue} / {kr.targetValue}
            {kr.unit ? ` ${kr.unit}` : ""}
          </button>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-2">
        {Math.round(progress)}% completed
      </div>
    </div>
  );
}
