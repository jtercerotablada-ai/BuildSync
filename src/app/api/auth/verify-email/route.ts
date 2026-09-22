import { NextResponse } from "next/server";

/**
 * Retired. Verification now happens when the emailed token is redeemed on
 * /onboarding, which sets the password and stamps emailVerified in one step.
 *
 * This endpoint used to CONSUME the same email-verify token after only
 * stamping emailVerified, so anyone who reached it left the account with no
 * password and a dead onboarding link. It no longer touches the token; the
 * /verify-email page forwards to /onboarding instead of calling it.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This verification method is no longer used. Open the link in your email to finish setting up your account.",
    },
    { status: 410 }
  );
}
