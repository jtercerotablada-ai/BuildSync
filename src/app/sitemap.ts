import type { MetadataRoute } from 'next';
import { company, services } from '@/lib/ttc/site';
import { LANGS, localePath } from '@/lib/ttc/i18n';

/**
 * Public marketing routes only, in both languages. The authenticated app is
 * excluded here and disallowed in robots.ts — it is not public content.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = company.url;

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

  const rows: MetadataRoute.Sitemap = pages.flatMap((p) =>
    LANGS.map((lang) => ({
      url: `${base}${localePath(p.path, lang)}`,
      lastModified: now,
      changeFrequency: p.freq,
      priority: lang === 'en' ? p.priority : Math.max(0.1, p.priority - 0.1),
      alternates: {
        languages: {
          en: `${base}${localePath(p.path, 'en')}`,
          es: `${base}${localePath(p.path, 'es')}`,
        },
      },
    })),
  );

  rows.push({ url: `${base}/credits`, lastModified: now, changeFrequency: 'yearly', priority: 0.1 });
  return rows;
}
