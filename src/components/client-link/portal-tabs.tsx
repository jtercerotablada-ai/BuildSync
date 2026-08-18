"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The project workspace tab strip: Overview / Progress / Action Items /
 * Documents / Inspections / (Messages, disabled) / Activity.
 *
 * Every panel is REAL — server-rendered from the same client-safe projection —
 * and arrives here as a ReactNode prop, so this component owns only which one
 * is visible and never touches data. The active tab lives in location.hash
 * (#documents), which keeps the sidebar in sync for free (its items are plain
 * hash links), survives reload, and deep-links. No panel element carries the
 * hash as its id, so the browser has nothing to scroll-jump to.
 *
 * Messages is rendered disabled with an honest "Soon" — a two-way inbox does
 * not exist yet, and a dead tab that pretends otherwise is worse than none.
 */

export interface PortalTab {
  key: string;
  label: string;
  disabled?: boolean;
  disabledHint?: string;
}

export const TAB_EVENT = "portal:tab";

function tabFromHash(keys: string[]): string {
  if (typeof window === "undefined") return keys[0];
  const raw = window.location.hash.replace(/^#/, "");
  return keys.includes(raw) ? raw : keys[0];
}

export function PortalTabs({
  tabs,
  panels,
}: {
  tabs: PortalTab[];
  panels: Record<string, React.ReactNode>;
}) {
  const keys = tabs.filter((t) => !t.disabled).map((t) => t.key);
  // SSR always renders the first tab; the real hash is applied on mount.
  const [active, setActive] = useState(tabs[0].key);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = () => setActive(tabFromHash(keys));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback((key: string) => {
    // replaceState keeps Back for leaving the page, not for every tab hop.
    window.history.replaceState(null, "", `#${key}`);
    setActive(key);
  }, []);

  // Roving arrow-key navigation across the enabled tabs.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const idx = keys.indexOf(active);
      const next =
        e.key === "ArrowRight"
          ? keys[(idx + 1) % keys.length]
          : keys[(idx - 1 + keys.length) % keys.length];
      select(next);
      listRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)
        ?.focus();
    },
    [active, keys, select]
  );

  return (
    <>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Project sections"
        className="p-tabs"
        onKeyDown={onKeyDown}
      >
        {tabs.map((t) =>
          t.disabled ? (
            <span
              key={t.key}
              className="p-tab p-tab--disabled"
              aria-disabled="true"
              title={t.disabledHint}
            >
              {t.label}
              <span className="p-nav-item__soon">Soon</span>
            </span>
          ) : (
            <button
              key={t.key}
              type="button"
              role="tab"
              data-tab={t.key}
              id={`p-tab-${t.key}`}
              aria-selected={active === t.key}
              aria-controls={`p-panel-${t.key}`}
              tabIndex={active === t.key ? 0 : -1}
              className="p-tab"
              onClick={() => select(t.key)}
            >
              {t.label}
            </button>
          )
        )}
      </div>
      {tabs
        .filter((t) => !t.disabled)
        .map((t) => (
          <div
            key={t.key}
            role="tabpanel"
            id={`p-panel-${t.key}`}
            aria-labelledby={`p-tab-${t.key}`}
            hidden={active !== t.key}
          >
            {panels[t.key]}
          </div>
        ))}
    </>
  );
}
