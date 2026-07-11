"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Archive,
  Star,
  Filter,
  Sparkles,
  X,
  ChevronDown,
  MoreHorizontal,
  Loader2,
  Check,
  Settings,
  List,
  Rows3,
  AtSign,
  MessageCircle,
  CheckSquare,
  CheckCircle2,
  Mail,
  Inbox as InboxIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUiState } from "@/hooks/use-ui-state";

// Types
interface Notification {
  id: string;
  title: string;
  sender: {
    name: string;
    avatar?: string | null;
    color: string;
  };
  preview: string;
  createdAt: Date;
  read: boolean;
  type:
    | "task_assigned"
    | "comment"
    | "mention"
    | "update"
    | "system"
    | "form_submitted";
  taskId?: string;
  projectId?: string;
  // Set for TEAM message mentions — deep-links to the team's own
  // Messages page (/teams/[teamId]/messages) instead of a project tab.
  teamId?: string;
  // Set when a mention notification points at a specific message —
  // the inbox uses this to deep-link straight to the message in
  // the project's Messages tab (with scroll + highlight).
  messageId?: string;
  rootMessageId?: string;
}

// Visual type metadata. Each notification type gets a small icon
// overlay + a color that distinguishes mention/comment/assign/etc.
// at a glance, without hiding the sender's avatar.
const TYPE_META: Record<
  Notification["type"],
  {
    icon: React.ComponentType<{
      className?: string;
      style?: React.CSSProperties;
    }>;
    color: string;
    label: string;
  }
> = {
  mention: { icon: AtSign, color: "#c9a84c", label: "Mention" },
  comment: { icon: MessageCircle, color: "#0a0a0a", label: "Comment" },
  task_assigned: {
    icon: CheckSquare,
    color: "#0a0a0a",
    label: "Assigned",
  },
  update: { icon: CheckCircle2, color: "#a8893a", label: "Update" },
  system: { icon: Mail, color: "#6b7280", label: "System" },
  form_submitted: {
    icon: InboxIcon,
    color: "#a8893a",
    label: "Form submission",
  },
};

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  } else {
    return "Just now";
  }
}

export default function InboxPage() {
  const router = useRouter();
  // Persisted "default tab" (context-menu → Set as default). We seed
  // activeTab from it once uiState hydrates (see effect below).
  const {
    value: persistedDefaultTab,
    setValue: setPersistedDefaultTab,
    isHydrated: defaultTabHydrated,
  } = useUiState<string>("inbox.defaultTab", "activity");
  // Persisted favorites — array of notification ids the user starred.
  const { value: favorites, setValue: setFavorites } = useUiState<string[]>(
    "inbox.favorites",
    []
  );
  const [activeTab, setActiveTab] = useState("activity");
  // Only apply the persisted default once, on first hydration, so we
  // don't fight the user's in-session tab clicks.
  const appliedDefaultRef = useRef(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Server-computed unread count (read=false AND archived=false),
  // independent of the current tab/filter/page. Drives the Activity
  // badge so it never shows archived rows.
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  // Opaque cursor for the next (older) page; null when no more.
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // True once the user has pulled in extra pages via "Load more". While
  // true, the 30s poll must NOT replace the list (that would discard the
  // loaded pages and jump back to page 1) — it only refreshes the count.
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  // Monotonic request generation. Bumped on every scope change (tab
  // switch) so an in-flight loadMore/fetch that resolves late can detect
  // its scope is stale and drop its result instead of appending rows
  // from the wrong tab.
  const scopeGenRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "unread" | "mentions" | "assignments">("all");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest" | "unread">("recent");
  const [density, setDensity] = useState<"detailed" | "compact">("detailed");
  const [showAISummary, setShowAISummary] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  // Asana's "Período: Semana anterior" selector — narrows the time
  // window the AI summary considers. Default to last-week (matches
  // Asana's default).
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("last-week");
  const [ctxMenu, setCtxMenu] = useState<{
    tabId: string;
    tabLabel: string;
    x: number;
    y: number;
  } | null>(null);

  const handleTabContextMenu = (
    e: React.MouseEvent,
    tabId: string,
    tabLabel: string
  ) => {
    e.preventDefault();
    // Clamp to viewport
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 220);
    setCtxMenu({ tabId, tabLabel, x, y });
  };

  // Favorites are logically part of the "activity" stream (non-archived
  // notifications), so we hit the same archived=false endpoint for them.
  const isArchivedScope = activeTab === "archive";

  const fetchNotifications = useCallback(async () => {
    // Snapshot the generation for this scope; if the user switches tabs
    // before this resolves, gen won't match and we drop the (stale) result.
    const gen = scopeGenRef.current;
    try {
      const res = await fetch(
        `/api/notifications?archived=${isArchivedScope}`
      );
      if (res.ok) {
        const data = await res.json();
        if (gen !== scopeGenRef.current) return;
        // New GET shape: { notifications, nextCursor, unreadCount }.
        // Stay tolerant of the legacy bare-array shape during rollout.
        const rows: (Notification & { createdAt: string })[] = Array.isArray(
          data
        )
          ? data
          : data.notifications ?? [];
        const formattedData = rows.map((n) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }));
        setNotifications(formattedData);
        setNextCursor(Array.isArray(data) ? null : data.nextCursor ?? null);
        // Replacing the list resets pagination back to the first page.
        setHasLoadedMore(false);
        if (!Array.isArray(data) && typeof data.unreadCount === "number") {
          setServerUnreadCount(data.unreadCount);
        }
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      if (gen === scopeGenRef.current) setLoading(false);
    }
  }, [isArchivedScope]);

  // Lightweight count-only refresh — used by the poll while the user has
  // paginated, so we keep the Activity badge fresh without replacing the
  // list (which would discard loaded pages). unreadCount is independent
  // of limit, so limit=1 fetches a single row.
  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?archived=false&limit=1", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) && typeof data.unreadCount === "number") {
        setServerUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Error refreshing unread count:", error);
    }
  }, []);

  // Fetch the next (older) page and append it to the current list.
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    // Capture the scope generation at click time; if the user switches
    // tabs before this resolves, gen won't match and we drop the result
    // instead of appending rows from the wrong (e.g. archived) scope.
    const gen = scopeGenRef.current;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/notifications?archived=${isArchivedScope}&cursor=${encodeURIComponent(
          nextCursor
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        if (gen !== scopeGenRef.current) return;
        const rows: (Notification & { createdAt: string })[] = Array.isArray(
          data
        )
          ? data
          : data.notifications ?? [];
        const formattedData = rows.map((n) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }));
        setNotifications((prev) => [...prev, ...formattedData]);
        setNextCursor(Array.isArray(data) ? null : data.nextCursor ?? null);
        // Mark that the list now holds more than the first page, so the
        // poll won't replace (and discard) these appended rows.
        setHasLoadedMore(true);
        if (!Array.isArray(data) && typeof data.unreadCount === "number") {
          setServerUnreadCount(data.unreadCount);
        }
      }
    } catch (error) {
      console.error("Error loading more notifications:", error);
    } finally {
      if (gen === scopeGenRef.current) setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, isArchivedScope]);

  // Seed the active tab from the persisted default exactly once, after
  // uiState hydrates. Guarded so a user's tab click is never overridden.
  useEffect(() => {
    if (defaultTabHydrated && !appliedDefaultRef.current) {
      appliedDefaultRef.current = true;
      if (persistedDefaultTab && persistedDefaultTab !== "activity") {
        setActiveTab(persistedDefaultTab);
      }
    }
  }, [defaultTabHydrated, persistedDefaultTab]);

  // On scope change (tab switch that flips archived), invalidate any
  // in-flight requests and reset pagination so a late loadMore can't
  // append rows from the previous scope, and the poll starts fresh.
  useEffect(() => {
    scopeGenRef.current += 1;
    setNextCursor(null);
    setHasLoadedMore(false);
  }, [isArchivedScope]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time polling — refresh every 30s while the tab is visible.
  // Slower cadence than messages-view (10s) because the inbox is
  // glance-able rather than chat-like; 30s is a fair freshness/cost
  // trade-off. Pauses while hidden; refreshes immediately on focus.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (document.hidden) return;
      // If the user has loaded extra pages, replacing the list would
      // discard them and jump back to page 1. Only refresh the count.
      if (hasLoadedMore) {
        void refreshUnreadCount();
      } else {
        void fetchNotifications();
      }
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(tick, 30000);
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
  }, [fetchNotifications, hasLoadedMore, refreshUnreadCount]);

  const tabs = [
    { id: "activity", label: "Activity", icon: Bell },
    { id: "mentions", label: "Mentions", icon: AtSign },
    { id: "favorites", label: "Favorites", icon: Star },
    { id: "archive", label: "Archive", icon: Archive },
  ];

  // Group notifications by time
  const groupNotificationsByTime = (notifs: Notification[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const groups: { [key: string]: Notification[] } = {
      Today: [],
      Yesterday: [],
      "This week": [],
      Earlier: [],
    };

    notifs.forEach((notif) => {
      const date = new Date(notif.createdAt);
      if (date >= today) {
        groups["Today"].push(notif);
      } else if (date >= yesterday) {
        groups["Yesterday"].push(notif);
      } else if (date >= thisWeek) {
        groups["This week"].push(notif);
      } else {
        groups["Earlier"].push(notif);
      }
    });

    return groups;
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], read: true }),
      });
      setNotifications((prev) => {
        // Only decrement the server unread badge if this row was actually
        // unread (and non-archived) — otherwise the count would drift.
        const target = prev.find((n) => n.id === id);
        if (target && !target.read) {
          setServerUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Single-shot mark-all — the backend supports a `markAllRead: true` flag
  // (route.ts:72), so we issue ONE PATCH instead of N parallel requests.
  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      // Server marks every non-archived row read, so the unread badge is 0.
      setServerUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // Optimistic single-archive — remove from the list immediately, restore on error.
  const archiveOne = async (id: string) => {
    const prev = notifications;
    // Archiving an unread row removes it from the (unread AND non-archived)
    // set the badge counts, so decrement optimistically; restore on error.
    const target = prev.find((n) => n.id === id);
    const wasUnread = !!target && !target.read;
    setNotifications((cur) => cur.filter((n) => n.id !== id));
    if (wasUnread) setServerUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], archived: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      console.error("Error archiving notification:", error);
      setNotifications(prev);
      if (wasUnread) setServerUnreadCount((c) => c + 1);
    }
  };

  // Server-side archive-all — one PATCH archives EVERY non-archived row
  // for the caller (not just the loaded page), then we refetch to get
  // the fresh list + server unreadCount.
  const archiveAll = async () => {
    const prev = notifications;
    setNotifications([]);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveAll: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchNotifications();
    } catch (error) {
      console.error("Error archiving notifications:", error);
      setNotifications(prev);
    }
  };

  // Optimistic single-unarchive — used on the Archive tab. Removes the
  // row from the archived list and flips archived=false server-side.
  const unarchiveOne = async (id: string) => {
    const prev = notifications;
    setNotifications((cur) => cur.filter((n) => n.id !== id));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], archived: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      console.error("Error unarchiving notification:", error);
      setNotifications(prev);
    }
  };

  // Toggle a notification's favorite status (persisted in uiState).
  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);

    // Team message mention: deep-link to the team's own Messages page.
    // messages-view.tsx reads ?message= and ?thread= regardless of scope.
    if (notification.type === "mention" && notification.teamId) {
      const params = new URLSearchParams();
      if (notification.messageId) {
        params.set("message", notification.messageId);
      }
      if (
        notification.rootMessageId &&
        notification.rootMessageId !== notification.messageId
      ) {
        params.set("thread", notification.rootMessageId);
      }
      const qs = params.toString();
      router.push(
        `/teams/${notification.teamId}/messages${qs ? `?${qs}` : ""}`
      );
      return;
    }

    // Mention deep-link: open the project's Messages tab and scroll
    // to the specific message id. messages-view.tsx reads ?message=
    // and highlights it. The project page reads `?view=` to pick
    // the active tab (see app/(dashboard)/projects/[id]/page.tsx).
    if (notification.type === "mention" && notification.projectId) {
      const params = new URLSearchParams();
      params.set("view", "messages");
      if (notification.messageId) {
        params.set("message", notification.messageId);
      }
      if (
        notification.rootMessageId &&
        notification.rootMessageId !== notification.messageId
      ) {
        // For a mention inside a reply, open the parent thread too.
        params.set("thread", notification.rootMessageId);
      }
      router.push(`/projects/${notification.projectId}?${params.toString()}`);
      return;
    }

    if (notification.taskId && notification.projectId) {
      router.push(
        `/projects/${notification.projectId}?task=${notification.taskId}`
      );
    } else if (notification.taskId) {
      router.push(`/my-tasks?task=${notification.taskId}`);
    } else if (notification.projectId) {
      router.push(`/projects/${notification.projectId}`);
    }
  };

  // Use the SERVER unread count for the badge — it's the count of
  // read=false AND archived=false rows regardless of the loaded page,
  // so the badge never desyncs with archived/paged local state.
  const unreadCount = serverUnreadCount;

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const filteredNotifications = useMemo(() => {
    // Tab acts as the primary scope; the Filter dropdown narrows
    // further inside that scope. "Mentions" tab is a hard filter to
    // type === "mention", matching Asana's dedicated @-mentions tab.
    // "Favorites" keeps only starred notifications from the activity
    // stream.
    let scope = notifications;
    if (activeTab === "mentions") {
      scope = scope.filter((n) => n.type === "mention");
    } else if (activeTab === "favorites") {
      scope = scope.filter((n) => favoriteSet.has(n.id));
    }
    if (filterType === "unread") return scope.filter((n) => !n.read);
    if (filterType === "mentions") return scope.filter((n) => n.type === "mention");
    if (filterType === "assignments") return scope.filter((n) => n.type === "task_assigned");
    return scope;
  }, [notifications, filterType, activeTab, favoriteSet]);

  const groupedNotifications = groupNotificationsByTime(filteredNotifications);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between px-4 md:px-8 pt-5 md:pt-7 pb-1">
        <h1 className="text-lg md:text-xl font-semibold text-gray-900 tracking-[-0.01em]">
          Inbox
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
              <Settings className="w-[15px] h-[15px]" />
              <span className="hidden md:inline">Manage notifications</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => router.push("/settings?tab=notifications")}
            >
              <Settings className="w-4 h-4 mr-2" />
              Notification settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-medium text-gray-400">
              Quick actions
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={markAllAsRead}
            >
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuItem onClick={archiveAll}>
              <Archive className="w-4 h-4 mr-2" />
              Archive all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ─── Tabs ─── */}
      <div className="relative px-4 md:px-8">
        <div className="flex items-center gap-4 md:gap-6 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onContextMenu={(e) =>
                  handleTabContextMenu(e, tab.id, tab.label)
                }
                className={cn(
                  "relative flex items-center gap-1.5 pb-2.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="hidden md:block w-[15px] h-[15px]" />
                <span className="text-xs md:text-[13px]">{tab.label}</span>
                {tab.id === "activity" && unreadCount > 0 && (
                  <span className="ml-0.5 bg-[#c9a84c] text-white text-[10px] leading-none px-1.5 py-[3px] rounded-full min-w-[18px] text-center font-medium">
                    {unreadCount}
                  </span>
                )}
                {/* Active underline indicator */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
        {/* Divider */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200" />
      </div>

      {/* Tab context menu */}
      {ctxMenu && (
        <TabContextMenu
          tabId={ctxMenu.tabId}
          tabName={ctxMenu.tabLabel}
          isDefault={ctxMenu.tabId === persistedDefaultTab}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onSetDefault={() => {
            setPersistedDefaultTab(ctxMenu.tabId);
            setCtxMenu(null);
          }}
        />
      )}

      {/* ─── Filter Toolbar ─── */}
      <InboxToolbar
        sortOrder={sortOrder}
        density={density}
        onSortChange={(val) => {
          setSortOrder(val);
          if (val === "recent") {
            setNotifications((prev) =>
              [...prev].sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )
            );
          } else if (val === "oldest") {
            setNotifications((prev) =>
              [...prev].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              )
            );
          } else if (val === "unread") {
            setNotifications((prev) =>
              [...prev].sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1))
            );
          }
        }}
        onDensityChange={setDensity}
        onFilter={(type) => {
          setFilterType(type as "all" | "unread" | "mentions" | "assignments");
        }}
        onMarkAllRead={markAllAsRead}
        onArchiveAll={archiveAll}
      />

      {/* ─── Content Area ─── */}
      <div className="flex-1 overflow-auto">
        {(activeTab === "activity" ||
          activeTab === "mentions" ||
          activeTab === "favorites") && (
          <>
            {/* AI Summary Card - hidden on mobile */}
            {activeTab !== "favorites" && showAISummary && <div className="hidden md:block"><InboxSummaryCard
              onDismiss={() => setShowAISummary(false)}
              period={summaryPeriod}
              onPeriodChange={setSummaryPeriod}
              onViewSummary={async () => {
                setAiSummaryLoading(true);
                try {
                  // Time window for the AI prompt — derived from the
                  // user's selected period. Notifications older than
                  // this cutoff are excluded from the summary input.
                  const now = Date.now();
                  const daysBack =
                    summaryPeriod === "last-week"
                      ? 7
                      : summaryPeriod === "last-month"
                        ? 30
                        : 30;
                  const cutoff = now - daysBack * 24 * 60 * 60 * 1000;
                  const periodLabel =
                    summaryPeriod === "last-week"
                      ? "last 7 days"
                      : summaryPeriod === "last-month"
                        ? "last calendar month"
                        : "last 30 days";
                  const summaryText = notifications
                    .filter((n) => new Date(n.createdAt).getTime() >= cutoff)
                    .slice(0, 20)
                    .map(
                      (n) =>
                        `${n.sender.name}: ${n.title} - ${n.preview}`
                    )
                    .join("\n");
                  const res = await fetch("/api/ai/assist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      prompt: `Summarize these notifications from the ${periodLabel} concisely in 2-3 bullet points. Focus on what needs attention:`,
                      text: summaryText,
                    }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setAiSummary(data.result);
                  }
                } catch {
                  setAiSummary(
                    "Could not generate summary. Please try again."
                  );
                } finally {
                  setAiSummaryLoading(false);
                }
              }}
              aiSummary={aiSummary}
              aiSummaryLoading={aiSummaryLoading}
              disabled={filteredNotifications.length === 0}
            /></div>}

            {/* Notifications grouped by time */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              activeTab === "favorites" ? (
                <EmptyFavorites />
              ) : (
                <EmptyInbox />
              )
            ) : (
              <div className="px-4 md:px-8 py-4">
                {Object.entries(groupedNotifications).map(
                  ([period, notifs]) =>
                    notifs.length > 0 && (
                      <div key={period} className="mb-6">
                        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                          {period}
                        </h3>
                        <div className="space-y-px">
                          {notifs.map((notification) => (
                            <NotificationItem
                              key={notification.id}
                              notification={notification}
                              compact={density === "compact"}
                              favorited={favoriteSet.has(notification.id)}
                              onToggleFavorite={() =>
                                toggleFavorite(notification.id)
                              }
                              onClick={() =>
                                handleNotificationClick(notification)
                              }
                              onArchive={() => archiveOne(notification.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                )}

                {/* Load more (older) — only when the server says there's
                    another page. Favorites are filtered client-side, so
                    fetching more activity may surface more favorites. */}
                {nextCursor && (
                  <div className="flex justify-center mt-2 mb-4">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-1.5 text-[13px] text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load more"
                      )}
                    </button>
                  </div>
                )}

                {activeTab !== "favorites" && (
                  <button
                    onClick={archiveAll}
                    className="text-[13px] text-gray-500 hover:text-[#a8893a] hover:underline mt-2 mb-8 px-1"
                  >
                    Archive all notifications
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "archive" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyArchive />
            ) : (
              <div className="px-6 py-4 space-y-1">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    compact={density === "compact"}
                    archived
                    favorited={favoriteSet.has(notification.id)}
                    onToggleFavorite={() => toggleFavorite(notification.id)}
                    onClick={() => handleNotificationClick(notification)}
                    onArchive={() => unarchiveOne(notification.id)}
                  />
                ))}

                {nextCursor && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-1.5 text-[13px] text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load more"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Toolbar Components ─── */

const SORT_OPTIONS: { value: "recent" | "oldest" | "unread"; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "unread", label: "Unread first" },
];

const DENSITY_OPTIONS: { value: "detailed" | "compact"; label: string }[] = [
  { value: "detailed", label: "Detailed" },
  { value: "compact", label: "Compact" },
];

/* ─── Tab Context Menu ─── */
function TabContextMenu({
  isDefault,
  x,
  y,
  onClose,
  onSetDefault,
}: {
  tabId: string;
  tabName: string;
  isDefault: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onSetDefault: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const itemBase =
    "flex items-center gap-2.5 w-full px-3 py-[7px] text-[13px] rounded-md transition-colors text-left";

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-[192px] rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
      style={{ top: y, left: x }}
    >
      <button
        onClick={isDefault ? undefined : onSetDefault}
        disabled={isDefault}
        className={cn(
          itemBase,
          isDefault
            ? "text-gray-400 cursor-not-allowed opacity-50"
            : "text-gray-700 hover:bg-gray-100"
        )}
      >
        <Check className="w-3.5 h-3.5 text-gray-400" />
        Set as default
      </button>
    </div>
  );
}

function FilterButton({
  onFilter,
}: {
  onFilter: (type: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[6px] border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Filter className="w-3.5 h-3.5 text-gray-500" />
          Filter
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[200px] rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
      >
        <DropdownMenuItem
          onClick={() => onFilter("all")}
          className="rounded-md px-3 py-2 text-[13px] text-gray-700"
        >
          All activity
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onClick={() => onFilter("unread")}
          className="rounded-md px-3 py-2 text-[13px] text-gray-700"
        >
          Unread only
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onFilter("mentions")}
          className="rounded-md px-3 py-2 text-[13px] text-gray-700"
        >
          Mentions only
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onFilter("assignments")}
          className="rounded-md px-3 py-2 text-[13px] text-gray-700"
        >
          Assignments only
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onClick={() => onFilter("all")}
          className="rounded-md px-3 py-2 text-[13px] text-gray-500"
        >
          Clear filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DensityDropdown({
  value,
  onChange,
}: {
  value: "detailed" | "compact";
  onChange: (v: "detailed" | "compact") => void;
}) {
  const current = DENSITY_OPTIONS.find((o) => o.value === value)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[6px] border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Rows3 className="w-3.5 h-3.5 text-gray-500" />
          <span>
            Density: <span className="text-gray-900">{current.label}</span>
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[180px] rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
      >
        {DENSITY_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-gray-700"
          >
            <span className="w-4 flex-shrink-0">
              {value === opt.value && (
                <Check className="w-3.5 h-3.5 text-gray-900" />
              )}
            </span>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: "recent" | "oldest" | "unread";
  onChange: (v: "recent" | "oldest" | "unread") => void;
}) {
  const current = SORT_OPTIONS.find((o) => o.value === value)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[6px] border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <List className="w-3.5 h-3.5 text-gray-500" />
          <span>
            Sort: <span className="text-gray-900">{current.label}</span>
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-[180px] rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
      >
        {SORT_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-gray-700"
          >
            <span className="w-4 flex-shrink-0">
              {value === opt.value && (
                <Check className="w-3.5 h-3.5 text-gray-900" />
              )}
            </span>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InboxToolbar({
  sortOrder,
  density,
  onSortChange,
  onDensityChange,
  onFilter,
  onMarkAllRead,
  onArchiveAll,
}: {
  sortOrder: "recent" | "oldest" | "unread";
  density: "detailed" | "compact";
  onSortChange: (v: "recent" | "oldest" | "unread") => void;
  onDensityChange: (v: "detailed" | "compact") => void;
  onFilter: (type: string) => void;
  onMarkAllRead: () => void;
  onArchiveAll: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 md:px-8 py-2 border-b border-gray-100">
      {/* Left group */}
      <div className="flex items-center gap-2 md:gap-3">
        <FilterButton onFilter={onFilter} />
        <span className="hidden md:block"><DensityDropdown value={density} onChange={onDensityChange} /></span>
      </div>

      {/* Right group */}
      <div className="flex items-center gap-2 md:gap-3">
        <span className="hidden md:block"><SortDropdown value={sortOrder} onChange={onSortChange} /></span>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center h-[32px] w-[32px] rounded-[6px] border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-[200px] rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
          >
            <DropdownMenuItem
              onClick={onMarkAllRead}
              className="rounded-md px-3 py-2 text-[13px] text-gray-700"
            >
              <Check className="w-3.5 h-3.5 mr-2 text-gray-500" />
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onArchiveAll}
              className="rounded-md px-3 py-2 text-[13px] text-gray-700"
            >
              <Archive className="w-3.5 h-3.5 mr-2 text-gray-500" />
              Archive all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/* ─── Summary Card Component ─── */

type SummaryPeriod = "last-week" | "last-month" | "last-30-days";

const SUMMARY_PERIOD_LABEL: Record<SummaryPeriod, string> = {
  "last-week": "Last week",
  "last-month": "Last month",
  "last-30-days": "Last 30 days",
};

function InboxSummaryCard({
  onDismiss,
  onViewSummary,
  aiSummary,
  aiSummaryLoading,
  disabled,
  period,
  onPeriodChange,
}: {
  onDismiss: () => void;
  onViewSummary: () => void;
  aiSummary: string | null;
  aiSummaryLoading: boolean;
  disabled: boolean;
  // Asana's "Período" selector — narrows the window the AI uses
  // when building the summary. Default "last-week" matches what
  // Asana shows out of the box.
  period: SummaryPeriod;
  onPeriodChange: (p: SummaryPeriod) => void;
}) {
  return (
    <div className="mx-8 mt-5 mb-2">
      <div className="relative flex items-center justify-between gap-6 p-5 bg-gradient-to-r from-gray-100 via-gray-100 to-gray-100 rounded-xl border border-gray-200">
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 flex items-center justify-center h-6 w-6 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Left: icon + text */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gray-100/80 flex-shrink-0">
            <Sparkles className="w-[18px] h-[18px] text-black" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-gray-900 leading-tight">
              Inbox summary
            </p>
            <p className="text-[13px] text-gray-500 mt-0.5 leading-snug">
              Get a summary of your most important notifications with AI.
            </p>
            {/* Period selector — Asana shows "Período: Semana
                anterior ▼" beneath the subtitle, so the user picks
                the window before requesting the summary. */}
            <div className="mt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1 text-[12px] text-gray-600 hover:text-gray-900"
                  >
                    <span className="font-medium text-gray-500">Period:</span>
                    <span className="text-gray-700">{SUMMARY_PERIOD_LABEL[period]}</span>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={4}
                  className="w-[160px] rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
                >
                  {(Object.entries(SUMMARY_PERIOD_LABEL) as [SummaryPeriod, string][]).map(
                    ([id, label]) => (
                      <DropdownMenuItem
                        key={id}
                        onClick={() => onPeriodChange(id)}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-gray-700"
                      >
                        <span className="w-4 flex-shrink-0">
                          {period === id && (
                            <Check className="w-3.5 h-3.5 text-gray-900" />
                          )}
                        </span>
                        {label}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {aiSummary && (
              <div className="mt-3 p-3 bg-white/80 rounded-lg border border-gray-200 text-[13px] text-gray-700 leading-relaxed">
                {aiSummary}
              </div>
            )}
          </div>
        </div>

        {/* Right: CTA */}
        <div className="flex-shrink-0 pr-5">
          <Button
            size="sm"
            className="h-8 px-4 bg-gray-800 hover:bg-gray-700 text-white text-[13px] font-medium rounded-lg shadow-sm"
            disabled={aiSummaryLoading || disabled}
            onClick={onViewSummary}
          >
            {aiSummaryLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              "View summary"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Notification Item Component ─── */
function NotificationItem({
  notification,
  compact = false,
  archived = false,
  favorited = false,
  onToggleFavorite,
  onClick,
  onArchive,
}: {
  notification: Notification;
  compact?: boolean;
  // On the Archive tab the row action UNARCHIVES rather than archives.
  archived?: boolean;
  favorited?: boolean;
  onToggleFavorite?: () => void;
  onClick: () => void;
  onArchive?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[notification.type] ?? TYPE_META.system;
  const TypeIcon = meta.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 rounded-lg cursor-pointer group transition-colors",
        compact ? "py-2" : "py-3",
        !notification.read
          ? "bg-[#c9a84c]/5 hover:bg-[#c9a84c]/10"
          : "hover:bg-gray-50"
      )}
      onClick={onClick}
    >
      {/* Row actions on hover — star (favorite) + archive/unarchive.
          A favorited star stays visible even when not hovering. */}
      <div
        className={cn(
          "flex items-center gap-1.5 flex-shrink-0",
          compact ? "mt-0.5" : "mt-1"
        )}
      >
        <button
          className={cn(
            "transition-opacity",
            favorited
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.();
          }}
          title={favorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            className={cn(
              "w-[15px] h-[15px]",
              favorited
                ? "fill-[#c9a84c] text-[#c9a84c]"
                : "text-gray-400 hover:text-gray-600"
            )}
          />
        </button>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onArchive?.();
          }}
          title={archived ? "Unarchive" : "Archive"}
        >
          <Archive className="w-[15px] h-[15px] text-gray-400 hover:text-gray-600" />
        </button>
      </div>

      {/* Avatar with type-icon overlay */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "rounded-full flex items-center justify-center text-white font-medium overflow-hidden",
            compact ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-[12px]"
          )}
          style={
            notification.sender.avatar
              ? undefined
              : { backgroundColor: notification.sender.color }
          }
        >
          {notification.sender.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={notification.sender.avatar}
              alt={notification.sender.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            notification.sender.name.charAt(0).toUpperCase()
          )}
        </div>
        {/* Type badge — small overlapping circle in the bottom-right
            so users see "this is a mention / comment / assignment"
            without reading the title. */}
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full bg-white flex items-center justify-center border",
            compact ? "w-3.5 h-3.5" : "w-4 h-4"
          )}
          style={{ borderColor: meta.color }}
          title={meta.label}
        >
          <TypeIcon
            className={cn(compact ? "w-2 h-2" : "w-2.5 h-2.5")}
            style={{ color: meta.color }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-[13px] text-gray-900 leading-snug",
              !notification.read && "font-semibold"
            )}
          >
            {notification.title}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[12px] text-gray-400">
              {formatRelativeTime(notification.createdAt)}
            </span>
            {!notification.read && (
              <div className="w-2 h-2 bg-[#c9a84c] rounded-full" />
            )}
          </div>
        </div>

        {!compact && (
          <span className="text-[12px] text-gray-500 mt-0.5 block">
            {notification.sender.name}
          </span>
        )}

        {!compact && (
          <>
            <p
              className={cn(
                "text-[13px] text-gray-500 mt-1 leading-relaxed",
                !expanded && "line-clamp-2"
              )}
            >
              {notification.preview}
            </p>

            {notification.preview.length > 100 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="text-[12px] text-[#a8893a] hover:text-[#a8893a] mt-0.5"
              >
                {expanded ? "Show less" : "See more"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Reusable Empty State ─── */
function InboxEmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[420px]">
      <div className="flex flex-col items-center text-center max-w-full md:max-w-[420px] mx-auto px-4 md:px-6">
        {/* Icon container — 64px circle, light grey bg */}
        <div className="w-16 h-16 rounded-full bg-[#f3f4f6] flex items-center justify-center mb-6">
          <Icon className="w-[22px] h-[22px] text-gray-400" />
        </div>
        {/* Title */}
        <h3 className="text-[15px] font-semibold text-gray-900 mb-2 leading-snug">
          {title}
        </h3>
        {/* Subtitle */}
        <p className="text-[13px] text-gray-500 leading-[1.6]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function EmptyInbox() {
  return (
    <InboxEmptyState
      icon={Bell}
      title="You're all caught up!"
      subtitle="Notifications about tasks assigned to you, comments, and mentions will appear here."
    />
  );
}

function EmptyFavorites() {
  return (
    <InboxEmptyState
      icon={Star}
      title="No favorites yet"
      subtitle="Star important notifications to find them quickly here."
    />
  );
}

function EmptyArchive() {
  return (
    <InboxEmptyState
      icon={Archive}
      title="No archived notifications"
      subtitle="When you archive notifications, they'll appear here."
    />
  );
}
