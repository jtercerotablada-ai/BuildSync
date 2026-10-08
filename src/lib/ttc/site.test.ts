import { describe, expect, it } from 'vitest';
import type { SiteContent } from './content';
import {
  company,
  en,
  officeLinksChecked,
  officeLinksCheckedISO,
  regulatoryChecked,
  regulatoryCheckedISO,
} from './site';
import {
  es,
  officeLinksChecked as officeLinksCheckedEs,
  regulatoryChecked as regulatoryCheckedEs,
} from './site.es';
import { officePages, officePagesRead } from './office-pages';

/**
 * The two county-program pages print their filing deadline on the first
 * screen by READING the fact their timing row flags with `filing: true`
 * (ServiceDetailView) — the number is never typed a second time.
 *
 * The flag is optional in the type, so the compiler does not notice when a
 * translation drops it or a row gains a second one: the hero would quietly
 * fall back to its old filler facts, or print the wrong row. These tests are
 * what notices.
 */
const bundles: [string, SiteContent][] = [
  ['en', en],
  ['es', es],
];

const PROGRAMS = ['building-recertification', 'broward-bsip'];

const rowFacts = (c: SiteContent, slug: string) =>
  c.services.find((s) => s.slug === slug)?.timing?.rows[0]?.facts ?? [];

describe('county programs: the filing-deadline fact', () => {
  it('the county programs are the two services that carry a `program`', () => {
    for (const [, c] of bundles) {
      expect(c.services.filter((s) => s.program).map((s) => s.slug)).toEqual(PROGRAMS);
    }
  });

  for (const [lang, c] of bundles) {
    for (const slug of PROGRAMS) {
      it(`${slug} (${lang}) flags exactly one fact of its row`, () => {
        expect(rowFacts(c, slug).filter((f) => f.filing)).toHaveLength(1);
      });

      // site.ts: the headline's number "must always equal the row's Time to
      // file". The home page prints the headline; the service page prints
      // the row.
      it(`${slug} (${lang}) headline number is the one in that fact`, () => {
        const program = c.services.find((s) => s.slug === slug)?.program;
        const filing = rowFacts(c, slug).find((f) => f.filing);
        expect(filing?.v).toContain(program?.accentWord);
      });
    }
  }

  it('the Spanish rows flag the same fact as the English ones', () => {
    for (const slug of PROGRAMS) {
      const at = (c: SiteContent) => rowFacts(c, slug).findIndex((f) => f.filing);
      expect(at(es)).toBe(at(en));
    }
  });

  it('no other service flags one', () => {
    for (const [, c] of bundles) {
      const others = c.services.filter((s) => !s.program);
      const flagged = others.flatMap((s) =>
        (s.timing?.rows ?? []).flatMap((r) => r.facts.filter((f) => f.filing).map(() => s.slug)),
      );
      expect(flagged).toEqual([]);
    }
  });
});

/**
 * What a service page adds to the shared template — its own headings, the
 * line under its H1, its questions, the board's duties, the milestone page's
 * county links and comparison — is all optional in the type. So the compiler
 * does not notice a block the English file has and the Spanish file lacks;
 * and the rule that keeps every county's numbers in its own timing row
 * (site.ts, at the top) is one only a person enforces. These tests notice
 * both.
 */
const svc = (c: SiteContent, slug: string) => c.services.find((s) => s.slug === slug);

describe('service pages: the Spanish mirror carries the same blocks', () => {
  for (const s of en.services) {
    it(s.slug, () => {
      const t = svc(es, s.slug);
      expect(Object.keys(t?.headings ?? {}).sort()).toEqual(Object.keys(s.headings ?? {}).sort());
      expect(Boolean(t?.heroSub)).toBe(Boolean(s.heroSub));
      expect(t?.faq?.length ?? 0).toBe(s.faq?.length ?? 0);
      expect(t?.timing?.duties?.length ?? 0).toBe(s.timing?.duties?.length ?? 0);
      expect((t?.countyPages ?? []).map((p) => p.slug)).toEqual((s.countyPages ?? []).map((p) => p.slug));
      expect(Boolean(t?.offices)).toBe(Boolean(s.offices));
      expect(Boolean(t?.alsoCalled?.length)).toBe(Boolean(s.alsoCalled?.length));
      expect(t?.comparison?.rows.length ?? 0).toBe(s.comparison?.rows.length ?? 0);
      // The complete package, part by part: the same rows in both languages.
      expect(t?.packet?.parts.length ?? 0).toBe(s.packet?.parts.length ?? 0);
    });
  }

  it('a comparison row has one value per label', () => {
    for (const [, c] of bundles) {
      for (const s of c.services) {
        for (const row of s.comparison?.rows ?? []) {
          expect(row.values).toHaveLength(s.comparison?.labels.length ?? 0);
        }
      }
    }
  });
});

describe('county rules stay in the timing rows', () => {
  const REGULATED = [...PROGRAMS, 'milestone-inspections'];
  // An age or a day count: digits, then day(s) or year(s), in either language.
  const COUNT = /\d+[\s-]*(?:days?|years?|d[ií]as?|años?)/gi;
  // The one exception is a NAME: what owners still call both programs.
  const LEGACY_NAME = /^40[\s-]*(?:year|años)$/i;

  // Everything a page says outside its timing block and its "Good to know"
  // list: titles, headings, the first line, the questions, the comparison,
  // and the offices under "Who sent your notice?" — several of the city
  // pages that block links to print their own deadlines, and none of them
  // may be copied into a row.
  const copy = (c: SiteContent, slug: string): string[] => {
    const s = svc(c, slug);
    if (!s) return [];
    return [
      s.seo.title,
      s.seo.description,
      s.heroSub,
      ...Object.values(s.headings ?? {}),
      ...(s.faq ?? []).flatMap((f) => [f.q, f.a]),
      ...(s.countyPages ?? []).flatMap((p) => [p.title, p.text]),
      s.comparison?.title,
      ...(s.comparison?.rows ?? []).flatMap((r) => [r.name, ...r.values]),
      s.packet?.label,
      s.packet?.lede,
      s.packet?.note,
      ...(s.packet?.parts ?? []).flatMap((p) => [p.k, p.v]),
      s.offices?.title,
      s.offices?.lede,
      s.offices?.note,
      s.offices?.forms.text,
      s.offices?.forms.label,
      ...(s.offices?.rows ?? []).flatMap((r) => [r.city, r.office]),
    ].filter((x): x is string => typeof x === 'string');
  };

  for (const [lang, c] of bundles) {
    for (const slug of REGULATED) {
      it(`${slug} (${lang}) types no age and no day count outside its row`, () => {
        const counts = copy(c, slug).flatMap((text) => text.match(COUNT) ?? []);
        expect(counts.filter((m) => !LEGACY_NAME.test(m))).toEqual([]);
      });
    }

    // An answer points at the table above it by the row's label, in curly
    // quotes, instead of repeating the row's number. Rename a label and the
    // answers that cite it have to follow.
    for (const slug of PROGRAMS) {
      it(`${slug} (${lang}) answers quote only labels the page prints`, () => {
        const printed = new Set([
          ...rowFacts(c, slug).map((f) => f.k),
          c.ui.boardDuties,
          c.ui.considerations,
        ]);
        const quoted = (svc(c, slug)?.faq ?? []).flatMap((f) =>
          Array.from(f.a.matchAll(/“([^”]+)”/g), (m) => m[1]),
        );
        expect(quoted.length).toBeGreaterThan(0);
        // “40-year recertification” is the name, not a label.
        expect(quoted.filter((q) => !printed.has(q) && !q.includes('40'))).toEqual([]);
      });
    }
  }
});

/**
 * Each date on the site is written three times: in English, in Spanish, and
 * once more for machines (the <time> element and the WebPage markup). The
 * written ones are what a reader sees and the ISO one is what a crawler
 * reads, so a re-verification that moves two of the three would publish two
 * different days. The ISO value is the reference; the other two must spell
 * that same day.
 */
describe('dates: the written dates and the machine date are the same day', () => {
  const spell = (iso: string, locale: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  it('the day the regulatory rows were last verified', () => {
    expect(regulatoryChecked).toBe(spell(regulatoryCheckedISO, 'en-US'));
    expect(regulatoryCheckedEs).toBe(spell(regulatoryCheckedISO, 'es'));
  });

  it('the day the outbound links were last opened', () => {
    expect(officeLinksChecked).toBe(spell(officeLinksCheckedISO, 'en-US'));
    expect(officeLinksCheckedEs).toBe(spell(officeLinksCheckedISO, 'es'));
  });

  it('every regulated service prints the shared date, in its language', () => {
    for (const [lang, c] of bundles) {
      const want = lang === 'es' ? regulatoryCheckedEs : regulatoryChecked;
      const dates = c.services.flatMap((s) => (s.timing ? [s.timing.checked] : []));
      expect(dates.length).toBeGreaterThan(0);
      expect(dates.filter((d) => d !== want)).toEqual([]);
    }
  });
});

/**
 * The links that leave the site: a timing row's source and, on the two
 * county programs, the forms page under "Who sent your notice?". (The
 * offices listed there are text — see the next block.) A link is structure,
 * not copy, so it is the same in both languages — but it is typed in both
 * files, and a re-check that fixes a moved page in one of them would leave
 * the other pointing at a dead address.
 */
describe('outbound links: sources and offices', () => {
  const official = (url: string) => {
    const u = new URL(url);
    // https, and never this site: these are other people's pages.
    return u.protocol === 'https:' && !company.url.includes(u.hostname);
  };

  it('every timing row links its source, the same link in both languages', () => {
    for (const s of en.services) {
      const rows = s.timing?.rows ?? [];
      const mirror = svc(es, s.slug)?.timing?.rows ?? [];
      expect(mirror.map((r) => r.sourceUrl)).toEqual(rows.map((r) => r.sourceUrl));
      for (const r of rows) expect(r.sourceUrl && official(r.sourceUrl)).toBe(true);
    }
  });

  it('only the two county programs list offices', () => {
    for (const [, c] of bundles) {
      expect(c.services.filter((s) => s.offices).map((s) => s.slug)).toEqual(PROGRAMS);
    }
  });

  for (const slug of PROGRAMS) {
    it(`${slug}: the Spanish rows are the English rows — same order, same office`, () => {
      const a = svc(en, slug)?.offices;
      const b = svc(es, slug)?.offices;
      expect(b?.rows.map((r) => r.office)).toEqual(a?.rows.map((r) => r.office));
      expect(b?.forms.url).toBe(a?.forms.url);
    });

    for (const [lang, c] of bundles) {
      it(`${slug} (${lang}) names each city once, and links one outside https page: the forms`, () => {
        const o = svc(c, slug)?.offices;
        const cities = o?.rows.map((r) => r.city) ?? [];
        expect(cities.length).toBeGreaterThan(0);
        expect(new Set(cities).size).toBe(cities.length);
        // A ROW IS TEXT: a city, its office, and nothing else. No address in
        // any form — not a `url` put back, not one typed into a name.
        for (const r of o?.rows ?? []) {
          expect(Object.keys(r).sort()).toEqual(['city', 'office']);
          expect(r.office.length).toBeGreaterThan(0);
          expect(`${r.city} ${r.office}`).not.toMatch(/https?:|www\.|\.(?:gov|com|org)\b/i);
        }
        expect(o && official(o.forms.url)).toBe(true);
        expect(o?.checked).toBe(lang === 'es' ? officeLinksCheckedEs : officeLinksChecked);
      });

      // The rows were links, and the lede said so ("each row opens that
      // office's own page, in a new tab"). A sentence that promises a link
      // the page does not have is worse than no sentence.
      it(`${slug} (${lang}) the block promises no link from a row`, () => {
        const o = svc(c, slug)?.offices;
        const text = [o?.title, o?.lede, o?.note].join(' ');
        expect(text).not.toMatch(/\blinks?\b|\btab\b|\bopens?\b|\bclick|enlace|pestaña|\babre\b|\bclic\b/i);
        expect(c.ui.linksChecked).not.toMatch(/\blinks?\b|enlace/i);
      });

      // The owner's decision: nowhere does the site say who signs which
      // report, and a list of offices is not a list of places worked.
      it(`${slug} (${lang}) the block claims no signature and no filing history`, () => {
        const o = svc(c, slug)?.offices;
        const text = [o?.title, o?.lede, o?.note, o?.forms.text, o?.forms.label].join(' ');
        // Verb forms only: "la firma" is simply "the firm" in Spanish.
        expect(text).not.toMatch(/\bsign|\bseal|firmad[oa]|sellad[oa]|we (?:have )?filed|hemos presentado/i);
      });
    }
  }
});

/**
 * The offices under "Who sent your notice?" are text: the rows were links to
 * each city's page until the on-page check counted thirteen of them as
 * broken (city websites turn crawlers away), and the decision was to keep
 * the names and drop the links. The addresses each name was read on are a
 * RECORD, in office-pages.ts — the pages somebody opens to check a name
 * again. Two things can go wrong from here, and neither would show:
 *   • the record drifts from the list (a city added to one and not to the
 *     other), so a name has no page to be checked against;
 *   • an address finds its way back into the content. The content bundle is
 *     sent to the browser with every page that hands a service to a client
 *     component, so an address in it travels with the page, linked or not.
 */
describe('office names: where each was read is a record, not content', () => {
  for (const slug of PROGRAMS) {
    it(`${slug}: one recorded page per office, in the order of the list`, () => {
      const cities = svc(en, slug)?.offices?.rows.map((r) => r.city);
      expect(officePages[slug].map((p) => p.city)).toEqual(cities);
    });

    it(`${slug}: every recorded page is an outside https page, and none is listed twice`, () => {
      const pages = officePages[slug].map((p) => p.page);
      expect(new Set(pages).size).toBe(pages.length);
      for (const page of pages) {
        const u = new URL(page);
        expect(u.protocol).toBe('https:');
        expect(company.url).not.toContain(u.hostname);
      }
    });
  }

  it('the record covers the two county programs and nothing else', () => {
    expect(Object.keys(officePages)).toEqual(PROGRAMS);
  });

  // The date the page prints under the list is the day the record was read.
  it('the record was read on the day the page says the names were checked', () => {
    expect(officePagesRead).toBe(officeLinksCheckedISO);
  });

  it('no city or town website is anywhere in the content, in either language', () => {
    // What the site does link: the county-level `forms` page of each program
    // (Miami-Dade's is also where the unincorporated area's office was read).
    const linked = new Set(
      PROGRAMS.flatMap((slug) => [svc(en, slug)?.offices?.forms.url, svc(es, slug)?.offices?.forms.url]).map(
        (url) => new URL(url ?? '').hostname,
      ),
    );
    const hosts = [
      ...new Set(
        Object.values(officePages)
          .flat()
          .map((p) => new URL(p.page).hostname),
      ),
    ].filter((host) => !linked.has(host));
    expect(hosts.length).toBeGreaterThan(20);
    const content = JSON.stringify([en, es]);
    expect(hosts.filter((host) => content.includes(host.replace(/^www\./, '')))).toEqual([]);
  });
});


/**
 * The header leaves out any page flagged `inHeader: false`, and every view
 * reads `primaryNav` BY POSITION for its breadcrumb label. The compiler sees
 * neither: the flag is optional, so a translation can drop it, and an index
 * into a shorter list is simply `undefined` at run time — /contact would stop
 * rendering. These tests are what notices.
 */
describe('navigation: what the header leaves out', () => {
  // [0] ServicesView and ServiceDetailView, [1] ExistingView, [2] WorkView,
  // [3] AboutView, [4] ContactView.
  const ORDER = ['/services', '/existing-buildings', '/projects', '/about', '/contact'];

  for (const [lang, c] of bundles) {
    it(`${lang} keeps the five entries the views read by position`, () => {
      expect(c.primaryNav.map((item) => item.href)).toEqual(ORDER);
    });

    it(`${lang} keeps a page it hides linked from the footer`, () => {
      const footer = c.footerNav.flatMap((group) => group.items.map((item) => item.href));
      for (const item of c.primaryNav.filter((i) => i.inHeader === false)) {
        expect(footer).toContain(item.href);
      }
    });

    // With no case study to show, the page holds typical profiles: it is out
    // of the header and carries that name wherever it is linked. Publishing
    // real work is what lets it be "Work" in the header again.
    it(`${lang} names /projects for what it holds while there are no case studies`, () => {
      const page = c.primaryNav[2];
      if (c.caseStudies.length > 0) return;
      expect(page.inHeader).toBe(false);
      expect(page.label.toLowerCase()).toBe(c.ui.typicalEngagements.toLowerCase());
      const inFooter = c.footerNav.flatMap((group) => group.items).find((i) => i.href === page.href);
      expect(inFooter?.label).toBe(page.label);
      expect(c.ui.typologiesNoteLink).toBe(page.label);
    });
  }

  it('the two languages hide the same pages', () => {
    const hidden = (c: SiteContent) => c.primaryNav.filter((i) => i.inHeader === false).map((i) => i.href);
    expect(hidden(es)).toEqual(hidden(en));
  });
});

/**
 * Spanish that reads as Spanish (the style notes at the top of site.es.ts).
 * A mirror drifts back one string at a time — the next headline translated
 * from "We reply with a scope" hands the reader "un alcance" again — and
 * nothing but a reader notices. These tests are that reader, for the two
 * words the Spanish pages were built on.
 */
describe('Spanish copy: the words a building owner uses', () => {
  // Every string of a bundle, wherever it sits.
  const strings = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];

  // "Un alcance de trabajo acordado" (the terms) is the extent of the work,
  // named as such. "Un alcance" alone is a thing nobody receives.
  it('never hands the reader "un alcance"', () => {
    expect(strings(es).filter((s) => /\bun alcance\b(?! de trabajo)/i.test(s))).toEqual([]);
  });

  // "Encargo" stays where it is the legal word for an engagement: the
  // notice, the privacy policy and the terms, all under `legal`.
  it('says "trabajos", and keeps "encargo" for the legal pages', () => {
    const pages = { ...es, legal: null };
    expect(strings(pages).filter((s) => /\bencargos?\b/i.test(s))).toEqual([]);
  });
});

describe('language switch', () => {
  // The switch shows the OTHER language, so an English page prints
  // `language.es` and a Spanish page `language.en`: a name translated into
  // the page's own language ("Spanish", "Inglés") would be the one word the
  // reader it is for cannot be counted on to recognise.
  it('names each language in that language, in both files', () => {
    for (const [, c] of bundles) {
      expect(c.ui.language.en).toBe('English');
      expect(c.ui.language.es).toBe('Español');
    }
  });
});
