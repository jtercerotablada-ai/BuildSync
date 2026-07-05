"use client";

/**
 * PortfolioCustomizeDrawer — the real "Customize" right-hand drawer.
 *
 * Two sections, both wired to real state / APIs (no dead rows):
 *
 *   FIELDS  — toggles for the List columns. These read/write the SAME
 *             listView.columns state the List "Options" popover uses, so
 *             hiding a field here hides that column in List and vice
 *             versa (single source of truth, no duplication). Fields with
 *             no backing per-project data (Connected goals — portfolio-
 *             level, lives in Progress; Milestone progress — not in the
 *             project stats payload) are intentionally OMITTED rather than
 *             rendered as dead toggles.
 *
 *   SETTINGS — rename, color, icon, description, privacy. Each PATCHes
 *             /api/portfolios/:id via the parent's savePortfolio callback.
 *
 * Asana's Rules / Project templates / Status templates rows are premium
 * automation with no backing here and are deliberately omitted.
 */

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Folder, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  ColumnKey,
  ColumnDef,
  PortfolioPrivacy,
} from "@/app/(dashboard)/portfolios/[portfolioId]/customize-shared";

// Curated color palette (brand golds + common hues used across BuildSync).
const COLOR_OPTIONS = [
  "#a8893a",
  "#c9a84c",
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#000000",
  "#64748b",
];

// Icon options stored as lucide-ish keys. We render Folder for all but
// tint by color; the stored value round-trips through PATCH { icon }.
const ICON_OPTIONS = ["folder", "briefcase", "building", "layers", "target"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;

  // Shared List column state (single source of truth with List Options).
  columns: ColumnKey[];
  columnDefs: ColumnDef[];
  onToggleColumn: (key: ColumnKey) => void;

  // Portfolio settings.
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  privacy: PortfolioPrivacy;
  /** PATCH the portfolio; returns true on success. */
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
}

export function PortfolioCustomizeDrawer({
  open,
  onOpenChange,
  canEdit,
  columns,
  columnDefs,
  onToggleColumn,
  name,
  description,
  color,
  icon,
  privacy,
  onSave,
}: Props) {
  const [nameDraft, setNameDraft] = useState(name);
  const [descDraft, setDescDraft] = useState(description || "");

  // Keep local drafts in sync when the portfolio changes underneath us.
  useEffect(() => {
    setNameDraft(name);
  }, [name]);
  useEffect(() => {
    setDescDraft(description || "");
  }, [description]);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === name) {
      setNameDraft(name);
      return;
    }
    const ok = await onSave({ name: trimmed });
    if (ok) toast.success("Name updated");
  }

  async function saveDescription() {
    if (descDraft === (description || "")) return;
    const ok = await onSave({ description: descDraft.trim() || null });
    if (ok) toast.success("Description updated");
  }

  async function saveColor(next: string) {
    if (next === color) return;
    const ok = await onSave({ color: next });
    if (ok) toast.success("Color updated");
  }

  async function saveIcon(next: string) {
    if (next === icon) return;
    const ok = await onSave({ icon: next });
    if (ok) toast.success("Icon updated");
  }

  async function savePrivacy(next: PortfolioPrivacy) {
    if (next === privacy) return;
    const ok = await onSave({ privacy: next });
    if (ok) toast.success("Privacy updated");
  }

  const activeColor = color || "#a8893a";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Customize</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* ── Fields ─────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Fields
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Show or hide columns in the List view.
            </p>
            <div className="space-y-0.5">
              {columnDefs.map((def) => {
                const checked = columns.includes(def.key);
                return (
                  <label
                    key={def.key}
                    className="flex items-center justify-between py-1.5 px-1 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <span className="text-sm text-gray-800">{def.label}</span>
                    <Switch
                      checked={checked}
                      onCheckedChange={() => onToggleColumn(def.key)}
                    />
                  </label>
                );
              })}
            </div>
          </section>

          {/* ── Settings ───────────────────────────────── */}
          <section className="border-t pt-5 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Settings
            </h3>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                value={nameDraft}
                disabled={!canEdit}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="h-9"
              />
            </div>

            {/* Icon + color preview */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Icon</label>
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: activeColor + "20" }}
                >
                  <Folder className="h-4 w-4" style={{ color: activeColor }} />
                </div>
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => saveIcon(ic)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs capitalize border transition-colors disabled:opacity-50",
                      icon === ic
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => saveColor(c)}
                    aria-label={`Set color ${c}`}
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50",
                      activeColor === c && "ring-2 ring-offset-2 ring-gray-900"
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {activeColor === c && (
                      <Check className="h-3.5 w-3.5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Description
              </label>
              <Textarea
                value={descDraft}
                disabled={!canEdit}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={saveDescription}
                placeholder="Add a description..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            {/* Privacy */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Privacy
              </label>
              <Select
                value={privacy}
                disabled={!canEdit}
                onValueChange={(v) => savePrivacy(v as PortfolioPrivacy)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                  <SelectItem value="WORKSPACE">Workspace</SelectItem>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                {privacy === "PRIVATE"
                  ? "Only invited members can access this portfolio."
                  : privacy === "WORKSPACE"
                    ? "Invited members plus people with the link."
                    : "Anyone in the workspace can view this portfolio."}
              </p>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
