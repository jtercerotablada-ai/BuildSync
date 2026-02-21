"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const themes = [
  {
    value: "light",
    label: "Light",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    icon: Monitor,
  },
];

export function DisplaySection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleThemeChange(value: string) {
    setTheme(value);
    // Persist to DB for cross-device sync
    fetch("/api/users/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: value }),
    }).catch(() => {});
  }

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Display</h2>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Display</h2>
        <p className="text-sm text-muted-foreground">
          Customize how BuildSync looks
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-lg">
        {themes.map((t) => {
          const Icon = t.icon;
          const isActive = theme === t.value;
          return (
            <button
              key={t.value}
              onClick={() => handleThemeChange(t.value)}
              className={cn(
                "flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors",
                isActive
                  ? "border-black bg-black/5"
                  : "border-muted hover:border-black/30"
              )}
            >
              <Icon
                className={cn(
                  "h-8 w-8",
                  isActive ? "text-black" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  isActive ? "text-black" : "text-muted-foreground"
                )}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
