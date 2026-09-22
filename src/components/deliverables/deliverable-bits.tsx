"use client";

import { useRef, useState } from "react";
import {
  Download,
  File as FileIcon,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD_ACCEPT } from "@/lib/storage";
import type { StageHolder } from "@/lib/pipelines";
import {
  formatBytes,
  initialsOf,
  statusTone,
} from "./deliverable-format";
import type { DeliverableFileJSON, UserLite } from "./types";

// ─── Status pill ────────────────────────────────────────────────────────

export function StatusPill({
  label,
  open,
  holder,
  className,
}: {
  label: string;
  open: boolean;
  holder: StageHolder;
  className?: string;
}) {
  const tone = statusTone(open, holder);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tone === "ours" && "bg-[#c9a84c]/15 text-[#7a6424] ring-1 ring-inset ring-[#c9a84c]/40",
        tone === "theirs" && "bg-slate-100 text-slate-700",
        tone === "closed" && "bg-slate-50 text-slate-400",
        className
      )}
    >
      {label}
    </span>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────

export function UserAvatar({
  user,
  size = 24,
}: {
  user: UserLite | null | undefined;
  size?: number;
}) {
  if (!user) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-300"
        style={{ width: size, height: size }}
        aria-label="Unassigned"
      />
    );
  }
  return user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.image}
      alt={user.name ?? ""}
      title={user.name ?? undefined}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={user.name ?? undefined}
      className="inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-700 font-medium flex-shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
    >
      {initialsOf(user.name)}
    </span>
  );
}

// ─── Files ──────────────────────────────────────────────────────────────

function isPdf(f: { name: string; mimeType: string }) {
  return f.mimeType === "application/pdf" || /\.pdf$/i.test(f.name);
}

/**
 * The files of one revision (or an RFI's attachments). The ✕ appears only
 * when `onRemove` is passed — the caller withholds it once the revision is
 * locked or the viewer is read-only.
 */
export function FileRows({
  files,
  onRemove,
  removingId,
  emptyText = "No files yet.",
}: {
  files: DeliverableFileJSON[];
  onRemove?: (f: DeliverableFileJSON) => void;
  removingId?: string | null;
  emptyText?: string;
}) {
  if (files.length === 0) {
    return <p className="text-xs text-slate-400">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-2 px-2.5 py-1.5 min-w-0">
          {isPdf(f) ? (
            <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
          ) : (
            <FileIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          )}
          <a
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm text-slate-800 hover:underline"
            title={f.name}
          >
            {f.name}
          </a>
          <span className="hidden sm:inline text-[11px] text-slate-400 flex-shrink-0">
            {formatBytes(f.size)}
          </span>
          <a
            href={`${f.url}?download=1`}
            download={f.name}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Download ${f.name}`}
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(f)}
              disabled={removingId === f.id}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label={`Remove ${f.name}`}
              title="Remove"
            >
              {removingId === f.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** "Drop files or click to upload", with the in-flight file's progress. */
export function FileDropzone({
  onFiles,
  uploading,
  progress,
  currentName,
  label = "Drop files or click to upload",
}: {
  onFiles: (files: FileList) => void;
  uploading: boolean;
  progress: number | null;
  currentName: string | null;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={uploading ? -1 : 0}
      aria-disabled={uploading}
      onClick={() => !uploading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!uploading && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!uploading && e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-xs transition-colors",
        uploading
          ? "cursor-default border-slate-200 bg-slate-50 text-slate-500"
          : over
            ? "cursor-pointer border-[#c9a84c] bg-[#c9a84c]/10 text-slate-700"
            : "cursor-pointer border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          // Reset so picking the same file again still fires onChange.
          e.target.value = "";
        }}
      />
      {uploading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="truncate">
            Uploading {progress ?? 0}%{currentName ? ` · ${currentName}` : ""}
          </span>
        </>
      ) : (
        <>
          <Upload className="h-3.5 w-3.5" />
          <span>{label}</span>
        </>
      )}
    </div>
  );
}

/** A labelled field row for the sheet and dialogs. */
export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1"
    >
      {children}
    </label>
  );
}
