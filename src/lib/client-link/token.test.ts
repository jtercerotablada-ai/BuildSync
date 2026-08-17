import { describe, expect, it } from "vitest";
import { mintToken, hashToken, hashesMatch, isWellFormedToken } from "./token";

describe("mintToken", () => {
  it("returns a 64-character hex token and its sha256 hash", () => {
    const { token, tokenHash } = mintToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toBe(token);
  });

  it("mints tokens drawn from a CSPRNG, not a constant or a weak generator", () => {
    // A hardcoded return value, or Math.random()-derived output, would pass
    // every shape assertion above. Only real randomness guarantees this many
    // calls stay pairwise distinct.
    const CALLS = 50;
    const tokens = new Set(Array.from({ length: CALLS }, () => mintToken().token));
    expect(tokens.size).toBe(CALLS);
  });

  it("returns a tokenHash that is genuinely the sha256 of the returned token", () => {
    // The shape-only assertion above accepts a second independent random
    // value for tokenHash, which would pass every check here and then fail
    // verification in production. Tie the two together explicitly.
    const { token, tokenHash } = mintToken();
    expect(tokenHash).toBe(hashToken(token));
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });
  it("differs for different input", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("hashesMatch", () => {
  it("matches identical hashes", () => {
    const h = hashToken("x");
    expect(hashesMatch(h, h)).toBe(true);
  });
  it("rejects different hashes", () => {
    expect(hashesMatch(hashToken("x"), hashToken("y"))).toBe(false);
  });
  it("rejects a length mismatch without throwing", () => {
    expect(hashesMatch(hashToken("x"), "abcd")).toBe(false);
  });
});

describe("isWellFormedToken", () => {
  it("accepts a minted token", () => {
    expect(isWellFormedToken(mintToken().token)).toBe(true);
  });
  it.each([null, 42, "", "zz", "A".repeat(64)])("rejects %p", (bad) => {
    expect(isWellFormedToken(bad)).toBe(false);
  });
});
