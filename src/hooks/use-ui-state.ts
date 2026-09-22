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
import { toast } from "sonner";

const FETCH_DEBOUNCE_MS = 600;

// localStorage cache keys. The DB remains the source of truth; this
// cache exists ONLY to eliminate the first-paint flash when the user
// reloads. Keys are namespaced by user id so one user's cached UI
// prefs (background tint, collapsed panels, …) never flash for — or
// get mirrored into — another account on a shared machine. The legacy
// unscoped 'ui-state-cache' key is deliberately ignored.
// LAST_USER_KEY remembers the last server-confirmed user so the seed
// read below can find its cache synchronously; shared with
// use-widget-preferences.ts.
const CACHE_STORAGE_KEY_PREFIX = "ui-state-cache";
const LAST_USER_KEY = "buildsync-last-user-id";
const cacheKeyFor = (userId: string) => `${CACHE_STORAGE_KEY_PREFIX}:${userId}`;

// Last server-confirmed user id — seeded from the marker at import so
// the first paint can read that user's cache; re-confirmed (and
// corrected after a user switch) by every successful server fetch.
let cachedUserId: string | null = (() => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
})();

function readCachedFromStorage(): Record<string, unknown> | null {
  if (typeof window === "undefined" || !cachedUserId) return null;
  try {
    const raw = localStorage.getItem(cacheKeyFor(cachedUserId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedToStorage(state: Record<string, unknown>) {
  if (typeof window === "undefined" || !cachedUserId) return;
  try {
    localStorage.setItem(cacheKeyFor(cachedUserId), JSON.stringify(state));
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

// Keys the user wrote this session. Their PATCH may still be pending
// when the initial GET lands, so for exactly these keys the local
// value is newer than the server payload and must not be reverted.
// For an object-valued key the entry lists the sub-keys written, and
// only those override the server copy; `true` means the whole value.
type DirtyMark = Set<string> | true;
const locallyDirtyKeys = new Map<string, DirtyMark>();

// Sub-keys (or the whole value) still to be sent, per key. Drained by
// sendPatch; put back when a transient failure is retried.
const unsentChanges = new Map<string, DirtyMark>();

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function unionMark(map: Map<string, DirtyMark>, key: string, mark: DirtyMark) {
  const cur = map.get(key);
  if (cur === true || mark === true) {
    map.set(key, true);
    return;
  }
  map.set(key, cur ? new Set([...cur, ...mark]) : new Set(mark));
}

// Which part of a key an edit touched. An object-valued key is written
// one sub-key at a time: sending the whole object let a stale tab put
// back every sub-key another tab had changed since (e.g. My Tasks
// sections), and the server merges one level deep anyway. A removed
// sub-key is sent as null, which the server treats as a deletion.
function changedPart(prev: unknown, next: unknown): DirtyMark {
  if (!isPlainObject(prev) || !isPlainObject(next)) return true;
  const changed = new Set<string>();
  for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) changed.add(k);
  }
  return changed;
}

async function fetchUiState(): Promise<Record<string, unknown>> {
  if (serverConfirmed && cachedUiState) return cachedUiState;
  if (inflightFetch) return inflightFetch;
  inflightFetch = (async () => {
    try {
      const res = await fetch("/api/users/preferences");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const uid =
        typeof data?.userId === "string" ? (data.userId as string) : null;
      const state = (data?.uiState as Record<string, unknown> | null) || {};
      // Overlay edits made while the fetch was in flight so the
      // server payload doesn't visibly revert them. Dirty keys were
      // written by the CURRENT session's user, so they stay valid
      // even if the seed cache came from a previous user.
      for (const [key, mark] of locallyDirtyKeys) {
        if (!cachedUiState || !(key in cachedUiState)) continue;
        const local = cachedUiState[key];
        const server = state[key];
        if (mark !== true && isPlainObject(local) && isPlainObject(server)) {
          const overlaid: Record<string, unknown> = { ...server };
          for (const sub of mark) {
            if (sub in local && local[sub] !== null) overlaid[sub] = local[sub];
            else delete overlaid[sub];
          }
          state[key] = overlaid;
        } else {
          state[key] = local;
        }
      }
      // A mismatch means the seed cache belonged to the machine's
      // previous user — the server payload replacing it here discards
      // those entries. Update the marker so the next mount seeds from
      // the right scoped key.
      if (uid && uid !== cachedUserId) {
        cachedUserId = uid;
        try {
          localStorage.setItem(LAST_USER_KEY, uid);
        } catch {
          // ignore — marker is only a seed optimization
        }
      }
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

function setCachedKey(key: string, value: unknown, mark: DirtyMark) {
  if (!cachedUiState) cachedUiState = {};
  cachedUiState[key] = value;
  unionMark(locallyDirtyKeys, key, mark);
  // Only mirror to storage once the server has confirmed whose cache
  // this is — a pre-confirm write could land in another user's key.
  // Pre-confirm dirty values still reach storage when the fetch
  // settles (dirty-key overlay + writeCachedToStorage above).
  if (serverConfirmed) writeCachedToStorage(cachedUiState);
  subscribers.forEach((cb) => cb());
}

// One in-flight PATCH per key keeps writes ordered and dedup'd. We
// debounce so rapid edits (e.g. dragging a column resize) collapse to
// a single network write.
const pendingPatches = new Map<string, ReturnType<typeof setTimeout>>();

// A failed write used to be dropped without a word: the value lived on in
// the local cache, so the UI looked saved, and then vanished on the next
// device or after the next server fetch. Transient failures (network, 5xx,
// 408/429) are retried with backoff; anything else, or the last retry, tells
// the user once per page load.
const MAX_PATCH_ATTEMPTS = 3;
const RETRY_BASE_MS = 2000;
let warnedSaveFailure = false;

function warnSaveFailure(message: string) {
  if (warnedSaveFailure) return;
  warnedSaveFailure = true;
  toast.error(message);
}

function sendPatch(key: string, attempt: number) {
  const mark = unsentChanges.get(key);
  unsentChanges.delete(key);
  if (mark === undefined) return;
  // Always send the key's CURRENT value: a retry must never overwrite a
  // newer edit with the one that failed.
  const current = cachedUiState ? cachedUiState[key] : undefined;
  let value: unknown = current;
  if (mark !== true && isPlainObject(current)) {
    if (mark.size === 0) return;
    const part: Record<string, unknown> = {};
    for (const sub of mark) part[sub] = sub in current ? current[sub] : null;
    value = part;
  }
  fetch("/api/users/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uiState: { [key]: value } }),
  })
    .then((res) => {
      if (res.ok) return;
      if (res.status === 401) {
        warnSaveFailure(
          "Your session has expired. Sign in again to keep saving your view settings."
        );
        return;
      }
      const transient =
        res.status >= 500 || res.status === 408 || res.status === 429;
      if (!transient) {
        // e.g. 400 when the stored preferences hit their size cap — the
        // same request will never succeed.
        warnSaveFailure(
          "Couldn't save your view settings. Changes are kept on this device only."
        );
        return;
      }
      retryPatch(key, attempt, mark);
    })
    .catch(() => retryPatch(key, attempt, mark));
}

function retryPatch(key: string, attempt: number, mark: DirtyMark) {
  // The failed part still has to reach the server, with or without a
  // newer queued write for the same key.
  unionMark(unsentChanges, key, mark);
  // A newer write for this key is already queued; it carries the value.
  if (pendingPatches.has(key)) return;
  if (attempt >= MAX_PATCH_ATTEMPTS) {
    warnSaveFailure(
      "Couldn't save your view settings. Changes are kept on this device only."
    );
    return;
  }
  const handle = setTimeout(() => {
    pendingPatches.delete(key);
    sendPatch(key, attempt + 1);
  }, RETRY_BASE_MS * attempt);
  pendingPatches.set(key, handle);
}

function schedulePatch(key: string, mark: DirtyMark) {
  unionMark(unsentChanges, key, mark);
  const existing = pendingPatches.get(key);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    pendingPatches.delete(key);
    sendPatch(key, 1);
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
  // True once `value` reflects the server copy rather than this device's
  // localStorage cache, so a consumer seeded from SSR can ignore the
  // cached value applied first.
  const [isServerConfirmed, setIsServerConfirmed] = useState(false);
  const hydratedRef = useRef(false);
  // Mirror of `value` so setValue can resolve the functional form OUTSIDE
  // React. It used to resolve inside a setValueState updater and write the
  // module cache, localStorage, the subscriber fan-out and the debounced
  // PATCH from in there — an impure updater, which React double-invokes in
  // development, doubling every one of those writes.
  const valueRef = useRef<T>(defaultValue);
  valueRef.current = value;

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
    setIsServerConfirmed(serverConfirmed);

    const sync = () => {
      const v = cachedUiState?.[key];
      if (v !== undefined) {
        setValueState(v as T);
      }
    };
    subscribers.add(sync);
    // Kick off (or join) the server fetch. When the server response
    // lands, sync runs again with the authoritative DB value.
    fetchUiState().then(() => {
      sync();
      setIsServerConfirmed(serverConfirmed);
    });
    return () => {
      subscribers.delete(sync);
    };
  }, [key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (p: T) => T)(valueRef.current)
          : next;
      // Diff against the shared cache first: another instance of this key
      // may have written it since this one last rendered.
      const prev =
        cachedUiState && key in cachedUiState
          ? cachedUiState[key]
          : valueRef.current;
      const mark = changedPart(prev, resolved);
      valueRef.current = resolved;
      setValueState(resolved);
      setCachedKey(key, resolved, mark);
      schedulePatch(key, mark);
    },
    [key]
  );

  return { value, setValue, isHydrated, isServerConfirmed };
}
