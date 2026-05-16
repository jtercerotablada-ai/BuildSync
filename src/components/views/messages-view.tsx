"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
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

interface MentionRef {
  userId: string;
  name: string | null;
  image: string | null;
}

interface ProjectMemberLite {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  jobTitle: string | null;
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
  // Thread meta — only populated on root messages. Replies don't
  // have nested replies (threads are flat) so these stay at 0/null
  // for any reply rendered inside a thread.
  replyCount?: number;
  lastReplyAt?: string | null;
  // @ mentions resolved by the server. Used both to render gold
  // chips inside the content and to power the inbox notification
  // hand-off (already done server-side).
  mentions?: MentionRef[];
}

/**
 * Scope of this Messages surface. The same component handles both
 * project-level messages (under /projects/[id]) and team-level
 * messages (under /teams/[id]) — only the URL prefixes and the
 * directory endpoint differ.
 *
 * For backwards compat the component still accepts a `projectId`
 * prop directly; we synthesize a project scope from it. New
 * callers should pass `scope` explicitly.
 */
export type MessageScope =
  | { type: "project"; projectId: string }
  | { type: "team"; teamId: string }
  | { type: "portfolio"; portfolioId: string };

interface ScopeEndpoints {
  list: string;                   // GET roots, POST new root
  members: string;                // GET directory for @-mention typeahead
  message: (id: string) => string;            // PATCH / DELETE
  pin: (id: string) => string;                // POST toggle
  reactions: (id: string) => string;          // POST toggle
  replies: (rootId: string) => string;        // GET + POST
  attachments: (id: string) => string;        // POST upload
  attachment: (mid: string, aid: string) => string; // DELETE
}

function buildEndpoints(scope: MessageScope): ScopeEndpoints {
  if (scope.type === "project") {
    const pid = scope.projectId;
    return {
      list: `/api/projects/${pid}/messages`,
      members: `/api/projects/${pid}/members`,
      message: (id) => `/api/messages/${id}`,
      pin: (id) => `/api/messages/${id}/pin`,
      reactions: (id) => `/api/messages/${id}/reactions`,
      replies: (rid) => `/api/messages/${rid}/replies`,
      attachments: (id) => `/api/messages/${id}/attachments`,
      attachment: (mid, aid) => `/api/messages/${mid}/attachments/${aid}`,
    };
  }
  if (scope.type === "portfolio") {
    // Portfolio uses the same Message model as projects, so the
    // generic /api/messages/[id]/* endpoints work — they gate on
    // either project OR portfolio membership via loadMessageWithAccess.
    const pid = scope.portfolioId;
    return {
      list: `/api/portfolios/${pid}/messages`,
      members: `/api/portfolios/${pid}/members`,
      message: (id) => `/api/messages/${id}`,
      pin: (id) => `/api/messages/${id}/pin`,
      reactions: (id) => `/api/messages/${id}/reactions`,
      replies: (rid) => `/api/messages/${rid}/replies`,
      attachments: (id) => `/api/messages/${id}/attachments`,
      attachment: (mid, aid) => `/api/messages/${mid}/attachments/${aid}`,
    };
  }
  // team
  const tid = scope.teamId;
  return {
    list: `/api/teams/${tid}/messages`,
    members: `/api/teams/${tid}/members`,
    message: (id) => `/api/teams/${tid}/messages/${id}`,
    pin: (id) => `/api/teams/${tid}/messages/${id}/pin`,
    reactions: (id) => `/api/teams/${tid}/messages/${id}/reactions`,
    replies: (rid) => `/api/teams/${tid}/messages/${rid}/replies`,
    attachments: (id) => `/api/teams/${tid}/messages/${id}/attachments`,
    attachment: (mid, aid) =>
      `/api/teams/${tid}/messages/${mid}/attachments/${aid}`,
  };
}

interface MessagesViewProps {
  // New preferred API — explicit scope.
  scope?: MessageScope;
  // Legacy props (project scope is inferred when set). Kept so the
  // existing /projects/[id] page works without changes.
  sections?: { id: string; name: string; tasks: unknown[] }[];
  projectId?: string;
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
  scope: scopeProp,
  projectId,
  currentUser,
}: MessagesViewProps) {
  // Resolve effective scope: explicit prop wins; otherwise infer
  // project scope from the legacy projectId.
  const scope: MessageScope = useMemo(
    () =>
      scopeProp ??
      (projectId
        ? { type: "project" as const, projectId }
        : ({ type: "project" as const, projectId: "" } as MessageScope)),
    [scopeProp, projectId]
  );
  // Stable primitive scope key for downstream effect deps.
  const scopeKey =
    scope.type === "project"
      ? scope.projectId
      : scope.type === "portfolio"
        ? scope.portfolioId
        : scope.teamId;
  // Memoized endpoint builder so handlers don't rebuild URLs on
  // every render.
  const endpoints = useMemo(
    () => buildEndpoints(scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope.type, scopeKey]
  );

  // ── Deep-link params ────────────────────────────────────
  // The inbox routes mention notifications to /projects/[id]?view=
  // messages&message=ID(&thread=ROOTID). We read those once on
  // mount, then scroll + briefly highlight the matching message.
  const searchParams = useSearchParams();
  const targetMessageId = searchParams.get("message");
  const targetThreadId = searchParams.get("thread");
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

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

  // ── Thread state ────────────────────────────────────────
  // Replies cache keyed by root id. Empty array = thread loaded but
  // has no replies yet. Undefined = not loaded.
  const [repliesByThread, setRepliesByThread] = useState<
    Record<string, MessageRow[]>
  >({});
  // Which thread roots are currently expanded inline.
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    () => new Set()
  );
  // Composer drafts per thread (lets the user step away from one
  // thread and come back to the same draft).
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>(
    {}
  );
  // In-flight reply sends per thread root — keeps the send button
  // disabled while POSTing.
  const [replySending, setReplySending] = useState<Set<string>>(
    () => new Set()
  );

  // ── Mention state ──────────────────────────────────────
  // Project members for the @ typeahead. Fetched once on mount.
  const [members, setMembers] = useState<ProjectMemberLite[]>([]);
  // userIds the author has tagged in the current main draft. Tracked
  // separately from the textarea text so we can persist the resolved
  // ids on send (text alone is ambiguous when two members share a
  // first name).
  const [mentionUserIds, setMentionUserIds] = useState<string[]>([]);
  // Per-thread mention tracking for reply composers.
  const [replyMentionUserIds, setReplyMentionUserIds] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    // Best-effort: a 403 or 500 here just disables @ typeahead, the
    // composer still works in plain mode.
    fetch(endpoints.members)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { user: ProjectMemberLite }[] | unknown) => {
        if (!Array.isArray(data)) return;
        const list = data
          .map((row) => (row as { user?: ProjectMemberLite }).user)
          .filter((u): u is ProjectMemberLite => Boolean(u));
        setMembers(list);
      })
      .catch(() => {
        // Silent failure — composer falls back to plain text mode.
      });
  }, [endpoints.members]);

  // Real-time poll bookkeeping. The scroll container ref lets us
  // detect "user is at the bottom" so background polls can auto-scroll
  // without yanking the viewport when the user is reading history.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  // Refs that the poll loop reads — avoids stale closures from the
  // setInterval capturing the first render's state.
  const editingIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);
  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  // ── Fetch / merge ───────────────────────────────────────
  // `silent` keeps the loading spinner off so background polls don't
  // flash UI. Merge logic preserves local-only state that the server
  // doesn't know about yet (optimistic temp- rows + in-flight edits).
  const fetchMessages = useCallback(
    async (silent = false) => {
      try {
        const res = await fetch(endpoints.list);
        if (!res.ok) throw new Error("Failed to load");
        const data: MessageRow[] = await res.json();
        // API returns newest-first; we display newest-last (chat
        // style) so flip the array. Pinned messages always render
        // at the top regardless of date.
        const incoming = Array.isArray(data) ? [...data].reverse() : [];

        if (!silent) {
          setMessages(incoming);
          return;
        }

        // Silent merge — preserve optimistic temp rows + don't stomp
        // the message the user is editing right now.
        setMessages((prev) => {
          const serverById = new Map(incoming.map((m) => [m.id, m]));
          const result: MessageRow[] = [];
          const seenServer = new Set<string>();

          // Walk the server list first to keep server order. Replace
          // each server message with the local version if we're
          // editing it (otherwise the editing text would get wiped).
          for (const sm of incoming) {
            const local = prev.find((p) => p.id === sm.id);
            if (local && editingIdRef.current === sm.id) {
              // Currently editing: preserve local content but accept
              // the server's metadata (reactions, attachments, pin).
              result.push({
                ...sm,
                content: local.content,
              });
            } else {
              result.push(sm);
            }
            seenServer.add(sm.id);
          }

          // Re-append any local optimistic temp messages that haven't
          // landed on the server yet.
          for (const lm of prev) {
            if (lm.id.startsWith("temp-") && !seenServer.has(lm.id)) {
              result.push(lm);
            }
          }

          // Detect if the user got new messages they haven't scrolled
          // to yet. Compare last-message-id; if it changed and we're
          // not at the bottom, surface the "new messages" pill.
          const lastLocalId = prev[prev.length - 1]?.id;
          const lastResultId = result[result.length - 1]?.id;
          if (
            lastLocalId !== lastResultId &&
            lastResultId &&
            !lastResultId.startsWith("temp-")
          ) {
            // Only flag new-below if the user is scrolled up — the
            // auto-scroll effect handles the at-bottom case.
            const c = scrollContainerRef.current;
            if (c) {
              const distanceFromBottom =
                c.scrollHeight - c.scrollTop - c.clientHeight;
              if (distanceFromBottom > 80) {
                setHasNewBelow(true);
              }
            }
          }

          // No-op short-circuit: if nothing changed between polls,
          // return the previous reference so React skips a re-render
          // of the entire list. Cheap to compute against the small
          // message volume (≤100).
          const unchanged =
            result.length === prev.length &&
            result.every((m, i) => {
              const p = prev[i];
              return (
                p &&
                p.id === m.id &&
                p.updatedAt === m.updatedAt &&
                p.isPinned === m.isPinned &&
                p.reactions.length === m.reactions.length &&
                p.attachments.length === m.attachments.length &&
                m.reactions.every((r, ri) => {
                  const pr = p.reactions[ri];
                  return (
                    pr &&
                    pr.emoji === r.emoji &&
                    pr.count === r.count &&
                    pr.mine === r.mine
                  );
                })
              );
            });

          return unchanged ? prev : result;
        });
      } catch {
        if (!silent) {
          toast.error("Couldn't load messages");
        }
        // Silent failures are intentional — a transient network
        // blip during background polling shouldn't bother the user.
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId]
  );

  // Initial load.
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // (Deep-link scroll + highlight effect lives further down, after
  // fetchReplies is declared, so the useEffect can reference it
  // without a use-before-declaration error.)
  const deepLinkAppliedRef = useRef(false);

  // Real-time polling: every 10s when the tab is visible, plus an
  // immediate refresh whenever the tab regains focus (so coming back
  // to a stale tab feels instant). Pauses while sending to avoid
  // racing against our own optimistic update.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (document.hidden) return;
      if (sendingRef.current) return;
      void fetchMessages(true);
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(tick, 10000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Immediate refresh on focus, then resume the cadence.
        void fetchMessages(true);
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchMessages]);

  // Track whether the user is at the bottom of the scroll container.
  // Used by the auto-scroll-on-new-message + new-messages pill logic.
  useEffect(() => {
    const c = scrollContainerRef.current;
    if (!c) return;
    const onScroll = () => {
      const distanceFromBottom =
        c.scrollHeight - c.scrollTop - c.clientHeight;
      const isAtBottom = distanceFromBottom < 80;
      setAtBottom(isAtBottom);
      if (isAtBottom) setHasNewBelow(false);
    };
    c.addEventListener("scroll", onScroll);
    // Run once to initialize.
    onScroll();
    return () => c.removeEventListener("scroll", onScroll);
  }, [loading]);

  // Auto-scroll on new messages — but only if the user was already
  // pinned to the bottom. Don't yank them mid-read.
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!atBottom) return;
    const c = scrollContainerRef.current;
    if (!c) return;
    // requestAnimationFrame so the DOM has the new message before we
    // measure heights.
    requestAnimationFrame(() => {
      c.scrollTop = c.scrollHeight;
    });
  }, [lastMessageId, atBottom]);

  const scrollToBottom = useCallback(() => {
    const c = scrollContainerRef.current;
    if (!c) return;
    c.scrollTop = c.scrollHeight;
    setHasNewBelow(false);
  }, []);

  // ── Generic state updater across roots + replies ───────
  // Reactions, edits, deletes, and attachment ops can target either
  // a root message or a reply. This helper walks both maps so call
  // sites don't have to know which one holds a given id.
  const updateAnyMessage = useCallback(
    (id: string, fn: (m: MessageRow) => MessageRow) => {
      let found = false;
      setMessages((prev) => {
        let touched = false;
        const next = prev.map((m) => {
          if (m.id === id) {
            touched = true;
            found = true;
            return fn(m);
          }
          return m;
        });
        return touched ? next : prev;
      });
      if (found) return;
      setRepliesByThread((prev) => {
        const next: Record<string, MessageRow[]> = {};
        let touched = false;
        for (const [rootId, list] of Object.entries(prev)) {
          let listChanged = false;
          const updated = list.map((m) => {
            if (m.id === id) {
              listChanged = true;
              touched = true;
              return fn(m);
            }
            return m;
          });
          next[rootId] = listChanged ? updated : list;
        }
        return touched ? next : prev;
      });
    },
    []
  );

  // Snapshot helper — used by handlers that need to roll back on
  // error. Returns both maps so the rollback call site can restore
  // the exact pre-mutation state.
  const captureSnapshot = useCallback(
    () => ({ messages, repliesByThread }),
    [messages, repliesByThread]
  );
  const restoreSnapshot = useCallback(
    (snap: { messages: MessageRow[]; repliesByThread: Record<string, MessageRow[]> }) => {
      setMessages(snap.messages);
      setRepliesByThread(snap.repliesByThread);
    },
    []
  );

  // Remove a message anywhere — used by delete handler.
  const removeAnyMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setRepliesByThread((prev) => {
      const next: Record<string, MessageRow[]> = {};
      let touched = false;
      for (const [rootId, list] of Object.entries(prev)) {
        const filtered = list.filter((m) => m.id !== id);
        if (filtered.length !== list.length) touched = true;
        next[rootId] = filtered;
      }
      return touched ? next : prev;
    });
  }, []);

  // ── Thread fetch / expand ──────────────────────────────
  const fetchReplies = useCallback(async (rootId: string) => {
    try {
      const res = await fetch(endpoints.replies(rootId));
      if (!res.ok) throw new Error("Failed");
      const data: MessageRow[] = await res.json();
      setRepliesByThread((prev) => ({ ...prev, [rootId]: data }));
    } catch {
      toast.error("Couldn't load replies");
    }
  }, []);

  // Deep-link scroll + highlight. Runs once messages land. If the
  // target lives inside a thread (targetThreadId set), we expand
  // the thread + fetch its replies first, then scroll.
  useEffect(() => {
    if (loading) return;
    if (!targetMessageId) return;
    if (deepLinkAppliedRef.current) return;

    const target = targetMessageId;
    const thread = targetThreadId;

    // Auto-expand the thread if needed. We only do this once; the
    // poller takes over from there.
    if (thread && !expandedThreads.has(thread)) {
      setExpandedThreads((prev) => {
        const next = new Set(prev);
        next.add(thread);
        return next;
      });
      if (!repliesByThread[thread]) {
        void fetchReplies(thread);
      }
    }

    // Wait a frame for the DOM to settle (especially after the
    // optional thread expansion), then scroll + highlight.
    requestAnimationFrame(() => {
      const el = document.getElementById(`message-${target}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(target);
        deepLinkAppliedRef.current = true;
        // Drop the highlight after a few seconds so the page
        // settles back to normal.
        window.setTimeout(() => setHighlightedMessageId(null), 3000);
      }
    });
  }, [
    loading,
    targetMessageId,
    targetThreadId,
    messages,
    expandedThreads,
    repliesByThread,
    fetchReplies,
  ]);

  const toggleThread = useCallback(
    (rootId: string) => {
      setExpandedThreads((prev) => {
        const next = new Set(prev);
        if (next.has(rootId)) {
          next.delete(rootId);
        } else {
          next.add(rootId);
          // Fetch on first open; subsequent opens reuse the cache
          // and rely on the poller below for freshness.
          if (!repliesByThread[rootId]) {
            void fetchReplies(rootId);
          }
        }
        return next;
      });
    },
    [repliesByThread, fetchReplies]
  );

  // Poll the replies of every currently-open thread every 10s. We
  // reuse the same visibility-aware timer rhythm as the root poll
  // so users see new replies land without manual refresh.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (document.hidden) return;
      for (const rootId of expandedThreads) {
        void fetchReplies(rootId);
      }
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(tick, 10000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expandedThreads, fetchReplies]);

  // ── Send reply ─────────────────────────────────────────
  const handleSendReply = useCallback(
    async (rootId: string) => {
      const content = (replyDrafts[rootId] || "").trim();
      if (!content) return;
      if (replySending.has(rootId)) return;

      // Same effective-mentions filter as the main composer: only
      // ping users whose "@Name" handle is still in the reply body.
      const staged = replyMentionUserIds[rootId] || [];
      const effectiveMentions = staged.filter((uid) => {
        const member = members.find((m) => m.id === uid);
        if (!member) return false;
        const display = member.name || member.email;
        if (!display) return false;
        return content.includes(`@${display}`);
      });

      setReplySending((prev) => new Set(prev).add(rootId));
      const tempId = `temp-${Date.now()}`;
      const optimistic: MessageRow = {
        id: tempId,
        content,
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
      // Optimistic insert into the thread + bump replyCount on the
      // root so users see the badge update before the server round-
      // trip resolves.
      setRepliesByThread((prev) => ({
        ...prev,
        [rootId]: [...(prev[rootId] || []), optimistic],
      }));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === rootId
            ? {
                ...m,
                replyCount: (m.replyCount || 0) + 1,
                lastReplyAt: optimistic.createdAt,
              }
            : m
        )
      );
      setReplyDrafts((prev) => ({ ...prev, [rootId]: "" }));
      setReplyMentionUserIds((prev) => {
        if (!(rootId in prev)) return prev;
        const next = { ...prev };
        delete next[rootId];
        return next;
      });

      try {
        const res = await fetch(endpoints.replies(rootId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            mentionUserIds: effectiveMentions,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Failed to send");
        }
        const created: MessageRow = await res.json();
        // Swap the temp row for the server's row.
        setRepliesByThread((prev) => {
          const list = prev[rootId] || [];
          return {
            ...prev,
            [rootId]: list.map((m) => (m.id === tempId ? created : m)),
          };
        });
      } catch (err) {
        // Roll back the thread + root counter, restore the draft.
        setRepliesByThread((prev) => ({
          ...prev,
          [rootId]: (prev[rootId] || []).filter((m) => m.id !== tempId),
        }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === rootId
              ? {
                  ...m,
                  replyCount: Math.max(0, (m.replyCount || 1) - 1),
                }
              : m
          )
        );
        setReplyDrafts((prev) => ({ ...prev, [rootId]: content }));
        setReplyMentionUserIds((prev) => ({
          ...prev,
          [rootId]: effectiveMentions,
        }));
        toast.error(err instanceof Error ? err.message : "Failed to reply");
      } finally {
        setReplySending((prev) => {
          const next = new Set(prev);
          next.delete(rootId);
          return next;
        });
      }
    },
    [replyDrafts, replySending, currentUser, replyMentionUserIds, members]
  );

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
          endpoints.attachments(messageId),
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
        // Works for both root messages and replies — the helper
        // walks both maps.
        updateAnyMessage(messageId, (m) => ({
          ...m,
          attachments: [...m.attachments, created],
        }));
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
    [updateAnyMessage]
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

    // Filter the staged mentions down to those whose handle still
    // appears in the message text. A user can mention then delete
    // the "@Name" before sending; we should drop those userIds so
    // they don't get pinged for a mention that's no longer in the
    // message body.
    const effectiveMentions = mentionUserIds.filter((uid) => {
      const member = members.find((m) => m.id === uid);
      if (!member) return false;
      const display = member.name || member.email;
      if (!display) return false;
      return safeContent.includes(`@${display}`);
    });

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
    setMentionUserIds([]);
    setSending(true);

    try {
      const res = await fetch(endpoints.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: safeContent,
          mentionUserIds: effectiveMentions,
        }),
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
      setMentionUserIds(effectiveMentions);
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
    mentionUserIds,
    members,
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
    const snapshot = captureSnapshot();
    updateAnyMessage(messageId, (m) => ({
      ...m,
      attachments: m.attachments.filter((a) => a.id !== attachmentId),
    }));
    try {
      const res = await fetch(
        endpoints.attachment(messageId, attachmentId),
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete");
      }
    } catch (err) {
      restoreSnapshot(snapshot);
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
      const snapshot = captureSnapshot();
      updateAnyMessage(messageId, (m) => ({ ...m, content }));
      setEditingId(null);
      try {
        const res = await fetch(endpoints.message(messageId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Failed to update");
        }
      } catch (err) {
        restoreSnapshot(snapshot);
        toast.error(
          err instanceof Error ? err.message : "Failed to update"
        );
      }
    },
    [editingContent, captureSnapshot, restoreSnapshot, updateAnyMessage]
  );

  // ── Delete ───────────────────────────────────────────────
  const handleDelete = async (messageId: string) => {
    if (!confirm("Delete this message? This can't be undone.")) return;
    const snapshot = captureSnapshot();
    // Find which root, if any, this message belonged to so we can
    // decrement the replyCount when deleting a reply.
    let parentRootId: string | null = null;
    for (const [rid, list] of Object.entries(repliesByThread)) {
      if (list.some((m) => m.id === messageId)) {
        parentRootId = rid;
        break;
      }
    }
    removeAnyMessage(messageId);
    if (parentRootId) {
      const rid = parentRootId;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === rid
            ? { ...m, replyCount: Math.max(0, (m.replyCount || 1) - 1) }
            : m
        )
      );
    } else {
      // Deleting a root also drops any locally-cached reply list
      // for that thread (server cascade will handle the DB rows).
      setRepliesByThread((prev) => {
        if (!(messageId in prev)) return prev;
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
    }
    try {
      const res = await fetch(endpoints.message(messageId), {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete");
      }
      toast.success("Message deleted");
    } catch (err) {
      restoreSnapshot(snapshot);
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
      const res = await fetch(endpoints.pin(messageId), {
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
    const snapshot = captureSnapshot();
    // Optimistic toggle of the emoji on the target message
    // (regardless of whether it lives in roots or in a thread).
    updateAnyMessage(messageId, (m) => {
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
    });

    try {
      const res = await fetch(endpoints.reactions(messageId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      restoreSnapshot(snapshot);
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
    <div className="flex-1 flex flex-col bg-slate-50 relative">
      {/* Messages list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-3">
          {sorted.length === 0 ? (
            <EmptyState />
          ) : (
            sorted.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                isReply={false}
                highlighted={highlightedMessageId === m.id}
                highlightedReplyId={highlightedMessageId}
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
                // Thread-only props
                threadExpanded={expandedThreads.has(m.id)}
                threadReplies={repliesByThread[m.id]}
                replyDraft={replyDrafts[m.id] || ""}
                replyIsSending={replySending.has(m.id)}
                replyEditingId={editingId}
                replyEditingContent={editingContent}
                onToggleThread={() => toggleThread(m.id)}
                onReplyDraftChange={(v) =>
                  setReplyDrafts((prev) => ({ ...prev, [m.id]: v }))
                }
                onSendReply={() => handleSendReply(m.id)}
                onReplyStartEdit={(reply) => startEdit(reply)}
                onReplyCommitEdit={(replyId) => commitEdit(replyId)}
                onReplyCancelEdit={() => setEditingId(null)}
                onReplyEditingContentChange={setEditingContent}
                onReplyReact={(replyId, emoji) =>
                  handleReact(replyId, emoji)
                }
                onReplyDelete={(replyId) => handleDelete(replyId)}
                onReplyCopyLink={(replyId) => copyLink(replyId)}
                onReplyOpenAttachment={(replyId, idx) =>
                  setViewer({ messageId: replyId, index: idx })
                }
                onReplyDeleteAttachment={(replyId, attachmentId) =>
                  handleDeleteAttachment(replyId, attachmentId)
                }
                onReplyAddFiles={(replyId, files) => {
                  for (const f of files) {
                    void uploadFileToMessage(replyId, f);
                  }
                }}
                replyUploadingByMessage={uploadingByMessage}
                members={members}
                onReplyMentionAdd={(member) =>
                  setReplyMentionUserIds((prev) => {
                    const list = prev[m.id] || [];
                    if (list.includes(member.id)) return prev;
                    return { ...prev, [m.id]: [...list, member.id] };
                  })
                }
              />
            ))
          )}
        </div>
      </div>

      {/* "New messages ↓" pill — only when user scrolled up and new
          ones landed below them via the poll. Click jumps them down. */}
      {hasNewBelow && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute left-1/2 -translate-x-1/2 bottom-[88px] z-10 px-3 py-1.5 rounded-full bg-[#c9a84c] text-white text-xs font-medium shadow-lg hover:bg-[#a8893a] transition-colors flex items-center gap-1.5"
        >
          New messages
          <span aria-hidden>↓</span>
        </button>
      )}

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
              <MentionTextarea
                textareaRef={inputRef}
                value={newContent}
                onChange={setNewContent}
                members={members}
                onMentionAdd={(member) =>
                  setMentionUserIds((prev) =>
                    prev.includes(member.id) ? prev : [...prev, member.id]
                  )
                }
                onSend={handleSend}
                placeholder="Send a message — Enter to send, Shift+Enter for newline. @ to mention."
                rows={1}
                maxLength={10000}
                disabled={sending}
                className="w-full outline-none text-sm py-3 resize-none bg-transparent min-h-[40px] max-h-[200px]"
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
  isReply: boolean;
  // Set when the inbox deep-link points at this exact message id.
  // The row pulses gold for 3 seconds so the user spots which
  // message they were sent to.
  highlighted?: boolean;
  // Same notion but for descendants — passed down so a reply
  // inside the expanded thread can match its id and highlight
  // itself even when the parent root doesn't.
  highlightedReplyId?: string | null;
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
  // Thread props — only meaningful when isReply === false. The
  // reply-level handlers fan-out to the parent state because all
  // mutations go through the same updateAnyMessage helper there.
  threadExpanded?: boolean;
  threadReplies?: MessageRow[];
  replyDraft?: string;
  replyIsSending?: boolean;
  replyEditingId?: string | null;
  replyEditingContent?: string;
  replyUploadingByMessage?: Record<string, number>;
  onToggleThread?: () => void;
  onReplyDraftChange?: (v: string) => void;
  onSendReply?: () => void;
  onReplyStartEdit?: (reply: MessageRow) => void;
  onReplyCommitEdit?: (replyId: string) => void;
  onReplyCancelEdit?: () => void;
  onReplyEditingContentChange?: (v: string) => void;
  onReplyReact?: (replyId: string, emoji: string) => void;
  onReplyDelete?: (replyId: string) => void;
  onReplyCopyLink?: (replyId: string) => void;
  onReplyOpenAttachment?: (replyId: string, idx: number) => void;
  onReplyDeleteAttachment?: (
    replyId: string,
    attachmentId: string
  ) => void;
  onReplyAddFiles?: (replyId: string, files: File[]) => void;
  // @ mention plumbing for the reply composer
  members?: ProjectMemberLite[];
  onReplyMentionAdd?: (member: ProjectMemberLite) => void;
}

function MessageItem({
  message,
  isReply,
  highlighted,
  highlightedReplyId,
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
  threadExpanded,
  threadReplies,
  replyDraft,
  replyIsSending,
  replyEditingId,
  replyEditingContent,
  replyUploadingByMessage,
  onToggleThread,
  onReplyDraftChange,
  onSendReply,
  onReplyStartEdit,
  onReplyCommitEdit,
  onReplyCancelEdit,
  onReplyEditingContentChange,
  onReplyReact,
  onReplyDelete,
  onReplyCopyLink,
  onReplyOpenAttachment,
  onReplyDeleteAttachment,
  onReplyAddFiles,
  members,
  onReplyMentionAdd,
}: MessageItemProps) {
  const addFilesInputRef = useRef<HTMLInputElement | null>(null);
  const replyCount = message.replyCount ?? 0;
  const hasThread = !isReply && replyCount > 0;
  const m = message;
  const authorName = m.author?.name || m.author?.email || "Unknown";
  const initial = (authorName).charAt(0).toUpperCase();
  const wasEdited = m.updatedAt !== m.createdAt;

  return (
    <div
      id={`message-${m.id}`}
      className={cn(
        "bg-white rounded-lg border shadow-sm overflow-hidden group transition-shadow",
        m.isPinned && "border-l-4 border-l-[#c9a84c]",
        highlighted &&
          "ring-2 ring-[#c9a84c] ring-offset-2 ring-offset-slate-50 shadow-lg animate-pulse"
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

          {!isReply && onToggleThread && (
            <button
              type="button"
              onClick={onToggleThread}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
              title="Reply in thread"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

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
              {!isReply && (
                <DropdownMenuItem onClick={onPinToggle}>
                  <Pin className="w-4 h-4 mr-2" />
                  {m.isPinned ? "Unpin" : "Pin"}
                </DropdownMenuItem>
              )}
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
            {renderMessageBody(m.content, m.mentions)}
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

      {/* ── Thread surface (root messages only) ─────────────── */}
      {!isReply && (hasThread || threadExpanded) && (
        <div className="border-t bg-slate-50/60">
          <button
            type="button"
            onClick={onToggleThread}
            className="w-full px-4 py-2 flex items-center justify-between gap-2 text-xs font-medium text-[#a8893a] hover:bg-slate-50 transition-colors"
          >
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              {replyCount > 0
                ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
                : "Reply in thread"}
              {!threadExpanded && m.lastReplyAt && replyCount > 0 && (
                <span className="text-slate-400 font-normal">
                  · last {formatRelative(m.lastReplyAt)}
                </span>
              )}
            </span>
            <span className="text-slate-400">
              {threadExpanded ? "Hide" : "View"}
            </span>
          </button>

          {threadExpanded && (
            <div className="px-4 pb-3 pl-[52px] space-y-2">
              {!threadReplies ? (
                <div className="py-4 flex items-center justify-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : threadReplies.length === 0 ? (
                <p className="py-2 text-xs text-slate-400">
                  No replies yet — be the first.
                </p>
              ) : (
                threadReplies.map((r) => (
                  <MessageItem
                    key={r.id}
                    message={r}
                    isReply={true}
                    highlighted={highlightedReplyId === r.id}
                    highlightedReplyId={highlightedReplyId}
                    editing={replyEditingId === r.id}
                    editingContent={replyEditingContent || ""}
                    uploadingCount={replyUploadingByMessage?.[r.id] || 0}
                    onEditingContentChange={
                      onReplyEditingContentChange || (() => {})
                    }
                    onStartEdit={() => onReplyStartEdit?.(r)}
                    onCommitEdit={() => onReplyCommitEdit?.(r.id)}
                    onCancelEdit={() => onReplyCancelEdit?.()}
                    onDelete={() => onReplyDelete?.(r.id)}
                    onPinToggle={() => {}}
                    onReact={(emoji) => onReplyReact?.(r.id, emoji)}
                    onCopyLink={() => onReplyCopyLink?.(r.id)}
                    onOpenAttachment={(idx) =>
                      onReplyOpenAttachment?.(r.id, idx)
                    }
                    onDeleteAttachment={(aid) =>
                      onReplyDeleteAttachment?.(r.id, aid)
                    }
                    onAddFiles={(files) =>
                      onReplyAddFiles?.(r.id, files)
                    }
                  />
                ))
              )}

              {/* Reply composer */}
              <ReplyComposer
                draft={replyDraft || ""}
                sending={!!replyIsSending}
                members={members || []}
                onChange={(v) => onReplyDraftChange?.(v)}
                onMentionAdd={(member) => onReplyMentionAdd?.(member)}
                onSend={() => onSendReply?.()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reply composer ──────────────────────────────────────────────

interface ReplyComposerProps {
  draft: string;
  sending: boolean;
  members: ProjectMemberLite[];
  onChange: (v: string) => void;
  onMentionAdd: (member: ProjectMemberLite) => void;
  onSend: () => void;
}

function ReplyComposer({
  draft,
  sending,
  members,
  onChange,
  onMentionAdd,
  onSend,
}: ReplyComposerProps) {
  return (
    <div className="flex items-end gap-2 bg-white rounded-lg border focus-within:border-[#c9a84c] transition-colors">
      <MentionTextarea
        value={draft}
        onChange={onChange}
        members={members}
        onMentionAdd={onMentionAdd}
        onSend={onSend}
        placeholder="Reply… @ to mention."
        rows={1}
        maxLength={10000}
        disabled={sending}
        className="w-full outline-none text-sm py-2 px-3 resize-none bg-transparent min-h-[36px] max-h-[160px]"
      />
      <Button
        size="sm"
        onClick={onSend}
        disabled={!draft.trim() || sending}
        className="m-1.5 bg-black hover:bg-gray-900 text-white"
      >
        {sending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Send className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
}

// ─── MentionTextarea ─────────────────────────────────────────────
//
// A textarea wrapper that surfaces an inline picker when the user
// types "@". Selecting a member inserts "@FullName " at the cursor
// and reports the resolved userId via onMentionAdd so the parent
// can stage it for the eventual POST.
//
// The picker pops up above the textarea (using bottom-full) so it
// never gets clipped by the composer container. Keyboard nav: Up/
// Down to highlight, Enter/Tab to confirm, Escape to cancel.
//
// Members are filtered case-insensitively against the in-progress
// query (the text between "@" and the cursor). Only the first 8
// matches render — typing narrows the list further.

interface MentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  members: ProjectMemberLite[];
  onMentionAdd: (member: ProjectMemberLite) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}

function MentionTextarea({
  value,
  onChange,
  members,
  onMentionAdd,
  onSend,
  placeholder,
  disabled,
  rows = 1,
  maxLength,
  className,
  textareaRef,
}: MentionTextareaProps) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = textareaRef ?? localRef;
  // Trigger = the user is currently inside an @ context. Null when
  // they aren't (i.e. closed or never opened).
  const [trigger, setTrigger] = useState<{
    atIndex: number;
    query: string;
  } | null>(null);
  const [highlight, setHighlight] = useState(0);

  // Filter members against the live query. Case-insensitive on
  // both first/last name. Email is included as a fallback so
  // un-named accounts are still reachable.
  const matches = trigger
    ? members
        .filter((m) => {
          const q = trigger.query.toLowerCase();
          if (!q) return true;
          return (
            (m.name || "").toLowerCase().includes(q) ||
            (m.email || "").toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  // Keep the highlighted index in range as the matches shrink.
  useEffect(() => {
    if (highlight >= matches.length) setHighlight(0);
  }, [matches.length, highlight]);

  // Helper: parse the current text+cursor and decide if we're in
  // an @ context. The rules:
  //   - There must be an "@" at some index before the cursor.
  //   - No whitespace or newline between "@" and the cursor.
  //   - The "@" must be at position 0 or follow whitespace (so we
  //     don't trigger on emails like foo@bar).
  const detectTrigger = (
    text: string,
    cursor: number
  ): { atIndex: number; query: string } | null => {
    for (let i = cursor - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === "@") {
        const prev = i === 0 ? "" : text[i - 1];
        if (prev === "" || /\s/.test(prev)) {
          return { atIndex: i, query: text.slice(i + 1, cursor) };
        }
        return null;
      }
      if (/\s/.test(ch)) return null;
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const cursor = e.target.selectionStart ?? next.length;
    const t = detectTrigger(next, cursor);
    setTrigger(t);
    if (t) setHighlight(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (trigger && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        confirmMention(matches[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTrigger(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const confirmMention = (member: ProjectMemberLite) => {
    if (!trigger) return;
    const displayName = member.name || member.email || "user";
    const before = value.slice(0, trigger.atIndex);
    // Cursor was at trigger.atIndex + 1 + trigger.query.length.
    const after = value.slice(
      trigger.atIndex + 1 + trigger.query.length
    );
    const inserted = `@${displayName} `;
    const next = before + inserted + after;
    onChange(next);
    onMentionAdd(member);
    setTrigger(null);
    // Restore focus + move cursor to right after the inserted
    // mention so the user can keep typing.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const pos = before.length + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative flex-1">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        className={className}
      />
      {trigger && matches.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1 w-64 max-h-64 overflow-auto rounded-md border bg-white shadow-lg z-20">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 border-b">
            Mention
          </div>
          {matches.map((m, idx) => {
            const display = m.name || m.email || "Unknown";
            const initial = display.charAt(0).toUpperCase();
            return (
              <button
                key={m.id}
                type="button"
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  // mousedown (not click) so the textarea doesn't
                  // lose focus before we can re-focus it.
                  e.preventDefault();
                  confirmMention(m);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-slate-50",
                  idx === highlight && "bg-[#c9a84c]/10"
                )}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={m.image || ""} />
                  <AvatarFallback className="text-[10px] bg-[#d4b65a] text-white">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {display}
                  </p>
                  {m.jobTitle && (
                    <p className="text-[11px] text-slate-400 truncate">
                      {m.jobTitle}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
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
        Messages live here. Share updates, decisions, and questions —
        they persist for the whole team to see.
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

// Render message content with @ mentions promoted to gold chips.
// Mentions are matched by the server-resolved display name (the same
// "@FirstName Lastname" string the composer inserted at send-time),
// so a user who edits and removes the "@Name" handle but leaves the
// row in the mentions table won't see a phantom chip — and a user
// who types "@Name" by hand without picking from the typeahead will
// just see plain text (no row, no chip).
function renderMessageBody(
  content: string,
  mentions?: MentionRef[]
): React.ReactNode {
  if (!mentions || mentions.length === 0) return content;

  // Build the list of display strings ("@FullName") with longest
  // first so "@John Smith" wins over "@John" when both exist.
  const handles = mentions
    .map((m) => ({
      display: m.name || "user",
      userId: m.userId,
    }))
    .filter((h) => h.display.length > 0)
    .sort((a, b) => b.display.length - a.display.length);
  if (handles.length === 0) return content;

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `@(${handles.map((h) => escape(h.display)).join("|")})(?=$|[^\\w])`,
    "g"
  );

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIdx) {
      parts.push(content.slice(lastIdx, match.index));
    }
    const display = match[1];
    const handle = handles.find((h) => h.display === display);
    parts.push(
      <span
        key={`mention-${key++}`}
        data-userid={handle?.userId}
        className="inline-flex items-center px-1 py-0.5 rounded bg-[#c9a84c]/15 text-[#a8893a] font-medium text-[13px]"
      >
        @{display}
      </span>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < content.length) {
    parts.push(content.slice(lastIdx));
  }
  return parts;
}

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
