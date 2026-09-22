import { describe, expect, it } from "vitest";
import { clientIp, isRateLimited, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows `limit` hits per window and then refuses", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const refused = rateLimit(key, 3, 60_000);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfter).toBeGreaterThan(0);
  });
});

describe("isRateLimited", () => {
  it("does not count as a hit", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 10; i++) expect(isRateLimited(key, 2).limited).toBe(false);
    rateLimit(key, 2, 60_000);
    expect(isRateLimited(key, 2).limited).toBe(false);
    rateLimit(key, 2, 60_000);
    const state = isRateLimited(key, 2);
    expect(state.limited).toBe(true);
    expect(state.retryAfter).toBeGreaterThan(0);
  });

  it("is independent per key", () => {
    const a = `t:${Math.random()}`;
    const b = `t:${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(isRateLimited(a, 1).limited).toBe(true);
    expect(isRateLimited(b, 1).limited).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    expect(clientIp({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp({})).toBe("unknown");
  });
});
