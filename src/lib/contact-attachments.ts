/**
 * Rules for files attached to a public proposal request.
 *
 * Shared by the browser (to refuse a file before it moves), the token route
 * (to pin the upload) and the contact route (to accept only what the token
 * route could have produced). One list, three gates.
 *
 * Deliberately NARROWER than the app's general allowlist in storage.ts: a
 * stranger on the internet is minting these tokens, so only what a client
 * actually sends about a building is admitted — a notice, photographs, a
 * drawing, an archive of drawings.
 */

/**
 * Access level of contact attachments.
 *
 * The firm's blob store is a PUBLIC store, and Vercel refuses `access:
 * 'private'` on a public store ("Cannot use private access on a public
 * store", verified 2026-09-12). A private store would be a new store with a
 * new token. Until one exists, attachments are public blobs at an
 * unguessable address — `contact/<uuid>/<name>-<random suffix>` — which is
 * two layers of entropy and never linked from any page. Flip this to
 * 'private' once the store is private; the browser, the token route and the
 * URL check all read it from here.
 */
export const CONTACT_BLOB_ACCESS: 'public' | 'private' = 'public';

export const CONTACT_MAX_FILES = 5;
export const CONTACT_MAX_BYTES = 25 * 1024 * 1024;
/** Every contact blob lives under this folder. The token route pins it. */
export const CONTACT_FOLDER = 'contact/';

export const CONTACT_ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'application/zip',
  'application/x-zip-compressed',
  'image/vnd.dwg',
  'image/vnd.dxf',
  'application/acad',
  'application/dxf',
  'application/dwg',
  'application/x-dwg',
  'application/vnd.dwg',
  'application/octet-stream',
] as const;

export const CONTACT_ALLOWED_EXTENSIONS = [
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff',
  '.zip', '.dwg', '.dxf',
] as const;

/** The `accept` attribute for the file input. */
export const CONTACT_ACCEPT = CONTACT_ALLOWED_EXTENSIONS.join(',');

export function contactExtensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/** True when the extension is one we admit. MIME is advisory — browsers send
 *  octet-stream for DWG/DXF and HEIC on some platforms. */
export function isContactFileAllowed(name: string, mime: string): boolean {
  const ext = contactExtensionOf(name);
  if (!(CONTACT_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return false;
  if (mime && !(CONTACT_ALLOWED_TYPES as readonly string[]).includes(mime)) {
    // Unknown MIME with a known extension: admit. Known-bad MIME never has a
    // known-good extension above, so this cannot smuggle an executable.
    return mime.startsWith('image/') || ext === '.dwg' || ext === '.dxf' || ext === '.heic' || ext === '.heif';
  }
  return true;
}

/** Shape stored on ContactSubmission.files and posted by the form. */
export type ContactAttachment = {
  url: string;
  name: string;
  size: number;
  type: string;
};

const BLOB_HOST_SUFFIX = '.blob.vercel-storage.com';

/**
 * The store id, taken from the write token: `vercel_blob_rw_<STOREID>_<secret>`.
 * The blob host is `<storeid lowercased>.<access>.blob.vercel-storage.com`.
 *
 * WHY THIS EXISTS: checking only the host SUFFIX accepts *any* Vercel Blob
 * store, and anyone can create one for free. Without this, a stranger could
 * POST /api/contact with a URL pointing at THEIR store under a `contact/`
 * key, we would file it as an attachment, and the office notification and the
 * admin inbox would both link staff — through our own domain — to bytes the
 * attacker controls and can swap at any time. Server-only: the token is not
 * exposed to the browser, and nothing in the client calls this.
 */
function blobStoreId(): string | null {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) return null;
  const parts = t.split('_');
  // vercel_blob_rw_<storeId>_<secret>
  return parts.length >= 5 && parts[0] === 'vercel' ? parts[3].toLowerCase() : null;
}

/**
 * A URL the contact token route could actually have produced: our store, at
 * the configured access level, under the contact folder. Anything else on a
 * submission is a lie — someone else's host, another folder, or (once the
 * store is private) a public blob smuggled in as a permanent link.
 */
export function isContactBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    // Reject credentials in the authority; `https://evil.com@ours...` parses
    // with hostname `ours...` in some readers and is never legitimate here.
    if (u.username || u.password) return false;
    if (!u.hostname.endsWith(BLOB_HOST_SUFFIX)) return false;
    const labels = u.hostname.split('.');
    // Exactly `<store>.<access>.blob.vercel-storage.com` — no deeper host.
    if (labels.length !== 5) return false;
    if (labels[1] !== CONTACT_BLOB_ACCESS) return false;
    const store = blobStoreId();
    // No token configured means we cannot prove ownership, so trust nothing.
    if (!store || labels[0] !== store) return false;
    const path = u.pathname.replace(/^\/+/, '');
    if (path.includes('..')) return false;
    return path.startsWith(CONTACT_FOLDER);
  } catch {
    return false;
  }
}

/** Parse whatever is on the Json column into a typed list (or none). */
export function parseContactAttachments(value: unknown): ContactAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== 'object') return [];
    const o = v as Record<string, unknown>;
    if (typeof o.url !== 'string' || typeof o.name !== 'string') return [];
    if (!isContactBlobUrl(o.url)) return [];
    return [
      {
        url: o.url,
        name: o.name,
        size: typeof o.size === 'number' ? o.size : 0,
        type: typeof o.type === 'string' ? o.type : '',
      },
    ];
  });
}
