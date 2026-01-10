"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Archive,
  Star,
  Plus,
  Filter,
  ArrowUpDown,
  Sparkles,
  X,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("activity");
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "Welcome to BuildSync! Your tools are ready.",
      sender: { name: "BuildSync", color: "#3B82F6" },
      preview:
        "Integrate your favorite tools for your workflow. Get started with project management, task tracking, and team collaboration.",
      createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
      read: false,
      type: "system",
    },
    {
      id: "2",
      title: "New task assigned: Review documentation",
      sender: { name: "Juan Tercero", color: "#8B5CF6" },
      preview:
        'You have been assigned a new task in the project "Website Redesign". Please review the documentation and provide feedback.',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      read: false,
      type: "task_assigned",
    },
    {
      id: "3",
      title: "Comment on: Setup project structure",
      sender: { name: "Maria Garcia", color: "#EC4899" },
      preview:
        "Great work on the initial setup! I have a few suggestions for the folder structure that might help with scalability.",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      read: true,
      type: "comment",
    },
  ]);
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const [showAISummary, setShowAISummary] = useState(true);

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

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const archiveAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-slate-900">Inbox</h1>
        <Button variant="ghost" size="sm" className="text-slate-600">
          Manage notifications
        </Button>
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
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "activity" && unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md ml-1">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-slate-600">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-600">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            Sort: {sortOrder === "recent" ? "Most recent" : "Oldest"}
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-400">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
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
                    <span className="font-medium text-slate-900">
                      Inbox summary
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAISummary(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-slate-600 mt-2">
                  Get a summary of your most important notifications with AI.
                </p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Period:</span>
                    <Button variant="outline" size="sm" className="h-8">
                      Last week
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                  <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
                    View summary
                  </Button>
                </div>
              </div>
            )}

            {/* Notifications grouped by time */}
            {notifications.length === 0 ? (
              <EmptyInbox />
            ) : (
              <div className="px-6 py-4">
                {Object.entries(groupedNotifications).map(
                  ([period, notifs]) =>
                    notifs.length > 0 && (
                      <div key={period} className="mb-6">
                        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                          {period}
                        </h3>
                        <div className="border-t border-slate-200 pt-2">
                          <div className="space-y-1">
                            {notifs.map((notification) => (
                              <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onMarkAsRead={() => markAsRead(notification.id)}
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
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline mt-4"
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
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer group transition-colors",
        !notification.read && "bg-blue-50/50"
      )}
      onClick={onMarkAsRead}
    >
      {/* Checkbox on hover */}
      <button
        className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-4 h-4 rounded border-2 border-slate-300 hover:border-slate-400" />
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
              "text-sm text-slate-900",
              !notification.read && "font-medium"
            )}
          >
            {notification.title}
          </p>
          {/* Unread indicator */}
          {!notification.read && (
            <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />
          )}
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs text-slate-500">
            {notification.sender.name}
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-400">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>

        <p
          className={cn(
            "text-sm text-slate-600 mt-1",
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
            className="text-xs text-blue-600 hover:text-blue-700 mt-1"
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
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <Bell className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-2">
        You&apos;re all caught up!
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-sm">
        Notifications about tasks assigned to you, comments, and mentions will
        appear here.
      </p>
    </div>
  );
}

function EmptyFavorites() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <Star className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-2">
        No favorites yet
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-sm">
        Star important notifications to find them quickly here.
      </p>
    </div>
  );
}

function EmptyArchive() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <Archive className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-2">
        No archived notifications
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-sm">
        When you archive notifications, they&apos;ll appear here.
      </p>
    </div>
  );
}
