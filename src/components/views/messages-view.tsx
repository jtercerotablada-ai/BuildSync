"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Send,
  Smile,
  Link2,
  MoreHorizontal,
  Pin,
  Pencil,
  Trash2,
  MessageSquare,
  Loader2,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileViewerModal } from "@/components/files/file-viewer-modal";
import { downloadFile } from "@/lib/download";

/**
 * Project messages view — the team channel that lives on every
 * project. Backed by the real /api/projects/:id/messages endpoint.
 *
 * Features wired:
 *  - Fetch on mount, sorted chronologically with newest at the
 *    bottom (chat convention).
 *  - Send via POST with optimistic insert + rollback on error.
 *  - Edit own messages inline.
 *  - Delete own messages (or any if you're project owner/ADMIN).
 *  - Pin any message; pinned messages sort to the top.
 *  - Reactions with 6 quick emojis; click again to un-react.
 *  - Tab is visible to: ⌘/Ctrl+Enter sends; Shift+Enter newline.
 */

// ─── Types ─────────────────────────────────────────────────────

interface MessageReaction {
  emoji: string;
  count: number;
  users: { id: string; name: string | null }[];
  mine: boolean;
}

interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

interface MessageRow {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
  mine: boolean;
}

interface MessagesViewProps {
  sections: { id: string; name: string; tasks: unknown[] }[];
  projectId: string;
  projectName?: string;
  projectColor?: string;
  projectStatus?: string;
  currentUser?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

// Six quick reactions matching the rest of the cockpit (gold-aligned
// where it makes sense). Picker lets users add any other emoji.
const QUICK_EMOJIS = ["👍", "🎉", "✅", "🚀", "👀", "💡"];

// ─── Component ─────────────────────────────────────────────────

export function MessagesView({
  projectId,
  currentUser,
}: MessagesViewProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pending files staged in the composer — uploaded after the
  // message POST returns the new id. Held as raw File objects so we
  // can preview the name/size before the network round-trip.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Tracks per-message in-flight attachment uploads (after the
  // message exists). Used to render an inline upload counter on the
  // message body while files are still in transit.
  const [uploadingByMessage, setUploadingByMessage] = useState<
    Record<string, number>
  >({});

  // Full-screen viewer state. files[index] is rendered with prev/next
  // navigation across all attachments of the same message.
  const [viewer, setViewer] = useState<{
    messageId: string;
    index: number;
  } | null>(null);

  // ── Fetch on mount ──────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`);
      if (!res.ok) throw new Error("Failed to load");
      const data: MessageRow[] = await res.json();
      // API returns newest-first; we display newest-last (chat style)
      // so flip the array. Pinned messages always render at the top
      // regardless of date.
      const sorted = Array.isArray(data) ? [...data].reverse() : [];
      setMessages(sorted);
    } catch {
      toast.error("Couldn't load messages");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // ── Upload one file to an existing message ─────────────
  // Used both during initial send (for pendingFiles) and from the
  // hover-add UI on existing messages (future surface). Updates the
  // attachments array on the target message as each upload returns.
  const uploadFileToMessage = useCallback(
    async (messageId: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      setUploadingByMessage((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] || 0) + 1,
      }));
      try {
        const res = await fetch(
          `/api/messages/${messageId}/attachments`,
          {
            method: "POST",
            body: fd,
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Upload failed");
        }
        const created: MessageAttachment = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, attachments: [...m.attachments, created] }
              : m
          )
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `${file.name}: ${err.message}`
            : `${file.name}: upload failed`
        );
      } finally {
        setUploadingByMessage((prev) => {
          const next = { ...prev };
          const remaining = (next[messageId] || 1) - 1;
          if (remaining <= 0) delete next[messageId];
          else next[messageId] = remaining;
          return next;
        });
      }
    },
    []
  );

  // ── Send ────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = newContent.trim();
    const files = pendingFiles;
    if ((!content && files.length === 0) || sending) return;

    // If the user sent only files (no text), use a single-character
    // placeholder so the schema-mandated content.min(1) passes. The
    // attachments themselves are the message; this keeps the API
    // contract simple without relaxing validation.
    const safeContent = content || (files.length > 0 ? "📎" : "");
    if (!safeContent) return;

    // Optimistic insert — show the message immediately, replace
    // with the server's version once the POST resolves so the id
    // matches and reactions can target it.
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageRow = {
      id: tempId,
      content: safeContent,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            email: null,
            image: currentUser.image,
          }
        : null,
      reactions: [],
      attachments: [],
      mine: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewContent("");
    setPendingFiles([]);
    setSending(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: safeContent }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to send");
      }
      const created: MessageRow = await res.json();
      // Replace the optimistic row with the server's row.
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? created : m))
      );
      // Fire off all attachment uploads in parallel against the
      // newly-created message id. We don't await individually so the
      // composer is freed for the next message immediately — uploads
      // continue in the background and the chips fill in as each
      // resolves.
      if (files.length > 0) {
        await Promise.all(
          files.map((f) => uploadFileToMessage(created.id, f))
        );
      }
    } catch (err) {
      // Roll back the optimistic insert + restore inputs so the user
      // can retry without re-selecting files.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewContent(content);
      setPendingFiles(files);
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }, [
    newContent,
    pendingFiles,
    sending,
    projectId,
    currentUser,
    uploadFileToMessage,
  ]);

  // ── Pending file selection ─────────────────────────────
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    // 10MB per-file ceiling matches storage.ts; reject early so the
    // user sees the bad file before they hit send.
    const tooBig = incoming.filter((f) => f.size > 10 * 1024 * 1024);
    if (tooBig.length > 0) {
      toast.error(`${tooBig[0].name} exceeds 10MB`);
    }
    const ok = incoming.filter((f) => f.size <= 10 * 1024 * 1024);
    setPendingFiles((prev) => [...prev, ...ok]);
    // Reset the input so re-selecting the same file fires onChange.
    e.target.value = "";
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Attachment delete (existing messages) ──────────────
  const handleDeleteAttachment = async (
    messageId: string,
    attachmentId: string
  ) => {
    const snapshot = messages;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              attachments: m.attachments.filter((a) => a.id !== attachmentId),
            }
          : m
      )
    );
    try {
      const res = await fetch(
        `/api/messages/${messageId}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete");
      }
    } catch (err) {
      setMessages(snapshot);
      toast.error(
        err instanceof Error ? err.message : "Failed to remove file"
      );
    }
  };

  // ── Edit ─────────────────────────────────────────────────
  const startEdit = (m: MessageRow) => {
    setEditingId(m.id);
    setEditingContent(m.content);
  };

  const commitEdit = useCallback(
    async (messageId: string) => {
      const content = editingContent.trim();
      if (!content) return;
      const snapshot = messages;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content } : m))
      );
      setEditingId(null);
      try {
        const res = await fetch(`/api/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Failed to update");
        }
      } catch (err) {
        setMessages(snapshot);
        toast.error(
          err instanceof Error ? err.message : "Failed to update"
        );
      }
    },
    [editingContent, messages]
  );

  // ── Delete ───────────────────────────────────────────────
  const handleDelete = async (messageId: string) => {
    if (!confirm("Delete this message? This can't be undone.")) return;
    const snapshot = messages;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete");
      }
      toast.success("Message deleted");
    } catch (err) {
      setMessages(snapshot);
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // ── Pin ──────────────────────────────────────────────────
  const handlePinToggle = async (messageId: string, current: boolean) => {
    // Optimistic flip
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isPinned: !current } : m
      )
    );
    try {
      const res = await fetch(`/api/messages/${messageId}/pin`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to toggle pin");
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isPinned: current } : m
        )
      );
      toast.error(err instanceof Error ? err.message : "Failed to pin");
    }
  };

  // ── React ────────────────────────────────────────────────
  const handleReact = async (messageId: string, emoji: string) => {
    const snapshot = messages;
    // Optimistic toggle of the emoji on this message.
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find((r) => r.emoji === emoji);
        if (existing) {
          if (existing.mine) {
            // Un-react — remove me from the bucket.
            const nextCount = existing.count - 1;
            if (nextCount <= 0) {
              return {
                ...m,
                reactions: m.reactions.filter((r) => r.emoji !== emoji),
              };
            }
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: nextCount, mine: false }
                  : r
              ),
            };
          }
          // Add me to existing bucket.
          return {
            ...m,
            reactions: m.reactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, mine: true }
                : r
            ),
          };
        }
        // New bucket — me first.
        return {
          ...m,
          reactions: [
            ...m.reactions,
            { emoji, count: 1, users: [], mine: true },
          ],
        };
      })
    );

    try {
      const res = await fetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setMessages(snapshot);
      toast.error("Failed to react");
    }
  };

  const copyLink = (messageId: string) => {
    const url = `${window.location.href.split("#")[0]}#message-${messageId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  // Sort: pinned first, then chronological (newest at bottom).
  const sorted = [...messages].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  // ── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      {/* Messages list */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-3">
          {sorted.length === 0 ? (
            <EmptyState />
          ) : (
            sorted.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                editing={editingId === m.id}
                editingContent={editingContent}
                uploadingCount={uploadingByMessage[m.id] || 0}
                onEditingContentChange={setEditingContent}
                onStartEdit={() => startEdit(m)}
                onCommitEdit={() => commitEdit(m.id)}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() => handleDelete(m.id)}
                onPinToggle={() => handlePinToggle(m.id, m.isPinned)}
                onReact={(emoji) => handleReact(m.id, emoji)}
                onCopyLink={() => copyLink(m.id)}
                onOpenAttachment={(idx) =>
                  setViewer({ messageId: m.id, index: idx })
                }
                onDeleteAttachment={(attachmentId) =>
                  handleDeleteAttachment(m.id, attachmentId)
                }
                onAddFiles={(files) => {
                  for (const f of files) {
                    void uploadFileToMessage(m.id, f);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Composer fixed to the bottom of the panel */}
      <div className="border-t bg-white">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white rounded-lg border focus-within:border-[#c9a84c] transition-colors">
            {/* Pending file chips (above the textarea so they're
                visible as the user types) */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 border-b">
                {pendingFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="inline-flex items-center gap-1.5 bg-slate-50 border rounded-md pl-2 pr-1 py-1 text-xs text-slate-700"
                  >
                    {f.type.startsWith("image/") ? (
                      <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="truncate max-w-[180px]">{f.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {formatBytes(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(idx)}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                      aria-label="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <Avatar className="h-8 w-8 m-2 flex-shrink-0">
                <AvatarImage src={currentUser?.image || ""} />
                <AvatarFallback className="text-xs bg-[#d4b65a] text-white">
                  {(currentUser?.name || "Y").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <textarea
                ref={inputRef}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Send a message — Enter to send, Shift+Enter for newline"
                rows={1}
                maxLength={10000}
                disabled={sending}
                className="flex-1 outline-none text-sm py-3 resize-none bg-transparent min-h-[40px] max-h-[200px]"
                style={{
                  height: "auto",
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={handleSelectFiles}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="m-2 p-2 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 disabled:opacity-40 transition-colors"
                title="Attach files"
                aria-label="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={
                  (!newContent.trim() && pendingFiles.length === 0) || sending
                }
                className="m-2 bg-black hover:bg-gray-900 text-white"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            Press Enter to send · Shift+Enter for a new line · Paperclip to
            attach
          </p>
        </div>
      </div>

      {/* Full-screen file viewer (lazy — only rendered when open) */}
      {viewer &&
        (() => {
          const m = messages.find((x) => x.id === viewer.messageId);
          if (!m || m.attachments.length === 0) return null;
          return (
            <FileViewerModal
              files={m.attachments.map((a) => ({
                id: a.id,
                name: a.name,
                url: a.url,
                size: a.size,
                mimeType: a.mimeType,
                createdAt: a.createdAt,
              }))}
              initialIndex={Math.min(viewer.index, m.attachments.length - 1)}
              onClose={() => setViewer(null)}
            />
          );
        })()}
    </div>
  );
}

// ─── Single message item ─────────────────────────────────────────

interface MessageItemProps {
  message: MessageRow;
  editing: boolean;
  editingContent: string;
  uploadingCount: number;
  onEditingContentChange: (v: string) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onPinToggle: () => void;
  onReact: (emoji: string) => void;
  onCopyLink: () => void;
  onOpenAttachment: (index: number) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onAddFiles: (files: File[]) => void;
}

function MessageItem({
  message,
  editing,
  editingContent,
  uploadingCount,
  onEditingContentChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onPinToggle,
  onReact,
  onCopyLink,
  onOpenAttachment,
  onDeleteAttachment,
  onAddFiles,
}: MessageItemProps) {
  const addFilesInputRef = useRef<HTMLInputElement | null>(null);
  const m = message;
  const authorName = m.author?.name || m.author?.email || "Unknown";
  const initial = (authorName).charAt(0).toUpperCase();
  const wasEdited = m.updatedAt !== m.createdAt;

  return (
    <div
      id={`message-${m.id}`}
      className={cn(
        "bg-white rounded-lg border shadow-sm overflow-hidden group",
        m.isPinned && "border-l-4 border-l-[#c9a84c]"
      )}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarImage src={m.author?.image || ""} />
            <AvatarFallback className="text-[11px] bg-[#d4b65a] text-white">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-slate-900 truncate">
                {authorName}
              </span>
              <span className="text-[11px] text-slate-400">
                {formatRelative(m.createdAt)}
              </span>
              {wasEdited && (
                <span className="text-[10px] text-slate-400 italic">
                  (edited)
                </span>
              )}
              {m.isPinned && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-[#a8893a] font-medium uppercase tracking-wider">
                  <Pin className="w-3 h-3" />
                  Pinned
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hover-only actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 flex-shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                title="React"
              >
                <Smile className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-1">
              <div className="flex items-center gap-0.5">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onReact(emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={onCopyLink}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
            title="Copy link"
          >
            <Link2 className="w-4 h-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                title="More"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onPinToggle}>
                <Pin className="w-4 h-4 mr-2" />
                {m.isPinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              {m.mine && (
                <>
                  <DropdownMenuItem onClick={onStartEdit}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-3 pl-[52px]">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editingContent}
              onChange={(e) => onEditingContentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onCommitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
              rows={3}
              autoFocus
              maxLength={10000}
              className="w-full p-2 text-sm border rounded-md resize-none outline-none focus:ring-2 focus:ring-[#c9a84c]"
            />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onCommitEdit}
                className="bg-black hover:bg-gray-900 text-white"
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
            {m.content}
          </p>
        )}

        {/* Attachments grid */}
        {!editing && (m.attachments.length > 0 || uploadingCount > 0) && (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {m.attachments.map((a, idx) => {
              const isImage = a.mimeType.startsWith("image/");
              return (
                <div
                  key={a.id}
                  className="group/att relative rounded-md border bg-slate-50 overflow-hidden hover:border-[#c9a84c] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onOpenAttachment(idx)}
                    className="w-full block text-left"
                    title={`Open ${a.name}`}
                  >
                    {isImage ? (
                      // Browser-rendered thumbnail; the blob is public.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt={a.name}
                        className="w-full h-28 object-cover bg-slate-100"
                      />
                    ) : (
                      <div className="w-full h-28 flex items-center justify-center bg-slate-100">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <div className="px-2 py-1.5 border-t bg-white">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {a.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatBytes(a.size)}
                      </p>
                    </div>
                  </button>
                  {/* Hover action overlay */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover/att:opacity-100 transition-opacity flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void downloadFile(a.url, a.name);
                      }}
                      className="p-1 rounded bg-white/95 border shadow-sm hover:bg-slate-50 text-slate-600"
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    {m.mine && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            !confirm(`Remove ${a.name} from this message?`)
                          )
                            return;
                          onDeleteAttachment(a.id);
                        }}
                        className="p-1 rounded bg-white/95 border shadow-sm hover:bg-rose-50 hover:text-rose-600 text-slate-600"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* In-flight placeholders */}
            {Array.from({ length: uploadingCount }).map((_, i) => (
              <div
                key={`uploading-${i}`}
                className="rounded-md border bg-slate-50 h-[148px] flex flex-col items-center justify-center gap-1 text-slate-400"
              >
                <Loader2 className="w-5 h-5 animate-spin text-[#c9a84c]" />
                <span className="text-[11px]">Uploading…</span>
              </div>
            ))}
          </div>
        )}

        {/* Reaction chips */}
        {!editing && m.reactions.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(r.emoji)}
                title={r.users.map((u) => u.name || "Unknown").join(", ")}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs transition-colors",
                  r.mine
                    ? "bg-[#c9a84c]/15 border-[#c9a84c] text-[#a8893a] font-medium"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <span className="text-sm leading-none">{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Author-only: add more files to an existing message */}
        {!editing && m.mine && (
          <>
            <input
              ref={addFilesInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const list = e.target.files;
                if (!list || list.length === 0) return;
                onAddFiles(Array.from(list));
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => addFilesInputRef.current?.click()}
              className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#a8893a]"
            >
              <Paperclip className="w-3 h-3" />
              Add file
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-12 h-12 rounded-full bg-[#c9a84c]/10 mx-auto flex items-center justify-center mb-3">
        <MessageSquare className="w-6 h-6 text-[#a8893a]" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        Start the conversation
      </h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        Project messages live here. Share updates, decisions, and
        questions — they persist for the whole team to see.
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
