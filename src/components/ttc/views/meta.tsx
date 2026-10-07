import type { Metadata } from 'next';
import { absoluteUrl, company } from '@/lib/ttc/site';
import { hreflangFor, localePath, ogLocale, type Lang } from '@/lib/ttc/i18n';
import { TITLE_BUDGET_PX, repeatedWords, titlePx } from '@/lib/ttc/serp';

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
 * A title followed by the firm's SHORT name. Titles are the one place the
 * full name does not go (see `company` in site.ts): it measures 469 px of
 * the 580 a search result shows. The (public) layout's title template is
 * this same function, for the few routes that do not go through pageMeta.
 */
export const brandedTitle = (title: string) => `${title} · ${company.shortName}`;

/**
 * The <title> of a page. What the page is about and where come first and
 * are never cut to make room: the brand follows only when the whole line
 * still fits a search result and repeats no word — a title that names the
 * engineer already says "Tercero". Where it does not fit, the title goes
 * out alone, and the brand is still on the result as the site name.
 */
export function pageTitle(title: string): string {
  const branded = brandedTitle(title);
  return titlePx(branded) <= TITLE_BUDGET_PX && repeatedWords(branded).length === 0
    ? branded
    : title;
}

/**
 * THE HOME PAGE'S ADDRESS IS NOT DECLARED THROUGH THE METADATA API.
 *
 * Next resolves every canonical, hreflang and og:url through one function
 * that prints the root path as the bare origin (`pathname === '/' ? origin :
 * href`, resolve-url.js) — whatever it is given: '/', the full address with
 * its slash, a URL object. So the English home page declared
 * `https://ttcivilstructural.com` as its canonical, its `en` and `x-default`
 * alternates and its og:url, the Spanish home page pointed its `en` and
 * `x-default` alternates at the same, and the owner's on-page check listed
 * it as an internal redirect "linked via canonical link, alternate link".
 *
 * So for the root path — both languages — `pageMeta` leaves the canonical,
 * the alternates and og:url OUT, and HomeView prints them with this
 * component: plain <link> and <meta> elements, which React 19 lifts into
 * <head> on the server and keeps there on the client. One canonical and one
 * set of alternates per page, as before; only the string differs. The
 * sitemap prints the same strings (sitemap.ts), and seo.test.ts holds the
 * three together.
 *
 * Checked in a production build, not only here: `curl` of / and /es from
 * `next start` shows each element once, inside <head>, and a browser still
 * holds one of each after hydration and after navigating away and back. If
 * Next ever stops stripping the slash, delete this component and the
 * `isHome` branches below together — both at once, or the page declares two
 * canonicals.
 */
export function HomeAddress({ lang }: { lang: Lang }) {
  const here = absoluteUrl(localePath('/', lang));
  return (
    <>
      <link rel="canonical" href={here} />
      {Object.entries(hreflangFor('/')).map(([hrefLang, path]) => (
        <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={absoluteUrl(path)} />
      ))}
      <meta property="og:url" content={here} />
    </>
  );
}

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
  // The two home pages print their own address (HomeAddress, above).
  const isHome = canonicalPath === '/';
  return {
    // Absolute: pageTitle has already added the brand, or left it out. Through
    // the layout's template it would print twice, or come back where it does
    // not fit.
    title: { absolute: pageTitle(m.title) },
    description: m.description,
    keywords: m.keywords,
    // <link rel="author">, on every page. The (public) layout sets the same
    // author with `company.url`, the bare origin, and Next prints an author's
    // url as written — the one link left on all 32 pages to the address the
    // check reports as a redirect. Same firm, the home page's real address.
    // (The layout's own line still serves /credits and the 404s, which do
    // not come through here: it wants `absoluteUrl('/')` too.)
    authors: [{ name: company.legalName, url: absoluteUrl('/') }],
    ...(isHome
      ? {}
      : { alternates: { canonical: here, languages: hreflangFor(canonicalPath) } }),
    openGraph: {
      // The firm name stays in og:title too: WhatsApp, iMessage and LinkedIn
      // never display og:site_name, so it is the only place the brand shows.
      // The FULL name, on every page: a share card is not cut at the width
      // of a search result, so it does not need the title's short one.
      title: m.ogTitle ?? `${m.title} · ${company.name}`,
      description: m.description,
      ...(isHome ? {} : { url: here }),
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
