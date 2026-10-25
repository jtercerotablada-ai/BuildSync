import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { marks } from './municipalities';
import type { SiteContent } from './content';
import { en } from './site';
import { es } from './site.es';
import { firstSentence } from '@/components/ttc/mp/text';

/**
 * Miami-Dade's recertification and Broward's BSIP are two programs with two
 * pages, and for a long stretch the two pages said the same thing in the
 * same words: nine questions, three scope lines, the board's three duties,
 * two caveats and a heading were one text printed twice. The owner's on-page
 * check counts every such block ("content that appears on several pages").
 *
 * Each page now says it in its own program's terms. Nothing in the type
 * keeps it that way — a sentence pasted from one block into the other
 * compiles — so these tests do. What the PAGES print is checked on the
 * rendered HTML in views/programs-own-words.test.ts; this file reads the
 * content itself.
 */
const bundles: [string, SiteContent][] = [
  ['en', en],
  ['es', es],
];
const PROGRAMS = ['building-recertification', 'broward-bsip'] as const;
const svc = (c: SiteContent, slug: string) => c.services.find((s) => s.slug === slug)!;

describe('the two county programs: each page in its own words', () => {
  // Everything a program page prints as a sentence of its own. Left out on
  // purpose: the six step LABELS and the four home steps (the same on both
  // pages by design, so the two processes compare), and `audience` and
  // `capabilities`, which are printed joined into one line.
  const lines = (c: SiteContent, slug: string): string[] => {
    const s = svc(c, slug);
    return [
      s.summary,
      s.heroSub,
      s.problemTitle,
      s.problem,
      s.nextStep,
      s.timing?.note,
      ...Object.values(s.headings ?? {}),
      ...s.when,
      ...s.scope,
      ...s.deliverables,
      ...s.process.map((p) => p.detail),
      ...(s.timing?.duties ?? []),
      ...(s.faq ?? []).flatMap((f) => [f.q, f.a]),
      ...s.considerations,
      // The complete package, part by part: each county's is its own list.
      s.packet?.label,
      s.packet?.lede,
      s.packet?.note,
      ...(s.packet?.parts ?? []).map((p) => p.v),
      s.offices?.lede,
      s.offices?.note,
      s.program?.lede,
      s.program?.timingLink,
      s.program?.detail,
      s.program?.cta,
    ].filter((x): x is string => typeof x === 'string');
  };

  for (const [lang, c] of bundles) {
    it(`${lang}: no question, scope line, duty, caveat or heading is the same on both pages`, () => {
      const [a, b] = PROGRAMS.map((slug) => new Set(lines(c, slug)));
      expect([...a].filter((line) => b.has(line))).toEqual([]);
    });

    // The questions are also what the FAQPage markup carries as `name`
    // (ServiceDetailView builds it from this array): one question, one page.
    it(`${lang}: every question belongs to one program`, () => {
      const [a, b] = PROGRAMS.map((slug) => (svc(c, slug).faq ?? []).map((f) => f.q));
      expect(a.length).toBeGreaterThan(0);
      expect(new Set([...a, ...b]).size).toBe(a.length + b.length);
    });
  }
});

/**
 * "What the board must do" is state law (F.S. 553.899(5) and (9)) and the
 * same duty in both counties. The two pages may differ ONLY in the name each
 * gives the document the statute counts from — the notice, the report. The
 * days, the acts and their order are the statute's.
 */
describe('the board’s duties: the same law on both pages', () => {
  // What is left of two sentences once their common beginning and their
  // common end are taken away.
  const differingPart = (a: string, b: string): [string, string] => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    let j = 0;
    while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    return [a.slice(i, a.length - j), b.slice(i, b.length - j)];
  };

  for (const [lang, c] of bundles) {
    const [md, br] = PROGRAMS.map((slug) => svc(c, slug).timing?.duties ?? []);

    it(`${lang}: three duties on each page, with the statute's day counts`, () => {
      for (const duties of [md, br]) {
        expect(duties).toHaveLength(3);
        expect(duties[0]).toMatch(/\b14\b/);
        expect(duties[1]).toMatch(/\b45\b/);
        expect(duties[2]).toMatch(/\b45\b/);
        // …and no other number: nothing was added to the law.
        expect(duties.join(' ').match(/\d+/g)).toEqual(['14', '45', '45']);
      }
    });

    it(`${lang}: a duty differs between the pages by one short name, and nothing else`, () => {
      md.forEach((duty, i) => {
        const [here, there] = differingPart(duty, br[i]);
        expect(here.length, duty).toBeGreaterThan(0);
        expect(there.length, br[i]).toBeGreaterThan(0);
        // "city or the county" / "Building Official"; "recertification" / "BSIP".
        expect(here.length, duty).toBeLessThanOrEqual(28);
        expect(there.length, br[i]).toBeLessThanOrEqual(28);
        expect(`${here} ${there}`).not.toMatch(/\d/);
      });
    });
  }
});

/**
 * The city pages' summary of a county program (they print the facts flagged
 * `home`; the old home page's two program sections did too) is a SUMMARY of
 * the program pages: the facts flagged `home`, each cut to its first sentence, and of the line
 * under the button its second half (the city pages). All of it is read from
 * the same row and the same line — so what must hold is here, on the data.
 */
describe('the summary of a county program (the facts flagged `home`)', () => {
  const facts = (c: SiteContent, slug: string) => svc(c, slug).timing?.rows[0]?.facts ?? [];
  const flagged = (c: SiteContent, slug: string) =>
    facts(c, slug).flatMap((f, i) => (f.home ? [i] : []));

  it('both programs flag the same rows, in both languages', () => {
    const want = flagged(en, PROGRAMS[0]);
    for (const [, c] of bundles) {
      for (const slug of PROGRAMS) expect(flagged(c, slug)).toEqual(want);
    }
  });

  it('it is a summary: some rows, not all of them, and the filing deadline among them', () => {
    for (const [, c] of bundles) {
      for (const slug of PROGRAMS) {
        const all = facts(c, slug);
        const home = all.filter((f) => f.home);
        expect(home.length).toBeGreaterThanOrEqual(3);
        expect(home.length).toBeLessThan(all.length);
        expect(home.filter((f) => f.filing)).toHaveLength(1);
      }
    }
  });

  // The section prints the first sentence only, so it has to be a sentence.
  it('every flagged row opens with a whole sentence', () => {
    for (const [, c] of bundles) {
      for (const slug of PROGRAMS) {
        for (const f of facts(c, slug).filter((x) => x.home)) {
          const kept = firstSentence(f.v);
          expect(kept.endsWith('.'), f.v).toBe(true);
          expect(kept.split(/\s+/).length, f.v).toBeGreaterThanOrEqual(3);
          // …and not one cut short at an abbreviation's full stop.
          expect(kept, f.v).not.toMatch(/\b(?:U\.S|EE|UU|St|No|Inc|Sec|Art|Fla|Dr|Núm|p\. ej)\.$/);
        }
      }
    }
  });

  it('no other service flags a row for the home page', () => {
    for (const [, c] of bundles) {
      const others = c.services.filter((s) => !s.program);
      const count = others.flatMap((s) => (s.timing?.rows ?? []).flatMap((r) => r.facts.filter((f) => f.home)));
      expect(count).toEqual([]);
    }
  });

  it('the link to the whole table names its county and types no number', () => {
    for (const [, c] of bundles) {
      const links = PROGRAMS.map((slug) => svc(c, slug).program!.timingLink);
      expect(links[0]).toContain('Miami-Dade');
      expect(links[1]).toContain('Broward');
      for (const link of links) expect(link).not.toMatch(/\d/);
    }
  });
});

/* The city pages and the cost page print once what the two programs share:
   the four steps under both county columns, and one column of building
   sizes in the price table. That is only true while they ARE
   shared — if a county ever gets its own steps or its own sizes, these fail
   and the page has to print them per county again. */
describe('the shared parts of the two programs are printed once', () => {
  it('both programs run the same four steps', () => {
    for (const [, c] of bundles) {
      const [a, b] = PROGRAMS.map((slug) => svc(c, slug).program!.steps);
      expect(b).toEqual(a);
    }
  });

  it('both counties price the same four sizes, in the same order', () => {
    for (const [, c] of bundles) {
      const [a, b] = c.pricing.programs.map((p) => p.tiers.map((t) => t.size));
      expect(b).toEqual(a);
    }
  });

  it('every county list names its own logo, and only the two counties have one', () => {
    for (const [, c] of bundles) {
      for (const list of c.pricing.jurisdictions.lists) {
        expect(list.mark).toMatch(/County$/);
        expect(marks[list.mark], list.mark).toBeDefined();
        expect(list.names.length).toBeGreaterThan(30);
      }
    }
    // The owner, 2026-10-21: no city seal or logo (Fla. Stat. 165.043; the
    // cities' own brand pages). A city mark comes back only with that
    // city's written permission, and this test is then changed on purpose.
    expect(Object.keys(marks).sort()).toEqual(['Broward County', 'Miami-Dade County']);
    const files = readdirSync(join(process.cwd(), 'public', 'ttc', 'img', 'jurisdictions')).sort();
    expect(files).toEqual(['broward.webp', 'miami-dade.webp']);
  });
});
