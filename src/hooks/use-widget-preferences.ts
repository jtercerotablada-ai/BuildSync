'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  WidgetType,
  WidgetSize,
  UserWidgetPreferences,
  AVAILABLE_WIDGETS,
  REMOVED_WIDGET_IDS,
} from '@/types/dashboard';

// localStorage keys are namespaced by user id so a shared machine can
// never migrate one user's layout into another user's account. The
// pre-scoping unscoped 'buildsync-widget-preferences' key is
// deliberately ignored — it can't be attributed to a user, and pushing
// it to the server is exactly how a layout leaked across accounts.
// LAST_USER_KEY remembers the last server-confirmed user so the
// offline fallback can find its cache; shared with use-ui-state.ts.
const STORAGE_KEY_PREFIX = 'buildsync-widget-preferences';
const LAST_USER_KEY = 'buildsync-last-user-id';
const storageKeyFor = (userId: string) => `${STORAGE_KEY_PREFIX}:${userId}`;

// Set of valid widget IDs known at runtime — used to scrub deleted
// IDs (e.g. the old PMI tiles) out of any pref payload before we
// hand it to React. Without this, a saved layout that references a
// removed widget would render nothing in that slot and confuse the
// reorder math.
const VALID_WIDGET_IDS: ReadonlySet<string> = new Set(
  AVAILABLE_WIDGETS.map((w) => w.id)
);
const REMOVED_WIDGET_ID_SET: ReadonlySet<string> = new Set(REMOVED_WIDGET_IDS);

/**
 * Strip any widget IDs that no longer exist in AVAILABLE_WIDGETS
 * (typically widgets we've sunset, like the May 2026 PMI tiles).
 * Falls back to the default preferences if filtering leaves the
 * user with nothing visible — better than an empty home page.
 */
function migratePreferences(
  raw: Partial<UserWidgetPreferences>
): UserWidgetPreferences {
  // Dedupe both arrays — a stored payload with a repeated id would
  // otherwise render duplicate React keys / dnd sortable ids.
  const visible = [...new Set(raw.visibleWidgets ?? [])].filter(
    (id): id is WidgetType => VALID_WIDGET_IDS.has(id)
  );
  const order = [...new Set(raw.widgetOrder ?? [])].filter(
    (id): id is WidgetType => VALID_WIDGET_IDS.has(id)
  );
  // Sizes for removed widgets are harmless but waste storage — drop
  // them too so the JSON payload stays clean.
  const sizes: Partial<Record<WidgetType, WidgetSize>> = {};
  if (raw.widgetSizes) {
    for (const [id, size] of Object.entries(raw.widgetSizes)) {
      if (VALID_WIDGET_IDS.has(id) && !REMOVED_WIDGET_ID_SET.has(id)) {
        sizes[id as WidgetType] = size as WidgetSize;
      }
    }
  }
  // If migration would leave the page empty (e.g. user only had
  // PMI tiles enabled), restore the defaults so they're not stuck
  // staring at a blank grid.
  if (visible.length === 0) return getDefaultPreferences();
  // Repair an order missing visible IDs (e.g. a partial payload from
  // an old client) — a widget that is visible but absent from the
  // order would otherwise render nowhere.
  const repairedOrder = [
    ...order,
    ...visible.filter((id) => !order.includes(id)),
  ];
  return { visibleWidgets: visible, widgetOrder: repairedOrder, widgetSizes: sizes };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * True when migration actually dropped or repaired something.
 * JSON key order from the server varies, so a naive stringify
 * comparison would flag a change (and PATCH back) on every load.
 */
function migrationChanged(
  raw: Partial<UserWidgetPreferences>,
  migrated: UserWidgetPreferences
): boolean {
  if (!arraysEqual(raw.visibleWidgets ?? [], migrated.visibleWidgets)) return true;
  if (!arraysEqual(raw.widgetOrder ?? [], migrated.widgetOrder)) return true;
  const rawSizes = Object.entries(raw.widgetSizes ?? {});
  const migratedSizes = migrated.widgetSizes ?? {};
  if (rawSizes.length !== Object.keys(migratedSizes).length) return true;
  return rawSizes.some(([id, size]) => migratedSizes[id as WidgetType] !== size);
}

const getDefaultPreferences = (): UserWidgetPreferences => {
  const enabledWidgets = AVAILABLE_WIDGETS
    .filter(w => w.defaultEnabled)
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map(w => w.id);

  return {
    visibleWidgets: enabledWidgets,
    widgetOrder: enabledWidgets,
    widgetSizes: {},
  };
};

export function useWidgetPreferences() {
  const [preferences, setPreferences] = useState<UserWidgetPreferences>(getDefaultPreferences);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Only persist after the user actually mutates preferences — never
  // echo the just-loaded layout back, and never let defaults overwrite
  // the saved server layout when the initial GET fails.
  const isDirtyRef = useRef(false);
  const preferencesRef = useRef(preferences);
  const pendingSaveRef = useRef(false);
  // Server-confirmed user id — scopes the localStorage fallback key.
  const userIdRef = useRef<string | null>(null);

  // Load from API on mount, fall back to localStorage migration
  useEffect(() => {
    let cancelled = false;
    // Apply a locally-stored layout without persisting it back — used
    // when the server GET fails (non-ok or network error) so an offline
    // user keeps their saved layout instead of seeing defaults. Never
    // sets the dirty flag, so no PATCH follows a failed load. Reads the
    // last server-confirmed user's scoped key (a user switch requires a
    // login, which needs the network, which refreshes the marker) —
    // with no confirmed user there is nothing safe to apply.
    const applyLocalFallback = () => {
      if (typeof window === 'undefined' || cancelled) return;
      const uid = localStorage.getItem(LAST_USER_KEY);
      if (!uid) return;
      userIdRef.current = uid;
      const stored = localStorage.getItem(storageKeyFor(uid));
      if (!stored) return;
      try {
        setPreferences(migratePreferences(JSON.parse(stored)));
      } catch {
        // ignore
      }
    };
    (async () => {
      try {
        const res = await fetch('/api/users/preferences');
        if (res.ok && !cancelled) {
          const data = await res.json();
          const uid: string | null =
            typeof data.userId === 'string' ? data.userId : null;
          if (uid && typeof window !== 'undefined') {
            userIdRef.current = uid;
            try {
              localStorage.setItem(LAST_USER_KEY, uid);
            } catch {
              // ignore
            }
          }
          if (data.widgetPreferences) {
            // Run migration — drops PMI/removed widget IDs.
            const migrated = migratePreferences(data.widgetPreferences);
            setPreferences(migrated);
            // If migration changed the payload, write the cleaned
            // version back so we don't re-migrate on every load.
            if (migrationChanged(data.widgetPreferences, migrated)) {
              fetch('/api/users/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ widgetPreferences: migrated }),
              }).catch(() => {});
            }
            setIsLoaded(true);
            return;
          }

          // No server data — migrate this user's OWN scoped localStorage
          // copy one time. Never the legacy unscoped key: it can't be
          // attributed to a user, so migrating it here is how user A's
          // layout used to leak into user B's fresh account.
          const stored =
            uid && typeof window !== 'undefined'
              ? localStorage.getItem(storageKeyFor(uid))
              : null;
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const migrated = migratePreferences(parsed);
              setPreferences(migrated);
              // Push migrated data to server
              await fetch('/api/users/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ widgetPreferences: migrated }),
              });
            } catch {
              // ignore
            }
          }
        } else if (!cancelled) {
          // API failed (e.g. unauthenticated) — fall back to localStorage
          applyLocalFallback();
        }
      } catch {
        // network error — same localStorage fallback as a non-ok response
        applyLocalFallback();
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist to API (debounced) + localStorage as offline fallback
  useEffect(() => {
    preferencesRef.current = preferences;
    if (!isLoaded || !isDirtyRef.current) return;

    // Save locally as offline fallback — only under the confirmed
    // user's scoped key so the copy stays attributable on shared machines
    if (typeof window !== 'undefined' && userIdRef.current) {
      try {
        localStorage.setItem(
          storageKeyFor(userIdRef.current),
          JSON.stringify(preferences)
        );
      } catch {
        // ignore
      }
    }

    // Debounced API save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    pendingSaveRef.current = true;
    saveTimeoutRef.current = setTimeout(() => {
      pendingSaveRef.current = false;
      fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetPreferences: preferences }),
      }).catch(() => {
        // ignore network errors — local copy is the fallback
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [preferences, isLoaded]);

  // Flush (not cancel) a still-debounced save on unmount, so a drag
  // followed by an immediate navigation isn't lost — keepalive lets
  // the request outlive the page.
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        fetch('/api/users/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgetPreferences: preferencesRef.current }),
          keepalive: true,
        }).catch(() => {
          // ignore — local copy is the fallback
        });
      }
    };
  }, []);

  const toggleWidget = useCallback((widgetId: WidgetType) => {
    isDirtyRef.current = true;
    setPreferences(prev => {
      const isVisible = prev.visibleWidgets.includes(widgetId);

      if (isVisible) {
        return {
          ...prev,
          visibleWidgets: prev.visibleWidgets.filter(id => id !== widgetId),
          widgetOrder: prev.widgetOrder.filter(id => id !== widgetId),
        };
      }

      // A re-enabled widget slots in at its defaultOrder position
      // relative to the widgets already in the order — appending at
      // the very bottom left it invisible behind the Customize sheet.
      let widgetOrder = prev.widgetOrder;
      if (!widgetOrder.includes(widgetId)) {
        const rank = (id: WidgetType) =>
          AVAILABLE_WIDGETS.find((w) => w.id === id)?.defaultOrder ??
          Number.MAX_SAFE_INTEGER;
        const insertAt = widgetOrder.findIndex(
          (id) => rank(id) > rank(widgetId)
        );
        widgetOrder =
          insertAt === -1
            ? [...widgetOrder, widgetId]
            : [
                ...widgetOrder.slice(0, insertAt),
                widgetId,
                ...widgetOrder.slice(insertAt),
              ];
      }
      // Sizes are user intent — never recomputed here.
      return {
        ...prev,
        visibleWidgets: [...prev.visibleWidgets, widgetId],
        widgetOrder,
      };
    });
  }, []);

  const reorderWidgets = useCallback((newOrder: WidgetType[]) => {
    isDirtyRef.current = true;
    setPreferences(prev => ({
      ...prev,
      widgetOrder: newOrder,
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    isDirtyRef.current = true;
    setPreferences(getDefaultPreferences());
  }, []);

  const setWidgetSize = useCallback((widgetId: WidgetType, size: WidgetSize) => {
    isDirtyRef.current = true;
    setPreferences(prev => ({
      ...prev,
      widgetSizes: {
        ...(prev.widgetSizes || {}),
        [widgetId]: size,
      },
    }));
  }, []);

  // Display sizes are derived at render, never persisted: widgetSizes
  // holds only explicit user choices, and a widget with no recorded
  // choice that would otherwise sit alone in a 2-col row (last in the
  // order, or followed by a full-size card) renders full so the grid
  // shows no hole. Explicit 'half'/'full' always wins.
  const effectiveSizes = useMemo(() => {
    const sizes: Partial<Record<WidgetType, WidgetSize>> = {};
    const visible = preferences.widgetOrder.filter((id) =>
      preferences.visibleWidgets.includes(id)
    );
    let column = 0;
    for (let i = 0; i < visible.length; i++) {
      const id = visible[i];
      const manual = preferences.widgetSizes?.[id];
      let size: WidgetSize = manual || 'half';
      if (!manual && column === 0) {
        const next = visible[i + 1];
        const nextSize = next
          ? preferences.widgetSizes?.[next] || 'half'
          : null;
        if (!next || nextSize === 'full') size = 'full';
      }
      sizes[id] = size;
      column = size === 'full' ? 0 : (column + 1) % 2;
    }
    return sizes;
  }, [preferences]);

  const getWidgetSize = useCallback((widgetId: WidgetType): WidgetSize => {
    return effectiveSizes[widgetId] || preferences.widgetSizes?.[widgetId] || 'half';
  }, [effectiveSizes, preferences.widgetSizes]);

  return {
    preferences,
    isLoaded,
    toggleWidget,
    reorderWidgets,
    resetToDefaults,
    setWidgetSize,
    getWidgetSize,
  };
}
