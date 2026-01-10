'use client';

import { useState, useEffect, useCallback } from 'react';
import { WidgetType, UserWidgetPreferences, AVAILABLE_WIDGETS } from '@/types/dashboard';

const STORAGE_KEY = 'buildsync-widget-preferences';

const getDefaultPreferences = (): UserWidgetPreferences => {
  const enabledWidgets = AVAILABLE_WIDGETS
    .filter(w => w.defaultEnabled)
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map(w => w.id);

  return {
    visibleWidgets: enabledWidgets,
    widgetOrder: enabledWidgets,
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
        setPreferences(parsed);
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

      if (isVisible) {
        return {
          visibleWidgets: prev.visibleWidgets.filter(id => id !== widgetId),
          widgetOrder: prev.widgetOrder.filter(id => id !== widgetId),
        };
      } else {
        return {
          visibleWidgets: [...prev.visibleWidgets, widgetId],
          widgetOrder: [...prev.widgetOrder, widgetId],
        };
      }
    });
  }, []);

  const reorderWidgets = useCallback((newOrder: WidgetType[]) => {
    setPreferences(prev => ({
      ...prev,
      widgetOrder: newOrder,
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferences(getDefaultPreferences());
  }, []);

  return {
    preferences,
    isLoaded,
    toggleWidget,
    reorderWidgets,
    resetToDefaults,
  };
}
