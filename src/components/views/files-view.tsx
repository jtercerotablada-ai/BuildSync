"use client";

import { useState, useMemo } from "react";
import {
  File,
  FileText,
  Download,
  ExternalLink,
  MoreHorizontal,
  Grid,
  List,
  Search,
  Upload,
  Image,
  Film,
  Music,
  FileSpreadsheet,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ============================================
// TYPES
// ============================================

interface FileAttachment {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "document" | "spreadsheet" | "presentation" | "other";
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
  uploadedBy: {
    id: string;
    name: string;
    initials: string;
    color: string;
  };
  taskId?: string;
  taskName?: string;
  messageId?: string;
}

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

function getFileIcon(type: FileAttachment["type"]) {
  switch (type) {
    case "image":
      return <Image className="w-6 h-6 text-black" />;
    case "video":
      return <Film className="w-6 h-6 text-black" />;
    case "audio":
      return <Music className="w-6 h-6 text-black" />;
    case "document":
      return <FileText className="w-6 h-6 text-black" />;
    case "spreadsheet":
      return <FileSpreadsheet className="w-6 h-6 text-black" />;
    case "presentation":
      return <Presentation className="w-6 h-6 text-black" />;
    default:
      return <File className="w-6 h-6 text-gray-500" />;
  }
}

function getFileTypeColor(type: FileAttachment["type"]) {
  switch (type) {
    case "image":
      return "bg-white";
    case "video":
      return "bg-white";
    case "audio":
      return "bg-white";
    case "document":
      return "bg-white";
    case "spreadsheet":
      return "bg-emerald-50";
    case "presentation":
      return "bg-white";
    default:
      return "bg-gray-50";
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FilesView({ sections, projectId }: FilesViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Sample data - empty to show empty state first
  // In production, this would come from API based on project attachments
  const [files] = useState<FileAttachment[]>([
    // Uncomment to see with files:
    /*
    {
      id: "1",
      name: "Design Mockup.png",
      type: "image",
      size: 2456000,
      url: "#",
      thumbnailUrl: "/api/placeholder/200/150",
      uploadedAt: new Date(2025, 0, 5),
      uploadedBy: { id: "1", name: "Juan Tercero", initials: "JT", color: "#FBBF24" },
      taskId: "t1",
      taskName: "Create UI mockups",
    },
    {
      id: "2",
      name: "Project Requirements.pdf",
      type: "document",
      size: 1024000,
      url: "#",
      uploadedAt: new Date(2025, 0, 3),
      uploadedBy: { id: "2", name: "Maria Garcia", initials: "MG", color: "#EC4899" },
      taskId: "t2",
      taskName: "Document requirements",
    },
    {
      id: "3",
      name: "Budget 2025.xlsx",
      type: "spreadsheet",
      size: 512000,
      url: "#",
      uploadedAt: new Date(2025, 0, 7),
      uploadedBy: { id: "1", name: "Juan Tercero", initials: "JT", color: "#FBBF24" },
      taskId: "t3",
      taskName: "Budget planning",
    },
    {
      id: "4",
      name: "Demo Video.mp4",
      type: "video",
      size: 15728640,
      url: "#",
      thumbnailUrl: "/api/placeholder/200/150",
      uploadedAt: new Date(2025, 0, 8),
      uploadedBy: { id: "3", name: "Carlos Lopez", initials: "CL", color: "#3B82F6" },
    },
    */
  ]);

  // Filter files
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !selectedType || file.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [files, searchQuery, selectedType]);

  // If no files, show empty state
  if (files.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Toolbar */}
      <div className="sticky top-0 bg-white border-b px-6 py-3 z-10">
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-3">
            {/* Search */}
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

            {/* Filter by type */}
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
              <option value="presentation">Presentations</option>
            </select>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center border rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "grid" ? "bg-gray-100" : "hover:bg-gray-50"
                )}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === "list" ? "bg-gray-100" : "hover:bg-gray-50"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
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
          <FilesGrid files={filteredFiles} />
        ) : (
          <FilesList files={filteredFiles} />
        )}
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE - UNIFORM WHITE BACKGROUND
// ============================================

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-white min-h-full">
      <div className="text-center max-w-md">
        {/* Illustration - Asana style with red/coral colors */}
        <FilesIllustration />

        {/* Text */}
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          All task and message attachments from this project will appear here
        </h3>
        <p className="text-sm text-gray-500">
          Upload files to tasks or messages and they'll be collected here automatically.
        </p>
      </div>
    </div>
  );
}

// ============================================
// FILES ILLUSTRATION - ASANA STYLE (RED COLORS)
// ============================================

function FilesIllustration() {
  return (
    <div className="relative w-28 h-28 mx-auto mb-6">
      {/* Main document (back, top-right) */}
      <div className="absolute top-0 right-0 w-16 h-20 bg-white rounded-lg border-2 border-black shadow-sm overflow-hidden">
        {/* Header with mini card and dots */}
        <div className="p-1.5 border-b border-red-100">
          <div className="flex items-center gap-1">
            <div className="w-4 h-2.5 bg-white rounded-sm" />
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-black" />
              <div className="w-1 h-1 rounded-full bg-black" />
            </div>
          </div>
        </div>
        {/* Content lines */}
        <div className="p-1.5 space-y-1">
          <div className="h-1 bg-white rounded-full w-full" />
          <div className="h-1 bg-white rounded-full w-full" />
          <div className="h-1 bg-white rounded-full w-2/3" />
        </div>
      </div>

      {/* Image card (middle, with cursor) */}
      <div className="absolute top-6 left-2 w-12 h-10 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border-2 border-black shadow-sm flex items-center justify-center">
        {/* Cursor/click icon */}
        <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.64,21.97C13.14,22.21 12.54,22 12.31,21.5L10.13,16.76L7.62,18.78C7.45,18.92 7.24,19 7.02,19C6.55,19 6.16,18.61 6.16,18.14V5.86C6.16,5.39 6.55,5 7.02,5C7.24,5 7.45,5.08 7.62,5.22L18.09,13.81C18.45,14.09 18.53,14.61 18.25,14.97C18.09,15.18 17.84,15.31 17.57,15.31H14.43L16.61,20.05C16.85,20.55 16.64,21.15 16.14,21.39L13.64,21.97Z"/>
        </svg>
      </div>

      {/* Small document (front, bottom-left, rotated) */}
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

function FilesGrid({ files }: { files: FileAttachment[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {files.map((file) => (
        <FileCard key={file.id} file={file} />
      ))}
    </div>
  );
}

function FileCard({ file }: { file: FileAttachment }) {
  return (
    <div className="group relative border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      {/* Preview */}
      <div
        className={cn(
          "aspect-[4/3] flex items-center justify-center",
          getFileTypeColor(file.type)
        )}
      >
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          getFileIcon(file.type)
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {formatFileSize(file.size)} · {format(file.uploadedAt, "MMM d")}
        </p>

        {file.taskName && (
          <p className="text-xs text-black mt-1 truncate">{file.taskName}</p>
        )}
      </div>

      {/* Hover Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button className="p-1.5 bg-white rounded shadow hover:bg-gray-50">
          <Download className="w-3 h-3 text-gray-600" />
        </button>
        <button className="p-1.5 bg-white rounded shadow hover:bg-gray-50">
          <ExternalLink className="w-3 h-3 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// LIST VIEW
// ============================================

function FilesList({ files }: { files: FileAttachment[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
        <div className="col-span-5">Name</div>
        <div className="col-span-2">Size</div>
        <div className="col-span-2">Uploaded</div>
        <div className="col-span-2">Task</div>
        <div className="col-span-1"></div>
      </div>

      {/* Rows */}
      {files.map((file) => (
        <div
          key={file.id}
          className="grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer items-center"
        >
          {/* Name */}
          <div className="col-span-5 flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                getFileTypeColor(file.type)
              )}
            >
              {getFileIcon(file.type)}
            </div>
            <span className="text-sm font-medium text-gray-900 truncate">
              {file.name}
            </span>
          </div>

          {/* Size */}
          <div className="col-span-2 text-sm text-gray-500">
            {formatFileSize(file.size)}
          </div>

          {/* Uploaded */}
          <div className="col-span-2 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: file.uploadedBy.color }}
            >
              {file.uploadedBy.initials}
            </div>
            <span className="text-sm text-gray-500">
              {format(file.uploadedAt, "MMM d")}
            </span>
          </div>

          {/* Task */}
          <div className="col-span-2">
            {file.taskName && (
              <span className="text-sm text-black truncate">{file.taskName}</span>
            )}
          </div>

          {/* Actions */}
          <div className="col-span-1 flex justify-end">
            <button className="p-1 hover:bg-gray-100 rounded">
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
