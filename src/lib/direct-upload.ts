import { upload } from "@vercel/blob/client";
import {
  type UploadTarget,
  uploadAccessFor,
  uploadFolderFor,
  uploadMaxBytesFor,
} from "@/lib/storage";

/**
 * Browser → blob storage, for every upload surface.
 *
 * A Vercel function refuses a request body over ~4.5MB before the handler
 * runs (413, with a body that is not JSON), so a file cannot travel THROUGH a
 * route handler. The bytes go straight to the store with a token minted by
 * /api/blob/upload, and the caller then posts only the returned url to the
 * route that records the row. That route re-checks everything (verifyUploadedBlob).
 *
 * Throws an Error whose message is fit for a toast.
 */
export async function uploadDirect(
  file: File,
  target: UploadTarget,
  onProgress?: (percentage: number) => void
): Promise<{ url: string }> {
  const maxBytes = uploadMaxBytesFor(target);
  if (file.size > maxBytes) {
    throw new Error(
      `File exceeds the ${Math.floor(maxBytes / (1024 * 1024))}MB limit`
    );
  }

  const mimeType = file.type || "application/octet-stream";
  const safeName = file.name.replace(/[/\\]/g, "_");
  // `<folder><uuid>/<name>`: the token route refuses any other shape. The
  // uuid folder is half of what keeps a public blob's address unguessable;
  // the store's random suffix is the other half.
  const pathname = `${uploadFolderFor(target)}${crypto.randomUUID()}/${safeName}`;

  try {
    const blob = await upload(pathname, file, {
      // Read from storage.ts, never hard-coded here: the store refuses any
      // other value, and the recording route refuses a blob at any other
      // access level.
      access: uploadAccessFor(target),
      handleUploadUrl: "/api/blob/upload",
      // Declared here AND in the payload so they agree: the token pins this
      // exact content type, and a mismatch is rejected by the store.
      contentType: mimeType,
      clientPayload: JSON.stringify({ ...target, mimeType }),
      multipart: file.size > 8 * 1024 * 1024,
      onUploadProgress: onProgress
        ? ({ percentage }) => onProgress(percentage)
        : undefined,
    });
    // The store's url, never the pathname we asked for: addRandomSuffix means
    // the two differ, and only this one addresses the bytes.
    return { url: blob.url };
  } catch (err) {
    // The SDK throws one fixed string for EVERY token-route rejection — it
    // discards the response body — so the real reason (file type, access,
    // record deleted mid-upload) never reaches this catch.
    throw new Error(
      err instanceof Error && /client token/i.test(err.message)
        ? "Upload refused — check the file type and your access"
        : err instanceof Error
          ? err.message
          : "Upload failed"
    );
  }
}

/** Read an API error body, tolerating the platform's non-JSON 413 page. */
export async function responseError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error as string;
  if (res.status === 413) return "File is too large to send this way";
  return fallback;
}
