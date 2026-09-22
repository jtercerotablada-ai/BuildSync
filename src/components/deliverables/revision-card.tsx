"use client";

import { useState } from "react";
import {
  ChevronRight,
  Loader2,
  Plus,
  Send,
  Stamp,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DISPOSITIONS,
  REVISION_LABEL_PATTERN,
  dispositionLabel,
  hasPdf,
  issuePartyLabel,
  nextRevisionLabel,
  type Disposition,
} from "@/lib/deliverables";
import { ActionDialog } from "./action-dialog";
import { FileDropzone, FileRows, UserAvatar } from "./deliverable-bits";
import { errorMessage } from "./deliverable-api";
import { formatDay, formatStamp, todayInput } from "./deliverable-format";
import type {
  DeliverableDetailJSON,
  DeliverableFileJSON,
  DeliverablePermissions,
  RevisionJSON,
} from "./types";

/** POST /actions for this deliverable; throws DeliverableApiError. */
export type RunAction = (
  body: { action: string } & Record<string, unknown>,
  success: string
) => Promise<void>;

export interface UploadState {
  upload: (files: FileList | File[] | null, revisionId: string | null) => Promise<void>;
  uploading: boolean;
  progress: number | null;
  currentName: string | null;
}

/** A disabled button still explains itself on hover (the span takes the
 *  pointer events a disabled button drops). */
function WithReason({
  reason,
  children,
}: {
  reason: string | null;
  children: React.ReactNode;
}) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The CURRENT revision of a document (files → seal → issue) or the current
 * review cycle of a submittal (files → disposition). Only this card has
 * actions; older revisions render as <RevisionSummary>.
 */
export function RevisionCard({
  mode,
  item,
  revision,
  permissions,
  currentUserId,
  today,
  runAction,
  uploader,
  onRemoveFile,
  removingFileId,
  onIssue,
  onNewRevision,
  onDeleteRevision,
}: {
  mode: "DOCUMENT" | "SUBMITTAL";
  item: DeliverableDetailJSON;
  revision: RevisionJSON;
  permissions: DeliverablePermissions;
  currentUserId: string | null;
  today: Date | null;
  runAction: RunAction;
  uploader: UploadState;
  onRemoveFile: (f: DeliverableFileJSON) => void;
  removingFileId: string | null;
  onIssue: () => void;
  onNewRevision: (label: string | null, extra: { receivedAt?: string }) => Promise<void>;
  onDeleteRevision: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [sealOpen, setSealOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [undoIssueOpen, setUndoIssueOpen] = useState(false);
  const [undoReviewOpen, setUndoReviewOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [returnedAt, setReturnedAt] = useState("");
  const [showReviewExtras, setShowReviewExtras] = useState(false);

  const { canWrite, canSeal, isWorkspaceOwner, isWorkspaceManager } = permissions;
  const status = item.status;
  const locked = revision.locked;
  const files = revision.files;
  const pdf = hasPdf(files);
  const rev = `Rev ${revision.label}`;

  const act = async (key: string, body: Record<string, unknown> & { action: string }, success: string) => {
    if (pending) return;
    setPending(key);
    try {
      await runAction(body, success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const canEditFiles = canWrite && !locked && status !== "VOID";

  // ── Files ────────────────────────────────────────────────────────────
  const filesBlock = (
    <div className="space-y-2">
      <FileRows
        files={files}
        onRemove={canEditFiles ? onRemoveFile : undefined}
        removingId={removingFileId}
        emptyText={
          mode === "DOCUMENT"
            ? "No files yet. Attach the PDF set for this revision."
            : "No files yet. Attach what was submitted."
        }
      />
      {canEditFiles && (
        <FileDropzone
          onFiles={(fl) => void uploader.upload(fl, revision.id)}
          uploading={uploader.uploading}
          progress={uploader.progress}
          currentName={uploader.currentName}
        />
      )}
    </div>
  );

  const deleteRevisionLink =
    canWrite && !locked && item.revisions.length > 1 ? (
      <button
        type="button"
        onClick={onDeleteRevision}
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-600"
      >
        <Trash2 className="h-3 w-3" />
        Delete {rev}
      </button>
    ) : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold text-slate-900">{rev}</span>
          <span className="text-[11px] text-slate-400">current</span>
          {locked && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              Files locked
            </span>
          )}
        </div>
        {deleteRevisionLink}
      </div>

      <div className="space-y-4 p-3">
        {revision.notes && (
          <p className="whitespace-pre-wrap text-xs text-slate-600">{revision.notes}</p>
        )}
        {mode === "SUBMITTAL" && revision.receivedAt && (
          <p className="text-xs text-slate-500">Received {formatDay(revision.receivedAt, today)}</p>
        )}

        {filesBlock}

        {mode === "DOCUMENT" ? (
          <>
            {/* ── Seal ── */}
            <section className="space-y-2">
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Seal</h4>
              {revision.sealedAt ? (
                <div className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-[#c9a84c]/10 px-3 py-2 ring-1 ring-inset ring-[#c9a84c]/40">
                  <div className="flex items-start gap-2 min-w-0">
                    <Stamp className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a8893a]" />
                    <p className="text-sm text-slate-800">
                      Sealed by {revision.sealedByName ?? "a PE"}
                      {revision.sealLicenseNo ? `, ${revision.sealLicenseNo}` : ""}
                      <span className="text-slate-500"> · {formatStamp(revision.sealedAt)}</span>
                    </p>
                  </div>
                  {canSeal &&
                    !revision.issuedAt &&
                    status === "SEALED" &&
                    (revision.sealedBy?.id === currentUserId || isWorkspaceOwner) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-slate-600"
                        onClick={() => {
                          setRevokeReason("");
                          setRevokeOpen(true);
                        }}
                      >
                        Revoke seal
                      </Button>
                    )}
                </div>
              ) : !item.sealRequired ? (
                <p className="text-xs text-slate-500">No seal required for this deliverable.</p>
              ) : revision.issuedAt ? (
                <p className="text-xs text-slate-500">
                  Issued as a preliminary set (not sealed). Start a new revision to issue it sealed.
                </p>
              ) : canSeal && canWrite ? (
                ["IN_PROGRESS", "AWAITING_SEAL", "COMMENTS"].includes(status) ? (
                  <WithReason reason={pdf ? null : "Attach the signed & sealed PDF first."}>
                    <Button
                      size="sm"
                      onClick={() => setSealOpen(true)}
                      disabled={!pdf || !!pending}
                      className="bg-[#c9a84c] text-white hover:bg-[#b8973f]"
                    >
                      <Stamp className="h-3.5 w-3.5" />
                      Mark sealed
                    </Button>
                  </WithReason>
                ) : (
                  <p className="text-xs text-slate-500">Not sealed.</p>
                )
              ) : status === "AWAITING_SEAL" ? (
                <p className="text-xs text-slate-500">Waiting for the PE&apos;s seal</p>
              ) : canWrite && (status === "IN_PROGRESS" || status === "COMMENTS") ? (
                <WithReason reason={files.length > 0 ? null : "Attach the PDF to be sealed first."}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={files.length === 0 || !!pending}
                    onClick={() =>
                      void act(
                        "request",
                        { action: "REQUEST_SEAL", revisionId: revision.id },
                        "Seal requested"
                      )
                    }
                  >
                    {pending === "request" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Stamp className="h-3.5 w-3.5" />
                    )}
                    Request seal
                  </Button>
                </WithReason>
              ) : (
                <p className="text-xs text-slate-500">Not sealed.</p>
              )}
            </section>

            {/* ── Issue ── */}
            <section className="space-y-2">
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Issue</h4>
              {revision.issuedAt ? (
                <div className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-slate-800">
                      <Send className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" />
                      Issued {formatDay(revision.issuedAt, today)} to{" "}
                      {issuePartyLabel(revision.issuedToParty) ?? "—"}
                      {revision.issuedTo ? ` — ${revision.issuedTo}` : ""}
                    </p>
                    {revision.transmittalNote && (
                      <p className="whitespace-pre-wrap text-xs text-slate-600">
                        {revision.transmittalNote}
                      </p>
                    )}
                    {revision.issuedBy?.name && (
                      <p className="text-[11px] text-slate-400">by {revision.issuedBy.name}</p>
                    )}
                  </div>
                  {canWrite &&
                    status === "ISSUED" &&
                    (revision.issuedBy?.id === currentUserId || isWorkspaceManager) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-slate-600"
                        onClick={() => setUndoIssueOpen(true)}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Undo issue
                      </Button>
                    )}
                </div>
              ) : canWrite &&
                ["IN_PROGRESS", "AWAITING_SEAL", "SEALED", "COMMENTS"].includes(status) ? (
                <WithReason reason={files.length > 0 ? null : "Attach the issued files first."}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onIssue}
                    disabled={files.length === 0 || !!pending}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Issue…
                  </Button>
                </WithReason>
              ) : (
                <p className="text-xs text-slate-500">Not issued.</p>
              )}
            </section>
          </>
        ) : (
          /* ── Submittal review ── */
          <section className="space-y-2">
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Review</h4>
            {revision.disposition ? (
              <div className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{dispositionLabel(revision.disposition)}</span>
                    <span className="text-slate-500">
                      {" "}
                      · returned {formatDay(revision.issuedAt, today)}
                      {revision.reviewedBy?.name ? ` by ${revision.reviewedBy.name}` : ""}
                    </span>
                  </p>
                  {revision.transmittalNote && (
                    <p className="whitespace-pre-wrap text-xs text-slate-600">
                      {revision.transmittalNote}
                    </p>
                  )}
                </div>
                {canWrite &&
                  (status === "RESUBMIT_REQUIRED" || status === "CLOSED") &&
                  (revision.reviewedBy?.id === currentUserId || isWorkspaceManager) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-slate-600"
                      onClick={() => setUndoReviewOpen(true)}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Undo
                    </Button>
                  )}
              </div>
            ) : canWrite && status === "UNDER_REVIEW" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {DISPOSITIONS.map((d) => (
                    <Button
                      key={d.key}
                      size="sm"
                      variant="outline"
                      disabled={!!pending}
                      className={cn(
                        "justify-center text-xs",
                        (d.key === "APPROVED" || d.key === "APPROVED_AS_NOTED") &&
                          "hover:border-[#c9a84c] hover:bg-[#c9a84c]/10"
                      )}
                      onClick={() =>
                        void act(
                          d.key,
                          {
                            action: "REVIEW",
                            revisionId: revision.id,
                            disposition: d.key as Disposition,
                            notes: reviewNotes.trim() || null,
                            returnedAt: returnedAt || todayInput(today ?? new Date()),
                          },
                          `Returned ${d.label.toLowerCase()}`
                        )
                      }
                    >
                      {pending === d.key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {d.label}
                    </Button>
                  ))}
                </div>
                {showReviewExtras ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={2}
                      maxLength={5000}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Review comments (optional)"
                    />
                    <div className="flex items-center gap-2">
                      <label htmlFor={`ret-${revision.id}`} className="text-xs text-slate-500">
                        Returned
                      </label>
                      <Input
                        id={`ret-${revision.id}`}
                        type="date"
                        value={returnedAt || (today ? todayInput(today) : "")}
                        onChange={(e) => setReturnedAt(e.target.value)}
                        className="h-8 w-44"
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReviewExtras(true)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    + Add comments or a return date
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Not reviewed.</p>
            )}
          </section>
        )}

        {/* ── Next revision / resubmittal ── */}
        {canWrite && status !== "VOID" && locked && (
          mode === "SUBMITTAL" ? (
            status === "RESUBMIT_REQUIRED" && (
              <NewRevisionButton
                current={revision.label}
                label="Log resubmittal"
                withReceived
                today={today}
                onCreate={onNewRevision}
              />
            )
          ) : (
            <NewRevisionButton
              current={revision.label}
              label="New revision"
              today={today}
              onCreate={onNewRevision}
            />
          )
        )}
      </div>

      {/* ── Confirms ── */}
      <ActionDialog
        open={sealOpen}
        onOpenChange={setSealOpen}
        title={`Mark ${rev} as sealed?`}
        description="You're recording that you digitally signed and sealed this revision. Its files become read-only."
        confirmLabel="Mark sealed"
        onConfirm={() =>
          runAction({ action: "SEAL", revisionId: revision.id }, `${rev} sealed`)
        }
      />
      <ActionDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={`Revoke the seal on ${rev}?`}
        description="The revocation stays in the history, with your reason and who sealed it. The files unlock."
        confirmLabel="Revoke seal"
        destructive
        confirmDisabled={!revokeReason.trim()}
        onConfirm={() =>
          runAction(
            { action: "REVOKE_SEAL", revisionId: revision.id, reason: revokeReason.trim() },
            "Seal revoked"
          )
        }
      >
        <div className="space-y-1">
          <label htmlFor={`revoke-${revision.id}`} className="text-sm font-medium text-slate-700">
            Why is this seal being revoked?
          </label>
          <Textarea
            id={`revoke-${revision.id}`}
            rows={3}
            maxLength={500}
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="Wrong sheet set attached"
          />
        </div>
      </ActionDialog>
      <ActionDialog
        open={undoIssueOpen}
        onOpenChange={setUndoIssueOpen}
        title={`Undo the issue of ${rev}?`}
        description="Use this when the issue was recorded by mistake. The undo stays in the history."
        confirmLabel="Undo issue"
        onConfirm={() =>
          runAction({ action: "UNDO_ISSUE", revisionId: revision.id }, "Issue undone")
        }
      />
      <ActionDialog
        open={undoReviewOpen}
        onOpenChange={setUndoReviewOpen}
        title={`Undo the review of ${rev}?`}
        description="The submittal goes back to Under review. The undo stays in the history."
        confirmLabel="Undo review"
        onConfirm={() =>
          runAction({ action: "UNDO_REVIEW", revisionId: revision.id }, "Review undone")
        }
      />
    </div>
  );
}

/** "New revision" / "Log resubmittal": the next label is suggested; a label
 *  with no obvious successor ("IFC") has to be typed. */
function NewRevisionButton({
  current,
  label,
  withReceived = false,
  today,
  onCreate,
}: {
  current: string;
  label: string;
  withReceived?: boolean;
  today: Date | null;
  onCreate: (label: string | null, extra: { receivedAt?: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [received, setReceived] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = REVISION_LABEL_PATTERN.test(value.trim());

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (v) {
          setValue(nextRevisionLabel(current) ?? "");
          setReceived(todayInput(today ?? new Date()));
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid || busy) return;
            setBusy(true);
            try {
              await onCreate(value.trim(), withReceived ? { receivedAt: received } : {});
              setOpen(false);
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label htmlFor="new-rev-label" className="mb-1 block text-xs font-medium text-slate-600">
              Revision label
            </label>
            <Input
              id="new-rev-label"
              value={value}
              maxLength={12}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              className="font-mono uppercase"
              placeholder="1"
            />
            {!valid && value.trim() !== "" && (
              <p className="mt-1 text-[11px] text-red-600">
                Use up to 12 letters, digits, dots or dashes.
              </p>
            )}
          </div>
          {withReceived && (
            <div>
              <label htmlFor="new-rev-received" className="mb-1 block text-xs font-medium text-slate-600">
                Received
              </label>
              <Input
                id="new-rev-received"
                type="date"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Rev {current} stays as it is, read-only, in the history.
          </p>
          <Button type="submit" size="sm" className="w-full" disabled={!valid || busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Start Rev {value.trim().toUpperCase() || "…"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** One read-only line for an older revision, expandable to its files. */
export function RevisionSummary({
  mode,
  revision,
  today,
}: {
  mode: "DOCUMENT" | "SUBMITTAL";
  revision: RevisionJSON;
  today: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const parts: string[] = [`Rev ${revision.label}`];
  if (mode === "DOCUMENT") {
    if (revision.sealedAt) parts.push(`Sealed ${formatStamp(revision.sealedAt).replace(/, \d{4}$/, "")}`);
    if (revision.issuedAt) {
      const party = issuePartyLabel(revision.issuedToParty);
      parts.push(`Issued ${formatDay(revision.issuedAt, today)}${party ? ` → ${party}` : ""}`);
    }
  } else {
    if (revision.disposition) parts.push(dispositionLabel(revision.disposition) ?? "");
    if (revision.issuedAt) parts.push(`returned ${formatDay(revision.issuedAt, today)}`);
  }
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform", open && "rotate-90")} />
        <span className="min-w-0 truncate">{parts.filter(Boolean).join(" · ")}</span>
        <span className="ml-auto flex-shrink-0 text-[11px] text-slate-400">
          {revision.files.length} file{revision.files.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {revision.sealedAt && (
            <p className="flex items-center gap-1.5 text-xs text-slate-600">
              <Stamp className="h-3 w-3 text-[#a8893a]" />
              Sealed by {revision.sealedByName ?? "a PE"}
              {revision.sealLicenseNo ? `, ${revision.sealLicenseNo}` : ""} · {formatStamp(revision.sealedAt)}
            </p>
          )}
          {revision.issuedTo && (
            <p className="text-xs text-slate-600">
              {mode === "DOCUMENT" ? "Issued to" : "Returned to"} {revision.issuedTo}
            </p>
          )}
          {revision.transmittalNote && (
            <p className="whitespace-pre-wrap text-xs text-slate-500">{revision.transmittalNote}</p>
          )}
          <FileRows files={revision.files} />
          {revision.reviewedBy && mode === "SUBMITTAL" && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <UserAvatar user={revision.reviewedBy} size={14} /> Reviewed by {revision.reviewedBy.name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
