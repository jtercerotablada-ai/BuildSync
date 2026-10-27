import { describe, expect, it } from 'vitest';
import { getContent } from './content';
import type { Lang } from './i18n';

/**
 * The program's clock (plates/ServiceClock.tsx) says again, in large numbers,
 * what the program's verified rows say. A number on the band that is not in
 * the rows is a number nobody verified: every one must appear in the
 * service's own `timing` facts, `considerations` or questions — so when a row
 * changes, this fails until the band follows.
 */
const LANGS: Lang[] = ['en', 'es'];

describe('service clock: every number is the verified rows said again', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    for (const [slug, clock] of Object.entries(c.serviceClock)) {
      const s = c.services.find((x) => x.slug === slug);
      it(`${lang} ${slug}: the service exists and the band has four numbers`, () => {
        expect(s, slug).toBeTruthy();
        expect(clock.items).toHaveLength(4);
      });
      if (!s) continue;
      const rows = [
        ...(s.timing?.rows.flatMap((r) => r.facts.map((f) => `${f.k} ${f.v}`)) ?? []),
        ...s.considerations,
        ...(s.faq?.map((q) => `${q.q} ${q.a}`) ?? []),
        ...s.when,
        ...s.scope,
      ].join(' \n ');
      // Numbers as words count too ("three stories", "fifty feet").
      const words: Record<string, RegExp> = {
        '2': /\b(phase two|two phases|fase dos|segunda fase|dos fases)\b/i,
        '3': /\b(3|three|tres)\b/i,
        '5': /\b(5|five|cinco)\b/i,
        '10': /\b(10|ten|diez)\b/i,
        '50': /\b(50|fifty|cincuenta)\b/i,
      };
      for (const it2 of clock.items) {
        it(`${lang} ${slug}: "${it2.n} ${it2.unit}" is in the verified rows`, () => {
          const re = words[it2.n] ?? new RegExp(`(^|[^\d,])${it2.n}([^\d]|$)`);
          expect(rows, `${it2.n} ${it2.unit} — ${it2.k}`).toMatch(re);
          if (it2.sub) {
            const n = it2.sub.match(/\d[\d,]*/)?.[0];
            if (n) expect(rows, it2.sub).toContain(n);
          }
        });
      }
    }
  }
});

describe('service buildings: every service page has its plate, in both languages', () => {
  const en = getContent('en');
  const es = getContent('es');
  for (const s of en.services) {
    it(`${s.slug}: the plate exists in both languages with the same number of cards`, () => {
      expect(en.serviceBuildings[s.slug], s.slug).toBeTruthy();
      expect(es.serviceBuildings[s.slug], s.slug).toBeTruthy();
      expect(es.serviceBuildings[s.slug].items.length).toBe(en.serviceBuildings[s.slug].items.length);
      expect([6, 8, 12]).toContain(en.serviceBuildings[s.slug].items.length);
      expect(Boolean(es.serviceBuildings[s.slug].outside)).toBe(Boolean(en.serviceBuildings[s.slug].outside));
    });
    it(`${s.slug}: the accent phrase is in the title`, () => {
      for (const c of [en, es]) {
        const b = c.serviceBuildings[s.slug];
        expect(b.title).toContain(b.accentWord);
      }
    });
  }
  it('every photograph is a finished building: none under construction', () => {
    for (const c of [en, es]) {
      for (const b of Object.values(c.serviceBuildings)) {
        for (const it2 of b.items) expect(it2.photo.alt, it2.title).not.toMatch(/under construction|crane|en construcción|grúa/i);
      }
    }
  });
});
