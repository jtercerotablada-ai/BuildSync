"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronRight,
  History,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { useToday } from "@/lib/use-today";
import { holderDeskLabel } from "@/lib/pipelines";
import {
  DOC_TYPES,
  EVENT_LABELS,
  KIND_LABELS,
  docTypeLabel,
  statusLabel,
  type DeliverableEventType,
} from "@/lib/deliverables";
import { ActionDialog } from "./action-dialog";
import {
  FieldLabel,
  FileDropzone,
  FileRows,
  StatusPill,
  UserAvatar,
} from "./deliverable-bits";
import {
  DeliverableApiError,
  apiJson,
  errorMessage,
  showStageOffer,
} from "./deliverable-api";
import {
  daysSince,
  descriptionFieldLabel,
  eventText,
  formatDay,
  formatDayCountLong,
  formatStampShort,
  overdueDays,
  partyFieldLabel,
  toDateInput,
  todayInput,
} from "./deliverable-format";
import { IssueDialog, type IssueInput } from "./issue-dialog";
import { RevisionCard, RevisionSummary, type RunAction } from "./revision-card";
import { useDeliverableUpload } from "./use-deliverable-upload";
import type {
  ActionResponse,
  DeliverableDetailJSON,
  DeliverableFileJSON,
  DeliverablePermissions,
  DeliverableProjectInfo,
  UserLite,
} from "./types";

const UNASSIGNED = "__none__";
const DELETE_BLOCKED =
  "Issued and sealed records can't be deleted. Set the status to Void instead.";

/**
 * The item's sheet: header (number, title, status, holder), fields, the
 * kind's own section (revisions / review cycles / RFI answer) and History.
 *
 * Every mutation is sent, then the item is REFETCHED (the API is the only
 * source of the derived status, holder and locks) and `onChanged` tells the
 * register to refetch too. Field edits keep a local draft while typing and
 * snap back to the server value when a save is refused.
 */
export function DeliverableDetailSheet({
  deliverableId,
  projectId,
  project,
  assignableUsers,
  onClose,
  onChanged,
}: {
  deliverableId: string | null;
  projectId: string;
  project: DeliverableProjectInfo | null;
  assignableUsers: UserLite[];
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Sheet open={!!deliverableId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl"
      >
        {deliverableId && (
          <SheetBody
            key={deliverableId}
            deliverableId={deliverableId}
            projectId={projectId}
            project={project}
            assignableUsers={assignableUsers}
            onClose={onClose}
            onChanged={onChanged}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type Loaded = { item: DeliverableDetailJSON; permissions: DeliverablePermissions };

function SheetBody({
  deliverableId,
  projectId,
  project,
  assignableUsers,
  onClose,
  onChanged,
}: {
  deliverableId: string;
  projectId: string;
  project: DeliverableProjectInfo | null;
  assignableUsers: UserLite[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const today = useToday();

  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "error" | "notfound" | "ready">("loading");
  const reqRef = useRef(0);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    const req = ++reqRef.current;
    try {
      const res = await apiJson<Loaded>(
        `/api/deliverables/${deliverableId}`,
        {},
        "Couldn't load this item"
      );
      if (req !== reqRef.current) return;
      // The sheet acts on THIS page's project (stage offers PATCH it), so an
      // item from another project — a hand-edited ?deliverable= — is treated
      // as not found here.
      const ownerProjectId = (res.item as { projectId?: string }).projectId;
      if (ownerProjectId && ownerProjectId !== projectId) {
        setData(null);
        hasDataRef.current = false;
        setState("notfound");
        return;
      }
      setData(res);
      hasDataRef.current = true;
      setState("ready");
    } catch (err) {
      if (req !== reqRef.current) return;
      if (err instanceof DeliverableApiError && err.status === 404) {
        setState("notfound");
      } else if (hasDataRef.current) {
        // A background refetch that fails keeps the last good copy on
        // screen, and says so.
        toast.error(errorMessage(err, "Couldn't refresh this item"));
      } else {
        setState("error");
      }
    }
  }, [deliverableId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
    onChanged();
  }, [load, onChanged]);

  const uploader = useDeliverableUpload(deliverableId, () => void refresh());

  // ── Mutations ────────────────────────────────────────────────────────
  const patch = useCallback(
    async (fields: Record<string, unknown>): Promise<boolean> => {
      try {
        await apiJson(
          `/api/deliverables/${deliverableId}`,
          { method: "PATCH", json: fields },
          "Couldn't save"
        );
        await refresh();
        return true;
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't save"));
        void load();
        return false;
      }
    },
    [deliverableId, refresh, load]
  );

  const runAction: RunAction = useCallback(
    async (body, success) => {
      let res: ActionResponse;
      try {
        res = await apiJson<ActionResponse>(
          `/api/deliverables/${deliverableId}/actions`,
          { method: "POST", json: body },
          "Couldn't save"
        );
      } catch (err) {
        // A conflict means our copy is stale: refresh behind the error.
        if (err instanceof DeliverableApiError && err.status === 409 && err.code !== "UNSEALED") {
          void load();
        }
        throw err;
      }
      toast.success(success);
      await refresh();
      if (res?.stageOffer) {
        showStageOffer(res.stageOffer, projectId, () => {
          onChanged();
          router.refresh();
        });
      }
    },
    [deliverableId, projectId, refresh, load, onChanged, router]
  );

  const [removingFileId, setRemovingFileId] = useState<string | null>(null);
  const removeFile = async (f: DeliverableFileJSON) => {
    if (removingFileId) return;
    if (!window.confirm(`Remove "${f.name}"?`)) return;
    setRemovingFileId(f.id);
    try {
      await apiJson(
        `/api/deliverables/${deliverableId}/files/${f.id}`,
        { method: "DELETE" },
        "Couldn't remove the file"
      );
      toast.success(`${f.name} removed`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't remove the file"));
    } finally {
      setRemovingFileId(null);
      void refresh();
    }
  };

  const newRevision = async (label: string | null, extra: { receivedAt?: string }) => {
    const rev = await apiJson<{ label: string }>(
      `/api/deliverables/${deliverableId}/revisions`,
      {
        method: "POST",
        json: { ...(label ? { label } : {}), ...extra },
      },
      "Couldn't start the revision"
    );
    toast.success(`Rev ${rev?.label ?? label ?? ""} started`);
    await refresh();
  };

  const [issueOpen, setIssueOpen] = useState(false);
  const [deleteRevOpen, setDeleteRevOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (state === "loading" && !data) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2">
        <SheetTitle className="sr-only">Loading deliverable</SheetTitle>
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (state === "notfound" || (state === "error" && !data)) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 px-6 text-center">
        <SheetTitle className="text-base">
          {state === "notfound" ? "Item not found" : "Couldn't load this item"}
        </SheetTitle>
        <SheetDescription>
          {state === "notfound"
            ? "It may have been deleted, or you don't have access to it."
            : "Check your connection and try again."}
        </SheetDescription>
        <div className="flex gap-2">
          {state === "error" && (
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { item, permissions } = data;
  const { canWrite } = permissions;
  const kind = item.kind;
  const current = item.revisions[0] ?? null;
  const older = item.revisions.slice(1);
  const overdue = today && item.open ? overdueDays(item.dueDate, today) : 0;
  const statusOptions = item.manualStatuses;

  return (
    <div className="flex min-h-full flex-col">
      {/* ── Header ── */}
      <div className="space-y-2 border-b border-slate-100 px-4 pb-3 pt-4 pr-12">
        <div className="flex items-center gap-2">
          <InlineText
            value={item.number}
            disabled={!canWrite}
            onCommit={(v) => patch({ number: v })}
            ariaLabel="Number"
            maxLength={40}
            className="w-28 font-mono text-sm font-semibold uppercase text-slate-900"
          />
          <span className="text-xs text-slate-400">
            {kind === "DOCUMENT" ? docTypeLabel(item.docType) ?? KIND_LABELS[kind] : KIND_LABELS[kind]}
          </span>
          {canWrite && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem
                  variant="destructive"
                  disabled={item.deleteBlocked}
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
                {item.deleteBlocked && (
                  <p className="px-2 pb-1.5 text-[11px] leading-snug text-slate-500">
                    {DELETE_BLOCKED}
                  </p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <SheetTitle asChild>
          <div>
            <InlineText
              value={item.title}
              disabled={!canWrite}
              onCommit={(v) => patch({ title: v })}
              ariaLabel="Title"
              maxLength={200}
              className="w-full text-lg font-semibold text-slate-900"
            />
          </div>
        </SheetTitle>
        <SheetDescription className="sr-only">
          {KIND_LABELS[kind]} {item.number}, {item.statusLabel}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && statusOptions.length > 0 ? (
            <Select
              value={item.status}
              onValueChange={(v) => {
                if (v !== item.status) void patch({ status: v });
              }}
            >
              <SelectTrigger size="sm" className="h-7 w-auto gap-1.5 text-xs" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={item.status} disabled>
                  {item.statusLabel}
                </SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {item.status === "VOID"
                      ? `Restore (${statusLabel(kind, s)})`
                      : statusLabel(kind, s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StatusPill label={item.statusLabel} open={item.open} holder={item.holder} />
          )}
          {item.holder !== "NONE" && (
            <span className="text-xs text-slate-500">
              {holderDeskLabel(item.holder)} ·{" "}
              {today ? formatDayCountLong(daysSince(item.statusChangedAt, today)) : "—"}
            </span>
          )}
          {item.dueDate &&
            (overdue > 0 ? (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                Overdue {overdue}d
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                Due {formatDay(item.dueDate, today)}
              </span>
            ))}
        </div>
      </div>

      <div className="flex-1 space-y-6 px-4 py-4">
        {/* ── Fields ── */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kind === "DOCUMENT" && (
            <div>
              <FieldLabel>Type</FieldLabel>
              {canWrite ? (
                <Select
                  value={item.docType ?? ""}
                  onValueChange={(v) => v !== item.docType && void patch({ docType: v })}
                >
                  <SelectTrigger className="h-8 w-full text-sm">
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
              ) : (
                <p className="text-sm text-slate-800">{docTypeLabel(item.docType) ?? "—"}</p>
              )}
            </div>
          )}
          {kind === "DOCUMENT" && (
            <div>
              <FieldLabel>Seal required</FieldLabel>
              <div className="flex h-8 items-center gap-2">
                <Switch
                  checked={item.sealRequired}
                  disabled={!canWrite}
                  onCheckedChange={(v) => void patch({ sealRequired: v })}
                  aria-label="Seal required"
                />
                <span className="text-sm text-slate-600">
                  {item.sealRequired ? "PE seal before issue" : "No seal"}
                </span>
              </div>
            </div>
          )}
          {kind !== "DOCUMENT" && (
            <DateField
              label="Received"
              value={item.receivedAt}
              disabled={!canWrite}
              today={today}
              onCommit={(v) => patch({ receivedAt: v })}
            />
          )}
          <DateField
            label="Due"
            value={item.dueDate}
            disabled={!canWrite}
            today={today}
            onCommit={(v) => patch({ dueDate: v })}
          />
          <div>
            <FieldLabel>Assignee</FieldLabel>
            {canWrite ? (
              <Select
                value={item.assignee?.id ?? UNASSIGNED}
                onValueChange={(v) => {
                  const next = v === UNASSIGNED ? null : v;
                  if (next !== (item.assignee?.id ?? null)) void patch({ assigneeId: next });
                }}
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {item.assignee && !assignableUsers.some((u) => u.id === item.assignee!.id) && (
                    <SelectItem value={item.assignee.id}>{item.assignee.name || "Unnamed"}</SelectItem>
                  )}
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-800">
                <UserAvatar user={item.assignee} size={20} />
                {item.assignee?.name ?? "Unassigned"}
              </div>
            )}
          </div>
          <div>
            <FieldLabel>{partyFieldLabel(kind)}</FieldLabel>
            <InlineText
              value={item.party ?? ""}
              allowEmpty
              disabled={!canWrite}
              placeholder="—"
              onCommit={(v) => patch({ party: v || null })}
              ariaLabel={partyFieldLabel(kind)}
              maxLength={200}
              className="h-8 w-full rounded-md border border-slate-200 px-2 text-sm text-slate-800"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>{descriptionFieldLabel(kind)}</FieldLabel>
            <InlineTextarea
              value={item.description ?? ""}
              disabled={!canWrite}
              onCommit={(v) => patch({ description: v || null })}
              ariaLabel={descriptionFieldLabel(kind)}
              placeholder={
                kind === "RFI"
                  ? "What was asked"
                  : kind === "SUBMITTAL"
                    ? "What was submitted"
                    : "Sheets, scope, notes"
              }
            />
          </div>
        </section>

        {/* ── Kind section ── */}
        {kind !== "RFI" && current && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {kind === "DOCUMENT" ? "Revisions" : "Review cycles"}
            </h3>
            {/* Keyed by revision: a new cycle must not inherit the last
                cycle's review comments or return date. */}
            <RevisionCard
              key={current.id}
              mode={kind}
              item={item}
              revision={current}
              permissions={permissions}
              currentUserId={currentUserId}
              today={today}
              runAction={runAction}
              uploader={uploader}
              onRemoveFile={(f) => void removeFile(f)}
              removingFileId={removingFileId}
              onIssue={() => setIssueOpen(true)}
              onNewRevision={newRevision}
              onDeleteRevision={() => setDeleteRevOpen(true)}
            />
            {older.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {older.map((r) => (
                  <RevisionSummary key={r.id} mode={kind} revision={r} today={today} />
                ))}
              </div>
            )}
          </section>
        )}

        {kind === "RFI" && (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Attachments</h3>
              <FileRows
                files={item.files}
                onRemove={canWrite ? (f) => void removeFile(f) : undefined}
                removingId={removingFileId}
                emptyText="No attachments."
              />
              {canWrite && (
                <FileDropzone
                  onFiles={(fl) => void uploader.upload(fl, null)}
                  uploading={uploader.uploading}
                  progress={uploader.progress}
                  currentName={uploader.currentName}
                />
              )}
            </section>
            <AnswerBlock item={item} canWrite={canWrite} today={today} runAction={runAction} />
          </>
        )}

        <HistorySection item={item} today={today} />
      </div>

      {/* ── Dialogs ── */}
      {current && kind === "DOCUMENT" && (
        <IssueDialog
          open={issueOpen}
          onOpenChange={setIssueOpen}
          revisionLabel={current.label}
          project={project}
          deliverableParty={item.party}
          onIssue={(input: IssueInput) =>
            runAction(
              { action: "ISSUE", revisionId: current.id, ...input },
              `Rev ${current.label} issued`
            )
          }
        />
      )}
      {current && (
        <ActionDialog
          open={deleteRevOpen}
          onOpenChange={setDeleteRevOpen}
          title={`Delete Rev ${current.label}?`}
          description="Its files are deleted too. The deletion stays in the history."
          confirmLabel="Delete revision"
          destructive
          onConfirm={async () => {
            await apiJson(
              `/api/deliverables/${deliverableId}/revisions/${current.id}`,
              { method: "DELETE" },
              "Couldn't delete the revision"
            );
            toast.success(`Rev ${current.label} deleted`);
            await refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${item.number}?`}
        description="This removes the record, its revisions and its files. It can't be undone."
        onConfirm={async () => {
          await apiJson(
            `/api/deliverables/${deliverableId}`,
            { method: "DELETE" },
            "Couldn't delete"
          );
          toast.success(`${item.number} deleted`);
          setDeleteOpen(false);
          onChanged();
          onClose();
        }}
      />
    </div>
  );
}

// ─── RFI answer ─────────────────────────────────────────────────────────

function AnswerBlock({
  item,
  canWrite,
  today,
  runAction,
}: {
  item: DeliverableDetailJSON;
  canWrite: boolean;
  today: Date | null;
  runAction: RunAction;
}) {
  const answered = item.status === "ANSWERED";
  const canAnswer = canWrite && (item.status === "OPEN" || item.status === "AWAITING_INFO");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const startEdit = (prefill: string) => {
    setText(prefill);
    setDate(
      answered && item.respondedAt
        ? toDateInput(item.respondedAt)
        : todayInput(today ?? new Date())
    );
    setEditing(true);
  };

  const submit = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      await runAction(
        {
          action: "ANSWER",
          response: text.trim(),
          respondedAt: date || todayInput(today ?? new Date()),
        },
        answered ? "Answer updated" : "Answer recorded"
      );
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <div className="space-y-2">
      <Textarea
        rows={4}
        maxLength={10000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="The answer given"
        aria-label="Answer"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="rfi-answer-date" className="text-xs text-slate-500">
          Answered
        </label>
        <Input
          id="rfi-answer-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 w-44"
        />
        <div className="ml-auto flex gap-2">
          {(answered || editing) && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={() => void submit()} disabled={busy || !text.trim()}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {answered ? "Save answer" : "Record answer"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">Answer</h3>
      {answered ? (
        editing ? (
          form
        ) : (
          <div className="space-y-1.5 rounded-md bg-slate-50 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-500">
                Answered {formatDay(item.respondedAt, today)}
                {item.respondedBy?.name ? ` by ${item.respondedBy.name}` : ""}
              </p>
              {canWrite && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => startEdit(item.response ?? "")}
                >
                  Edit answer
                </Button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{item.response}</p>
          </div>
        )
      ) : (
        <>
          {item.response && (
            <div className="space-y-1 rounded-md border border-dashed border-slate-200 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Previous answer
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{item.response}</p>
              {item.respondedAt && (
                <p className="text-[11px] text-slate-400">
                  {formatDay(item.respondedAt, today)}
                  {item.respondedBy?.name ? ` · ${item.respondedBy.name}` : ""}
                </p>
              )}
            </div>
          )}
          {canAnswer ? (
            editing ? (
              form
            ) : (
              <Button size="sm" variant="outline" onClick={() => startEdit("")}>
                Record answer
              </Button>
            )
          ) : (
            !item.response && <p className="text-xs text-slate-500">Not answered.</p>
          )}
        </>
      )}
    </section>
  );
}

// ─── History ────────────────────────────────────────────────────────────

function HistorySection({
  item,
  today,
}: {
  item: DeliverableDetailJSON;
  today: Date | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-sm font-semibold text-slate-900"
      >
        <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        <History className="h-4 w-4 text-slate-400" />
        History
        <span className="text-xs font-normal text-slate-400">({item.events.length})</span>
      </button>
      {open && (
        <ol className="mt-2 space-y-1.5 pl-6">
          {item.events.length === 0 ? (
            <li className="text-xs text-slate-400">Nothing recorded yet.</li>
          ) : (
            item.events.map((e) => (
              <li key={e.id} className="text-xs leading-snug text-slate-600">
                <span className="text-slate-400">{formatStampShort(e.createdAt, today)}</span>
                {" · "}
                <span className="font-medium text-slate-700">{e.actorName ?? "Someone"}</span>
                {" · "}
                {eventText(e, {
                  eventLabel: (t) => EVENT_LABELS[t as DeliverableEventType] ?? t,
                  statusLabel: (s) => statusLabel(item.kind, s),
                })}
              </li>
            ))
          )}
        </ol>
      )}
    </section>
  );
}

// ─── Inline fields ──────────────────────────────────────────────────────

function InlineText({
  value,
  onCommit,
  disabled,
  className,
  maxLength,
  ariaLabel,
  placeholder,
  allowEmpty = false,
}: {
  value: string;
  onCommit: (v: string) => Promise<boolean>;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
  ariaLabel: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  // Resync the draft when the server value changes (a refetch, a refused
  // save) — adjusted during render, not in an effect.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }

  if (disabled) {
    return (
      <span className={cn("block truncate", className, "border-transparent")}>
        {value || placeholder || "—"}
      </span>
    );
  }

  const commit = async () => {
    const v = draft.trim();
    if (!v && !allowEmpty) {
      setDraft(value);
      return;
    }
    if (v === value.trim()) {
      setDraft(value);
      return;
    }
    setSaving(true);
    const ok = await onCommit(v);
    setSaving(false);
    if (!ok) setDraft(value);
  };

  return (
    <input
      value={draft}
      aria-label={ariaLabel}
      maxLength={maxLength}
      placeholder={placeholder}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(value);
          // Let the reset land before blur commits.
          setTimeout(() => (e.target as HTMLInputElement).blur(), 0);
        }
      }}
      className={cn(
        "min-w-0 rounded bg-transparent outline-none hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#c9a84c]/40 disabled:opacity-60",
        className
      )}
    />
  );
}

function InlineTextarea({
  value,
  onCommit,
  disabled,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => Promise<boolean>;
  disabled?: boolean;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  // Resync the draft when the server value changes (a refetch, a refused
  // save) — adjusted during render, not in an effect.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }

  if (disabled) {
    return value ? (
      <p className="whitespace-pre-wrap text-sm text-slate-800">{value}</p>
    ) : (
      <p className="text-sm text-slate-400">—</p>
    );
  }
  return (
    <Textarea
      value={draft}
      rows={3}
      maxLength={10000}
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={async () => {
        if (draft.trim() === value.trim()) return;
        setSaving(true);
        const ok = await onCommit(draft.trim());
        setSaving(false);
        if (!ok) setDraft(value);
      }}
      className="text-sm"
    />
  );
}

function DateField({
  label,
  value,
  disabled,
  today,
  onCommit,
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  today: Date | null;
  onCommit: (v: string | null) => Promise<boolean>;
}) {
  const server = toDateInput(value);
  const [draft, setDraft] = useState(server);
  const [saving, setSaving] = useState(false);
  const [seen, setSeen] = useState(server);
  if (seen !== server) {
    setSeen(server);
    setDraft(server);
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {disabled ? (
        <p className="text-sm text-slate-800">{value ? formatDay(value, today) : "—"}</p>
      ) : (
        <Input
          type="date"
          value={draft}
          disabled={saving}
          aria-label={label}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={async () => {
            if (draft === server) return;
            setSaving(true);
            const ok = await onCommit(draft || null);
            setSaving(false);
            if (!ok) setDraft(server);
          }}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}
