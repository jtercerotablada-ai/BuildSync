import { describe, expect, it } from 'vitest';
import type { SiteContent } from './content';
import { en } from './site';
import { es } from './site.es';

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
      expect(t?.comparison?.rows.length ?? 0).toBe(s.comparison?.rows.length ?? 0);
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
  // list: titles, headings, the first line, the questions, the comparison.
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

  // Shown on English pages only, to a browser set to Spanish.
  it('offers Spanish in Spanish, the same line in both files', () => {
    expect(es.ui.language.offer).toEqual(en.ui.language.offer);
    expect(en.ui.language.offer.text).toMatch(/español/);
  });
});
