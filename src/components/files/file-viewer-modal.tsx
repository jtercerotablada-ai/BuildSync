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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { downloadFile } from "@/lib/download";
import { toast } from "sonner";

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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const current = files[index];

  // Reset transform state every time the file changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [index]);

  // A fitted image has nothing to pan to, so any offset from an earlier
  // zoom is ignored until the user zooms back in.
  const effectivePan = zoom > 1 ? pan : { x: 0, y: 0 };

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
        setPan({ x: 0, y: 0 });
      } else if (e.key.toLowerCase() === "r") {
        setRotation((r) => (r + 90) % 360);
      } else if (e.key === "Tab") {
        // Keep Tab inside the viewer — the page behind is covered by an
        // opaque overlay, so focus landing there is focus lost.
        const root = containerRef.current;
        if (!root) return;
        // The preview surface itself is focusable (a PDF iframe, a video or
        // audio player), so it has to be a stop in this list — leave it out
        // and Tab just cycles the toolbar while the actual file stays
        // keyboard-unreachable.
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, video[controls], audio[controls], [contenteditable], [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const inside = !!active && root.contains(active);
        if (e.shiftKey && (!inside || active === first)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (!inside || active === last)) {
          e.preventDefault();
          first.focus();
        }
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

  // Move focus into the viewer on open and hand it back to whatever opened
  // it on close, so a keyboard user doesn't resume behind the overlay.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  if (!current) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`File preview: ${current.name}`}
      tabIndex={-1}
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

        <button
          type="button"
          onClick={async () => {
            try {
              await downloadFile(current.url, current.name);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Couldn't download file"
              );
            }
          }}
          className="h-8 w-8 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>
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
          ref={closeButtonRef}
          onClick={onClose}
          className="h-8 w-8 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-md"
          title="Close (Esc)"
          aria-label="Close file preview"
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
          pan={effectivePan}
          onPanChange={setPan}
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
  pan,
  onPanChange,
  onClickBackdrop,
}: {
  file: ViewerFile;
  zoom: number;
  rotation: number;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  onClickBackdrop: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  // A bare <img>/<iframe>/<video> gives the user nothing while the bytes are
  // in flight and nothing but a broken glyph when they never arrive, which is
  // the common case here: big scans over a slow line, or a stale blob URL.
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">(
    "loading"
  );
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

  // Once the image is scaled past its container the interesting part is
  // usually off-screen, so dragging is the only way to reach a corner of a
  // marked-up drawing. Travel is capped at the overflow so the image can
  // never be dragged out of sight. After a quarter turn the on-screen axes
  // are swapped, so the horizontal extent comes from the layout height and
  // the vertical one from the layout width.
  const clampPan = useCallback(
    (next: { x: number; y: number }) => {
      const el = imgRef.current;
      const box = el?.parentElement;
      if (!el || !box) return next;
      const quarterTurned = (rotation / 90) % 2 === 1;
      const spanX = (quarterTurned ? el.offsetHeight : el.offsetWidth) * zoom;
      const spanY = (quarterTurned ? el.offsetWidth : el.offsetHeight) * zoom;
      const maxX = Math.max(0, (spanX - box.clientWidth) / 2);
      const maxY = Math.max(0, (spanY - box.clientHeight) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [rotation, zoom]
  );

  // Zooming out or rotating shrinks that cap, and neither goes through the
  // drag handler. Without re-clamping here the stored offset stays at the
  // old scale and the picture renders parked past its own edge — a black
  // band on one side — until the next drag snaps it back.
  const panRef = useRef(pan);
  panRef.current = pan;
  useEffect(() => {
    if (!isImage) return;
    const clamped = clampPan(panRef.current);
    if (clamped.x !== panRef.current.x || clamped.y !== panRef.current.y) {
      onPanChange(clamped);
    }
  }, [clampPan, isImage, onPanChange]);

  useEffect(() => {
    setLoadState("loading");
  }, [file.url]);

  const spinner = (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <Loader2 className="h-8 w-8 animate-spin text-white/60" />
    </div>
  );

  const downloadFallback = (headline: string, sub: string) => (
    <div
      className="text-center text-white max-w-md px-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-20 h-24 rounded-md bg-white/10 border border-white/20 flex flex-col items-center justify-center mx-auto mb-4">
        <span className="text-[11px] font-mono font-bold tracking-wider text-white/80">
          {(file.name.split(".").pop() ?? "FILE").toUpperCase().slice(0, 4)}
        </span>
      </div>
      <p className="text-base font-medium mb-1">{headline}</p>
      <p className="text-sm text-white/60 mb-5">{sub}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await downloadFile(file.url, file.name);
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Couldn't download file"
            );
          }
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#c9a84c] hover:bg-[#a8893a] text-black font-medium text-sm transition-colors"
      >
        <Download className="h-4 w-4" />
        Download {formatBytes(file.size)}
      </button>
      {/* Backdrop is the only way to close from here; keep it as a no-op so
          eslint doesn't complain about unused prop. */}
      <button type="button" className="hidden" onClick={onClickBackdrop} />
    </div>
  );

  if (isImage) {
    const endDrag = (e: React.PointerEvent<HTMLImageElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
      setDragging(false);
    };
    if (loadState === "failed") {
      return downloadFallback(
        "This image couldn't be loaded.",
        "The file may have been moved or its link has expired."
      );
    }
    return (
      <>
      {loadState === "loading" && spinner}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={file.url}
        alt={file.name}
        onLoad={() => setLoadState("ready")}
        onError={() => setLoadState("failed")}
        className={cn(
          "max-w-[95vw] max-h-[80vh] object-contain duration-150 select-none",
          !dragging && "transition-transform",
          loadState !== "ready" && "opacity-0",
          zoom > 1 && (dragging ? "cursor-grabbing" : "cursor-grab")
        )}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          // While zoomed the gesture is ours; otherwise the browser can claim
          // it for its own scroll/pinch mid-drag.
          touchAction: zoom > 1 ? "none" : undefined,
        }}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          // A second finger coming down to pinch must not take over the drag
          // already in flight — its coordinates would yank the image sideways.
          if (dragRef.current) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          dragRef.current = {
            pointerId: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            panX: pan.x,
            panY: pan.y,
          };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const start = dragRef.current;
          if (!start || start.pointerId !== e.pointerId) return;
          onPanChange(
            clampPan({
              x: start.panX + (e.clientX - start.x),
              y: start.panY + (e.clientY - start.y),
            })
          );
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      </>
    );
  }

  if (isPdf) {
    return (
      <>
        {loadState === "loading" && spinner}
        <iframe
          src={`${file.url}#toolbar=1&navpanes=0`}
          title={file.name}
          className="w-[95vw] h-[85vh] bg-white rounded-md shadow-2xl"
          onLoad={() => setLoadState("ready")}
          onClick={(e) => e.stopPropagation()}
        />
      </>
    );
  }

  if (isVideo) {
    if (loadState === "failed") {
      return downloadFallback(
        "This video couldn't be played.",
        "The file may have been moved or its format isn't supported here."
      );
    }
    return (
      <>
        {loadState === "loading" && spinner}
        <video
          src={file.url}
          controls
          className={cn(
            "max-w-[95vw] max-h-[85vh] rounded-md shadow-2xl",
            loadState !== "ready" && "opacity-0"
          )}
          onLoadedData={() => setLoadState("ready")}
          onError={() => setLoadState("failed")}
          onClick={(e) => e.stopPropagation()}
        />
      </>
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
      <>
        {loadState === "loading" && spinner}
        <iframe
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
            file.url
          )}`}
          title={file.name}
          className="w-[95vw] h-[85vh] bg-white rounded-md shadow-2xl"
          onLoad={() => setLoadState("ready")}
          onClick={(e) => e.stopPropagation()}
        />
      </>
    );
  }

  // Unknown / unsupported — show download CTA
  return downloadFallback(
    "Preview not available for this file type.",
    "Download it to open in the original application."
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
        <button
          type="button"
          onClick={async () => {
            try {
              await downloadFile(url, "download");
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Couldn't download file"
              );
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#c9a84c] hover:bg-[#a8893a] text-black font-medium text-sm transition-colors"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
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
