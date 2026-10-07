'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getContent, type SiteContent } from '@/lib/ttc/content';
import { htmlLang, langFromPathname, localePath, type Lang } from '@/lib/ttc/i18n';

/** The language of the page the visitor is on, read from the URL. */
export function useLang(): Lang {
  return langFromPathname(usePathname());
}

/** The whole site's copy for the current language. */
export function useContent(): SiteContent {
  return getContent(useLang());
}

/** Prefix a canonical href for the current language. */
export function useL(): (href: string) => string {
  const lang = useLang();
  return (href: string) => localePath(href, lang);
}

/**
 * A `next/link` that stays in the visitor's language. Every internal link in
 * a client component goes through this; server components call
 * `localePath()` directly.
 */
export function L({
  href,
  ...rest
}: React.ComponentProps<typeof Link> & { href: string }) {
  const l = useL();
  return <Link href={l(href)} {...rest} />;
}

/* ── The query string of the page on screen ──────────────────────────────
   For the one link that has to keep it: the language switch (and the line
   that offers Spanish). `usePathname()` carries no query, so the switch on
   /es/contact?service=broward-bsip used to lead to a bare /contact and the
   form opened for the Broward notice came back empty.

   Not `useSearchParams()`: the header is shared by every statically
   rendered page, where that hook needs a Suspense boundary and leaves
   whatever is inside it out of the server HTML — the language link is the
   last thing that should be missing there. This reads the address bar
   instead, as an external store: the server and the hydration pass get ''
   (so the static HTML and the first client render agree), and React then
   re-renders with the real value.

   The address bar tells nobody when the app router rewrites it, so the
   store is re-read at the three moments that matter: after a route change
   (the effect below — the router writes the URL after the render that
   changed the pathname, so a read DURING that render is one page behind),
   on Back/Forward, and when the link itself is about to be used (see
   `refreshSearch`). */
const searchListeners = new Set<() => void>();

function subscribeSearch(notify: () => void) {
  searchListeners.add(notify);
  window.addEventListener('popstate', notify);
  return () => {
    searchListeners.delete(notify);
    window.removeEventListener('popstate', notify);
  };
}

const readSearch = () => window.location.search;
const noSearch = () => '';

/**
 * Re-read the address bar. For the pointer-down and focus of a link built
 * from `useSearch()`: a navigation that changes only the query (the header
 * button on /contact?service=…) changes no pathname and fires no event, so
 * this is what keeps the link from carrying the query of the page before.
 */
export function refreshSearch() {
  searchListeners.forEach((notify) => notify());
}

/** `?service=…` of the page on screen, or '' — and '' on the server. */
export function useSearch(): string {
  const pathname = usePathname();
  useEffect(refreshSearch, [pathname]);
  return useSyncExternalStore(subscribeSearch, readSearch, noSearch);
}

/**
 * The root layout stamps `<html lang="en">` for the whole app. The Spanish
 * pages correct it on the client so screen readers and translation tools get
 * the right language; the `hreflang` metadata carries it for crawlers.
 *
 * Before this runs (and without JavaScript) the server HTML is still scoped
 * correctly element by element: es/layout.tsx wraps the page body in
 * `<div lang="es">`, and the skip link, header, menu and footer each carry
 * `lang={htmlLang[lang]}` themselves.
 */
export function LangHtml() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = htmlLang[lang];
  }, [lang]);
  return null;
}
