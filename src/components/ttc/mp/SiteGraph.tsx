'use client';

import React from 'react';
import { JsonLd, OG_IMAGE } from '@/components/ttc/views/meta';
import { siteGraph } from '@/lib/ttc/structured-data';
import { useLang } from './lang';

/**
 * The site-wide structured data (Organization + WebSite), in the language of
 * the page.
 *
 * A client component for one reason: the (public) layout serves the English
 * and the Spanish routes alike and is never told which one it is rendering —
 * reading headers() there would opt the whole site out of static rendering.
 * The URL is the only place the language lives (i18n.ts), and `useLang()`
 * reads it the way the header and the footer do. The script is still in the
 * server HTML, which is what a crawler reads; nothing here waits for
 * JavaScript.
 *
 * The graph itself is built in `structured-data.ts`. The image is the share
 * card of this language: a real file, 1200×630, with the firm's own logo.
 */
export function SiteGraph() {
  const lang = useLang();
  return <JsonLd data={siteGraph(lang, OG_IMAGE[lang])} />;
}
