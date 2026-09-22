import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyTaskAccess,
  verifyProjectAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { loadMessageWithAccess } from "@/lib/message-access";
import { requireTeamStanding } from "@/lib/team-access";
import { verifyTrackingToken } from "@/lib/tracking-token";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getDeliverableAccess } from "@/lib/deliverable-access";
import {
  type UploadTarget,
  assertFileAllowed,
  isDirectUploadPath,
  uploadAccessFor,
  uploadFolderFor,
  uploadMaxBytesFor,
} from "@/lib/storage";

/**
 * POST /api/blob/upload — mint a client upload token, and clean up after it.
 *
 * Vercel refuses a function request body over ~4.5MB before the handler runs,
 * so no upload of real size can stream THROUGH a route handler. Every upload
 * surface (task and comment attachments, project Key resources / Files tab,
 * deliverable revision files,
 * project and team message attachments, public form attachments and tracking
 * replies) sends its bytes from the browser straight to blob storage with a
 * token minted here, then posts the finished url to the route that records
 * the row. This route is the only thing standing between a caller and the
 * store.
 *
 * ── WHAT A TOKEN PINS ─────────────────────────────────────────────────────
 *   • the pathname: `<the target's folder><uuid>/<name>` — the folder binds
 *     the blob to the one record the access check ran against, the uuid keeps
 *     a public blob's address unguessable, and addRandomSuffix stops a caller
 *     overwriting an existing blob by naming it;
 *   • ONE concrete content type, cleared by the app's type allowlist;
 *   • the size ceiling the recording route enforces (uploadMaxBytesFor).
 *
 * It CANNOT pin `access` — onBeforeGenerateToken's return has no such field —
 * so the browser chooses. That is caught twice afterwards:
 *
 *   GUARD 1 (synchronous, authoritative) is verifyUploadedBlob() in every
 *   recording route: no row is created for a url that is not OUR store, at
 *   the expected access level, under the target's folder.
 *
 *   GUARD 2 (asynchronous, cleanup) is `onUploadCompleted` below: it deletes a
 *   finished blob whose access differs from what the target expects, so a
 *   stray one does not survive as a raw URL either.
 *
 * While the store is public (SAAS_BLOB_ACCESS) both guards expect "public";
 * flipping that constant makes them expect "private" with no change here.
 *
 * ── THE ROW IS NOT CREATED HERE ───────────────────────────────────────────
 * `onUploadCompleted` deliberately writes nothing. Each recording route keeps
 * its own authorisation, bindings and activity log, and having one writer is
 * what makes guard 1 unavoidable.
 */

/**
 * One concrete `type/subtype`, and nothing else.
 *
 * The declared value becomes the token's entire `allowedContentTypes` list,
 * and that field supports WILDCARDS: a payload of `*` / `*` (or `text/*`)
 * would mint a token that accepts anything up to the size cap. `*` is absent
 * from both character classes on purpose, as are `;` and whitespace.
 */
const CONCRETE_MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

/** Record ids end up in the pathname, so nothing that could leave the folder. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function id(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new AuthorizationError("Unsupported upload target");
  }
  return value;
}

/**
 * Parse and narrow the client payload. Throws on anything unrecognised: a
 * token is a write credential, and one minted for a target we could not read
 * is a credential for an unknown target.
 */
function parseTarget(clientPayload: string | null): {
  target: UploadTarget;
  mimeType: string;
} {
  let raw: Record<string, unknown> | null;
  try {
    raw = JSON.parse(clientPayload ?? "") as Record<string, unknown> | null;
  } catch {
    throw new AuthorizationError("Malformed upload target");
  }
  if (!raw || typeof raw !== "object") {
    throw new AuthorizationError("Unsupported upload target");
  }

  let target: UploadTarget;
  switch (raw.kind) {
    case "task-attachment":
      target = {
        kind: "task-attachment",
        taskId: id(raw.taskId),
        ...(raw.commentId != null ? { commentId: id(raw.commentId) } : {}),
      };
      break;
    case "project-resource":
      target = { kind: "project-resource", projectId: id(raw.projectId) };
      break;
    case "message-attachment":
      target = { kind: "message-attachment", messageId: id(raw.messageId) };
      break;
    case "team-message-attachment":
      target = {
        kind: "team-message-attachment",
        teamId: id(raw.teamId),
        messageId: id(raw.messageId),
      };
      break;
    case "form-attachment":
      target = { kind: "form-attachment", formId: id(raw.formId) };
      break;
    case "deliverable-file":
      target = { kind: "deliverable-file", deliverableId: id(raw.deliverableId) };
      break;
    case "tracking-reply":
      if (typeof raw.token !== "string" || raw.token.length > 4096) {
        throw new AuthorizationError("Unsupported upload target");
      }
      target = {
        kind: "tracking-reply",
        formId: id(raw.formId),
        submissionId: id(raw.submissionId),
        token: raw.token,
      };
      break;
    default:
      throw new AuthorizationError("Unsupported upload target");
  }

  return {
    target,
    // A browser sends "" for most CAD/BIM files; the store settles on
    // octet-stream for those anyway, so declare it rather than leave the pin
    // open. The extension allowlist is what actually admits a .rvt.
    mimeType:
      typeof raw.mimeType === "string" && CONCRETE_MIME.test(raw.mimeType)
        ? raw.mimeType
        : "application/octet-stream",
  };
}

/**
 * The same gate the recording route applies, run BEFORE the bytes move: once
 * a token is minted the store holds the bytes and nothing downstream can
 * un-mint it.
 */
async function authorize(
  target: UploadTarget,
  userId: string | null | undefined,
  request: Request
): Promise<void> {
  switch (target.kind) {
    case "task-attachment": {
      if (!userId) throw new AuthorizationError("Unauthorized");
      // Attaching to YOUR OWN comment is part of commenting (a COMMENTER keeps
      // it), exactly as POST /api/tasks/:taskId/attachments decides it.
      let ownComment = false;
      if (target.commentId) {
        const comment = await prisma.comment.findFirst({
          where: { id: target.commentId, taskId: target.taskId },
          select: { authorId: true },
        });
        if (!comment) throw new NotFoundError("Comment not found");
        ownComment = comment.authorId === userId;
      }
      await verifyTaskAccess(userId, target.taskId, {
        requireWrite: !ownComment,
        requireComment: ownComment,
      });
      return;
    }
    case "project-resource": {
      if (!userId) throw new AuthorizationError("Unauthorized");
      await verifyProjectAccess(userId, target.projectId, { requireWrite: true });
      return;
    }
    case "deliverable-file": {
      if (!userId) throw new AuthorizationError("Unauthorized");
      // Same gate as POST /api/deliverables/:id/files, which records the row:
      // the deliverable's project must be readable (else 404) and writable.
      // Whether the target revision is still unlocked is decided there — the
      // token only binds the bytes to this deliverable's folder.
      const access = await getDeliverableAccess(target.deliverableId, userId);
      if (!access.ok) throw new NotFoundError("Deliverable not found");
      if (!access.canWrite) {
        throw new AuthorizationError(
          "You don't have permission to edit this project"
        );
      }
      return;
    }
    case "message-attachment": {
      if (!userId) throw new AuthorizationError("Unauthorized");
      const access = await loadMessageWithAccess(target.messageId, userId);
      if (!access.ok) throw new NotFoundError("Message not found");
      if (!access.isAuthor) {
        throw new AuthorizationError(
          "Only the author can attach files to their message"
        );
      }
      return;
    }
    case "team-message-attachment": {
      if (!userId) throw new AuthorizationError("Unauthorized");
      // Same gate as the attachments POST that records the file: a team
      // member or workspace OWNER/ADMIN with a live contributor seat. A bare
      // TeamMember row would refuse managers the POST admits, and mint tokens
      // for a stale row whose seat is gone.
      const standing = await requireTeamStanding(userId, target.teamId);
      const message = await prisma.teamMessage.findFirst({
        where: { id: target.messageId, teamId: target.teamId },
        select: { authorId: true },
      });
      if (!message) throw new NotFoundError("Message not found");
      if (message.authorId !== userId && !standing.canManageMembers) {
        throw new AuthorizationError(
          "You can only attach files to your own messages"
        );
      }
      return;
    }
    case "form-attachment":
    case "tracking-reply": {
      // A stranger may be on the other end: throttle before touching the DB.
      const key = userId ? `u:${userId}` : clientIp(request.headers);
      const limited = rateLimit(`blob-upload:${target.kind}:${key}`, 30, 15 * 60 * 1000);
      if (!limited.ok) throw new AuthorizationError("Too many uploads");

      if (target.kind === "form-attachment") {
        const form = await prisma.form.findUnique({
          where: { id: target.formId },
          select: { isActive: true, visibility: true },
        });
        // Same gates the submit route applies to the submission itself.
        if (!form || !form.isActive) throw new NotFoundError("Form not found");
        if (form.visibility === "ORGANIZATION" && !userId) {
          throw new AuthorizationError("Unauthorized");
        }
        return;
      }

      const verification = verifyTrackingToken(target.token, target.submissionId);
      if (!verification.ok) throw new AuthorizationError("Unauthorized");
      const submission = await prisma.formSubmission.findUnique({
        where: { id: target.submissionId },
        select: { formId: true, taskId: true },
      });
      if (!submission || submission.formId !== target.formId || !submission.taskId) {
        throw new NotFoundError("Submission not found");
      }
      return;
    }
  }
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
      // A browser request. For signed-in kinds it carries the session cookie;
      // the proxy waives ONLY the missing-session 401 for this path (so the
      // cookie-less callback below can land, and so an anonymous public-form
      // submitter can reach the form kinds). A request that does arrive with a
      // session still clears the non-contributor role gate there (see
      // isSessionOptionalApi in src/proxy.ts). Per-record authorisation is
      // in-handler, here.
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const userId = await getCurrentUserId();
        const { target, mimeType } = parseTarget(clientPayload);

        await authorize(target, userId, request);

        // The browser chooses the pathname, so pin it to the record the
        // access check was just run against. Without this, access to one
        // record mints a token that writes anywhere in the store — and the
        // folder is what the recording route uses to prove a finished blob
        // belongs to the record a row is being created on.
        if (!isDirectUploadPath(pathname, uploadFolderFor(target))) {
          throw new AuthorizationError("Upload path does not match the target");
        }

        // The type rules, applied before the bytes move: rejects a .exe or a
        // .vbs while still admitting the octet-stream a .rvt arrives as.
        assertFileAllowed(pathname, mimeType);

        return {
          allowedContentTypes: [mimeType],
          maximumSizeInBytes: uploadMaxBytesFor(target),
          addRandomSuffix: true,
          validUntil: Date.now() + 60 * 60 * 1000,
          // Never the tracking token: this payload rides inside the client
          // token and comes back on the callback.
          tokenPayload: JSON.stringify({
            kind: target.kind,
            folder: uploadFolderFor(target),
            access: uploadAccessFor(target),
          }),
        };
      },

      // ── CALLBACK BRANCH — GUARD 2 (asynchronous, cleanup) ───────────────
      // SERVER-TO-SERVER, from Vercel Blob, with NO session: handleUpload has
      // already authenticated it by verifying x-vercel-signature against the
      // store token before calling us. Its job is the half guard 1 cannot do:
      // a blob at the wrong access level that no row points at is still bytes
      // at a URL whoever uploaded it knows. This deletes those.
      //
      // The callback needs a publicly reachable URL, which the SDK can only
      // derive on Vercel; on localhost it is skipped, so there guard 1 is the
      // only guard.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let expected: string | undefined;
        try {
          expected = (JSON.parse(tokenPayload ?? "{}") as { access?: string }).access;
        } catch {
          expected = undefined;
        }
        const actual = new URL(blob.url).hostname.split(".")[1];
        if (expected && actual === expected) return;

        // Log BEFORE the delete: the case that needs an engineer is the one
        // where del() throws and the blob is still alive.
        console.error(
          `[blob upload] client upload at unexpected access (${actual}), deleting: ${blob.pathname} (${tokenPayload ?? "no payload"})`
        );
        try {
          await del(blob.url);
        } catch (delErr) {
          // Rethrow only here: the store retries a failed callback, and a retry
          // of THIS is productive. When the delete succeeded, returning
          // normally avoids a loop that re-deletes a gone url.
          throw new Error(
            `[blob upload] FAILED to delete a client upload: ${blob.pathname}`,
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
    // a Prisma failure — collapses to one message. This route answers before
    // the session gate, so an unauthenticated caller must not be handed
    // internal error text; and the reason would not reach the user anyway,
    // because @vercel/blob/client discards the response body and throws its
    // own "Failed to retrieve the client token".
    console.error("[blob upload] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 400 });
  }
}
