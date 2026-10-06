import type { Metadata } from 'next';
import { company } from '@/lib/ttc/site';
import { hreflangFor, localePath, ogLocale, type Lang } from '@/lib/ttc/i18n';

/**
 * The share card, one per language (1200×630, public/ttc/og/). A static file
 * on purpose: the `opengraph-image` file convention would serve it from
 * /opengraph-image, which is not a marketing path, so the host split would
 * bounce every scraper to the app host's login. /ttc/ is host-neutral.
 *
 * The card carries the tagline and the counties over the real logo — never the
 * engineer's name or license number. The relative url is made absolute by the
 * (public) layout's metadataBase.
 */
export const OG_IMAGE: Record<
  Lang,
  { url: string; width: number; height: number; alt: string }
> = {
  en: {
    url: '/ttc/og/og-en.jpg',
    width: 1200,
    height: 630,
    alt: `Structural Engineering for South Florida — ${company.name}`,
  },
  es: {
    url: '/ttc/og/og-es.jpg',
    width: 1200,
    height: 630,
    alt: `Ingeniería estructural para el Sur de Florida — ${company.name}`,
  },
};

/**
 * Page metadata for one language: localized title/description, the canonical
 * for THIS language's URL, hreflang twins for both, and the right OG locale.
 *
 * Next merges metadata SHALLOWLY: this `openGraph` replaces the layout's whole
 * object, so everything a share card needs (siteName, image) has to be here,
 * not only in the layout. There is deliberately no `twitter` key — the layout
 * sets only the card type, and Next then fills twitter:title, :description and
 * :image from THIS openGraph, so X gets the same localized card.
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
      // The firm name stays in og:title too: WhatsApp, iMessage and LinkedIn
      // never display og:site_name, so it is the only place the brand shows.
      title: m.ogTitle ?? `${m.title} · ${company.name}`,
      description: m.description,
      url: here,
      siteName: company.name,
      type: 'website',
      locale: ogLocale[lang],
      alternateLocale: [ogLocale[lang === 'en' ? 'es' : 'en']],
      images: [OG_IMAGE[lang]],
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
