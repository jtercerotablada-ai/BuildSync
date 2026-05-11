"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "ON_TRACK", label: "On track", color: "#c9a84c" },
  { value: "AT_RISK", label: "At risk", color: "#a8893a" },
  { value: "OFF_TRACK", label: "Off track", color: "#0a0a0a" },
  { value: "ACHIEVED", label: "Achieved", color: "#c9a84c" },
  { value: "DROPPED", label: "Dropped", color: "#666666" },
] as const;

/**
 * Weekly Check-in dialog. Replaces the "post a comment" pattern with a
 * structured rhythm: status + 1-10 confidence + short summary.
 *
 * POSTs to /api/objectives/[id]/check-in which:
 *   1. updates the objective's status, confidenceScore, lastCheckInAt
 *   2. appends an ObjectiveStatusUpdate entry to the activity feed
 *
 * The parent passes `currentStatus` and `currentConfidence` to seed
 * the form so users only confirm/adjust rather than retype.
 */
export function CheckInDialog({
  open,
  onOpenChange,
  objectiveId,
  currentStatus,
  currentConfidence,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  currentStatus: string;
  currentConfidence: number | null;
  onSuccess?: () => void;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [confidence, setConfidence] = useState<number>(currentConfidence ?? 7);
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setConfidence(currentConfidence ?? 7);
      setSummary("");
    }
  }, [open, currentStatus, currentConfidence]);

  async function submit() {
    if (!summary.trim()) {
      toast.error("A short note is required for the check-in");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          confidenceScore: confidence,
          summary: summary.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success("Check-in posted");
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't post check-in");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Weekly check-in</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-700">Status</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    "px-2 py-2 rounded-md text-[11px] font-medium border transition-colors",
                    status === opt.value
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  )}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-700">
                Confidence (1-10)
              </Label>
              <span className="text-sm font-semibold text-black">
                {confidence}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full accent-black"
            />
            <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wider">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-700">Note for this week</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What moved, what's blocking, what you're doing about it…"
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t -mx-6 px-6 pb-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving || !summary.trim()}
            className="bg-black hover:bg-gray-900 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Post check-in"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
