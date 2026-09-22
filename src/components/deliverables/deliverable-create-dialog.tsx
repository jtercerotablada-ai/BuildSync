"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToday } from "@/lib/use-today";
import {
  DOC_TYPES,
  REVISION_LABEL_PATTERN,
  defaultDueDate,
  formatDateOnly,
  nextDeliverableNumber,
  parseDateOnly,
  type DeliverableKind,
  type DocType,
} from "@/lib/deliverables";
import { FieldLabel } from "./deliverable-bits";
import { apiJson, errorMessage } from "./deliverable-api";
import { partyFieldLabel, todayInput } from "./deliverable-format";
import type { DeliverableDetailJSON, UserLite } from "./types";

const TITLES: Record<DeliverableKind, string> = {
  DOCUMENT: "New deliverable",
  RFI: "Log RFI",
  SUBMITTAL: "Log submittal",
};

const DESCRIPTIONS: Record<DeliverableKind, string> = {
  DOCUMENT: "A drawing set, calculation package, report or letter. Rev 0 is created with it.",
  RFI: "A question from the contractor or the field, and when the answer is due.",
  SUBMITTAL: "Shop drawings or product data sent to us for review.",
};

const UNASSIGNED = "__none__";

export interface CreatePrefill {
  docType?: DocType;
  title?: string;
}

/**
 * Create a document, log an RFI or log a submittal. The number is prefilled
 * with the next free one; left untouched it is NOT sent, so the server
 * auto-numbers (and retries once if a colleague took it at the same moment).
 */
export function DeliverableCreateDialog({
  open,
  onOpenChange,
  projectId,
  kind,
  existingNumbers,
  assignableUsers,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  kind: DeliverableKind;
  existingNumbers: string[];
  assignableUsers: UserLite[];
  prefill?: CreatePrefill | null;
  onCreated: (item: DeliverableDetailJSON) => void;
}) {
  const today = useToday();
  const suggestedNumber = useMemo(
    () => nextDeliverableNumber(kind, existingNumbers),
    [kind, existingNumbers]
  );

  const [docType, setDocType] = useState<DocType | "">("");
  const [number, setNumber] = useState("");
  const [numberTouched, setNumberTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [firstRev, setFirstRev] = useState("0");
  const [sealRequired, setSealRequired] = useState(true);
  const [receivedAt, setReceivedAt] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTouched, setDueTouched] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string>(UNASSIGNED);
  const [party, setParty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset every time the dialog opens, for the kind it opens for.
  useEffect(() => {
    if (!open) return;
    const received = kind === "DOCUMENT" ? "" : todayInput(today ?? new Date());
    setDocType(prefill?.docType ?? "");
    setNumber(suggestedNumber);
    setNumberTouched(false);
    setTitle(prefill?.title ?? "");
    setDescription("");
    setFirstRev("0");
    setSealRequired(true);
    setReceivedAt(received);
    setDueTouched(false);
    setDueDate(dueFor(kind, received));
    setAssigneeId(UNASSIGNED);
    setParty("");
    setError(null);
    setSaving(false);
    // suggestedNumber/today intentionally read at open time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, prefill]);

  const onReceivedChange = (v: string) => {
    setReceivedAt(v);
    // RFI +7 / submittal +14 from receipt, until the user sets a due date.
    if (!dueTouched) setDueDate(dueFor(kind, v));
  };

  const revValid = kind !== "DOCUMENT" || REVISION_LABEL_PATTERN.test(firstRev.trim());
  const canSubmit =
    !saving &&
    title.trim().length > 0 &&
    number.trim().length > 0 &&
    (kind !== "DOCUMENT" || docType !== "") &&
    revValid;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const numberTrim = number.trim();
    const body: Record<string, unknown> = {
      kind,
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || null,
      assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
      party: party.trim() || null,
      // Untouched suggestion → let the server number it (it retries once).
      ...(numberTouched ? { number: numberTrim } : {}),
    };
    if (kind === "DOCUMENT") {
      body.docType = docType;
      body.sealRequired = sealRequired;
      body.firstRevisionLabel = firstRev.trim() || "0";
    } else {
      body.receivedAt = receivedAt || null;
    }
    try {
      const item = await apiJson<DeliverableDetailJSON>(
        `/api/projects/${projectId}/deliverables`,
        { method: "POST", json: body },
        "Failed to create deliverable"
      );
      toast.success(`${item.number} created`);
      onOpenChange(false);
      onCreated(item);
    } catch (err) {
      setError(errorMessage(err, "Failed to create deliverable"));
    } finally {
      setSaving(false);
    }
  };

  const id = (s: string) => `dlv-create-${s}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{TITLES[kind]}</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[kind]}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {kind === "DOCUMENT" && (
            <div>
              <FieldLabel htmlFor={id("type")}>Type</FieldLabel>
              <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                <SelectTrigger id={id("type")} className="w-full">
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
            <div>
              <FieldLabel htmlFor={id("number")}>Number</FieldLabel>
              <Input
                id={id("number")}
                value={number}
                maxLength={40}
                onChange={(e) => {
                  setNumberTouched(true);
                  setNumber(e.target.value);
                }}
                className="font-mono uppercase"
              />
            </div>
            <div>
              <FieldLabel htmlFor={id("title")}>Title *</FieldLabel>
              <Input
                id={id("title")}
                value={title}
                maxLength={200}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  kind === "DOCUMENT"
                    ? "Structural drawings"
                    : kind === "RFI"
                      ? "Beam B-3 bearing at grid C"
                      : "Rebar shop drawings — level 2"
                }
              />
            </div>
          </div>

          {kind !== "DOCUMENT" && (
            <div>
              <FieldLabel htmlFor={id("desc")}>
                {kind === "RFI" ? "Question" : "Description"}
              </FieldLabel>
              <Textarea
                id={id("desc")}
                value={description}
                maxLength={10000}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}

          {kind === "DOCUMENT" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor={id("rev")}>First revision</FieldLabel>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={id("rev")}
                    value={firstRev}
                    maxLength={12}
                    onChange={(e) => setFirstRev(e.target.value)}
                    aria-invalid={!revValid}
                    className="w-20 font-mono uppercase"
                  />
                  {["0", "A"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFirstRev(v)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-mono",
                        firstRev.trim().toUpperCase() === v
                          ? "border-[#c9a84c] bg-[#c9a84c]/10 text-slate-900"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {!revValid && (
                  <p className="mt-1 text-[11px] text-red-600">
                    Use up to 12 letters, digits, dots or dashes.
                  </p>
                )}
              </div>
              <div>
                <FieldLabel htmlFor={id("seal")}>Seal required</FieldLabel>
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    id={id("seal")}
                    checked={sealRequired}
                    onCheckedChange={setSealRequired}
                  />
                  <span className="text-sm text-slate-600">
                    {sealRequired ? "PE seal before issue" : "No seal"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {kind !== "DOCUMENT" && (
              <div>
                <FieldLabel htmlFor={id("received")}>Received</FieldLabel>
                <Input
                  id={id("received")}
                  type="date"
                  value={receivedAt}
                  onChange={(e) => onReceivedChange(e.target.value)}
                />
              </div>
            )}
            <div>
              <FieldLabel htmlFor={id("due")}>Due</FieldLabel>
              <Input
                id={id("due")}
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueTouched(true);
                  setDueDate(e.target.value);
                }}
              />
            </div>
            <div>
              <FieldLabel htmlFor={id("assignee")}>Assignee</FieldLabel>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id={id("assignee")} className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={cn(kind === "DOCUMENT" && "sm:col-span-2")}>
              <FieldLabel htmlFor={id("party")}>{partyFieldLabel(kind)}</FieldLabel>
              <Input
                id={id("party")}
                value={party}
                maxLength={200}
                onChange={(e) => setParty(e.target.value)}
                placeholder={
                  kind === "DOCUMENT" ? "Bayview Condo Assn." : "ABC Builders"
                }
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {kind === "DOCUMENT" ? "Create" : "Log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function dueFor(kind: DeliverableKind, received: string): string {
  if (kind === "DOCUMENT") return "";
  const from = parseDateOnly(received);
  if (!from) return "";
  const due = defaultDueDate(kind, from);
  return due ? formatDateOnly(due) : "";
}
