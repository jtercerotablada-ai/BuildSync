import crypto from "crypto";

/** URL segment length in bytes before hex encoding. */
const TOKEN_BYTES = 32;

/**
 * Mint a share token. Returns the plaintext for the URL and the hash to store.
 *
 * The plaintext is deliberately not recoverable: `src/lib/tokens.ts` stores
 * verification tokens in plaintext, which the auth audit flagged, and new
 * surface should not inherit that. The cost is that a link can be shown once
 * and then only re-minted — which is the semantics we want anyway, since
 * re-sending to a new board president must kill the former one's link.
 */
export function mintToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time compare of two SHA-256 hex digests.
 *
 * Total by construction: returns false for anything that is not a pair of
 * well-formed digests rather than throwing. `Buffer.from(s, "hex")` does NOT
 * reject invalid hex — it truncates at the first bad character — so two
 * strings of equal JS length can decode to buffers of different byte length,
 * and timingSafeEqual then throws ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH. This
 * function guards a public, unauthenticated route, where a thrown error is a
 * 500 and a 500 is a signal. It must fail closed and quietly.
 */
export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  // Compare decoded byte length, not string length: that is what
  // timingSafeEqual actually requires, and it is what invalid hex corrupts.
  if (bufA.length !== bufB.length || bufA.length !== 32) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** A token is well-formed if it is exactly the hex we mint. Cheap pre-filter. */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}
