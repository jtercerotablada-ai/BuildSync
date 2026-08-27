"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const themes = [
  { value: "light", label: "Light", icon: Sun, disabled: false },
  { value: "dark", label: "Dark", icon: Moon, disabled: true },
  { value: "system", label: "System", icon: Monitor, disabled: true },
];

// The product UI is English-only for now — the dashboard layout intentionally
// does not mount the language provider, so picking Español used to report
// success and translate nothing. Keep the preference write path (the public
// site still reads it) but present Español the way the unfinished themes are.
const languages = [
  { value: "en", label: "English", disabled: false },
  { value: "es", label: "Español", disabled: true },
];

export function DisplaySection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  useEffect(() => {
    setMounted(true);

    // Load persisted preferences (theme + language) from DB
    (async () => {
      try {
        const res = await fetch("/api/users/preferences");
        if (res.ok) {
          const data = await res.json();
          // Theme from DB takes precedence over local storage
          if (data.theme && data.theme !== theme) {
            setTheme(data.theme);
          }
          // Language from uiState
          const ui = data.uiState as { language?: string } | null;
          if (ui?.language === "en" || ui?.language === "es") {
            setLanguage(ui.language);
          }
        }
      } catch {
        // fall back to defaults
      } finally {
        setLoadingPrefs(false);
      }
    })();
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleThemeChange(value: string) {
    setTheme(value);
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      });
      if (!res.ok) throw new Error();
      toast.success("Theme saved");
    } catch {
      toast.error("Failed to save theme");
    }
  }

  async function handleLanguageChange(value: "en" | "es") {
    setLanguage(value);
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uiState: { language: value } }),
      });
      if (!res.ok) throw new Error();
      // Also keep localStorage in sync for the language provider on next mount
      try {
        localStorage.setItem("ttc-language", value);
      } catch {
        // ignore
      }
      toast.success("Language saved");
    } catch {
      toast.error("Failed to save language");
    }
  }

  if (!mounted || loadingPrefs) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Theme */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">Theme</p>
          <span className="text-[10px] uppercase tracking-wider text-gray-400">
            Dark mode coming soon
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-lg">
          {themes.map((t) => {
            const Icon = t.icon;
            const isActive = !t.disabled && theme === t.value;
            return (
              <button
                key={t.value}
                onClick={() => !t.disabled && handleThemeChange(t.value)}
                disabled={t.disabled}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors relative",
                  isActive
                    ? "border-black bg-black/5"
                    : t.disabled
                      ? "border-gray-100 cursor-not-allowed opacity-50"
                      : "border-muted hover:border-black/30"
                )}
              >
                <Icon
                  className={cn(
                    "h-8 w-8",
                    isActive
                      ? "text-black"
                      : t.disabled
                        ? "text-gray-300"
                        : "text-gray-500"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive
                      ? "text-black"
                      : t.disabled
                        ? "text-gray-400"
                        : "text-gray-600"
                  )}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Language */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <p className="text-sm font-medium text-gray-700">Language</p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-gray-400">
            Spanish UI coming soon
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-lg">
          {languages.map((l) => {
            // Unlike the theme cards (whose default "light" is enabled),
            // the stored language can be a disabled one. Gating the
            // selection on `!disabled` would leave an "es" user with no
            // card marked at all, which reads as a broken control — so a
            // disabled card still shows as the current choice, greyed out.
            const isActive = language === l.value;
            return (
              <button
                key={l.value}
                onClick={() =>
                  !l.disabled && handleLanguageChange(l.value as "en" | "es")
                }
                disabled={l.disabled}
                className={cn(
                  "flex items-center justify-between rounded-lg border-2 p-4 transition-colors text-left",
                  isActive
                    ? "border-black bg-black/5"
                    : l.disabled
                      ? "border-gray-100"
                      : "border-muted hover:border-black/30",
                  l.disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive
                      ? "text-black"
                      : l.disabled
                        ? "text-gray-400"
                        : "text-muted-foreground"
                  )}
                >
                  {l.label}
                </span>
                {isActive && (
                  <span className="h-2 w-2 rounded-full bg-black" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
