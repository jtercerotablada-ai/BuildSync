/**
 * Avatar images are stored INLINE in User.image (a data URL), which means the
 * blob travels in every payload that carries a user: the session, mention
 * lists, comment authors, member tables. The picker used to accept whatever
 * the file dialog returned and store it verbatim, so a 4 MB photo from a phone
 * became a ~5.5 MB base64 string re-sent on every one of those responses.
 *
 * This normalizes any picked file to a small square JPEG before it is stored.
 */

/** Max bytes accepted from the file picker, BEFORE downscaling. */
export const AVATAR_MAX_INPUT_BYTES = 8 * 1024 * 1024;
/** Stored square size, in px. */
export const AVATAR_SIZE = 256;
/** Hard cap on the stored data URL (server-enforced too). */
export const AVATAR_MAX_STORED_CHARS = 300_000;

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export class AvatarError extends Error {}

/**
 * Validate + downscale a picked file into a square JPEG data URL.
 * Throws AvatarError with a user-facing message.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new AvatarError("Use a PNG, JPG, WEBP or GIF image.");
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    throw new AvatarError("That image is too large (max 8 MB).");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AvatarError("Couldn't read that file."));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  // Canvas downscale. If it fails for any reason (older browser, decode
  // error), fall back to the original only when it is already small enough.
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new AvatarError("That image couldn't be read."));
      el.src = dataUrl;
    });

    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AvatarError("Canvas unavailable");
    // Center-crop to a square, then scale.
    ctx.drawImage(
      img,
      (img.width - side) / 2,
      (img.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
    const out = canvas.toDataURL("image/jpeg", 0.85);
    if (out.length <= AVATAR_MAX_STORED_CHARS) return out;
  } catch {
    // fall through to the size check below
  }

  if (dataUrl.length <= AVATAR_MAX_STORED_CHARS) return dataUrl;
  throw new AvatarError("That image is too large. Try a smaller one.");
}
