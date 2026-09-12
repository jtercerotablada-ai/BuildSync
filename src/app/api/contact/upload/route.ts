import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  CONTACT_ALLOWED_TYPES,
  CONTACT_FOLDER,
  CONTACT_MAX_BYTES,
  isContactFileAllowed,
} from "@/lib/contact-attachments";

/**
 * POST /api/contact/upload — mint a client upload token for a proposal-request
 * attachment, so a municipal notice, a photo set or a drawing goes from the
 * visitor's browser straight to private blob storage. A route handler cannot
 * carry those bytes: Vercel caps a function body far below a scanned notice.
 *
 * This route has NO session — it serves the public contact form — so it is
 * built around the fact that a stranger is calling it:
 *
 *   • Rate-limited per IP, with a tighter budget than the form itself.
 *   • Pathname pinned under `contact/` so a token can never write anywhere
 *     the app reads as a task attachment or a project file.
 *   • One concrete content type, 25 MB ceiling, short validity.
 *   • The allowlist is the narrow contact one, not the app's general one.
 *   • `access` cannot be pinned by a token (the SDK has no such field), so the
 *     contact route re-checks every submitted URL with isContactBlobUrl()
 *     against CONTACT_BLOB_ACCESS and the `contact/` folder.
 *
 * The upload-completed callback deliberately does nothing: the row is
 * written by POST /api/contact once the visitor sends the form, and a blob
 * that never gets attached to a submission is just an orphan in storage.
 */

const CONCRETE_MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  // Ten tokens per quarter hour per address: a real client attaches a few
  // files once; a script filling the store is throttled at the first minute.
  const limited = rateLimit(`contact-upload:${ip}`, 12, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

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
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const clean = pathname.replace(/^\/+/, "");
        if (!clean.startsWith(CONTACT_FOLDER) || clean.includes("..")) {
          throw new Error("Upload path is not allowed");
        }
        const name = clean.slice(clean.lastIndexOf("/") + 1);

        let mime = "application/octet-stream";
        try {
          const payload = JSON.parse(clientPayload ?? "{}") as { mimeType?: unknown };
          if (typeof payload.mimeType === "string" && CONCRETE_MIME.test(payload.mimeType)) {
            mime = payload.mimeType;
          }
        } catch {
          /* octet-stream */
        }

        if (!isContactFileAllowed(name, mime)) {
          throw new Error("File type is not accepted");
        }
        if (!(CONTACT_ALLOWED_TYPES as readonly string[]).includes(mime)) {
          mime = "application/octet-stream";
        }

        return {
          allowedContentTypes: [mime],
          maximumSizeInBytes: CONTACT_MAX_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
          tokenPayload: JSON.stringify({ kind: "contact-attachment" }),
        };
      },
      onUploadCompleted: async () => {
        /* The submission row is created by POST /api/contact. Nothing to do. */
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    // A stranger is on the other end: one generic message, details in the log.
    console.error("[contact upload] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 400 });
  }
}
