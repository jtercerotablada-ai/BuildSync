"use client";

import { useState, useMemo, useEffect } from "react";
import {
  File,
  FileText,
  Download,
  ExternalLink,
  MoreHorizontal,
  Grid,
  List,
  Search,
  Image,
  Film,
  Music,
  FileSpreadsheet,
  Presentation,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  uploader: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

type FileType = "image" | "video" | "audio" | "document" | "spreadsheet" | "other";

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

type ViewMode = "grid" | "list";

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
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "spreadsheet";
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text/")) return "document";
  return "other";
}

function getFileIcon(type: FileType) {
  switch (type) {
    case "image":
      return <Image className="w-6 h-6 text-[#a8893a]" />;
    case "video":
      return <Film className="w-6 h-6 text-black" />;
    case "audio":
      return <Music className="w-6 h-6 text-[#a8893a]" />;
    case "document":
      return <FileText className="w-6 h-6 text-black" />;
    case "spreadsheet":
      return <FileSpreadsheet className="w-6 h-6 text-[#a8893a]" />;
    default:
      return <File className="w-6 h-6 text-gray-500" />;
  }
}

function getFileTypeColor(type: FileType) {
  switch (type) {
    case "image": return "bg-[#c9a84c]/10";
    case "video": return "bg-gray-100";
    case "audio": return "bg-[#a8893a]/10";
    case "document": return "bg-gray-100";
    case "spreadsheet": return "bg-[#c9a84c]/10";
    default: return "bg-gray-50";
  }
}

function getUploaderInitials(uploader: FileAttachment["uploader"]): string {
  if (!uploader) return "?";
  const name = uploader.name || uploader.email || "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FilesView({ sections, projectId }: FilesViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFiles() {
      try {
        const res = await fetch(`/api/projects/${projectId}/attachments`);
        if (res.ok) {
          const data = await res.json();
          setFiles(data);
        }
      } catch (error) {
        console.error("Error fetching files:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFiles();
  }, [projectId]);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      const fileType = getFileType(file.mimeType);
      const matchesType = !selectedType || fileType === selectedType;
      return matchesSearch && matchesType;
    });
  }, [files, searchQuery, selectedType]);

  const handleDownload = (file: FileAttachment) => {
    if (file.url) {
      window.open(file.url, "_blank");
    }
  };

  const handleDelete = async (file: FileAttachment) => {
    if (!file.taskId) return;
    if (!confirm(`Delete "${file.name}"?`)) return;

    try {
      const res = await fetch(`/api/tasks/${file.taskId}/attachments/${file.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== file.id));
        toast.success("File deleted");
      } else {
        toast.error("Failed to delete file");
      }
    } catch {
      toast.error("Failed to delete file");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (files.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Toolbar */}
      <div className="sticky top-0 bg-white border-b px-6 py-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedType || ""}
              onChange={(e) => setSelectedType(e.target.value || null)}
              className="px-3 py-2 border rounded-lg text-sm outline-none"
            >
              <option value="">All types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="document">Documents</option>
              <option value="spreadsheet">Spreadsheets</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-2 transition-colors", viewMode === "grid" ? "bg-gray-100" : "hover:bg-gray-50")}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-2 transition-colors", viewMode === "list" ? "bg-gray-100" : "hover:bg-gray-50")}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Files Content */}
      <div className="p-6">
        {filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No files match your search</p>
          </div>
        ) : viewMode === "grid" ? (
          <FilesGrid files={filteredFiles} onDownload={handleDownload} onDelete={handleDelete} />
        ) : (
          <FilesList files={filteredFiles} onDownload={handleDownload} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white min-h-full">
      <div className="text-center max-w-md">
        <FilesIllustration />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          All task and message attachments from this project will appear here
        </h3>
        <p className="text-sm text-gray-500">
          Upload files to tasks or messages and they&apos;ll be collected here automatically.
        </p>
      </div>
    </div>
  );
}

function FilesIllustration() {
  return (
    <div className="relative w-28 h-28 mx-auto mb-6">
      <div className="absolute top-0 right-0 w-16 h-20 bg-white rounded-lg border-2 border-black shadow-sm overflow-hidden">
        <div className="p-1.5 border-b border-gray-200">
          <div className="flex items-center gap-1">
            <div className="w-4 h-2.5 bg-white rounded-sm" />
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-black" />
              <div className="w-1 h-1 rounded-full bg-black" />
            </div>
          </div>
        </div>
        <div className="p-1.5 space-y-1">
          <div className="h-1 bg-white rounded-full w-full" />
          <div className="h-1 bg-white rounded-full w-full" />
          <div className="h-1 bg-white rounded-full w-2/3" />
        </div>
      </div>
      <div className="absolute top-6 left-2 w-12 h-10 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border-2 border-black shadow-sm flex items-center justify-center">
        <File className="w-5 h-5 text-black" />
      </div>
      <div className="absolute bottom-0 left-0 w-8 h-10 bg-white rounded-lg border-2 border-black shadow-sm transform -rotate-12 overflow-hidden">
        <div className="p-1 space-y-0.5">
          <div className="h-0.5 bg-gray-300 rounded-full w-full" />
          <div className="h-0.5 bg-gray-300 rounded-full w-3/4" />
          <div className="h-0.5 bg-gray-300 rounded-full w-1/2" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// GRID VIEW
// ============================================

interface FilesActionProps {
  files: FileAttachment[];
  onDownload: (file: FileAttachment) => void;
  onDelete: (file: FileAttachment) => void;
}

function FilesGrid({ files, onDownload, onDelete }: FilesActionProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {files.map((file) => (
        <FileCard key={file.id} file={file} onDownload={onDownload} onDelete={onDelete} />
      ))}
    </div>
  );
}

function FileCard({ file, onDownload, onDelete }: { file: FileAttachment; onDownload: (f: FileAttachment) => void; onDelete: (f: FileAttachment) => void }) {
  const fileType = getFileType(file.mimeType);
  const isImage = fileType === "image";

  return (
    <div className="group relative border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      <div
        className={cn("aspect-[4/3] flex items-center justify-center", getFileTypeColor(fileType))}
        onClick={() => onDownload(file)}
      >
        {isImage && file.url ? (
          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          getFileIcon(fileType)
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {formatFileSize(file.size)} · {format(new Date(file.createdAt), "MMM d")}
        </p>
        {file.taskName && (
          <p className="text-xs text-[#a8893a] mt-1 truncate">{file.taskName}</p>
        )}
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          onClick={(e) => { e.stopPropagation(); onDownload(file); }}
        >
          <Download className="w-3 h-3 text-gray-600" />
        </button>
        <button
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          onClick={(e) => { e.stopPropagation(); onDelete(file); }}
        >
          <Trash2 className="w-3 h-3 text-black" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// LIST VIEW
// ============================================

function FilesList({ files, onDownload, onDelete }: FilesActionProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
        <div className="col-span-5">Name</div>
        <div className="col-span-2">Size</div>
        <div className="col-span-2">Uploaded</div>
        <div className="col-span-2">Task</div>
        <div className="col-span-1"></div>
      </div>
      {files.map((file) => {
        const fileType = getFileType(file.mimeType);
        return (
          <div
            key={file.id}
            className="grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer items-center"
            onClick={() => onDownload(file)}
          >
            <div className="col-span-5 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", getFileTypeColor(fileType))}>
                {getFileIcon(fileType)}
              </div>
              <span className="text-sm font-medium text-gray-900 truncate">{file.name}</span>
            </div>
            <div className="col-span-2 text-sm text-gray-500">{formatFileSize(file.size)}</div>
            <div className="col-span-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-xs font-medium text-white">
                {getUploaderInitials(file.uploader)}
              </div>
              <span className="text-sm text-gray-500">{format(new Date(file.createdAt), "MMM d")}</span>
            </div>
            <div className="col-span-2">
              {file.taskName && (
                <span className="text-sm text-[#a8893a] truncate">{file.taskName}</span>
              )}
            </div>
            <div className="col-span-1 flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-gray-100 rounded" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(file); }}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(file); }} className="text-black">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
