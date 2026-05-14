"use client";

import { useState, useEffect, useCallback } from "react";
import type { EffectiveAccess } from "@/lib/access-control";

/**
 * useEffectiveAccess — client-side hook that fetches the user's
 * EffectiveAccess once on mount and exposes it (along with
 * loading + error state).
 *
 * Cache: per-tab in-memory; re-fetches whenever the component
 * remounts. Cheap because the API itself is small and uncached on
 * the server, but the practical hit rate per session is low.
 *
 * Usage:
 *   const { access, loading } = useEffectiveAccess();
 *   if (!loading && !canAccessSection(access!, "reporting")) hide();
 */
export function useEffectiveAccess(): {
  access: EffectiveAccess | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [access, setAccess] = useState<EffectiveAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccess = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/access", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          setError("unauthorized");
        } else if (res.status === 404) {
          setError("no-workspace");
        } else {
          setError("fetch-failed");
        }
        setAccess(null);
        return;
      }
      const data = (await res.json()) as EffectiveAccess;
      setAccess(data);
      setError(null);
    } catch {
      setError("network");
      setAccess(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  return { access, loading, error, refetch: fetchAccess };
}
