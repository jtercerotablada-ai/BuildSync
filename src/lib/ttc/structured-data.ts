import { getContent, type SiteContent } from './content';
import { localePath, type Lang } from './i18n';
import { absoluteUrl, company, contact, municipalities, regulatoryCheckedISO } from './site';

/**
 * The site's structured data (JSON-LD), as plain objects: the site-wide graph
 * every public page carries, and the two nodes of a service page. Pure
 * functions of the language and the content, so the markup is built from the
 * same `site.ts` the page prints and can be tested without rendering anything
 * (structured-data.test.ts).
 *
 * THE LANGUAGE IS AN ARGUMENT. The graph used to be one constant in the
 * (public) layout, built from the English bundle: on /es pages the firm's
 * description and all eight catalogue entries were English and pointed at the
 * English URLs, beside a Spanish Service node. Every name and every URL here
 * now follows the page.
 *
 * What is deliberately NOT here:
 *   • No `address`. There is no published office address, and an invented or
 *     partial one is worse than none.
 *   • No ProfessionalService / LocalBusiness node. Those are LocalBusiness
 *     subtypes, Google requires `address` on them, and the Rich Results Test
 *     flagged the old #practice node as an invalid local-business item on
 *     every page. What it carried — the offer catalogue, the area served —
 *     is valid on Organization, so it lives there, and each service page's
 *     Service names #organization as its `provider`.
 *   • No `sameAs`: no public profile exists yet (`contact.social`).
 *   • No Person node. The engineer is referenced by @id only; the node
 *     itself lives on /about (AboutView), in that page's language.
 */

const ORGANIZATION = `${company.url}/#organization`;
const WEBSITE = `${company.url}/#website`;

/** BCP 47 tags for `inLanguage`; the copy is written for US readers. */
const LD_LANG: Record<Lang, string> = { en: 'en-US', es: 'es-US' };

/** The practice answers in both, on every channel. schema.org wants the
    language's English name or its tag; names read better in a validator. */
const SPOKEN = ['English', 'Spanish'];

const CATALOG_NAME: Record<Lang, string> = {
  en: 'Structural engineering services',
  es: 'Servicios de ingeniería estructural',
};

type ServiceContent = SiteContent['services'][number];

/** Absolute URL of a canonical path, in the page's language. */
const abs = (path: string, lang: Lang) => `${company.url}${localePath(path, lang)}`;

/**
 * Organization + WebSite: the graph of every public page (SiteGraph).
 *
 * `image` is handed in by the caller — the share card of the page's language
 * (OG_IMAGE in views/meta.tsx) — so this module stays free of .tsx imports.
 */
export function siteGraph(lang: Lang, image: { url: string; width: number; height: number }) {
  const c = getContent(lang);
  // `contact.phone.href` is the E.164 number behind a `tel:` scheme, which is
  // exactly what `telephone` wants. One source for the number.
  const telephone = contact.phone?.href.replace(/^tel:/, '');
  // "FL Engineering Business No. 40285" → "40285". The printed line stays
  // the single source; the markup only lifts the number out of it.
  const registryNumber = company.registry?.match(/\d+/)?.[0];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION,
        name: company.legalName,
        alternateName: company.shortName,
        url: absoluteUrl('/'),
        logo: {
          '@type': 'ImageObject',
          url: `${company.url}${company.logo.dark}`,
          width: company.logo.markSize.w,
          height: company.logo.markSize.h,
        },
        image: {
          '@type': 'ImageObject',
          url: `${company.url}${image.url}`,
          width: image.width,
          height: image.height,
        },
        email: contact.email,
        ...(telephone ? { telephone } : {}),
        description: c.company.description,
        // The firm's state registration: the one credential that belongs to
        // the COMPANY, printed in the footer of every page. The engineer's
        // own license stays on his Person node.
        ...(company.registry && registryNumber
          ? {
              identifier: {
                '@type': 'PropertyValue',
                propertyID: 'Florida Engineering Business Registry',
                name: company.registry,
                value: registryNumber,
              },
            }
          : {}),
        founder: { '@id': `${company.url}/about#engineer` },
        employee: { '@id': `${company.url}/about#engineer` },
        // The owner's own line and the firm's mailbox; either is answered in
        // English or in Spanish.
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          ...(telephone ? { telephone } : {}),
          email: contact.email,
          areaServed: 'US-FL',
          availableLanguage: SPOKEN,
        },
        // Plain text is valid here. The state is appended because a bare
        // 'Hollywood', 'Plantation' or 'Weston' also names places elsewhere.
        // Place names are identifiers: English in both languages.
        areaServed: [
          'Miami-Dade County, Florida',
          'Broward County, Florida',
          ...municipalities.map((city) => `${city}, FL`),
        ],
        knowsAbout: [
          'Structural Engineering',
          'Reinforced Concrete Design',
          'Structural Analysis',
          'Foundation Design',
          'Building Recertification',
          'Building Safety Inspection Program (BSIP)',
          'Milestone Inspection',
          'Structural Condition Assessment',
          'Repair Recommendations',
          'BIM Coordination',
          'Structural Peer Review',
          'Engineering Compliance',
        ],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: CATALOG_NAME[lang],
          itemListElement: c.services.map((s) => ({
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              // The same @id the service page of THIS language gives its own
              // Service node (serviceLd below), so the catalogue entry and
              // the page describe one thing.
              '@id': `${abs(`/services/${s.slug}`, lang)}#service`,
              name: s.title,
              description: s.summary,
              url: abs(`/services/${s.slug}`, lang),
            },
          })),
        },
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE,
        url: absoluteUrl('/'),
        name: company.name,
        publisher: { '@id': ORGANIZATION },
        inLanguage: [LD_LANG.en, LD_LANG.es],
      },
      // A tuple, so a reader of the graph (the tests) knows the first node
      // is the Organization without narrowing a union.
    ] as const,
  };
}

/**
 * A service page's Service node.
 *
 * The provider is the ONE Organization node of the site-wide graph, by @id —
 * a second, unnamed ProfessionalService here read as a different company.
 */
export function serviceLd(lang: Lang, service: ServiceContent) {
  const pageUrl = abs(`/services/${service.slug}`, lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: service.title,
    // The names people still use for the two county programs, as aliases.
    ...(service.alsoCalled?.length ? { alternateName: service.alsoCalled } : {}),
    description: service.seo.description,
    serviceType: service.title,
    provider: { '@id': ORGANIZATION },
    // A county program is offered in its own county only: the Broward page
    // must not tell a search engine it serves Miami-Dade, or the reverse.
    // Every other service is offered in both.
    areaServed: service.areaServed ?? ['Miami-Dade County, Florida', 'Broward County, Florida'],
    // Who the page says it is for, line by line (`service.audience`).
    audience: service.audience.map((audienceType) => ({ '@type': 'Audience', audienceType })),
    // schema.org has no `availableLanguage` on Service itself: the property
    // belongs to the channel a service is reached through. The channel is
    // the form this page's buttons open, with the service already selected.
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: abs(`/contact?service=${service.slug}`, lang),
      availableLanguage: SPOKEN,
    },
    url: pageUrl,
  };
}

/**
 * The page itself, for the three regulated services: `lastReviewed` is the
 * day their rows were last checked against the primary sources — the same
 * `regulatoryChecked` the page prints as "Last verified", in the form a
 * machine reads. (schema.org's Service has no date of its own, which is why
 * this is a second node and not one more property.)
 *
 * A service with no timing row has no such date, and gets no node: a
 * `lastReviewed` there would claim a review that never happened.
 */
export function webPageLd(lang: Lang, service: ServiceContent) {
  if (!service.timing) return null;
  const pageUrl = abs(`/services/${service.slug}`, lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: service.seo.title,
    description: service.seo.description,
    inLanguage: LD_LANG[lang],
    isPartOf: { '@id': WEBSITE },
    about: { '@id': `${pageUrl}#service` },
    lastReviewed: regulatoryCheckedISO,
  };
}
