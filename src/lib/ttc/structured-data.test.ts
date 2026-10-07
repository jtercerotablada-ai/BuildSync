import { describe, expect, it } from 'vitest';
import { getContent } from './content';
import type { Lang } from './i18n';
import { company, contact, regulatoryCheckedISO } from './site';
import { serviceLd, siteGraph, webPageLd } from './structured-data';

/**
 * The structured data is invisible on the page, so nothing a person looks at
 * shows when it goes wrong. Two things did: on /es the site-wide graph was
 * English and pointed at the English URLs, and the firm's phone and state
 * registration, printed on every page, were not in it at all. These tests
 * also hold the line on what the graph must NOT carry until the owner
 * supplies it (an address, a local-business type, profile links).
 */
const CARD = { url: '/ttc/og/card.jpg', width: 1200, height: 630 };
const LANGS: Lang[] = ['en', 'es'];
const PROGRAMS = ['building-recertification', 'broward-bsip'];
const REGULATED = [...PROGRAMS, 'milestone-inspections'];

const organization = (lang: Lang) => siteGraph(lang, CARD)['@graph'][0];
const svc = (lang: Lang, slug: string) => {
  const s = getContent(lang).services.find((x) => x.slug === slug);
  if (!s) throw new Error(`no service ${slug}`);
  return s;
};

describe('site-wide graph: the firm', () => {
  for (const lang of LANGS) {
    it(`(${lang}) carries the phone the site prints, in E.164`, () => {
      const org = organization(lang);
      expect(org.telephone).toBe('+17722658506');
      // Never typed twice: it is the number behind the site's own tel: links.
      expect(`tel:${org.telephone}`).toBe(contact.phone?.href);
      expect(org.contactPoint.telephone).toBe(org.telephone);
      expect(org.contactPoint.email).toBe(contact.email);
      expect(org.contactPoint.availableLanguage).toEqual(['English', 'Spanish']);
    });

    it(`(${lang}) identifies the firm by its state registry number`, () => {
      const org = organization(lang);
      expect(org.identifier?.value).toBe('40285');
      // The number is lifted out of the line the footer prints.
      expect(company.registry).toContain(org.identifier?.value);
      expect(org.identifier?.name).toBe(company.registry);
    });

    it(`(${lang}) has an absolute image and logo`, () => {
      const org = organization(lang);
      expect(org.image.url).toBe(`${company.url}${CARD.url}`);
      expect(org.logo.url.startsWith(`${company.url}/`)).toBe(true);
    });

    it(`(${lang}) stays a plain Organization: no address, no profiles, no Person`, () => {
      const graph = siteGraph(lang, CARD)['@graph'];
      const org = graph[0] as Record<string, unknown>;
      expect(org['@type']).toBe('Organization');
      expect(org).not.toHaveProperty('address');
      expect(org).not.toHaveProperty('sameAs');
      expect(graph.map((node) => node['@type'])).toEqual(['Organization', 'WebSite']);
    });
  }
});

describe('site-wide graph: the language of the page', () => {
  it('describes the firm in the language of the page', () => {
    expect(organization('en').description).toBe(getContent('en').company.description);
    expect(organization('es').description).toBe(getContent('es').company.description);
    expect(organization('es').description).not.toBe(organization('en').description);
  });

  for (const lang of LANGS) {
    it(`(${lang}) the catalogue names and links each service in that language`, () => {
      const prefix = lang === 'es' ? `${company.url}/es/services/` : `${company.url}/services/`;
      const items = organization(lang).hasOfferCatalog.itemListElement.map((o) => o.itemOffered);
      expect(items.map((i) => i.name)).toEqual(getContent(lang).services.map((s) => s.title));
      for (const item of items) expect(item.url.startsWith(prefix)).toBe(true);
    });

    // Each entry and the page it points at must be ONE node, or a crawler
    // sees sixteen services where there are eight.
    it(`(${lang}) a catalogue entry has the @id of that service page's own node`, () => {
      const items = organization(lang).hasOfferCatalog.itemListElement.map((o) => o.itemOffered);
      expect(items.map((i) => i['@id'])).toEqual(
        getContent(lang).services.map((s) => serviceLd(lang, s)['@id']),
      );
    });
  }
});

describe('service page: Service node', () => {
  for (const lang of LANGS) {
    it(`(${lang}) only the two county programs carry other names`, () => {
      const named = getContent(lang)
        .services.filter((s) => 'alternateName' in serviceLd(lang, s))
        .map((s) => s.slug);
      expect(named).toEqual(PROGRAMS);
    });

    it(`(${lang}) says who it is for, and that it is answered in both languages`, () => {
      for (const s of getContent(lang).services) {
        const ld = serviceLd(lang, s);
        expect(ld.audience.map((a) => a.audienceType)).toEqual([...s.audience]);
        expect(ld.availableChannel.availableLanguage).toEqual(['English', 'Spanish']);
        // The channel is the form, opened for this service, in this language.
        expect(ld.availableChannel.serviceUrl).toBe(
          `${company.url}${lang === 'es' ? '/es' : ''}/contact?service=${s.slug}`,
        );
        expect(ld.provider['@id']).toBe(organization(lang)['@id']);
      }
    });

    // A number read against the wrong county is the most expensive mistake
    // this site can make; the markup must not make it either.
    it(`(${lang}) a county program is offered in its own county only`, () => {
      expect(serviceLd(lang, svc(lang, 'building-recertification')).areaServed).toEqual([
        'Miami-Dade County, Florida',
      ]);
      expect(serviceLd(lang, svc(lang, 'broward-bsip')).areaServed).toEqual(['Broward County, Florida']);
    });
  }
});

describe('service page: WebPage node', () => {
  it('the review date is a real ISO day', () => {
    expect(regulatoryCheckedISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(regulatoryCheckedISO))).toBe(false);
  });

  for (const lang of LANGS) {
    it(`(${lang}) the three regulated pages say when their rows were last checked`, () => {
      for (const slug of REGULATED) {
        const page = webPageLd(lang, svc(lang, slug));
        expect(page?.lastReviewed).toBe(regulatoryCheckedISO);
        expect(page?.inLanguage).toBe(lang === 'es' ? 'es-US' : 'en-US');
        expect(page?.about['@id']).toBe(serviceLd(lang, svc(lang, slug))['@id']);
        expect(page?.url).toBe(`${company.url}${lang === 'es' ? '/es' : ''}/services/${slug}`);
      }
    });

    // No timing row, no review to date: the node would claim one.
    it(`(${lang}) a service with no timing row gets no WebPage node`, () => {
      const others = getContent(lang).services.filter((s) => !s.timing);
      expect(others.length).toBeGreaterThan(0);
      for (const s of others) expect(webPageLd(lang, s)).toBeNull();
    });
  }
});
