import { NextResponse } from "next/server";

/**
 * Self-service sign-up is CLOSED.
 *
 * BuildSync is the firm's internal, staff-only tool. Open registration let any
 * internet user mint a password-less row for any address, finish onboarding
 * and land as OWNER of a fresh empty workspace — an authenticated session on
 * the production app and database, at the firm's expense (AI routes, blob
 * store). A new hire who used it instead of their invitation also ended up
 * alone in that empty workspace instead of in the firm.
 *
 * Accounts are created by accepting a workspace invitation
 * (/invite/<token> → POST /api/invite/<token>/accept), which proves control of
 * the address and joins the right workspace in one step. The same answer for
 * every address, so this cannot be used to probe which emails exist.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "BuildSync accounts are created by invitation only. Ask a workspace admin to invite you, then open the link in the invitation email.",
    },
    { status: 403 }
  );
}
