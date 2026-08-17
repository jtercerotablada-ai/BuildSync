/**
 * The password rule, in one place, importable from anywhere.
 *
 * It used to live in `auth-utils.ts`, which pulls in Prisma and
 * `getServerSession` and is therefore server-only. Client screens could not
 * import it, so they carried their own looser copy — /onboarding checked
 * length alone — and a password the on-screen meter called "Good" was rejected
 * by the server on submit. Two definitions of one rule always drift; this file
 * has no dependencies precisely so both sides can share the single definition.
 *
 * `auth-utils.ts` re-exports it, so existing server imports keep working.
 */
export function validatePassword(password: string): { valid: boolean; message: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character" };
  }
  return { valid: true, message: "" };
}
