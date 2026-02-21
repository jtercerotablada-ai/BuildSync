'use client';

import { useState, useEffect, useCallback } from 'react';
import { WidgetType, WidgetSize, UserWidgetPreferences, AVAILABLE_WIDGETS } from '@/types/dashboard';

const STORAGE_KEY = 'buildsync-widget-preferences';

/**
 * Auto-calculate widget sizes based on grid position.
 * In a 2-column grid, widgets pair up sequentially.
 * If a widget ends up alone in a row (odd count), it becomes full-width.
 */
function calculateAutoSizes(
  visibleWidgets: WidgetType[],
  widgetOrder: WidgetType[],
  currentSizes: Partial<Record<WidgetType, WidgetSize>>
): Partial<Record<WidgetType, WidgetSize>> {
  const orderedVisible = widgetOrder.filter(w => visibleWidgets.includes(w));
  const newSizes: Partial<Record<WidgetType, WidgetSize>> = {};

  // Simulate the grid row by row
  let col = 0;
  let rowWidgets: WidgetType[] = [];

  for (const widget of orderedVisible) {
    const manualSize = currentSizes[widget];

    // If a widget was manually set to full, it occupies its own row
    if (manualSize === 'full') {
      // First: if there was a lone widget in the current row, make IT full
      if (rowWidgets.length === 1) {
        newSizes[rowWidgets[0]] = 'full';
      }
      // This widget gets its own full row
      newSizes[widget] = 'full';
      rowWidgets = [];
      col = 0;
      continue;
    }

    // Half-size widget
    rowWidgets.push(widget);
    newSizes[widget] = 'half';
    col++;

    if (col === 2) {
      // Row complete — both widgets stay half
      rowWidgets = [];
      col = 0;
    }
  }

  // If there's one widget left alone in the last row, make it full
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
    widgetSizes: {}, // All widgets default to 'half' size
  };
};

export function useWidgetPreferences() {
  const [preferences, setPreferences] = useState<UserWidgetPreferences>(getDefaultPreferences);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Migrate legacy data that doesn't have widgetSizes
        const migratedPreferences: UserWidgetPreferences = {
          visibleWidgets: parsed.visibleWidgets || [],
          widgetOrder: parsed.widgetOrder || [],
          widgetSizes: parsed.widgetSizes || {},
        };
        setPreferences(migratedPreferences);
      } catch (e) {
        console.error('Failed to parse widget preferences:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }
  }, [preferences, isLoaded]);

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

  // Reorder only — no size recalculation (used during drag)
  const reorderWidgets = useCallback((newOrder: WidgetType[]) => {
    setPreferences(prev => ({
      ...prev,
      widgetOrder: newOrder,
    }));
  }, []);

  // Recalculate auto sizes based on current layout (used after drop)
  // Preserves manually-set full sizes
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

  // Manual size change — only affects the specific widget, no auto-recalculation
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
