import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyTaskAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import {
  assertFileAllowed,
  isPrivateBlobUrl,
  maxUploadBytes,
} from "@/lib/storage";

/**
 * POST /api/blob/upload — mint a client upload token, and clean up after it.
 *
 * Every other upload in this app streams its bytes through a route handler,
 * and Vercel caps a function's request body far below the ceiling
 * maxUploadBytes() advertises. A permit set, a scanned sealed PDF and a Revit
 * model all lose that argument, so those bytes have to go from the browser
 * straight to blob storage. This route is the only thing standing between a
 * signed-in user and the store.
 *
 * ── THE HOLE THIS ROUTE IS BUILT AROUND ───────────────────────────────────
 * A signed upload token CANNOT pin access. `onBeforeGenerateToken` returns a
 * Pick of allowedContentTypes | maximumSizeInBytes | validUntil |
 * addRandomSuffix | allowOverwrite | cacheControlMaxAge | ifMatch — there is
 * no `access` field anywhere in it (@vercel/blob/client). The BROWSER passes
 * access to `upload()`, so a signed-in user holding a valid token can ask for
 * a PUBLIC blob: a permanent, login-less link to a client's sealed drawing,
 * which is exactly what `uploadFile()` switching to private closed.
 *
 * That cannot be prevented at token time, so it is caught twice afterwards,
 * in two independent places:
 *
 *   GUARD 1 (synchronous, authoritative) lives in
 *   POST /api/tasks/:taskId/attachments — it refuses to create the database
 *   row for any url that is not a private blob of ours. Nothing public can
 *   ever be reached THROUGH the product.
 *
 *   GUARD 2 (asynchronous, cleanup) is `onUploadCompleted` below — it deletes
 *   a finished blob that came out public. Nothing public survives as a raw
 *   URL either, even though no row would have pointed at it.
 *
 * Neither is redundant. Guard 1 alone leaves a live public URL that no screen
 * in the app shows and nobody thinks to look for; guard 2 alone leaves a
 * window — it fires on a callback, after the fact — in which a row already
 * points at a public file.
 *
 * ── THE ROW IS NOT CREATED HERE ───────────────────────────────────────────
 * `onUploadCompleted` deliberately writes nothing. The attachments route
 * keeps its own authorisation, its own comment binding and its own activity
 * log, and having one writer is what makes guard 1 unavoidable.
 */

/**
 * One concrete `type/subtype`, and nothing else.
 *
 * The declared value becomes the token's entire `allowedContentTypes` list,
 * and that field supports WILDCARDS: a payload of `*` / `*` (or `text/*`)
 * would mint a token that accepts anything up to the size cap, which is the
 * opposite of pinning one type. `*` is absent from both character classes on
 * purpose, as are `;` and whitespace — a parameterised value would not match
 * what upload() sends anyway.
 */
const CONCRETE_MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

/** What the browser says it is uploading, once we have agreed to believe it. */
interface UploadTarget {
  kind: "task-attachment";
  taskId: string;
  /** Declared so the token can pin ONE content type — see below. */
  mimeType: string;
}

/**
 * Parse and narrow the client payload. Throws on anything unrecognised: a
 * token is a write credential, and one minted for a target we could not read
 * is a credential for an unknown target.
 */
function parseTarget(clientPayload: string | null): UploadTarget {
  let raw: unknown;
  try {
    raw = JSON.parse(clientPayload ?? "");
  } catch {
    throw new AuthorizationError("Malformed upload target");
  }

  const payload = raw as Partial<UploadTarget> | null;
  if (
    !payload ||
    payload.kind !== "task-attachment" ||
    typeof payload.taskId !== "string" ||
    payload.taskId.length === 0
  ) {
    throw new AuthorizationError("Unsupported upload target");
  }

  return {
    kind: "task-attachment",
    taskId: payload.taskId,
    // A browser sends "" for most CAD/BIM files; the store settles on
    // octet-stream for those anyway, so declare it rather than leave the pin
    // open. The extension allowlist is what actually admits a .rvt.
    mimeType:
      typeof payload.mimeType === "string" && CONCRETE_MIME.test(payload.mimeType)
        ? payload.mimeType
        : "application/octet-stream",
  };
}

export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,

      // ── TOKEN BRANCH ────────────────────────────────────────────────────
      // A real browser request carrying the caller's session cookie. The
      // proxy waives ONLY the missing-session 401 for this path, and only so
      // the cookie-less callback below can land; a request that does arrive
      // with a session still clears the non-contributor role gate there (see
      // isSessionOptionalApi in src/proxy.ts). Per-task authorisation is
      // in-handler, here.
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const userId = await getCurrentUserId();
        if (!userId) {
          throw new AuthorizationError("Unauthorized");
        }

        const target = parseTarget(clientPayload);

        // The same guard POST /api/tasks/:taskId/attachments runs. A token
        // must never exist for a task the caller may not write to — once it
        // is minted, the store is the one holding the bytes, and nothing
        // downstream can un-mint it.
        await verifyTaskAccess(userId, target.taskId, { requireWrite: true });

        // The browser chooses the pathname, so pin it to the task the access
        // check was just run against. Without this, write access to one task
        // mints a token that writes anywhere in the store — and the folder is
        // what the attachments route uses to prove a finished blob belongs to
        // the task a row is being created on.
        if (!pathname.replace(/^\/+/, "").startsWith(`tasks/${target.taskId}/`)) {
          throw new AuthorizationError("Upload path does not match the task");
        }

        // The type rules, applied before the bytes move. This is the same
        // assertion every server-side upload clears, and it is what rejects a
        // .exe or a .vbs while still admitting the octet-stream that a .rvt,
        // .dwg or .nwd arrives as.
        assertFileAllowed(pathname, target.mimeType);

        return {
          // Everything the token CAN pin, pinned. Not `access` — the SDK has
          // no such field, which is the entire reason guards 1 and 2 exist.
          //
          // One content type, not a list: the client declares what it is
          // sending and passes the identical value to upload(), so a token
          // that leaks is a credential for exactly one kind of file.
          allowedContentTypes: [target.mimeType],
          maximumSizeInBytes: maxUploadBytes(),
          // The store, not the caller, decides the final pathname. Without
          // this a caller could overwrite an existing blob by naming it.
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(target),
        };
      },

      // ── CALLBACK BRANCH — GUARD 2 (asynchronous, cleanup) ───────────────
      // This runs SERVER-TO-SERVER, from Vercel Blob, with NO session and no
      // cookie: `getCurrentUserId()` here would return null and mean nothing.
      // handleUpload has already authenticated it by verifying the
      // x-vercel-signature header against the store token before calling us.
      //
      // Its whole job is the half guard 1 cannot do. Guard 1 (in the
      // attachments route) stops a public blob being reachable through the
      // product, but a blob nothing points at is still bytes on a public URL
      // that whoever uploaded it already knows. This deletes those.
      //
      // Note the callback needs a publicly reachable URL, which the SDK can
      // only derive when running on Vercel; on localhost it warns and skips
      // the callback entirely, so in dev guard 1 is the only guard.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (isPrivateBlobUrl(blob.url)) return;

        // Log BEFORE the delete, not after. The case that actually needs an
        // engineer is the one where del() throws and the public blob is still
        // alive — writing the line afterwards is exactly backwards, because
        // that case would never reach it.
        console.error(
          `[blob upload] non-private client upload, deleting: ${blob.pathname} (${tokenPayload ?? "no payload"})`
        );
        try {
          await del(blob.url);
        } catch (delErr) {
          // Rethrow only here. A failed callback is retried by the store, and
          // a retry of THIS is productive — it tries the deletion again. When
          // the delete succeeded there is nothing left to retry, so returning
          // normally avoids a permanent loop that re-deletes a gone url.
          throw new Error(
            `[blob upload] FAILED to delete a non-private client upload: ${blob.pathname}`,
            { cause: delErr }
          );
        }
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    // Everything else — an assertFileAllowed rejection, a malformed callback,
    // a Prisma failure inside verifyTaskAccess — collapses to one message.
    // This route answers before the session gate (it has to, for the
    // callback), so an unauthenticated caller must not be handed internal
    // error text; and the reason would not reach the user anyway, because
    // retrieveClientToken in @vercel/blob/client discards the response body
    // and throws its own "Failed to retrieve the client token".
    console.error("[blob upload] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 400 });
  }
}
