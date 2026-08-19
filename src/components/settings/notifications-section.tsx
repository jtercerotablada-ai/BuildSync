"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DigestCadence = "NEVER" | "DAILY" | "WEEKLY";

interface NotificationPreferences {
  notifyTaskAssigned: boolean;
  notifyTaskCompleted: boolean;
  notifyCommentAdded: boolean;
  notifyMentioned: boolean;
  notifyProjectUpdates: boolean;
  // Legacy weekly toggle — still tracked because old code may still
  // read it, but the user-facing surface is `notifyDigestCadence`.
  notifyWeeklyDigest: boolean;
  notifyDigestCadence: DigestCadence;
}

const toggleItems: {
  key: Exclude<keyof NotificationPreferences, "notifyWeeklyDigest" | "notifyDigestCadence">;
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
];

const digestOptions: { value: DigestCadence; label: string; description: string }[] = [
  {
    value: "NEVER",
    label: "Off",
    description: "Don't send digest emails",
  },
  {
    value: "DAILY",
    label: "Daily",
    description: "Every morning at 7am local",
  },
  {
    value: "WEEKLY",
    label: "Weekly",
    description: "Monday mornings",
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
    notifyDigestCadence: "NEVER",
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
            // Fallback to legacy toggle when the new field isn't set
            // yet (rows created before May 23 2026 migration).
            notifyDigestCadence:
              (data.notifyDigestCadence as DigestCadence | undefined) ??
              (data.notifyWeeklyDigest ? "WEEKLY" : "NEVER"),
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

  async function togglePref(key: Exclude<keyof NotificationPreferences, "notifyDigestCadence">) {
    const prev = prefs[key];
    const next = typeof prev === "boolean" ? !prev : prev;
    setPrefs({ ...prefs, [key]: next });

    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
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

  async function setDigestCadence(cadence: DigestCadence) {
    const prev = prefs.notifyDigestCadence;
    if (prev === cadence) return;
    // Optimistic — also sync the legacy boolean so any code that
    // still reads `notifyWeeklyDigest` doesn't go stale.
    setPrefs({
      ...prefs,
      notifyDigestCadence: cadence,
      notifyWeeklyDigest: cadence === "WEEKLY",
    });

    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyDigestCadence: cadence,
          notifyWeeklyDigest: cadence === "WEEKLY",
        }),
      });
      if (!res.ok) {
        setPrefs({ ...prefs, notifyDigestCadence: prev });
        toast.error("Failed to update digest cadence");
      }
    } catch {
      setPrefs({ ...prefs, notifyDigestCadence: prev });
      toast.error("Failed to update digest cadence");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {toggleItems.map((item) => (
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

        {/* Email digest cadence — 3-state picker (Off / Daily /
            Weekly). Replaces the binary "Weekly digest" toggle from
            pre-May 2026. Asana parity added during QC Fase 2 P1.3. */}
        <div className="rounded-lg border p-4">
          <div className="mb-3">
            <Label className="text-sm font-medium">Email digest</Label>
            <p className="text-xs text-muted-foreground">
              A summary of your activity sent on a schedule
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {digestOptions.map((opt) => {
              const active = prefs.notifyDigestCadence === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDigestCadence(opt.value)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-black bg-black/[0.04]"
                      : "border-gray-200 hover:border-gray-400"
                  )}
                >
                  <span
                    className={cn(
                      "text-[13px] font-medium",
                      active ? "text-black" : "text-gray-700"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
