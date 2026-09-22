/**
 * Lightweight fixed-window rate limiter — audit AUTH-02.
 *
 * Guards auth endpoints (login, forgot/reset password, register) against
 * brute-force and email-bombing bursts.
 *
 * ⚠️ IMPORTANT: this keeps counters in process memory. On serverless
 * (Vercel) every instance has its own memory, so it throttles PER INSTANCE,
 * not globally. It meaningfully slows naive single-source attacks but is not
 * a substitute for a shared store. For production-grade limits, back this
 * with Upstash Redis (@upstash/ratelimit) or similar and swap the store
 * below — the call sites don't need to change.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Returns { ok } — false once `limit` hits happen within `windowMs` for the
 * given key. `retryAfter` is seconds until the window resets.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  // Opportunistic prune so the map can't grow unbounded on a long-lived
  // instance.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now > b.resetAt) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { ok: true, retryAfter: 0 };
}

/**
 * Read-only check: is `key` already at `limit` hits in its current window?
 * Pair it with `rateLimit(key, …)` called only on the outcomes that should
 * count — e.g. login counts FAILED attempts only, so a user who signs in
 * correctly several times never locks themselves out.
 */
export function isRateLimited(
  key: string,
  limit: number
): { limited: boolean; retryAfter: number } {
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || now > bucket.resetAt || bucket.count < limit) {
    return { limited: false, retryAfter: 0 };
  }
  return { limited: true, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
}

/**
 * Gives back one hit taken with `rateLimit(key, …)`. For limits that should
 * count only failures but must still reserve the attempt up front: a
 * peek-then-count check lets every request of a parallel burst through before
 * the first failure is recorded.
 */
export function refundRateLimit(key: string): void {
  const bucket = buckets.get(key);
  if (bucket && Date.now() <= bucket.resetAt && bucket.count > 0) {
    bucket.count--;
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers | Record<string, unknown>): string {
  const get = (name: string): string | null => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }
    const v = (headers as Record<string, unknown>)[name];
    return typeof v === "string" ? v : Array.isArray(v) ? String(v[0]) : null;
  };
  const fwd = get("x-forwarded-for");
  return (
    (fwd ? fwd.split(",")[0]?.trim() : null) ||
    get("x-real-ip") ||
    "unknown"
  );
}
