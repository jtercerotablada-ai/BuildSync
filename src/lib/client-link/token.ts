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

/** Constant-time compare of two hex hashes of equal length. */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** A token is well-formed if it is exactly the hex we mint. Cheap pre-filter. */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}
