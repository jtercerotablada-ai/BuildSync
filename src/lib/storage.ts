import { put, del, get, head } from "@vercel/blob";

/**
 * Access level of every signed-in (SaaS) upload.
 *
 * The firm's blob store is a PUBLIC store, and Vercel refuses `access:
 * 'private'` on a public store ("Cannot use private access on a public
 * store", verified again 2026-09-21 — no SaaS upload had succeeded since the
 * switch to private on 2026-08-28). A private store would be a new store with
 * a new token. Until one exists, uploads are public blobs at an unguessable
 * address — `<folder>/<uuid>/<name>-<random suffix>` — that no screen links
 * to: every list still hands out the /api/files/... door (or a message's own
 * door), which re-runs the owning record's access rule on each read.
 *
 * Flip this to 'private' (and swap BLOB_READ_WRITE_TOKEN) once a private store
 * exists. uploadFile, the client upload() calls, the token route and every
 * url check read it from here, so the flip is this one line.
 */
export const SAAS_BLOB_ACCESS: "public" | "private" = "public";

/**
 * Per-file ceiling for ANONYMOUS uploads (public forms, tracking replies).
 * Narrower than maxUploadBytes() on purpose: a stranger is holding the token.
 */
export const PUBLIC_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
/** Files per anonymous request (one form submission or one tracking reply). */
export const PUBLIC_UPLOAD_MAX_FILES = 10;

/**
 * Ceiling for a single upload, in bytes.
 *
 * 10MB used to be the cap and it did not fit the work: a permit set, a scanned
 * sealed PDF, a recertification photo package and a Revit model all clear it.
 * 250MB covers those. A large federated model can still exceed it — raising
 * MAX_UPLOAD_BYTES in the environment moves the cap without a deploy, which is
 * why the value is read here rather than baked into a constant.
 *
 * Vercel caps a function's request body at ~4.5MB, so anything bigger has to
 * go from the browser straight to blob storage (see direct-upload.ts and
 * /api/blob/upload); this ceiling is what the token route pins.
 *
 * The browser only sees NEXT_PUBLIC_* variables, so a client-side pre-check
 * reads the default unless NEXT_PUBLIC_MAX_UPLOAD_BYTES mirrors the override.
 */
export function maxUploadBytes(): number {
  return (
    Number(process.env.MAX_UPLOAD_BYTES) ||
    Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_BYTES) ||
    250 * 1024 * 1024
  );
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/rtf",
  // LandXML / gbXML survey and energy-model exchange.
  "application/xml",
  "text/xml",
  "application/zip",
  "application/x-zip-compressed",
  // Archives are how a drawing set actually arrives from an architect.
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/gzip",
  "application/x-tar",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  // Common CAD MIME variants (browsers often send octet-stream for these,
  // which is handled by the extension allowlist below).
  "image/vnd.dwg",
  "image/vnd.dxf",
  "application/acad",
  "application/dxf",
  "application/dwg",
  "application/x-dwg",
  "application/vnd.dwg",
  "model/vnd.dwf",
  "application/vnd.dwf",
  // BIM / geometry exchange.
  "model/ifc",
  "application/x-step",
  "application/step",
  "model/step",
  "application/iges",
  "model/iges",
  "application/vnd.sketchup.skp",
  "application/vnd.google-earth.kml+xml",
  "application/vnd.google-earth.kmz",
];

const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".js", ".jsx", ".ts", ".tsx",
  ".html", ".htm", ".php", ".py", ".rb", ".msi", ".dll", ".com", ".scr",
  // Same class as the above, and missing from a list that already refused
  // their siblings — an .mjs is a .js and a .vbs is a .bat.
  ".mjs", ".cjs", ".jar", ".vbs", ".wsf", ".hta", ".reg", ".lnk", ".pif",
];

// Extensions accepted even when the browser sends a generic MIME type
// (e.g. application/octet-stream) — the reliable signal for CAD/BIM and
// other engineering files a civil/structural firm actually shares. The
// BLOCKED_EXTENSIONS list above always takes precedence.
const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".svg",
  ".bmp", ".tif", ".tiff",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".rtf", ".md", ".xml",
  ".zip", ".rar", ".7z", ".gz", ".tar",
  ".mp4", ".mov", ".mp3", ".wav", ".m4a",
  // Engineering / CAD / BIM
  ".dwg", ".dxf", ".dwf", ".dwfx", ".dwt", ".rvt", ".rfa", ".rte",
  ".ifc", ".ifczip", ".skp", ".3dm", ".sat",
  ".step", ".stp", ".iges", ".igs", ".dgn", ".kmz", ".kml",
  // Navisworks coordination models and reality-capture scans — the deliverable
  // on a recertification survey is often one of these, not a drawing.
  ".nwd", ".nwf", ".nwc", ".rcp", ".rcs", ".e57",
  // Structural analysis models (ETABS, SAP2000, SAFE, STAAD, RISA).
  ".edb", ".sdb", ".fdb", ".std", ".r3d",
];

/**
 * The `accept` attribute for an upload input: every extension the server
 * admits, so a picker never hides a .dwg or .rvt the allowlist would take.
 */
export const UPLOAD_ACCEPT = ALLOWED_EXTENSIONS.join(",");

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\.\//g, "")
    .replace(/\.\.\\/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .slice(0, 255);
}

function extensionOf(filename: string): string {
  return "." + (filename.split(".").pop()?.toLowerCase() || "");
}

/**
 * The type allowlist, as a reusable assertion.
 *
 * Exported because a route with its own narrower rule still has to clear this
 * one first — the team avatar route runs it before its image-only check, so
 * the blocklist can never be bypassed by a surface that forgot about it.
 *
 * Throws with a message safe to hand back to the caller.
 */
export function assertFileAllowed(filename: string, mimeType: string) {
  // Dangerous extensions are always rejected, regardless of MIME.
  const ext = extensionOf(filename);
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error(`File extension '${ext}' is not allowed`);
  }

  // Accept the file if EITHER its MIME type is allowlisted OR its
  // extension is a known-safe one — CAD/BIM files frequently arrive as
  // application/octet-stream, so a MIME-only allowlist wrongly rejects
  // the engineering files this firm shares.
  const mimeOk = !!mimeType && ALLOWED_MIME_TYPES.includes(mimeType);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  if (!mimeOk && !extOk) {
    throw new Error(
      `File type '${mimeType || ext || "unknown"}' is not allowed`
    );
  }
}

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

/**
 * The store id, taken from the write token: `vercel_blob_rw_<STOREID>_<secret>`.
 * The blob host is `<storeid lowercased>.<access>.blob.vercel-storage.com`.
 * Server-only in effect: the token never reaches the browser, so there this
 * returns null and every ownership check below fails closed.
 */
function blobStoreId(): string | null {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) return null;
  const parts = t.split("_");
  return parts.length >= 5 && parts[0] === "vercel" ? parts[3].toLowerCase() : null;
}

/** `[storeId, access]` for a blob url of OUR store, else null. */
function ownBlobHost(url: string): [string, string] | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (!u.hostname.endsWith(BLOB_HOST_SUFFIX)) return null;
    const labels = u.hostname.split(".");
    // Exactly `<store>.<access>.blob.vercel-storage.com` — no deeper host.
    if (labels.length !== 5) return null;
    // Checking only the host SUFFIX accepts ANY Vercel Blob store, and anyone
    // can create one for free: a url on a stranger's store would be recorded
    // as an attachment and served (via the legacy redirect) from our domain,
    // with bytes the stranger can swap at will. No token, no proof: fail closed.
    const store = blobStoreId();
    if (!store || labels[0] !== store) return null;
    return [labels[0], labels[1]];
  } catch {
    return null;
  }
}

/** A URL we actually own, i.e. one this app wrote to its own blob store. */
export function isVercelBlobUrl(url: string): boolean {
  return ownBlobHost(url) !== null;
}

/**
 * Is this stored URL a PRIVATE blob?
 *
 * The SDK addresses a blob at `${storeId}.${access}.blob.vercel-storage.com`
 * (see `get` in @vercel/blob), so the second host label is the access level.
 * Reading it costs nothing and needs no network round trip, which matters:
 * every authenticated file read asks this question first.
 */
export function isPrivateBlobUrl(url: string): boolean {
  return ownBlobHost(url)?.[1] === "private";
}

/**
 * Fetch a private blob's bytes. Returns null when the blob is gone.
 * Callers must have authorised the request FIRST — this does no access check
 * of its own beyond holding the store token.
 */
export async function readPrivateBlob(url: string) {
  return get(url, { access: "private" });
}

// ── Direct (browser → store) uploads ─────────────────────────────────────
//
// Shared by the browser (direct-upload.ts), the token route
// (/api/blob/upload) and every route that records a finished blob, so the
// folder a token pins, the access it expects and the ceiling it enforces are
// the same three facts everywhere.

/** Where a direct upload is headed. The token route authorises each kind. */
export type UploadTarget =
  | { kind: "task-attachment"; taskId: string; commentId?: string }
  | { kind: "project-resource"; projectId: string }
  | { kind: "message-attachment"; messageId: string }
  | { kind: "team-message-attachment"; teamId: string; messageId: string }
  | { kind: "form-attachment"; formId: string }
  | { kind: "deliverable-file"; deliverableId: string }
  | {
      kind: "tracking-reply";
      formId: string;
      submissionId: string;
      token: string;
    };

/** The folder (with trailing slash) every blob for this target lives under. */
export function uploadFolderFor(target: UploadTarget): string {
  switch (target.kind) {
    case "task-attachment":
      return `tasks/${target.taskId}/`;
    case "project-resource":
      return `projects/${target.projectId}/resources/`;
    case "message-attachment":
    case "team-message-attachment":
      return `messages/${target.messageId}/`;
    case "form-attachment":
      return `forms/${target.formId}/`;
    case "tracking-reply":
      return `tracking/${target.submissionId}/`;
    case "deliverable-file":
      return `deliverables/${target.deliverableId}/`;
  }
}

/**
 * Public forms and tracking replies are read by people with no session, so
 * they stay public even once SAAS_BLOB_ACCESS flips to private.
 */
export function uploadAccessFor(target: UploadTarget): "public" | "private" {
  return target.kind === "form-attachment" || target.kind === "tracking-reply"
    ? "public"
    : SAAS_BLOB_ACCESS;
}

export function uploadMaxBytesFor(target: UploadTarget): number {
  return target.kind === "form-attachment" || target.kind === "tracking-reply"
    ? PUBLIC_UPLOAD_MAX_BYTES
    : maxUploadBytes();
}

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/i;

/**
 * `<folder><uuid>/<name>` — the only shape the token route accepts. The uuid
 * segment is what makes a PUBLIC blob's address unguessable (the store adds a
 * random suffix on top), and the folder is what binds the blob to the one
 * record the token was minted for.
 */
// `..` as a whole path segment. A bare substring test also refused honest
// names like "Foundation plan..pdf", and a dotted name cannot climb anything.
const PARENT_SEGMENT = /(^|\/)\.\.(\/|$)/;

export function isDirectUploadPath(pathname: string, folder: string): boolean {
  const clean = pathname.replace(/^\/+/, "");
  if (!clean.startsWith(folder) || PARENT_SEGMENT.test(clean)) return false;
  return UUID_SEGMENT.test(clean.slice(folder.length));
}

/** A user-caused rejection of a posted blob url; the message is safe to show. */
export class BlobRejectedError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "BlobRejectedError";
  }
}

/**
 * Accept a blob url the BROWSER says it just uploaded, or throw
 * BlobRejectedError.
 *
 * The url is the caller's word. A token cannot pin `access` (the SDK has no
 * such field), so this is where a blob at the wrong access level is refused;
 * head() — which resolves through OUR store token — is the only answer to
 * "does it exist, and what is actually in it"; and the folder check binds the
 * bytes to the record being written, which matters beyond read scope because
 * deleting a row deletes the blob behind it. Size and type are the STORE's
 * numbers, never the caller's.
 */
export async function verifyUploadedBlob(
  url: string,
  name: string,
  folder: string,
  access: "public" | "private",
  maxBytes: number
): Promise<{ url: string; name: string; size: number; mimeType: string }> {
  const host = ownBlobHost(url);
  if (!host) {
    throw new BlobRejectedError("That file is not in this app's storage");
  }
  if (host[1] !== access) {
    throw new BlobRejectedError(`Files here must be uploaded as ${access} files`);
  }
  // A store address never carries a query or hash; one that does is another
  // spelling of some blob, aimed at the recording routes' url dedupe.
  const parsed = new URL(url);
  if (parsed.search || parsed.hash) {
    throw new BlobRejectedError("That file is not in this app's storage");
  }

  let blob;
  try {
    blob = await head(url);
  } catch {
    throw new BlobRejectedError("That file is not in this app's storage");
  }

  const blobPath = blob.pathname.replace(/^\/+/, "");
  if (!blobPath.startsWith(folder) || PARENT_SEGMENT.test(blobPath)) {
    throw new BlobRejectedError("That file was not uploaded here");
  }

  if (blob.size > maxBytes) {
    throw new BlobRejectedError(
      `File size exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`
    );
  }

  const cleanName = sanitizeFilename(name.trim()) || "file";
  const mimeType = blob.contentType || "application/octet-stream";
  try {
    assertFileAllowed(cleanName, mimeType);
  } catch (err) {
    throw new BlobRejectedError(
      err instanceof Error ? err.message : "File type is not allowed"
    );
  }

  // The store's own spelling, never the caller's: every recording route
  // dedupes on this string, and a query, hash or case variant of one blob
  // would otherwise slip past it and leave two rows sharing one blob.
  return { url: blob.url ?? parsed.href, name: cleanName, size: blob.size, mimeType };
}

export async function uploadFile(file: File, folder: string) {
  const maxBytes = maxUploadBytes();
  if (file.size > maxBytes) {
    throw new Error(
      `File size exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`
    );
  }

  assertFileAllowed(file.name, file.type);

  const safeName = sanitizeFilename(file.name);
  const pathname = `${folder}/${crypto.randomUUID()}/${safeName}`;

  // SAAS_BLOB_ACCESS, not a literal: the store decides what it accepts (see
  // the constant). While it is public the address itself is the secret — a
  // uuid folder plus the store's random suffix — and the row's url is never
  // handed out: reads go through /api/files/[recordType]/[recordId] (or a
  // message's own door), which re-runs the owning record's access rule.
  const blob = await put(pathname, file, {
    access: SAAS_BLOB_ACCESS,
    addRandomSuffix: true,
  });

  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Upload something that must stay readable WITHOUT a session.
 *
 * Public forms and their tracking pages are served to people who have no
 * account here — `/forms/` and `/api/forms/` are public prefixes in the proxy.
 * A private blob cannot be shown to a caller we cannot authenticate, so an
 * attachment on that path has to keep a public URL; making it private would
 * hand the external submitter a 403 for the file they just uploaded.
 *
 * Use this ONLY where the reader is deliberately anonymous. Everything with a
 * signed-in audience belongs on `uploadFile`, which follows SAAS_BLOB_ACCESS.
 * The two are separate functions rather than a flag so that choosing "public"
 * is a visible decision at the call site.
 */
export async function uploadPublicFile(file: File, folder: string) {
  const maxBytes = PUBLIC_UPLOAD_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      `File size exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`
    );
  }

  assertFileAllowed(file.name, file.type);

  const safeName = sanitizeFilename(file.name);
  const pathname = `${folder}/${crypto.randomUUID()}/${safeName}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return { url: blob.url, pathname: blob.pathname };
}

export async function deleteFile(url: string) {
  // Only ever a blob of OUR store. A stored url is not always one we wrote
  // (a legacy row, a value somebody PATCHed in), and del() with the firm's
  // token must never be aimed at an address a caller chose.
  if (!isVercelBlobUrl(url)) return;
  try {
    await del(url);
  } catch (error) {
    console.error("Error deleting file from blob storage:", error);
    throw new Error("Failed to delete file");
  }
}

/**
 * The address a browser should use to read a stored file.
 *
 * Private blob URLs are not fetchable from the browser, and public ones (legacy
 * uploads, and every upload while SAAS_BLOB_ACCESS is public) must not be
 * handed out as permanent links, so nothing that reaches a client should carry a
 * raw `record.url` any more. Routes rewrite the field through this on the way
 * out; the read route re-runs the owning record's access rule on every hit.
 */
export function fileReadUrl(
  recordType: "attachment" | "file" | "resource" | "deliverable",
  id: string
): string {
  return `/api/files/${recordType}/${id}`;
}
