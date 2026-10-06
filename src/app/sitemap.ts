import type { MetadataRoute } from 'next';
import { company, services } from '@/lib/ttc/site';
import { hreflangFor, LANGS, localePath } from '@/lib/ttc/i18n';

/**
 * Public marketing routes only, in both languages. The authenticated app is
 * excluded here and disallowed in robots.ts — it is not public content.
 *
 * No `lastModified`. It used to be `new Date()`, which re-dated all 30 pages
 * on every deploy of the app — and a lastmod that is routinely wrong teaches
 * Google to ignore it. Add one back only from a real per-page source (a date
 * that changes when that page's content does), never from a hand-kept map.
 *
 * /credits is not listed: it holds licensing notes, not anything a client
 * searches for, so it is noindex and simply stays reachable from the footer.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = company.url;
  /* Next resolves a page's relative canonical against metadataBase, and for
     the home page that prints the bare origin — no trailing slash. Same rule
     here so the <loc>, the hreflang hrefs and the canonical the page declares
     are byte-identical. (`/` and the bare origin are the same URL to a
     crawler; this just stops the two signals from looking different.) */
  const abs = (path: string) => `${base}${path === '/' ? '' : path}`;

  const pages: { path: string; freq: 'monthly' | 'yearly'; priority: number }[] = [
    { path: '/', freq: 'monthly', priority: 1 },
    { path: '/services', freq: 'monthly', priority: 0.9 },
    { path: '/existing-buildings', freq: 'monthly', priority: 0.9 },
    { path: '/about', freq: 'monthly', priority: 0.8 },
    { path: '/contact', freq: 'monthly', priority: 0.8 },
    { path: '/projects', freq: 'monthly', priority: 0.6 },
    { path: '/privacy', freq: 'yearly', priority: 0.2 },
    { path: '/terms', freq: 'yearly', priority: 0.2 },
    ...services.map((s) => ({ path: `/services/${s.slug}`, freq: 'monthly' as const, priority: 0.8 })),
  ];

  return pages.flatMap((p) =>
    LANGS.map((lang) => ({
      url: abs(localePath(p.path, lang)),
      changeFrequency: p.freq,
      // Rounded: 0.8 - 0.1 prints as 0.7000000000000001 in the XML.
      priority:
        lang === 'en' ? p.priority : Math.max(0.1, Math.round((p.priority - 0.1) * 10) / 10),
      // Built from hreflangFor, the same map every page declares in its
      // <head> — x-default included — so the two signals cannot disagree.
      alternates: {
        languages: Object.fromEntries(
          Object.entries(hreflangFor(p.path)).map(([hreflang, path]) => [hreflang, abs(path)]),
        ),
      },
    })),
  );
}
