"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Confirmation for destructive actions.
 *
 * Most of the app uses window.confirm(), which is fine for reversible things.
 * This exists for the ones that cascade: deleting a team wipes its goals,
 * messages, custom fields and knowledge entries with no undo, and the delete
 * item sat one row under "Settings" in a dropdown with NO confirmation at all.
 *
 * Pass `requireText` (usually the record's name) to make the user type it —
 * reserve that for actions that destroy other people's work.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  consequences,
  confirmLabel = "Delete",
  requireText,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  consequences?: string[];
  confirmLabel?: string;
  requireText?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const canConfirm =
    !busy && (!requireText || typed.trim() === requireText.trim());

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      // A caller whose onConfirm rejects must not produce an unhandled
      // rejection and a dialog that silently snaps back to idle.
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {consequences && consequences.length > 0 ? (
          <ul className="list-disc space-y-1 rounded-md border border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-700">
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {requireText ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm">
              Type <span className="font-semibold">{requireText}</span> to
              confirm
            </Label>
            <Input
              id="confirm-text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
            />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {/* Deliberately NOT disabled while busy: a request that never
              settles would otherwise trap the user in a dialog with Escape
              and outside-click already suppressed. */}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
