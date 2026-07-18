"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  File,
  FileText,
  Download,
  MessageSquare,
  Image as ImageIcon,
  Film,
  Music,
  FileSpreadsheet,
  Trash2,
  Loader2,
  Link2,
  LayoutGrid,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface FileAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  taskId: string | null;
  taskName: string | null;
  messageId: string | null;
  source: "task" | "message" | "resource";
  /** For source "resource": whether it's an uploaded FILE or an external LINK. */
  resourceType?: "FILE" | "LINK" | null;
  uploader: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

type FileType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "spreadsheet"
  | "other";

interface Section {
  id: string;
  name: string;
  tasks: {
    id: string;
    name: string;
    _count: {
      attachments: number;
    };
  }[];
}

interface FilesViewProps {
  sections: Section[];
  projectId: string;
}

// ============================================
// HELPERS
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileType(mimeType: string): FileType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  )
    return "spreadsheet";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text/") ||
    // Legacy Office (msword, ppt) + presentations were mis-bucketed as "other".
    mimeType.includes("msword") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes("presentation")
  )
    return "document";
  return "other";
}

function getFileIcon(type: FileType) {
  switch (type) {
    case "image":
      return <ImageIcon className="w-7 h-7 text-slate-400" />;
    case "video":
      return <Film className="w-7 h-7 text-slate-400" />;
    case "audio":
      return <Music className="w-7 h-7 text-slate-400" />;
    case "document":
      return <FileText className="w-7 h-7 text-slate-400" />;
    case "spreadsheet":
      return <FileSpreadsheet className="w-7 h-7 text-slate-400" />;
    default:
      return <File className="w-7 h-7 text-slate-400" />;
  }
}

// ============================================
// MAIN COMPONENT — Asana's Archivos: a plain attachment gallery, no
// toolbar. Every attachment from the project's tasks AND messages,
// newest first, tiles in the measured Asana card language.
// ============================================

export function FilesView({ projectId }: FilesViewProps) {
  const router = useRouter();
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchFiles() {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch(`/api/projects/${projectId}/attachments`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setFiles(data);
      } catch (error) {
        console.error("Error fetching files:", error);
        // Distinguish "load failed" from "no files" — otherwise a fetch
        // failure showed the same empty state that claims the project has
        // no attachments.
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchFiles();
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const isLink = (file: FileAttachment) =>
    file.source === "resource" && file.resourceType === "LINK";

  const handleDownload = (file: FileAttachment) => {
    if (!file.url) return;
    // A "Key resources" LINK is an external URL, not a blob — just open it.
    if (isLink(file)) {
      window.open(file.url, "_blank", "noopener,noreferrer");
      return;
    }
    // Force a download instead of opening a preview tab. Vercel Blob serves
    // browser-renderable types inline, so window.open just previewed them;
    // `?download=1` (and the download attr) makes it save to disk.
    const sep = file.url.includes("?") ? "&" : "?";
    const a = document.createElement("a");
    a.href = `${file.url}${sep}download=1`;
    a.download = file.name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (file: FileAttachment) => {
    // Deletable when it's a task attachment OR an Overview key resource.
    const endpoint =
      file.source === "resource"
        ? `/api/projects/${projectId}/resources/${file.id}`
        : file.taskId
          ? `/api/tasks/${file.taskId}/attachments/${file.id}`
          : null;
    if (!endpoint) return;
    if (!confirm(`Delete "${file.name}"?`)) return;

    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
        toast.success(isLink(file) ? "Link removed" : "File deleted");
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const openSource = (file: FileAttachment) => {
    if (file.source === "resource") {
      router.push(`/projects/${projectId}?view=overview`);
    } else if (file.taskId) {
      window.open(`/tasks/${file.taskId}`, "_blank");
    } else if (file.messageId) {
      router.push(
        `/projects/${projectId}?view=messages&message=${file.messageId}`
      );
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-[400px] gap-3">
        <p className="text-sm text-slate-500">Couldn&apos;t load files.</p>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {files.map((file) => (
            <FileCard
              key={`${file.source}-${file.id}`}
              file={file}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onOpenSource={openSource}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE — Asana's: illustration + one centered line, nothing else.
// ============================================

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white min-h-full">
      <div className="text-center max-w-md px-6">
        <FilesIllustration />
        <h3 className="text-base font-medium text-slate-900">
          All files from this project&apos;s tasks, messages and key resources
          will appear here
        </h3>
      </div>
    </div>
  );
}

function FilesIllustration() {
  return (
    <div className="relative w-28 h-28 mx-auto mb-6">
      <div className="absolute top-0 right-0 w-16 h-20 bg-white rounded-lg border-2 border-[#DE5F73] shadow-sm overflow-hidden">
        <div className="p-1.5 border-b border-[#FBE9EC]">
          <div className="flex items-center gap-1">
            <div className="w-4 h-2.5 bg-[#FBE9EC] rounded-sm" />
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-[#DE5F73]" />
              <div className="w-1 h-1 rounded-full bg-[#DE5F73]" />
            </div>
          </div>
        </div>
        <div className="p-1.5 space-y-1">
          <div className="h-1 bg-[#FBE9EC] rounded-full w-full" />
          <div className="h-1 bg-[#FBE9EC] rounded-full w-full" />
          <div className="h-1 bg-[#FBE9EC] rounded-full w-2/3" />
        </div>
      </div>
      <div className="absolute top-6 left-2 w-12 h-10 bg-[#FBE9EC] rounded-lg border-2 border-[#DE5F73] shadow-sm flex items-center justify-center">
        <ImageIcon className="w-5 h-5 text-[#DE5F73]" />
      </div>
      <div className="absolute bottom-0 left-0 w-8 h-10 bg-white rounded-lg border-2 border-[#DE5F73] shadow-sm transform -rotate-12 overflow-hidden">
        <div className="p-1 space-y-0.5">
          <div className="h-0.5 bg-[#FBE9EC] rounded-full w-full" />
          <div className="h-0.5 bg-[#FBE9EC] rounded-full w-3/4" />
          <div className="h-0.5 bg-[#FBE9EC] rounded-full w-1/2" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// FILE TILE — Asana card language: white, 8px radius, #E0E1E3 ring,
// preview area, name, "size · date", source link (task or message).
// ============================================

function FileCard({
  file,
  onDownload,
  onDelete,
  onOpenSource,
}: {
  file: FileAttachment;
  onDownload: (f: FileAttachment) => void;
  onDelete: (f: FileAttachment) => void;
  onOpenSource: (f: FileAttachment) => void;
}) {
  const isLink = file.source === "resource" && file.resourceType === "LINK";
  const isResource = file.source === "resource";
  const fileType = getFileType(file.mimeType);
  const isImage = fileType === "image" && !isLink;
  const deletable = isResource || !!file.taskId;

  return (
    <div className="group relative border border-[#E0E1E3] rounded-[8px] overflow-hidden bg-white hover:shadow-md transition-shadow cursor-pointer">
      <div
        className="aspect-[4/3] flex items-center justify-center bg-[#F2F3F4]"
        onClick={() => onDownload(file)}
      >
        {isImage && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={file.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : isLink ? (
          <Link2 className="w-7 h-7 text-slate-400" />
        ) : (
          getFileIcon(fileType)
        )}
      </div>
      <div className="p-3">
        <p
          className="text-sm font-medium text-slate-900 truncate"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {isLink
            ? `Link · ${format(new Date(file.createdAt), "MMM d")}`
            : `${formatFileSize(file.size)} · ${format(
                new Date(file.createdAt),
                "MMM d"
              )}`}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSource(file);
          }}
          className="flex items-center gap-1 text-xs text-[#335FB5] mt-1 truncate max-w-full hover:underline"
          title={
            isResource
              ? "Open in Overview"
              : file.source === "message"
                ? "Open message"
                : file.taskName || "Open task"
          }
        >
          {file.source === "message" ? (
            <>
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Message</span>
            </>
          ) : isResource ? (
            <>
              <LayoutGrid className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Key resources</span>
            </>
          ) : (
            <span className="truncate">{file.taskName}</span>
          )}
        </button>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          className="p-1.5 bg-white rounded shadow hover:bg-slate-50"
          title={isLink ? "Open link" : "Download"}
          onClick={(e) => {
            e.stopPropagation();
            onDownload(file);
          }}
        >
          {isLink ? (
            <ExternalLink className="w-3 h-3 text-slate-600" />
          ) : (
            <Download className="w-3 h-3 text-slate-600" />
          )}
        </button>
        {deletable && (
          <button
            className="p-1.5 bg-white rounded shadow hover:bg-slate-50"
            title={isLink ? "Remove link" : "Delete"}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file);
            }}
          >
            <Trash2 className="w-3 h-3 text-slate-600" />
          </button>
        )}
      </div>
    </div>
  );
}
