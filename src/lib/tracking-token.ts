import crypto from "crypto";

/**
 * Tracking-link token helpers for the public form-submission
 * tracking page (`/forms/<formId>/track/<submissionId>`).
 *
 * Why HMAC and not JWT? We only need to authenticate one tiny
 * payload (a submissionId + expiry) and we have a server-side
 * secret already (NEXTAUTH_SECRET). A JWT library would be 30KB
 * of overhead for nothing — Node's built-in crypto does HMAC-
 * SHA256 in one line and the result is shorter than a JWT.
 *
 * Format: `<base64url(payload-json)>.<base64url(signature)>`
 *
 * The signature is HMAC-SHA256(payload-json, SECRET). Verification
 * recomputes the signature with a constant-time compare so a leaked
 * payload string can't be used to forge a valid token without the
 * secret.
 *
 * TTL: 1 year. AEC project lifecycles are long (a CA-phase RFI
 * may have a 3-month round-trip; a recert may take 6 months).
 * Tokens older than the TTL silently fail verify — the user can
 * re-request the link via the original receipt email, or the
 * project owner can re-send it from the submissions inbox.
 */

const ALG = "sha256";
const TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

interface TrackingPayload {
  /** FormSubmission.id this token grants read+reply on. */
  s: string;
  /** Issued-at (epoch seconds). */
  iat: number;
  /** Expires-at (epoch seconds). */
  exp: number;
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) {
    // Fail loud in dev so we don't accidentally ship with a weak
    // secret. Production deploys without this env var should never
    // get past CI anyway.
    throw new Error(
      "NEXTAUTH_SECRET is not configured — tracking tokens require it."
    );
  }
  return s;
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Buffer {
  // Re-pad and undo URL-safe substitutions.
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
}

/**
 * Issue a tracking token for a submission. Call this at the
 * moment of submission so the receipt email + post-submit page
 * can show the URL.
 */
export function signTrackingToken(submissionId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TrackingPayload = {
    s: submissionId,
    iat: now,
    exp: now + TTL_SECONDS,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64url(Buffer.from(payloadJson, "utf8"));
  const sig = crypto.createHmac(ALG, secret()).update(payloadB64).digest();
  const sigB64 = base64url(sig);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a token. Returns the submissionId on success, or null if
 * the token is malformed, expired, or tampered. Constant-time
 * signature compare guards against timing attacks (cheap insurance
 * — these tokens grant access to project communications).
 */
export function verifyTrackingToken(
  token: string,
  expectedSubmissionId: string
): { ok: true; submissionId: string } | { ok: false; reason: string } {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "Malformed token" };
  }
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) {
    return { ok: false, reason: "Malformed token" };
  }

  // Recompute the signature.
  let expectedSig: Buffer;
  try {
    expectedSig = crypto
      .createHmac(ALG, secret())
      .update(payloadB64)
      .digest();
  } catch {
    return { ok: false, reason: "Signature verification failed" };
  }
  let providedSig: Buffer;
  try {
    providedSig = base64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "Malformed signature" };
  }
  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    return { ok: false, reason: "Invalid signature" };
  }

  // Parse the payload.
  let payload: TrackingPayload;
  try {
    payload = JSON.parse(
      base64urlDecode(payloadB64).toString("utf8")
    ) as TrackingPayload;
  } catch {
    return { ok: false, reason: "Malformed payload" };
  }

  // Sanity-check the shape.
  if (
    typeof payload.s !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number"
  ) {
    return { ok: false, reason: "Malformed payload" };
  }

  // Bind the token to the URL's submissionId so a leaked link
  // can't be replayed against a different submission.
  if (payload.s !== expectedSubmissionId) {
    return { ok: false, reason: "Token does not match submission" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return { ok: false, reason: "Token expired" };
  }

  return { ok: true, submissionId: payload.s };
}

/**
 * Build the user-facing tracking URL. Resolves the public origin in
 * priority order:
 *   1. APP_URL  (canonical — set this if you want full control)
 *   2. NEXTAUTH_URL (already configured for next-auth callbacks)
 *   3. VERCEL_URL (auto-set on Vercel deploys, missing the scheme)
 *   4. http://localhost:3000 (last-resort dev fallback)
 *
 * Trailing newlines / whitespace on the env var are stripped — a
 * common copy-paste mistake when populating .env on Windows.
 */
export function buildTrackingUrl(
  formId: string,
  submissionId: string,
  token: string
): string {
  const rawBase =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  const base = rawBase.trim().replace(/\/+$/, "");
  return `${base}/forms/${formId}/track/${submissionId}?token=${encodeURIComponent(token)}`;
}
