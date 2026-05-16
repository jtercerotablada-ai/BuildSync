"use client";

/**
 * Upload-to-task dialog used by the /my-tasks Files view.
 *
 * Attachments in our model are owned by a task — there are no orphan
 * files. So uploading from the cross-task Files view needs two steps:
 *   1. Pick the file(s)
 *   2. Pick the task to attach them to
 *
 * This dialog does both in one place. File picker first, then task
 * search (loads the user's workspace tasks, client-side filters by
 * name), then a single Upload button that POSTs every file to
 * /api/tasks/:taskId/attachments and bubbles success via onUploaded.
 *
 * Accepts the same MIME whitelist + 10 MB cap as the task panel
 * uploader so size limits stay consistent.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Paperclip,
  Search,
  Loader2,
  X,
  Check,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PickableTask {
  id: string;
  name: string;
  completed: boolean;
  project?: { id: string; name: string; color: string } | null;
}

interface UploadToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after every selected file has been POSTed (regardless of
   *  per-file success; the dialog surfaces per-file errors via toast). */
  onUploaded: () => void;
}

const ACCEPT =
  "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";
const MAX_SIZE = 10 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadToTaskDialog({
  open,
  onOpenChange,
  onUploaded,
}: UploadToTaskDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [tasks, setTasks] = useState<PickableTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on close.
  useEffect(() => {
    if (open) return;
    setFiles([]);
    setSearch("");
    setSelectedTaskId(null);
    setUploading(false);
  }, [open]);

  // Lazy-fetch tasks on first open.
  useEffect(() => {
    if (!open || tasks.length > 0) return;
    let cancelled = false;
    setLoadingTasks(true);
    fetch("/api/tasks?myTasks=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PickableTask[]) => {
        if (!cancelled) setTasks(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load tasks");
      })
      .finally(() => {
        if (!cancelled) setLoadingTasks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tasks.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks.slice(0, 50);
    return tasks
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [tasks, search]);

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const incoming: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: exceeds 10 MB limit`);
        continue;
      }
      incoming.push(f);
    }
    setFiles((prev) => [...prev, ...incoming]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleUpload() {
    if (uploading) return;
    if (files.length === 0 || !selectedTaskId) return;
    setUploading(true);
    let okCount = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(
          `/api/tasks/${selectedTaskId}/attachments`,
          { method: "POST", body: fd }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        okCount++;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `${file.name}: ${err.message}`
            : `${file.name}: upload failed`
        );
      }
    }
    if (okCount > 0) {
      toast.success(
        `Uploaded ${okCount} file${okCount === 1 ? "" : "s"}`
      );
      onUploaded();
    }
    setUploading(false);
    if (okCount > 0) onOpenChange(false);
  }

  function handleDialogDrop(e: React.DragEvent) {
    e.preventDefault();
    const list = e.dataTransfer.files;
    if (!list || list.length === 0) return;
    const incoming: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: exceeds 10 MB limit`);
        continue;
      }
      incoming.push(f);
    }
    setFiles((prev) => [...prev, ...incoming]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Upload a file to a task</DialogTitle>

        <div className="px-6 pt-5 pb-3 border-b">
          <h2 className="text-[16px] font-semibold text-gray-900">
            Upload a file to a task
          </h2>
          <p className="text-[12px] text-gray-500 mt-1">
            Attachments belong to a task — pick the file(s) and the
            task they should land on.
          </p>
        </div>

        {/* File drop / picker zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDialogDrop}
          className="mx-6 mt-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={pickFiles}
          />
          {files.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center py-6 text-[13px] text-gray-500 hover:text-gray-900"
            >
              <Paperclip className="w-5 h-5 mb-1.5 text-gray-300" />
              Click to pick files or drop them here
              <span className="text-[11px] text-gray-400 mt-0.5">
                Images, PDFs, Office docs · up to 10 MB each
              </span>
            </button>
          ) : (
            <div className="p-3 space-y-1.5">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50"
                >
                  <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-[13px] text-gray-800 truncate">
                    {f.name}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {formatSize(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-gray-400 hover:text-gray-900"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[12px] text-[#a8893a] hover:underline mt-1"
              >
                + Add more files
              </button>
            </div>
          )}
        </div>

        {/* Task picker */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-[12px] font-medium text-gray-700 mb-1.5">
            Attach to which task?
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a task"
              className="w-full h-9 pl-8 pr-3 text-[13px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="max-h-[200px] overflow-y-auto px-3 pb-3">
          {loadingTasks && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
          {!loadingTasks && filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-[12px] text-gray-400">
              {tasks.length === 0 ? "No tasks yet" : "No matching tasks"}
            </p>
          )}
          {!loadingTasks &&
            filtered.map((t) => {
              const isSelected = selectedTaskId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-left text-[13px] transition-colors",
                    isSelected
                      ? "bg-[#fbeed3] text-gray-900"
                      : "hover:bg-gray-100 text-gray-800"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0",
                      isSelected
                        ? "border-[#c9a84c] bg-[#c9a84c]"
                        : "border-gray-300"
                    )}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="flex-1 truncate">{t.name}</span>
                  {t.project && (
                    <span className="text-[11px] text-gray-500 truncate max-w-[120px]">
                      {t.project.name}
                    </span>
                  )}
                </button>
              );
            })}
        </div>

        <div className="px-6 py-3 border-t flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-8 text-[13px] font-medium text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || files.length === 0 || !selectedTaskId}
            className="px-4 h-8 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" /> Upload
                {files.length > 1 ? ` ${files.length} files` : ""}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
