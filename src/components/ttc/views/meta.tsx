import type { Metadata } from 'next';
import { company } from '@/lib/ttc/site';
import { hreflangFor, localePath, ogLocale, type Lang } from '@/lib/ttc/i18n';

/**
 * Page metadata for one language: localized title/description, the canonical
 * for THIS language's URL, hreflang twins for both, and the right OG locale.
 */
export function pageMeta(
  lang: Lang,
  canonicalPath: string,
  m: { title: string; description: string; ogTitle?: string; keywords?: string[] },
): Metadata {
  const here = localePath(canonicalPath, lang);
  // A title that already carries the firm name (the home page) must not go
  // through the layout's "%s · firm" template, or the name prints twice.
  const title = m.title.includes(company.name) ? { absolute: m.title } : m.title;
  return {
    title,
    description: m.description,
    keywords: m.keywords,
    alternates: { canonical: here, languages: hreflangFor(canonicalPath) },
    openGraph: {
      title: m.ogTitle ?? `${m.title} · ${company.name}`,
      description: m.description,
      url: here,
      type: 'website',
      locale: ogLocale[lang],
      alternateLocale: [ogLocale[lang === 'en' ? 'es' : 'en']],
    },
  };
}

export function breadcrumbLd(
  lang: Lang,
  items: { name: string; path: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${company.url}${localePath(it.path, lang)}`,
    })),
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
