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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
