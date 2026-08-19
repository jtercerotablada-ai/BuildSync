"use client";

import * as React from "react";
import { useDropzone, type DropzoneOptions, type FileRejection } from "react-dropzone";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Dropzone — drag-and-drop file uploader for task attachments,
 * project files, knowledge base imports, and avatar uploads.
 * Replaces the basic `<input type="file">` in upload-to-task-dialog
 * with a polished drag-target + preview list + per-file remove.
 *
 * Built on react-dropzone (newly installed). All BuildSync upload
 * rules — MIME whitelist, 10 MB cap — pass through via the
 * accept/maxSize props. The default config matches the existing
 * task-attachment validator.
 */

export interface DropzoneProps
  extends Omit<DropzoneOptions, "onDrop">,
    Pick<React.HTMLAttributes<HTMLDivElement>, "className"> {
  /** Files currently selected. Lift state up so parent owns the list. */
  files?: File[];
  /** Called when new files are accepted (passes ALL files, accepted + previous). */
  onChange?: (files: File[]) => void;
  /** Title shown in the dropzone (e.g. "Upload attachments"). */
  label?: string;
  /** Subtitle / hint shown below the title. */
  hint?: string;
  /** Pulls a default project-management config: images + PDF + Office, 10MB cap. */
  preset?: "task-attachment" | "image-only" | "any";
}

const PRESETS: Record<
  NonNullable<DropzoneProps["preset"]>,
  { accept: DropzoneOptions["accept"]; maxSize: number; hint: string }
> = {
  "task-attachment": {
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxSize: 10 * 1024 * 1024, // 10 MB — matches existing validator
    hint: "Images, PDF, Word, Excel · up to 10 MB",
  },
  "image-only": {
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
    maxSize: 5 * 1024 * 1024, // 5 MB
    hint: "Images only · up to 5 MB",
  },
  any: {
    accept: undefined,
    maxSize: 25 * 1024 * 1024, // 25 MB
    hint: "Any file · up to 25 MB",
  },
};

export function Dropzone({
  files = [],
  onChange,
  label = "Drop files here",
  hint,
  preset = "task-attachment",
  className,
  ...dropzoneOpts
}: DropzoneProps) {
  const presetConfig = PRESETS[preset];
  const [rejections, setRejections] = React.useState<FileRejection[]>([]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    accept: dropzoneOpts.accept ?? presetConfig.accept,
    maxSize: dropzoneOpts.maxSize ?? presetConfig.maxSize,
    ...dropzoneOpts,
    onDrop: (accepted: File[], rejected: FileRejection[]) => {
      setRejections(rejected);
      if (accepted.length && onChange) onChange([...files, ...accepted]);
    },
  });

  function removeFile(idx: number) {
    if (!onChange) return;
    onChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div data-slot="dropzone" className={cn("w-full", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors cursor-pointer",
          isDragActive && !isDragReject && "border-blue-400 bg-blue-50/50",
          isDragReject && "border-red-400 bg-red-50/50",
          !isDragActive && "border-gray-300 hover:border-gray-400 bg-gray-50/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="size-6 text-gray-400" />
        <div className="text-center">
          <p className="text-[13px] font-medium text-gray-700">{label}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {hint ?? presetConfig.hint}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[12px] h-7 mt-1"
          onClick={(e) => e.stopPropagation()}
        >
          Browse files
        </Button>
      </div>

      {/* Selected file list — clickable to remove. */}
      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-200 text-[12px]"
            >
              <span className="flex items-center gap-2 min-w-0">
                <FileText className="size-3.5 text-gray-500 shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="text-gray-400 shrink-0">
                  {formatBytes(f.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Rejection list — shows why files were rejected. */}
      {rejections.length > 0 && (
        <ul className="mt-3 space-y-1">
          {rejections.map((r, i) => (
            <li
              key={i}
              className="flex items-center gap-1.5 text-[11px] text-red-600"
            >
              <AlertCircle className="size-3 shrink-0" />
              <span className="truncate">
                <strong>{r.file.name}</strong> — {r.errors[0]?.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
