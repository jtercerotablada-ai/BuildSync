"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface NotificationPreferences {
  notifyTaskAssigned: boolean;
  notifyTaskCompleted: boolean;
  notifyCommentAdded: boolean;
  notifyMentioned: boolean;
  notifyProjectUpdates: boolean;
  notifyWeeklyDigest: boolean;
}

const notificationItems: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "notifyTaskAssigned",
    label: "Task assignments",
    description: "When a task is assigned to you",
  },
  {
    key: "notifyTaskCompleted",
    label: "Task completions",
    description: "When a task you follow is completed",
  },
  {
    key: "notifyCommentAdded",
    label: "Comments",
    description: "When someone comments on your tasks",
  },
  {
    key: "notifyMentioned",
    label: "Mentions",
    description: "When someone mentions you",
  },
  {
    key: "notifyProjectUpdates",
    label: "Project updates",
    description: "Status changes on your projects",
  },
  {
    key: "notifyWeeklyDigest",
    label: "Weekly digest",
    description: "A weekly summary of your activity",
  },
];

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    notifyTaskAssigned: true,
    notifyTaskCompleted: true,
    notifyCommentAdded: true,
    notifyMentioned: true,
    notifyProjectUpdates: true,
    notifyWeeklyDigest: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await fetch("/api/users/preferences");
        if (res.ok) {
          const data = await res.json();
          setPrefs({
            notifyTaskAssigned: data.notifyTaskAssigned,
            notifyTaskCompleted: data.notifyTaskCompleted,
            notifyCommentAdded: data.notifyCommentAdded,
            notifyMentioned: data.notifyMentioned,
            notifyProjectUpdates: data.notifyProjectUpdates,
            notifyWeeklyDigest: data.notifyWeeklyDigest,
          });
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    }
    fetchPrefs();
  }, []);

  async function togglePref(key: keyof NotificationPreferences) {
    const prev = prefs[key];
    const updated = { ...prefs, [key]: !prev };
    setPrefs(updated);

    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !prev }),
      });

      if (!res.ok) {
        setPrefs({ ...prefs, [key]: prev });
        toast.error("Failed to update preference");
      }
    } catch {
      setPrefs({ ...prefs, [key]: prev });
      toast.error("Failed to update preference");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Choose what notifications you receive
        </p>
      </div>

      <div className="space-y-4">
        {notificationItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{item.label}</Label>
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
            <Switch
              checked={prefs[item.key]}
              onCheckedChange={() => togglePref(item.key)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
