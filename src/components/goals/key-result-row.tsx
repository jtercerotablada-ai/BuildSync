"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Trash2,
  Edit2,
  Loader2,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { calculateKRProgress } from "@/lib/goal-utils";

/**
 * Format a KR value according to its declared format. PERCENTAGE
 * renders `42%`, CURRENCY renders `$8,400,000`, BOOLEAN renders
 * yes/no, NUMBER falls back to a localized number with optional unit.
 */
function formatKRValue(
  value: number,
  format: string,
  unit: string | null
): string {
  if (format === "PERCENTAGE") return `${value}%`;
  if (format === "CURRENCY") {
    const currency = unit && unit.length === 3 ? unit : "USD";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `$${value.toLocaleString()}`;
    }
  }
  if (format === "BOOLEAN") return value >= 1 ? "Yes" : "No";
  return `${value.toLocaleString()}${unit ? " " + unit : ""}`;
}

const KR_FORMATS = [
  { value: "NUMBER", label: "Number" },
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "CURRENCY", label: "Currency" },
  { value: "BOOLEAN", label: "Done / not done" },
] as const;

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
  // Held as the raw string the user typed: a controlled number input that
  // parses on every keystroke can never hold "2." or "-" long enough to
  // finish typing a decimal or a negative.
  const [value, setValue] = useState(String(kr.currentValue));
  const [saving, setSaving] = useState(false);
  // Disabling a focused input makes the browser fire blur, so Enter would
  // otherwise re-enter the save handler through onBlur and PATCH twice.
  const savingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
  // Target / start / unit / format editor. A mistyped target could only be
  // fixed by deleting the key result, which also threw away its history.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({
    startValue: "",
    targetValue: "",
    unit: "",
    format: "NUMBER",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  function openSettings() {
    setSettingsDraft({
      startValue: String(kr.startValue),
      targetValue: String(kr.targetValue),
      unit: kr.unit ?? "",
      format: KR_FORMATS.some((f) => f.value === kr.format)
        ? kr.format
        : "NUMBER",
    });
    setSettingsOpen(true);
  }

  const draftStart = parseFloat(settingsDraft.startValue);
  const draftTarget = parseFloat(settingsDraft.targetValue);
  const settingsError =
    Number.isNaN(draftStart) || Number.isNaN(draftTarget)
      ? "Enter a number for both values"
      : draftStart === draftTarget
        ? "Target must differ from the start value"
        : null;

  async function saveSettings() {
    if (settingsError || savingSettings) return;
    setSavingSettings(true);
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/key-results?keyResultId=${kr.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startValue: draftStart,
            targetValue: draftTarget,
            unit: settingsDraft.unit.trim() || null,
            format: settingsDraft.format,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Couldn't update the key result");
      }
      toast.success("Key result updated");
      setSettingsOpen(false);
      onChanged();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't update the key result"
      );
    } finally {
      setSavingSettings(false);
    }
  }

  useEffect(() => {
    setName(kr.name);
    setValue(String(kr.currentValue));
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
    if (savingRef.current) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === kr.name) {
      setName(kr.name);
      setMode("idle");
      return;
    }
    savingRef.current = true;
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
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function saveValue() {
    if (savingRef.current) return;
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
      // Empty or half-typed ("2.", "-") — keep the stored value.
      setValue(String(kr.currentValue));
      setMode("idle");
      return;
    }
    if (parsed === kr.currentValue) {
      setValue(String(kr.currentValue));
      setMode("idle");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/key-results?keyResultId=${kr.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentValue: parsed }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const delta = parsed - kr.currentValue;
      toast.success(
        `Updated ${delta > 0 ? `+${delta}` : delta}${kr.unit ? " " + kr.unit : ""}`
      );
      onChanged();
      setMode("idle");
    } catch {
      toast.error("Couldn't update value");
      setValue(String(kr.currentValue));
    } finally {
      savingRef.current = false;
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
              <DropdownMenuItem onClick={openSettings}>
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Edit target and unit
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
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={saveValue}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveValue();
                } else if (e.key === "Escape") {
                  setValue(String(kr.currentValue));
                  setMode("idle");
                }
              }}
              disabled={saving}
              className="h-7 w-20 text-xs text-right"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">
              / {formatKRValue(kr.targetValue, kr.format, kr.unit)}
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
            {formatKRValue(kr.currentValue, kr.format, kr.unit)} /{" "}
            {formatKRValue(kr.targetValue, kr.format, kr.unit)}
          </button>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-2">
        {Math.round(progress)}% completed
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit key result</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600 break-words">{kr.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`kr-start-${kr.id}`}>Start value</Label>
                <Input
                  id={`kr-start-${kr.id}`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={settingsDraft.startValue}
                  onChange={(e) =>
                    setSettingsDraft((d) => ({ ...d, startValue: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`kr-target-${kr.id}`}>Target value</Label>
                <Input
                  id={`kr-target-${kr.id}`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={settingsDraft.targetValue}
                  onChange={(e) =>
                    setSettingsDraft((d) => ({ ...d, targetValue: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`kr-unit-${kr.id}`}>Unit (optional)</Label>
                <Input
                  id={`kr-unit-${kr.id}`}
                  placeholder="permits, %, USD"
                  value={settingsDraft.unit}
                  onChange={(e) =>
                    setSettingsDraft((d) => ({ ...d, unit: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Format</Label>
                <Select
                  value={settingsDraft.format}
                  onValueChange={(v) =>
                    setSettingsDraft((d) => ({ ...d, format: v }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KR_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {settingsError && (
              <p className="text-sm text-gray-500">{settingsError}</p>
            )}
            <Button
              className="w-full"
              onClick={saveSettings}
              disabled={savingSettings || settingsError !== null}
            >
              {savingSettings ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
