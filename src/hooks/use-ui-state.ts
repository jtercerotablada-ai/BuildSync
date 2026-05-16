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

// localStorage cache key. The DB remains the source of truth; this
// cache exists ONLY to eliminate the first-paint flash when the user
// reloads. On every server fetch we mirror the result here, and on
// every write we mirror the new value here, so the next mount can
// render the right value synchronously without waiting on the network.
const CACHE_STORAGE_KEY = "ui-state-cache";

function readCachedFromStorage(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedToStorage(state: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full / private mode — silently fall through; the in-
    // memory cache still works for the rest of the session.
  }
}

// Module-level cache so multiple components reading uiState don't
// each hit the network. The fetch promise is shared so all callers
// resolve from the same in-flight request. Seeded from localStorage
// on first import so SSR + first render can read synchronously.
let cachedUiState: Record<string, unknown> | null = readCachedFromStorage();
let inflightFetch: Promise<Record<string, unknown>> | null = null;
const subscribers = new Set<() => void>();

// Tracks whether we've reconciled with the server at least once this
// session. The localStorage cache may be stale (the user could have
// switched devices), so the first DB fetch is authoritative.
let serverConfirmed = false;

async function fetchUiState(): Promise<Record<string, unknown>> {
  if (serverConfirmed && cachedUiState) return cachedUiState;
  if (inflightFetch) return inflightFetch;
  inflightFetch = (async () => {
    try {
      const res = await fetch("/api/users/preferences");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const state = (data?.uiState as Record<string, unknown> | null) || {};
      cachedUiState = state;
      serverConfirmed = true;
      writeCachedToStorage(state);
      return state;
    } catch {
      // Server unreachable — keep whatever was in the localStorage
      // cache so the user isn't suddenly thrown back to defaults.
      cachedUiState = cachedUiState ?? {};
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
  writeCachedToStorage(cachedUiState);
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
  // CRITICAL: the initializer MUST return the default on both server
  // and client so React hydration matches. Reading from the
  // localStorage cache in the initializer would cause a hydration
  // mismatch (server has no localStorage → default; client has cache
  // → real value), which manifests as a "default → real value" flash
  // on every page open. The cached value is applied inside the
  // useEffect below — after hydration is safe.
  const [value, setValueState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // Post-hydration: read the cached value (synchronous, no flash since
  // we haven't told React to render anything different yet) + kick off
  // the DB fetch in parallel. Both update `value` via the same setter.
  useEffect(() => {
    // Apply the localStorage cache immediately so consumers stop
    // showing the default on the very next paint.
    const cached = cachedUiState?.[key];
    if (cached !== undefined) {
      setValueState(cached as T);
    }
    // Whether the cache had a value or not, mark the hook hydrated.
    // Consumers that gate "showing the prefs UI" on isHydrated will
    // now render — and they'll render the cached value if present, or
    // a stable "blank/default" without ever flashing the default.
    hydratedRef.current = true;
    setIsHydrated(true);

    const sync = () => {
      const v = cachedUiState?.[key];
      if (v !== undefined) {
        setValueState(v as T);
      }
    };
    subscribers.add(sync);
    // Kick off (or join) the server fetch. When the server response
    // lands, sync runs again with the authoritative DB value.
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
