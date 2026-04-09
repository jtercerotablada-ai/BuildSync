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
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Types
interface Notification {
  id: string;
  title: string;
  sender: {
    name: string;
    avatar?: string;
    color: string;
  };
  preview: string;
  createdAt: Date;
  read: boolean;
  type: "task_assigned" | "comment" | "mention" | "update" | "system";
  taskId?: string;
  projectId?: string;
}

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
  const [activeTab, setActiveTab] = useState("activity");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "unread" | "mentions" | "assignments">("all");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest" | "unread">("recent");
  const [density, setDensity] = useState<"detailed" | "compact">("detailed");
  const [showAISummary, setShowAISummary] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [defaultTab, setDefaultTab] = useState("activity");
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

  const fetchNotifications = useCallback(async () => {
    try {
      const archived = activeTab === "archive";
      const res = await fetch(`/api/notifications?archived=${archived}`);
      if (res.ok) {
        const data = await res.json();
        const formattedData = data.map(
          (n: Notification & { createdAt: string }) => ({
            ...n,
            createdAt: new Date(n.createdAt),
          })
        );
        setNotifications(formattedData);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const tabs = [
    { id: "activity", label: "Activity", icon: Bell },
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
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const archiveAll = async () => {
    try {
      const ids = notifications.map((n) => n.id);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, archived: true }),
      });
      setNotifications([]);
    } catch (error) {
      console.error("Error archiving notifications:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.taskId && notification.projectId) {
      router.push(
        `/projects/${notification.projectId}?task=${notification.taskId}`
      );
    } else if (notification.taskId) {
      router.push(`/my-tasks?task=${notification.taskId}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = useMemo(() => {
    if (filterType === "unread") return notifications.filter((n) => !n.read);
    if (filterType === "mentions") return notifications.filter((n) => n.type === "mention");
    if (filterType === "assignments") return notifications.filter((n) => n.type === "task_assigned");
    return notifications;
  }, [notifications, filterType]);

  const groupedNotifications = groupNotificationsByTime(filteredNotifications);

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
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
              onClick={() => {
                notifications.forEach((n) => {
                  if (!n.read) markAsRead(n.id);
                });
              }}
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
                  <span className="ml-0.5 bg-blue-600 text-white text-[10px] leading-none px-1.5 py-[3px] rounded-full min-w-[18px] text-center font-medium">
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
          isDefault={ctxMenu.tabId === defaultTab}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onRename={() => {
            setCtxMenu(null);
          }}
          onSetDefault={() => {
            setDefaultTab(ctxMenu.tabId);
            setCtxMenu(null);
          }}
          onDuplicate={() => {
            setCtxMenu(null);
          }}
          onDelete={() => {
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
        onMarkAllRead={() => {
          notifications.forEach((n) => {
            if (!n.read) markAsRead(n.id);
          });
        }}
        onArchiveAll={archiveAll}
      />

      {/* ─── Content Area ─── */}
      <div className="flex-1 overflow-auto">
        {activeTab === "activity" && (
          <>
            {/* AI Summary Card - hidden on mobile */}
            {showAISummary && <div className="hidden md:block"><InboxSummaryCard
              onDismiss={() => setShowAISummary(false)}
              onViewSummary={async () => {
                setAiSummaryLoading(true);
                try {
                  const summaryText = notifications
                    .slice(0, 10)
                    .map(
                      (n) =>
                        `${n.sender.name}: ${n.title} - ${n.preview}`
                    )
                    .join("\n");
                  const res = await fetch("/api/ai/assist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      prompt:
                        "Summarize these notifications concisely in 2-3 bullet points. Focus on what needs attention:",
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
              <EmptyInbox />
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
                              onClick={() =>
                                handleNotificationClick(notification)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )
                )}

                <button
                  onClick={archiveAll}
                  className="text-[13px] text-gray-500 hover:text-blue-600 hover:underline mt-2 mb-8 px-1"
                >
                  Archive all notifications
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "favorites" && <EmptyFavorites />}
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
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
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
  tabId,
  tabName,
  isDefault,
  x,
  y,
  onClose,
  onRename,
  onSetDefault,
  onDuplicate,
  onDelete,
}: {
  tabId: string;
  tabName: string;
  isDefault: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
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
        onClick={onRename}
        className={cn(itemBase, "text-gray-700 hover:bg-gray-100")}
      >
        <Pencil className="w-3.5 h-3.5 text-gray-400" />
        Rename
      </button>

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

      <button
        onClick={onDuplicate}
        className={cn(itemBase, "text-gray-700 hover:bg-gray-100")}
      >
        <Copy className="w-3.5 h-3.5 text-gray-400" />
        Duplicate
      </button>

      {/* Divider */}
      <div className="my-1 h-px bg-gray-100" />

      <button
        onClick={onDelete}
        className={cn(
          itemBase,
          "text-red-500 hover:bg-red-50"
        )}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
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
function InboxSummaryCard({
  onDismiss,
  onViewSummary,
  aiSummary,
  aiSummaryLoading,
  disabled,
}: {
  onDismiss: () => void;
  onViewSummary: () => void;
  aiSummary: string | null;
  aiSummaryLoading: boolean;
  disabled: boolean;
}) {
  return (
    <div className="mx-8 mt-5 mb-2">
      <div className="relative flex items-center justify-between gap-6 p-5 bg-gradient-to-r from-violet-50/80 via-indigo-50/50 to-blue-50/60 rounded-xl border border-violet-100/60">
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 flex items-center justify-center h-6 w-6 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Left: icon + text */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-violet-100/80 flex-shrink-0">
            <Sparkles className="w-[18px] h-[18px] text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-gray-900 leading-tight">
              Inbox summary
            </p>
            <p className="text-[13px] text-gray-500 mt-0.5 leading-snug">
              Get a summary of your most important notifications with AI.
            </p>
            {aiSummary && (
              <div className="mt-3 p-3 bg-white/80 rounded-lg border border-violet-100/40 text-[13px] text-gray-700 leading-relaxed">
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
  onClick,
}: {
  notification: Notification;
  compact?: boolean;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 rounded-lg cursor-pointer group transition-colors",
        compact ? "py-2" : "py-3",
        !notification.read
          ? "bg-blue-50/40 hover:bg-blue-50/70"
          : "hover:bg-gray-50"
      )}
      onClick={onClick}
    >
      {/* Archive on hover */}
      <button
        className={cn(
          "opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0",
          compact ? "mt-0.5" : "mt-1"
        )}
        onClick={(e) => {
          e.stopPropagation();
          fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [notification.id], archived: true }),
          });
        }}
        title="Archive"
      >
        <Archive className="w-[15px] h-[15px] text-gray-400 hover:text-gray-600" />
      </button>

      {/* Avatar */}
      <div
        className={cn(
          "rounded-full flex items-center justify-center text-white font-medium flex-shrink-0",
          compact ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-[12px]"
        )}
        style={{ backgroundColor: notification.sender.color }}
      >
        {notification.sender.avatar ? (
          <img
            src={notification.sender.avatar}
            alt={notification.sender.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          notification.sender.name.charAt(0).toUpperCase()
        )}
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
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
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
                className="text-[12px] text-blue-600 hover:text-blue-700 mt-0.5"
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
