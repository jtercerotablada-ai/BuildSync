import { NextResponse } from "next/server";

/**
 * "Add tasks by email" is not available.
 *
 * This route used to hand out `<user-id>@mail.ttcivilstructural.com`, but
 * nothing receives mail at that domain (no MX record, no inbound provider,
 * no webhook that turns a message into a task). Every email forwarded to the
 * address bounced or vanished while the user believed it had been captured.
 * It now answers 410 so no caller can show an address that does not work.
 * Bring it back only together with a real inbound pipeline: MX for the
 * domain, a signed inbound webhook, and task creation for the mapped user.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Adding tasks by email is not available" },
    { status: 410 }
  );
}
