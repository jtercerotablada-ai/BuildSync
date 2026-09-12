'use client';

import React, { useEffect } from 'react';
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

/**
 * The root layout stamps `<html lang="en">` for the whole app. The Spanish
 * pages correct it on the client so screen readers and translation tools get
 * the right language; the `hreflang` metadata carries it for crawlers.
 */
export function LangHtml() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = htmlLang[lang];
  }, [lang]);
  return null;
}
