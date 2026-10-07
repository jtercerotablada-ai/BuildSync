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
