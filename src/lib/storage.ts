import { put, del, get } from "@vercel/blob";

/**
 * Ceiling for a single upload, in bytes.
 *
 * 10MB used to be the cap and it did not fit the work: a permit set, a scanned
 * sealed PDF, a recertification photo package and a Revit model all clear it.
 * 250MB covers those. A large federated model can still exceed it — raising
 * MAX_UPLOAD_BYTES in the environment moves the cap without a deploy, which is
 * why the value is read here rather than baked into a constant.
 *
 * NOTE: every upload today goes through a route handler, and Vercel caps a
 * function's request body far below this, so the PLATFORM is what a big file
 * actually hits first. This ceiling only starts to bind once the bytes go
 * from the browser straight to blob storage.
 */
export function maxUploadBytes(): number {
  return Number(process.env.MAX_UPLOAD_BYTES) || 250 * 1024 * 1024;
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

/** A URL we actually own, i.e. one this app wrote to its own blob store. */
export function isVercelBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
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
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname.endsWith(BLOB_HOST_SUFFIX) &&
      hostname.split(".")[1] === "private"
    );
  } catch {
    return false;
  }
}

/**
 * Fetch a private blob's bytes. Returns null when the blob is gone.
 * Callers must have authorised the request FIRST — this does no access check
 * of its own beyond holding the store token.
 */
export async function readPrivateBlob(url: string) {
  return get(url, { access: "private" });
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
  const pathname = `${folder}/${crypto.randomUUID()}-${safeName}`;

  // PRIVATE, not public. A public blob URL is a permanent, login-less link to
  // the bytes: every permission check in this app guards the database row, and
  // a sealed drawing handed out as a public URL stays readable by anyone who
  // ever saw it, even after the row is deleted. Private blobs are readable
  // only through /api/files/[recordType]/[recordId], which re-runs the owning
  // record's own access rule on every read.
  const blob = await put(pathname, file, {
    access: "private",
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
 * signed-in audience belongs on `uploadFile`, which gates the bytes behind the
 * owning record's own rule. The two are separate functions rather than a flag
 * so that choosing "public" is a visible decision at the call site.
 */
export async function uploadPublicFile(file: File, folder: string) {
  const maxBytes = maxUploadBytes();
  if (file.size > maxBytes) {
    throw new Error(
      `File size exceeds ${Math.floor(maxBytes / (1024 * 1024))}MB limit`
    );
  }

  assertFileAllowed(file.name, file.type);

  const safeName = sanitizeFilename(file.name);
  const pathname = `${folder}/${crypto.randomUUID()}-${safeName}`;

  const blob = await put(pathname, file, { access: "public" });

  return { url: blob.url, pathname: blob.pathname };
}

export async function deleteFile(url: string) {
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
 * Private blob URLs are not fetchable from the browser, and legacy public ones
 * must stop being handed out, so nothing that reaches a client should carry a
 * raw `record.url` any more. Routes rewrite the field through this on the way
 * out; the read route re-runs the owning record's access rule on every hit.
 */
export function fileReadUrl(
  recordType: "attachment" | "file" | "resource",
  id: string
): string {
  return `/api/files/${recordType}/${id}`;
}
