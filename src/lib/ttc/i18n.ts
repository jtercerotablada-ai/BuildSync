/**
 * Language helpers for the public site.
 *
 * English lives at the canonical paths (`/services/...`); Spanish mirrors
 * every page under `/es` (`/es/services/...`). The URL is the only state —
 * nothing is stored, so a shared link always opens in the language it was
 * copied in, and the switcher simply maps a path to its twin.
 */

export type Lang = 'en' | 'es';

export const LANGS: readonly Lang[] = ['en', 'es'] as const;
export const DEFAULT_LANG: Lang = 'en';
export const ES_PREFIX = '/es';

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'es';
}

/** `/es/about` → 'es'; `/about` → 'en'; `/escalate` → 'en'. */
export function langFromPathname(pathname: string | null | undefined): Lang {
  if (!pathname) return DEFAULT_LANG;
  return pathname === ES_PREFIX || pathname.startsWith(`${ES_PREFIX}/`)
    ? 'es'
    : 'en';
}

/** `/es/about` → `/about`; `/es` → `/`; `/about` → `/about`. */
export function stripLang(pathname: string): string {
  if (pathname === ES_PREFIX) return '/';
  if (pathname.startsWith(`${ES_PREFIX}/`)) return pathname.slice(ES_PREFIX.length);
  return pathname;
}

/**
 * Build the path for a language. Accepts a canonical (English) path or one
 * that already carries the prefix; hash fragments and queries survive.
 *
 *   localePath('/about#engineer', 'es') → '/es/about#engineer'
 *   localePath('/es/about', 'en')       → '/about'
 *   localePath('/', 'es')               → '/es'
 */
export function localePath(path: string, lang: Lang): string {
  const m = path.match(/^([^?#]*)(.*)$/);
  const base = stripLang(m?.[1] || '/');
  const rest = m?.[2] ?? '';
  if (lang === 'en') return `${base}${rest}`;
  return base === '/' ? `${ES_PREFIX}${rest}` : `${ES_PREFIX}${base}${rest}`;
}

/** The same page in the other language. */
export function altPath(pathname: string): string {
  return localePath(pathname, langFromPathname(pathname) === 'es' ? 'en' : 'es');
}

/** hreflang map for a canonical (English) path, ready for `alternates.languages`. */
export function hreflangFor(canonicalPath: string): Record<string, string> {
  return {
    en: localePath(canonicalPath, 'en'),
    es: localePath(canonicalPath, 'es'),
    'x-default': localePath(canonicalPath, 'en'),
  };
}

export const htmlLang: Record<Lang, string> = { en: 'en', es: 'es' };
export const ogLocale: Record<Lang, string> = { en: 'en_US', es: 'es_US' };
