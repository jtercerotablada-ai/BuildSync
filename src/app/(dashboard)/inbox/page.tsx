"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Archive,
  Star,
  Filter,
  ArrowUpDown,
  Sparkles,
  X,
  ChevronDown,
  MoreHorizontal,
  Loader2,
  Check,
  Settings,
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
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const [showAISummary, setShowAISummary] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const archived = activeTab === "archive";
      const res = await fetch(`/api/notifications?archived=${archived}`);
      if (res.ok) {
        const data = await res.json();
        const formattedData = data.map((n: Notification & { createdAt: string }) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }));
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

  const groupedNotifications = groupNotificationsByTime(notifications);

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
    // Navigate to the task if available
    if (notification.taskId && notification.projectId) {
      router.push(`/projects/${notification.projectId}?task=${notification.taskId}`);
    } else if (notification.taskId) {
      router.push(`/my-tasks?task=${notification.taskId}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-black">Inbox</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-black gap-2">
              <Settings className="w-4 h-4" />
              Manage notifications
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => {
              // Mark all as read
              notifications.forEach(n => { if (!n.read) markAsRead(n.id); });
            }}>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                activeTab === tab.id
                  ? "bg-white text-black font-medium"
                  : "text-black hover:bg-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "activity" && unreadCount > 0 && (
                <span className="bg-black text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-black">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setActiveTab("activity")}>
                All activity
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                setNotifications(prev => prev.filter(n => !n.read));
              }}>
                Unread only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNotifications(prev => prev.filter(n => n.type === "mention"));
              }}>
                Mentions only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNotifications(prev => prev.filter(n => n.type === "task_assigned"));
              }}>
                Assignments only
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={fetchNotifications}>
                Clear filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-black">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Sort: {sortOrder === "recent" ? "Most recent" : "Oldest"}
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => {
                setSortOrder("recent");
                setNotifications(prev => [...prev].sort((a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ));
              }}>
                {sortOrder === "recent" && <Check className="w-4 h-4 mr-2" />}
                {sortOrder !== "recent" && <span className="w-4 mr-2" />}
                Most recent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setSortOrder("oldest");
                setNotifications(prev => [...prev].sort((a, b) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                ));
              }}>
                {sortOrder === "oldest" && <Check className="w-4 h-4 mr-2" />}
                {sortOrder !== "oldest" && <span className="w-4 mr-2" />}
                Oldest first
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-400">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => {
              notifications.forEach(n => { if (!n.read) markAsRead(n.id); });
            }}>
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuItem onClick={archiveAll}>
              Archive all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "activity" && (
          <>
            {/* AI Summary Card */}
            {showAISummary && (
              <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-violet-50 to-blue-50 rounded-lg border border-violet-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-600" />
                    <span className="font-medium text-black">
                      Inbox summary
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAISummary(false)}
                    className="text-slate-400 hover:text-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-black mt-2">
                  Get a summary of your most important notifications with AI.
                </p>
                {aiSummary && (
                  <div className="mt-3 p-3 bg-white rounded-lg border text-sm text-slate-700">
                    {aiSummary}
                  </div>
                )}
                <div className="flex items-center justify-end mt-3">
                  <Button
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800"
                    disabled={aiSummaryLoading || notifications.length === 0}
                    onClick={async () => {
                      setAiSummaryLoading(true);
                      try {
                        const summaryText = notifications.slice(0, 10).map(n =>
                          `${n.sender.name}: ${n.title} - ${n.preview}`
                        ).join('\n');
                        const res = await fetch('/api/ai/assist', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            prompt: 'Summarize these notifications concisely in 2-3 bullet points. Focus on what needs attention:',
                            text: summaryText,
                          }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setAiSummary(data.result);
                        }
                      } catch {
                        setAiSummary('Could not generate summary. Please try again.');
                      } finally {
                        setAiSummaryLoading(false);
                      }
                    }}
                  >
                    {aiSummaryLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'View summary'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Notifications grouped by time */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyInbox />
            ) : (
              <div className="px-6 py-4">
                {Object.entries(groupedNotifications).map(
                  ([period, notifs]) =>
                    notifs.length > 0 && (
                      <div key={period} className="mb-6">
                        <h3 className="text-xs font-medium text-black uppercase tracking-wide mb-2">
                          {period}
                        </h3>
                        <div className="border-t border-slate-200 pt-2">
                          <div className="space-y-1">
                            {notifs.map((notification) => (
                              <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onClick={() => handleNotificationClick(notification)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                )}

                {/* Archive all link */}
                <button
                  onClick={archiveAll}
                  className="text-sm text-black hover:text-blue-700 hover:underline mt-4"
                >
                  Archive all notifications
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "favorites" && <EmptyFavorites />}

        {activeTab === "archive" && <EmptyArchive />}
      </div>
    </div>
  );
}

// Notification Item Component
function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer group transition-colors",
        !notification.read && "bg-blue-50/50"
      )}
      onClick={onClick}
    >
      {/* Archive on hover */}
      <button
        className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:text-black"
        onClick={(e) => {
          e.stopPropagation();
          // Archive this notification
          fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [notification.id], archived: true }),
          });
        }}
        title="Archive"
      >
        <Archive className="w-4 h-4 text-slate-400 hover:text-slate-600" />
      </button>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
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
              "text-sm text-black",
              !notification.read && "font-medium"
            )}
          >
            {notification.title}
          </p>
          {/* Unread indicator */}
          {!notification.read && (
            <div className="w-2 h-2 bg-black rounded-full flex-shrink-0 mt-1.5" />
          )}
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs text-black">
            {notification.sender.name}
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-400">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>

        <p
          className={cn(
            "text-sm text-black mt-1",
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
            className="text-xs text-black hover:text-blue-700 mt-1"
          >
            {expanded ? "Show less" : "See more"}
          </button>
        )}
      </div>
    </div>
  );
}

// Empty States
function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4">
        <Bell className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-black mb-2">
        You&apos;re all caught up!
      </h3>
      <p className="text-sm text-black text-center max-w-sm">
        Notifications about tasks assigned to you, comments, and mentions will
        appear here.
      </p>
    </div>
  );
}

function EmptyFavorites() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4">
        <Star className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-black mb-2">
        No favorites yet
      </h3>
      <p className="text-sm text-black text-center max-w-sm">
        Star important notifications to find them quickly here.
      </p>
    </div>
  );
}

function EmptyArchive() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4">
        <Archive className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-black mb-2">
        No archived notifications
      </h3>
      <p className="text-sm text-black text-center max-w-sm">
        When you archive notifications, they&apos;ll appear here.
      </p>
    </div>
  );
}
