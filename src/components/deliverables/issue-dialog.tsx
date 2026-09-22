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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToday } from "@/lib/use-today";
import { ISSUE_PARTIES, type IssueParty } from "@/lib/deliverables";
import { FieldLabel } from "./deliverable-bits";
import { DeliverableApiError, errorMessage } from "./deliverable-api";
import { issueNameFor, todayInput } from "./deliverable-format";
import type { DeliverableProjectInfo } from "./types";

export interface IssueInput {
  issuedToParty: IssueParty;
  issuedTo: string | null;
  issuedAt: string;
  transmittalNote: string | null;
  confirmUnsealed?: boolean;
}

/**
 * Record an issue of the current revision: to whom, when, with what note.
 * Issuing is RECORDED, not sent. A seal-required revision that isn't sealed
 * comes back 409 UNSEALED, and the dialog asks before issuing it as a
 * preliminary set.
 */
export function IssueDialog({
  open,
  onOpenChange,
  revisionLabel,
  project,
  deliverableParty,
  onIssue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revisionLabel: string;
  project: DeliverableProjectInfo | null;
  deliverableParty: string | null;
  /** Throws DeliverableApiError on refusal (code "UNSEALED" for the 409). */
  onIssue: (input: IssueInput) => Promise<void>;
}) {
  const today = useToday();
  const defaultParty: IssueParty = project?.type === "PERMIT" ? "CITY" : "CLIENT";
  const [party, setParty] = useState<IssueParty>(defaultParty);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnsealed, setConfirmUnsealed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setParty(defaultParty);
    setName(issueNameFor(defaultParty, project, deliverableParty));
    setNameTouched(false);
    setDate(todayInput(today ?? new Date()));
    setNote("");
    setError(null);
    setSaving(false);
    setConfirmUnsealed(false);
    // Read project/today at open time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const changeParty = (p: IssueParty) => {
    setParty(p);
    // Re-prefill until the user types a name of their own.
    if (!nameTouched) setName(issueNameFor(p, project, deliverableParty));
  };

  const send = async (confirm: boolean) => {
    if (saving || !date) return;
    setSaving(true);
    setError(null);
    try {
      await onIssue({
        issuedToParty: party,
        issuedTo: name.trim() || null,
        issuedAt: date,
        transmittalNote: note.trim() || null,
        ...(confirm ? { confirmUnsealed: true } : {}),
      });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof DeliverableApiError && err.code === "UNSEALED") {
        setConfirmUnsealed(true);
      } else {
        setError(errorMessage(err, "Couldn't record the issue"));
      }
    } finally {
      setSaving(false);
    }
  };

  const id = (s: string) => `dlv-issue-${s}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        {confirmUnsealed ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Rev {revisionLabel} isn&apos;t sealed
              </DialogTitle>
              <DialogDescription>
                Rev {revisionLabel} isn&apos;t sealed. Issue it as a preliminary
                (not sealed) set? The history will record it as preliminary.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={() => void send(true)} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Issue as preliminary
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Issue Rev {revisionLabel}</DialogTitle>
              <DialogDescription>
                Records who it went to and when. Nothing is emailed. Its files
                become read-only.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(false);
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
                <div>
                  <FieldLabel htmlFor={id("party")}>To</FieldLabel>
                  <Select value={party} onValueChange={(v) => changeParty(v as IssueParty)}>
                    <SelectTrigger id={id("party")} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_PARTIES.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor={id("name")}>Name</FieldLabel>
                  <Input
                    id={id("name")}
                    value={name}
                    maxLength={200}
                    onChange={(e) => {
                      setNameTouched(true);
                      setName(e.target.value);
                    }}
                    placeholder={party === "CITY" ? "City of Miami" : "Bayview Condo Assn."}
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor={id("date")}>Date</FieldLabel>
                <Input
                  id={id("date")}
                  type="date"
                  value={date}
                  required
                  onChange={(e) => setDate(e.target.value)}
                  className="sm:w-48"
                />
              </div>
              <div>
                <FieldLabel htmlFor={id("note")}>Transmittal note</FieldLabel>
                <Textarea
                  id={id("note")}
                  rows={3}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Issued for permit. Sheets S-001 to S-501."
                />
              </div>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !date}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Issue Rev {revisionLabel}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
