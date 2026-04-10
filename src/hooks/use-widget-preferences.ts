'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WidgetType, WidgetSize, UserWidgetPreferences, AVAILABLE_WIDGETS } from '@/types/dashboard';

const STORAGE_KEY = 'buildsync-widget-preferences';

/**
 * Auto-calculate widget sizes based on grid position.
 */
function calculateAutoSizes(
  visibleWidgets: WidgetType[],
  widgetOrder: WidgetType[],
  currentSizes: Partial<Record<WidgetType, WidgetSize>>
): Partial<Record<WidgetType, WidgetSize>> {
  const orderedVisible = widgetOrder.filter(w => visibleWidgets.includes(w));
  const newSizes: Partial<Record<WidgetType, WidgetSize>> = {};

  let col = 0;
  let rowWidgets: WidgetType[] = [];

  for (const widget of orderedVisible) {
    const manualSize = currentSizes[widget];

    if (manualSize === 'full') {
      if (rowWidgets.length === 1) {
        newSizes[rowWidgets[0]] = 'full';
      }
      newSizes[widget] = 'full';
      rowWidgets = [];
      col = 0;
      continue;
    }

    rowWidgets.push(widget);
    newSizes[widget] = 'half';
    col++;

    if (col === 2) {
      rowWidgets = [];
      col = 0;
    }
  }

  if (rowWidgets.length === 1) {
    newSizes[rowWidgets[0]] = 'full';
  }

  return newSizes;
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
  const isInitialLoadRef = useRef(true);

  // Load from API on mount, fall back to localStorage migration
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/users/preferences');
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.widgetPreferences) {
            // Use server data
            const migrated: UserWidgetPreferences = {
              visibleWidgets: data.widgetPreferences.visibleWidgets || [],
              widgetOrder: data.widgetPreferences.widgetOrder || [],
              widgetSizes: data.widgetPreferences.widgetSizes || {},
            };
            setPreferences(migrated);
            setIsLoaded(true);
            return;
          }

          // No server data — try migrating from localStorage one time
          const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const migrated: UserWidgetPreferences = {
                visibleWidgets: parsed.visibleWidgets || [],
                widgetOrder: parsed.widgetOrder || [],
                widgetSizes: parsed.widgetSizes || {},
              };
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
          if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                setPreferences({
                  visibleWidgets: parsed.visibleWidgets || [],
                  widgetOrder: parsed.widgetOrder || [],
                  widgetSizes: parsed.widgetSizes || {},
                });
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // network error — defaults
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
          isInitialLoadRef.current = false;
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist to API (debounced) + localStorage as offline fallback
  useEffect(() => {
    if (!isLoaded || isInitialLoadRef.current) return;

    // Always save locally as offline fallback
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch {
        // ignore
      }
    }

    // Debounced API save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
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

  // Mark initial load complete after first render with isLoaded=true
  useEffect(() => {
    if (isLoaded) {
      const t = setTimeout(() => { isInitialLoadRef.current = false; }, 100);
      return () => clearTimeout(t);
    }
  }, [isLoaded]);

  const toggleWidget = useCallback((widgetId: WidgetType) => {
    setPreferences(prev => {
      const isVisible = prev.visibleWidgets.includes(widgetId);

      let newVisible: WidgetType[];
      let newOrder: WidgetType[];

      if (isVisible) {
        newVisible = prev.visibleWidgets.filter(id => id !== widgetId);
        newOrder = prev.widgetOrder.filter(id => id !== widgetId);
      } else {
        newVisible = [...prev.visibleWidgets, widgetId];
        newOrder = [...prev.widgetOrder, widgetId];
      }

      const newSizes = calculateAutoSizes(newVisible, newOrder, prev.widgetSizes || {});

      return {
        ...prev,
        visibleWidgets: newVisible,
        widgetOrder: newOrder,
        widgetSizes: newSizes,
      };
    });
  }, []);

  const reorderWidgets = useCallback((newOrder: WidgetType[]) => {
    setPreferences(prev => ({
      ...prev,
      widgetOrder: newOrder,
    }));
  }, []);

  const recalculateWidgetSizes = useCallback(() => {
    setPreferences(prev => {
      const newSizes = calculateAutoSizes(prev.visibleWidgets, prev.widgetOrder, prev.widgetSizes || {});
      return {
        ...prev,
        widgetSizes: newSizes,
      };
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultPreferences();
    defaults.widgetSizes = calculateAutoSizes(defaults.visibleWidgets, defaults.widgetOrder, {});
    setPreferences(defaults);
  }, []);

  const setWidgetSize = useCallback((widgetId: WidgetType, size: WidgetSize) => {
    setPreferences(prev => ({
      ...prev,
      widgetSizes: {
        ...(prev.widgetSizes || {}),
        [widgetId]: size,
      },
    }));
  }, []);

  const getWidgetSize = useCallback((widgetId: WidgetType): WidgetSize => {
    return preferences.widgetSizes?.[widgetId] || 'half';
  }, [preferences.widgetSizes]);

  return {
    preferences,
    isLoaded,
    toggleWidget,
    reorderWidgets,
    recalculateWidgetSizes,
    resetToDefaults,
    setWidgetSize,
    getWidgetSize,
  };
}
