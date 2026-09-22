// Above this, a same-origin door is handed to the browser's own download
// manager instead of being held in this tab's memory before the save starts.
const BUFFER_LIMIT_BYTES = 50 * 1024 * 1024;

/**
 * Cross-origin file download.
 *
 * The HTML `download` attribute is silently ignored when the file
 * lives on a different origin (e.g. Vercel Blob's CDN). The browser
 * just navigates to the URL and lets the server decide whether to
 * stream or render. That's not what users expect when they click a
 * "download" button.
 *
 * downloadFile() fetches the bytes itself, wraps them in a Blob URL
 * on the current origin, and clicks an anchor — which the browser
 * does honor. We revoke the object URL right after the click so we
 * don't leak memory.
 *
 * Throws on network error so callers can `toast.error()` the failure.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const own = sameOriginApiUrl(url);
  const controller = new AbortController();
  // Fetch first even for the app's own doors: a deleted file or revoked
  // access must reach the caller's toast, and only a saved object URL keeps
  // the record's real name — a public blob's host names the download after
  // its random-suffixed pathname, because `<a download>` is ignored once the
  // door redirects across origins.
  const res = await fetch(url, { signal: controller.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const length = Number(res.headers.get("content-length"));
  if (own && !(length > 0 && length <= BUFFER_LIMIT_BYTES)) {
    // A large (or unsized) file: stream it to disk through the door's
    // `?download=1`. The name may carry the store's suffix for a public blob;
    // that beats buffering a 200 MB model in memory.
    controller.abort();
    own.searchParams.set("download", "1");
    const a = document.createElement("a");
    a.href = own.toString();
    a.download = filename || "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser a beat to start the download, then free the blob.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

/** The url as a same-origin /api/ address, or null for anything else. */
function sameOriginApiUrl(url: string): URL | null {
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/")
      ? u
      : null;
  } catch {
    return null;
  }
}
