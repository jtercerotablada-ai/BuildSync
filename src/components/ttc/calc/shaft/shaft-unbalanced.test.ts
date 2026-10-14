import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { formatNumber } from '@/lib/calc/format';
import { shaftUi, sharedWords } from '@/lib/calc/shaft/strings';
import type { ShaftModel } from '@/lib/calc/shaft/types';
import { ShaftCalculator } from '@/components/ttc/calc/shaft/ShaftCalculator';

/**
 * THE LINE NO SHAFT SHOWS, on the fourth calculator: "the reactions add up
 * to X and the load is Y".
 *
 * Under its two bearings the page says that the reactions balance the forces
 * of each plane — after asking (`agree`, lib/calc/format, asked in
 * lib/calc/shaft/analysis.ts), and only where BOTH planes' do. Where a
 * plane's do not, that plane says so instead, in the first calculator's
 * words, and not to use the results. No shaft anyone has found reaches that
 * line: two reactions from two equations of equilibrium add up to the forces.
 *
 * So the ENGINE is made to get one wrong, as lib/calc/shaft/analysis.test.ts
 * makes it: its left bearing carries a hundredth more than it found, in the
 * vertical plane — 360.7 lbf where the example has 357.1. The other
 * calculators' files of this name make `agree` answer no, and cannot tell
 * {sum} from {load}; this one can (1,404 lbf against 1,400), and one plane
 * from the other: the horizontal plane still adds up, says nothing — and is
 * not enough for the sentence, which is of both. In a file of its own, as
 * theirs are, because the engine is replaced for every test of the file.
 */

vi.mock('@/lib/calc/shaft/engine', async (original) => {
  const real = await original<typeof import('@/lib/calc/shaft/engine')>();
  return {
    ...real,
    solveShaft: (model: ShaftModel) => {
      const out = real.solveShaft(model);
      if (!out.ok) return out;
      return { ...out, bearings: [{ ...out.bearings[0], vertical: out.bearings[0].vertical * 1.01 }, out.bearings[1]] };
    },
  };
});

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    // (Not \s: the narrow space the Spanish page sets thousands apart with is kept.)
    .replace(/[ \t\n\r\f\v]+/g, ' ')
    .trim();

describe('shaft calculator: reactions that do not add up to the forces', () => {
  for (const lang of ['en', 'es'] as const) {
    const t = beamStrings[lang].ui;
    const w = shaftUi[lang];
    const n = (v: number) => formatNumber(v, 4, t.numbers.group);
    // The example: 1,000 + 400 lbf downward, 360 lbf towards the viewer; bearings at 2 and 16 in.
    const html = renderToStaticMarkup(h(ShaftCalculator, { t: sharedWords(t), w }));
    // The first card is the bearings'.
    const card = html.split(/<div class="mp-app__card(?: [^"]*)?">/)[1] ?? '';

    it(`${lang}: are not said to balance — the plane at fault says what each sum is, and not to use the results`, () => {
      expect(card).toContain(`<h3 class="mp-app__h">${w.bearings.title}</h3>`);
      // 1,400 lbf of forces in the vertical plane, under reactions of 357.1 × 1.01 + 1,043 lbf.
      const line = `${w.planes.vertical}: ${t.results.unbalanced.replace('{sum}', n(1400 + (5000 / 14) * 0.01)).replace('{load}', n(1400)).replace(/\{unit\}/g, 'lbf')}`;
      expect([...card.matchAll(/<p class="mp-app__row-error">([\s\S]*?)<\/p>/g)].map((m) => text(m[1]))).toEqual([line]);
      expect([n(1400 + (5000 / 14) * 0.01), n(1400)].map((x) => x.replace(/\D/g, ''))).toEqual(['1404', '1400']);
    });

    it(`${lang}: …in place of the sentence that says they do, not beside it — though the horizontal plane’s still add up`, () => {
      expect(card).not.toContain('mp-app__note');
      expect(text(html)).not.toContain(w.results.balance.split(':')[0]);
      // The plane that does add up has no line: a fault is said of the plane it is in.
      expect(text(card)).not.toContain(w.planes.horizontal);
    });
  }
});
