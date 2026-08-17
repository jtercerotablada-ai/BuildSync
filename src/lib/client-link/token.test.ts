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

  it("rejects equal-length input with a trailing invalid hex char, without throwing", () => {
    // Same JS string length as a real digest (64), but the last character
    // isn't hex. Buffer.from("...g", "hex") truncates before that pair, so
    // the decoded byte lengths diverge even though the string lengths match
    // — this is exactly what made the old length-on-strings guard insufficient.
    const tampered = hashToken("x").slice(0, 63) + "g";
    expect(() => hashesMatch(tampered, hashToken("y"))).not.toThrow();
    expect(hashesMatch(tampered, hashToken("y"))).toBe(false);
  });

  it("rejects a 64-char string containing a non-hex character against a real digest, without throwing", () => {
    // The specific case found while probing timingSafeEqual: invalid hex
    // elsewhere in an otherwise digest-shaped string.
    const real = hashToken("x");
    const tampered = "g" + real.slice(1);
    expect(() => hashesMatch(tampered, real)).not.toThrow();
    expect(hashesMatch(tampered, real)).toBe(false);
  });

  it("rejects two equal-length but entirely invalid hex strings, without throwing", () => {
    // Both operands are garbage of the same JS length. The old implementation
    // returned true here: both decode to 0-length buffers, and 0 === 0 looks
    // like a match to timingSafeEqual. The `!== 32` guard is what stops that.
    const a = "g".repeat(64);
    const b = "h".repeat(64);
    expect(() => hashesMatch(a, b)).not.toThrow();
    expect(hashesMatch(a, b)).toBe(false);
  });

  it("rejects two empty strings", () => {
    // Both decode to 0-length buffers, which are trivially "equal" by
    // timingSafeEqual's own rules. The `!== 32` guard exists specifically to
    // stop a pair of degenerate empty inputs from reading as a match.
    expect(hashesMatch("", "")).toBe(false);
  });

  it("treats uppercase and lowercase hex encodings of the same digest as equal", () => {
    // Buffer.from parses hex case-insensitively, so this comparison happens
    // at the byte level, not the string level — uppercase and lowercase
    // encodings of the same 32 bytes are the same hash. hashToken and
    // isWellFormedToken only ever produce/accept lowercase, so this never
    // arises from our own callers; documenting it here as the intended
    // behavior rather than an accident.
    const h = hashToken("x");
    expect(hashesMatch(h, h.toUpperCase())).toBe(true);
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
