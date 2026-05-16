"use client";

/**
 * useUiState — per-user, server-backed UI preferences.
 *
 * UserPreferences.uiState is a JSON column on the User table. This hook
 * lets any component read/write a single sub-key (e.g. "myTasks") with
 * a familiar useState-style signature, while the actual transport is
 * GET /api/users/preferences once on mount + debounced PATCH on change.
 *
 * Pro-product reason: we used to stash these in localStorage and they
 * died on every browser switch / device change / cache clear. uiState
 * follows the user across every device they log into.
 *
 * Layout-shift guard: the hook reports `isHydrated` so the component
 * can prefer the freshly-loaded server value once it arrives. While
 * hydrating, `value` is the supplied default. Edits before hydration
 * complete are queued — once the server payload arrives we merge it
 * into the user's draft so they never lose typing/clicking.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const FETCH_DEBOUNCE_MS = 600;

// Module-level cache so multiple components reading uiState don't
// each hit the network. The fetch promise is shared so all callers
// resolve from the same in-flight request.
let cachedUiState: Record<string, unknown> | null = null;
let inflightFetch: Promise<Record<string, unknown>> | null = null;
const subscribers = new Set<() => void>();

async function fetchUiState(): Promise<Record<string, unknown>> {
  if (cachedUiState) return cachedUiState;
  if (inflightFetch) return inflightFetch;
  inflightFetch = (async () => {
    try {
      const res = await fetch("/api/users/preferences");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const state = (data?.uiState as Record<string, unknown> | null) || {};
      cachedUiState = state;
      return state;
    } catch {
      cachedUiState = {};
      return cachedUiState;
    } finally {
      inflightFetch = null;
      // Notify subscribers of newly-loaded data
      subscribers.forEach((cb) => cb());
    }
  })();
  return inflightFetch;
}

function setCachedKey(key: string, value: unknown) {
  if (!cachedUiState) cachedUiState = {};
  cachedUiState[key] = value;
  subscribers.forEach((cb) => cb());
}

// One in-flight PATCH per key keeps writes ordered and dedup'd. We
// debounce so rapid edits (e.g. dragging a column resize) collapse to
// a single network write.
const pendingPatches = new Map<string, ReturnType<typeof setTimeout>>();

function schedulePatch(key: string, value: unknown) {
  const existing = pendingPatches.get(key);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    pendingPatches.delete(key);
    fetch("/api/users/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiState: { [key]: value } }),
    }).catch(() => {
      // Network drop — value is still cached locally; will be picked up
      // on next successful PATCH (or lost on full reload, which is
      // acceptable for ephemeral prefs).
    });
  }, FETCH_DEBOUNCE_MS);
  pendingPatches.set(key, handle);
}

/**
 * Server-backed per-user UI state for one key.
 *
 * @param key       sub-key under `uiState`, e.g. "myTasks"
 * @param defaultValue value used while hydrating from the server
 */
export function useUiState<T>(key: string, defaultValue: T) {
  const [value, setValueState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // Subscribe to cache updates so when one consumer hydrates, every
  // other consumer of the same key picks up the value.
  useEffect(() => {
    const sync = () => {
      const v = cachedUiState?.[key];
      if (v !== undefined) {
        setValueState(v as T);
        if (!hydratedRef.current) {
          hydratedRef.current = true;
          setIsHydrated(true);
        }
      } else if (!hydratedRef.current && cachedUiState !== null) {
        // Server explicitly has no value for this key — mark hydrated
        // so consumers know the default is intentional.
        hydratedRef.current = true;
        setIsHydrated(true);
      }
    };
    subscribers.add(sync);
    // Kick off (or join) the fetch.
    fetchUiState().then(sync);
    return () => {
      subscribers.delete(sync);
    };
  }, [key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (p: T) => T)(prev)
            : next;
        setCachedKey(key, resolved);
        schedulePatch(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return { value, setValue, isHydrated };
}
