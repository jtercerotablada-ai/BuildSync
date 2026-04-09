"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  FileText,
  Upload,
  Search,
  File,
  Image,
  FileSpreadsheet,
} from "lucide-react";

interface Document {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  projectId: string;
  projectName: string;
  uploaderName: string;
}

interface Project {
  id: string;
  name: string;
  canUpload: boolean;
}

interface DocumentListProps {
  documents: Document[];
  projects: Project[];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv")) return FileSpreadsheet;
  if (mimeType.includes("pdf")) return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileType(mimeType: string): string {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv")) return "Spreadsheet";
  if (mimeType.includes("document") || mimeType.includes("word")) return "Document";
  if (mimeType.includes("dwg") || mimeType.includes("autocad")) return "Drawing";
  return "File";
}

export function DocumentList({ documents, projects }: DocumentListProps) {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase());
    const matchesProject = projectFilter === "all" || doc.projectId === projectFilter;
    return matchesSearch && matchesProject;
  });

  const uploadableProjects = projects.filter((p) => p.canUpload);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadProjectId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", uploadProjectId);

      const res = await fetch("/api/client/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setShowUpload(false);
        window.location.reload();
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-white/10 bg-[#151515] pl-9 text-white placeholder:text-white/30 focus-visible:ring-[#c9a84c]/30"
            />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-48 border-white/10 bg-[#151515] text-white">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#1a1a1a]">
              <SelectItem value="all" className="text-white">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-white">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {uploadableProjects.length > 0 && (
          <Button
            onClick={() => setShowUpload(true)}
            className="bg-[#c9a84c] text-black hover:bg-[#b8973f] font-medium"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Document list */}
      <Card className="border-white/10 bg-[#151515]">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-white/20 mb-3" />
              <p className="text-white/50">No documents found.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((doc) => {
                const Icon = getFileIcon(doc.mimeType);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#c9a84c]/10 flex-shrink-0">
                      <Icon className="h-5 w-5 text-[#c9a84c]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-white/40">
                        {formatSize(doc.size)} &middot; {doc.uploaderName} &middot;{" "}
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className="bg-white/5 text-white/50 border-0 text-[10px] hidden sm:inline-flex">
                      {doc.projectName}
                    </Badge>
                    <Badge className="bg-white/5 text-white/40 border-0 text-[10px] hidden md:inline-flex">
                      {getFileType(doc.mimeType)}
                    </Badge>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/40 hover:text-[#c9a84c] hover:bg-white/5"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="border-white/10 bg-[#1a1a1a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-white/70 mb-1.5 block">Project</label>
              <Select value={uploadProjectId} onValueChange={setUploadProjectId}>
                <SelectTrigger className="border-white/10 bg-[#151515] text-white">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1a1a1a]">
                  {uploadableProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-white">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1.5 block">File</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleUpload}
                disabled={!uploadProjectId || uploading}
                className="block w-full text-sm text-white/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#c9a84c] file:text-black hover:file:bg-[#b8973f] cursor-pointer"
              />
            </div>
            {uploading && (
              <p className="text-sm text-[#c9a84c]">Uploading...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
