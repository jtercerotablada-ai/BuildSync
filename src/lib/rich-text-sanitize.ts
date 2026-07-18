/**
 * Client-side rich-text sanitizer shared by the note + brief editors.
 *
 * A dedicated DOMPurify instance (NOT the app-wide default, whose config
 * other editors rely on) with a strict tag/attr allowlist. `style` is kept
 * only for the highlighter's plain color declarations — everything else
 * (position:fixed overlays, url() beacons) is stripped, which closes stored
 * CSS injection since this HTML is authored by any editor and rendered for
 * every project member.
 */

import DOMPurify from "dompurify";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "div", "br", "h1", "h2", "h3",
    "b", "strong", "i", "em", "u", "s", "strike", "del",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "a", "hr", "mark", "span", "font",
  ],
  // No target/rel: createLink never emits them and a stored target=_blank
  // without rel enables reverse tabnabbing on older browsers.
  ALLOWED_ATTR: ["href", "style"],
};

const SAFE_STYLE_DECL =
  /^\s*(?:background-color|color)\s*:\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([\d.,%\s]+\)|transparent|[a-zA-Z]+)\s*$/;

const purifier = typeof window !== "undefined" ? DOMPurify(window) : null;
purifier?.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "style") return;
  const kept = data.attrValue
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => SAFE_STYLE_DECL.test(d));
  data.attrValue = kept.join("; ");
  if (!data.attrValue) data.keepAttr = false;
});

export function sanitizeRichText(html: string): string {
  // SSR never renders this HTML (all innerHTML writes happen in effects).
  if (!purifier) return html;
  return purifier.sanitize(html, SANITIZE_CONFIG);
}

/** "<p><br></p>" and friends count as blank; real structure (hr/li/pre) doesn't. */
export function isRichTextBlank(html: string): boolean {
  if (!html) return true;
  if (/<(hr|li|img|pre)[\s>/]/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}
