"use client";

/**
 * FileViewerModal — full-screen in-app viewer for any attachment in
 * the system. Renders the file inline when the browser can handle it
 * natively (images, PDFs, plain text, audio, video) and falls back
 * to Microsoft's Office Web Viewer for .docx/.xlsx/.pptx (the Vercel
 * Blob URL is public, which is what the Office viewer requires).
 *
 * Unknown / blocked types show a download CTA instead of a broken
 * preview pane.
 *
 * The viewer also supports list navigation: pass `files[]` + the
 * current index and the user can ←/→ through every attachment
 * without having to close + reopen the modal each time.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Paperclip,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ViewerFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt?: string;
  task?: {
    id: string;
    name: string;
    project?: { id: string; name: string; color: string } | null;
  } | null;
  uploader?: { id: string; name: string | null; image: string | null } | null;
}

interface Props {
  files: ViewerFile[];
  initialIndex: number;
  onClose: () => void;
  /** Hook for tasks page to open a task when the user clicks the badge. */
  onOpenTask?: (taskId: string) => void;
}

export function FileViewerModal({
  files,
  initialIndex,
  onClose,
  onOpenTask,
}: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const current = files[index];

  // Reset transform state every time the file changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [index]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : files.length - 1));
  }, [files.length]);
  const goNext = useCallback(() => {
    setIndex((i) => (i < files.length - 1 ? i + 1 : 0));
  }, [files.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && files.length > 1) {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" && files.length > 1) {
        e.preventDefault();
        goNext();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (e.key === "-") {
        setZoom((z) => Math.max(z - 0.25, 0.25));
      } else if (e.key === "0") {
        setZoom(1);
        setRotation(0);
      } else if (e.key.toLowerCase() === "r") {
        setRotation((r) => (r + 90) % 360);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose, files.length]);

  // Lock body scroll while the viewer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/10 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Paperclip className="h-4 w-4 text-white/60 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={current.name}>
              {current.name}
            </p>
            <p className="text-[11px] text-white/60 font-mono tabular-nums flex items-center gap-2">
              <span>{formatBytes(current.size)}</span>
              {current.createdAt && (
                <>
                  <span className="text-white/30">·</span>
                  <span>
                    {new Date(current.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
              {current.task && (
                <>
                  <span className="text-white/30">·</span>
                  {onOpenTask ? (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenTask(current.task!.id);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 hover:text-white truncate"
                    >
                      {current.task.project && (
                        <span
                          className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: current.task.project.color,
                          }}
                        />
                      )}
                      <span className="truncate">{current.task.name}</span>
                    </button>
                  ) : (
                    <Link
                      href={`/tasks/${current.task.id}`}
                      className="inline-flex items-center gap-1 hover:text-white truncate"
                    >
                      {current.task.project && (
                        <span
                          className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: current.task.project.color,
                          }}
                        />
                      )}
                      <span className="truncate">{current.task.name}</span>
                    </Link>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Transform controls — only for images */}
        {current.mimeType.startsWith("image/") && (
          <div className="hidden md:flex items-center gap-1 pr-2 border-r border-white/10">
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
              className="h-8 w-8 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md"
              title="Zoom out (−)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-mono tabular-nums w-12 text-center text-white/70">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
              className="h-8 w-8 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md"
              title="Zoom in (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="h-8 w-8 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md"
              title="Rotate (R)"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        )}

        {files.length > 1 && (
          <span className="text-[11px] font-mono tabular-nums text-white/60 hidden sm:inline">
            {index + 1} / {files.length}
          </span>
        )}

        <a
          href={current.url}
          download={current.name}
          className="h-8 w-8 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </a>
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 w-8 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          onClick={onClose}
          className="h-8 w-8 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={(e) => {
          // Click outside the preview content closes the modal
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <FilePreviewSurface
          file={current}
          zoom={zoom}
          rotation={rotation}
          onClickBackdrop={onClose}
        />

        {/* Nav arrows */}
        {files.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors"
              title="Previous (←)"
              aria-label="Previous file"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors"
              title="Next (→)"
              aria-label="Next file"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip (only when multiple) */}
      {files.length > 1 && files.length <= 30 && (
        <div
          className="border-t border-white/10 bg-black/40 px-4 py-2 flex items-center gap-2 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {files.map((f, i) => {
            const isImg = f.mimeType.startsWith("image/");
            return (
              <button
                key={f.id}
                onClick={() => setIndex(i)}
                className={cn(
                  "flex-shrink-0 w-14 h-14 rounded-md border-2 overflow-hidden bg-white/5 flex items-center justify-center transition-all",
                  i === index
                    ? "border-[#c9a84c]"
                    : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
                )}
                title={f.name}
              >
                {isImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.url}
                    alt={f.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[9px] font-mono font-bold text-white/70 uppercase">
                    {(f.name.split(".").pop() ?? "?").slice(0, 4)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Renders the actual preview surface for one file. Branching here so
 * the parent stays clean of mime-type if/else chains.
 */
function FilePreviewSurface({
  file,
  zoom,
  rotation,
  onClickBackdrop,
}: {
  file: ViewerFile;
  zoom: number;
  rotation: number;
  onClickBackdrop: () => void;
}) {
  const mt = file.mimeType;
  const isImage = mt.startsWith("image/");
  const isPdf = mt === "application/pdf";
  const isVideo = mt.startsWith("video/");
  const isAudio = mt.startsWith("audio/");
  const isText = useMemo(
    () =>
      mt === "text/plain" ||
      mt === "text/csv" ||
      mt === "application/json" ||
      mt === "text/markdown",
    [mt]
  );
  const isOffice = useMemo(() => {
    // Microsoft Office Online Viewer handles docx/xlsx/pptx (legacy
    // .doc/.xls/.ppt are flaky; let them fall back to download).
    const officeMimes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    return officeMimes.includes(mt);
  }, [mt]);

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file.url}
        alt={file.name}
        className="max-w-[95vw] max-h-[80vh] object-contain transition-transform duration-150 select-none"
        style={{
          transform: `scale(${zoom}) rotate(${rotation}deg)`,
        }}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (isPdf) {
    return (
      <iframe
        src={`${file.url}#toolbar=1&navpanes=0`}
        title={file.name}
        className="w-[95vw] h-[85vh] bg-white rounded-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (isVideo) {
    return (
      <video
        src={file.url}
        controls
        className="max-w-[95vw] max-h-[85vh] rounded-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (isAudio) {
    return (
      <div
        className="bg-white rounded-xl p-6 shadow-2xl min-w-[320px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-black mb-3 truncate">
          {file.name}
        </p>
        <audio src={file.url} controls className="w-full" />
      </div>
    );
  }

  if (isText) {
    return <TextPreview url={file.url} />;
  }

  if (isOffice) {
    return (
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
          file.url
        )}`}
        title={file.name}
        className="w-[95vw] h-[85vh] bg-white rounded-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  // Unknown / unsupported — show download CTA
  return (
    <div
      className="text-center text-white max-w-md px-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-20 h-24 rounded-md bg-white/10 border border-white/20 flex flex-col items-center justify-center mx-auto mb-4">
        <span className="text-[11px] font-mono font-bold tracking-wider text-white/80">
          {(file.name.split(".").pop() ?? "FILE").toUpperCase().slice(0, 4)}
        </span>
      </div>
      <p className="text-base font-medium mb-1">
        Preview not available for this file type.
      </p>
      <p className="text-sm text-white/60 mb-5">
        Download it to open in the original application.
      </p>
      <a
        href={file.url}
        download={file.name}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#c9a84c] hover:bg-[#a8893a] text-black font-medium text-sm transition-colors"
      >
        <Download className="h-4 w-4" />
        Download {formatBytes(file.size)}
      </a>
      {/* Backdrop is the only way to close from here; keep it as a no-op so
          eslint doesn't complain about unused prop. */}
      <button type="button" className="hidden" onClick={onClickBackdrop} />
    </div>
  );
}

/**
 * Fetches the raw bytes of a text file and renders them in a
 * monospace pane. Stops at 200 KB so a huge CSV doesn't lock the
 * browser; bigger files get a download CTA instead.
 */
function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooLarge, setTooLarge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    setTooLarge(false);
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const cl = Number(r.headers.get("content-length") || "0");
        if (cl > 200 * 1024) {
          setTooLarge(true);
          return;
        }
        const text = await r.text();
        if (!cancelled) setContent(text);
      })
      .catch((e) => !cancelled && setError(e.message || "Failed to load"));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (tooLarge) {
    return (
      <div
        className="text-center text-white max-w-md px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-medium mb-1">File is too large to preview.</p>
        <p className="text-sm text-white/60 mb-5">
          Download it to inspect locally.
        </p>
        <a
          href={url}
          download
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#c9a84c] hover:bg-[#a8893a] text-black font-medium text-sm transition-colors"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-white text-sm">
        Couldn&apos;t load preview: {error}
      </div>
    );
  }

  if (content === null) {
    return <Loader2 className="h-6 w-6 animate-spin text-white/60" />;
  }

  return (
    <pre
      className="w-[95vw] max-w-4xl h-[85vh] overflow-auto bg-white rounded-md p-4 text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </pre>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
