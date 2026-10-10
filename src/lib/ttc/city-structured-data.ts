import { citiesCheckedISO, cityPath, type CityPage } from './cities';
import type { Lang } from './i18n';
import { LD_LANG, ORGANIZATION, SPOKEN, WEBSITE, abs, type ServiceContent } from './structured-data';

/**
 * The structured data of a city page: /services/<program>/<city>.
 *
 * A module of its own, NOT part of structured-data.ts: the site-wide graph
 * component is 'use client' and imports that file, so whatever it imports
 * travels to the browser with every public page. These three builders take
 * a city page as an argument and are called by CityView, on the server.
 *
 * Three nodes, each built from what the page prints:
 *   • a Service: the county program, offered in ONE city — the county page's
 *     Service says the county, this one the city inside it.
 *   • the WebPage, with the day the city's own pages were last read.
 *   • the questions the page prints, as FAQPage — from the same array.
 */

const COUNTY_NAME: Record<CityPage['program'], string> = {
  'building-recertification': 'Miami-Dade County, Florida',
  'broward-bsip': 'Broward County, Florida',
};

/** "City of Miami" / "Ciudad de Miami" → "Miami": the place's own name. */
const placeName = (city: string) => city.replace(/^(City of|Ciudad de) /, '');

export function cityServiceLd(lang: Lang, service: ServiceContent, page: CityPage) {
  const pageUrl = abs(cityPath(page), lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: `${service.title} — ${page.city}`,
    description: page.description,
    serviceType: service.title,
    provider: { '@id': ORGANIZATION },
    // The city, inside its county: never the county alone, which is the
    // county page's claim, and never the other county.
    areaServed: {
      '@type': 'City',
      name: `${placeName(page.city)}, FL`,
      containedInPlace: { '@type': 'AdministrativeArea', name: COUNTY_NAME[page.program] },
    },
    audience: service.audience.map((audienceType) => ({ '@type': 'Audience', audienceType })),
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: abs(`/contact?service=${service.slug}`, lang),
      availableLanguage: SPOKEN,
    },
    url: pageUrl,
  };
}

export function cityWebPageLd(lang: Lang, page: CityPage, name: string) {
  const pageUrl = abs(cityPath(page), lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name,
    description: page.description,
    inLanguage: LD_LANG[lang],
    isPartOf: { '@id': WEBSITE },
    about: { '@id': `${pageUrl}#service` },
    // The day the city's own pages were read — not the county rows' date,
    // which the page prints beside those rows.
    lastReviewed: citiesCheckedISO,
  };
}

export function cityFaqLd(lang: Lang, page: CityPage) {
  const pageUrl = abs(cityPath(page), lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    url: pageUrl,
    inLanguage: LD_LANG[lang],
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
