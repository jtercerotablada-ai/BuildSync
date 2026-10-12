import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { defaultContinuous } from '@/lib/calc/continuous/model';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { ContinuousCalculator } from '@/components/ttc/calc/continuous/ContinuousCalculator';

/**
 * THE LINE NO BEAM SHOWS, on the third calculator: "the reactions add up to
 * X and the load is Y".
 *
 * In a single case (the live load on every span) the page asks whether the
 * reactions it is about to print add up to the load (`agree`,
 * lib/calc/format, asked in lib/calc/continuous/analysis.ts) and says so
 * only where they do; where they do not it says that instead, and not to use
 * the results. The engine refuses a beam that fails its own check of
 * equilibrium, so no beam anyone has found reaches the other line. Here
 * `agree` is made to answer no — in a file of its own, as the first
 * calculator's is (views/beam-unbalanced.test.ts), because the answer is
 * replaced for every test of the file.
 *
 * As there, {sum} and {load} cannot be told apart: on a solved beam they are
 * one figure.
 */

vi.mock('@/lib/calc/format', async (original) => ({ ...(await original<typeof import('@/lib/calc/format')>()), agree: () => false }));

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

describe('continuous beam calculator: reactions that do not add up to the load', () => {
  // The example with the live load on every span: 2.1 kip/ft on 78 ft, 163.8 kip.
  const WORDS = {
    en: 'The reactions add up to 163.8 kip and the load is 163.8 kip: they should be equal. Do not use these results.',
    es: 'Las reacciones suman 163.8 kip y la carga es 163.8 kip: deberían ser iguales. No use estos resultados.',
  };
  for (const lang of ['en', 'es'] as const) {
    const show = (everyArrangement: boolean) => text(renderToStaticMarkup(h(ContinuousCalculator, { t: beamStrings[lang].ui, c: continuousUi[lang], initial: { ...defaultContinuous(), everyArrangement } })));

    it(`${lang}: are not called equal — the page says what each is, and not to use the results`, () => {
      const said = show(false);
      expect(said).toContain(WORDS[lang]);
      // …in place of the line that says they do, not beside it.
      expect(said).not.toContain(beamStrings[lang].ui.results.equilibrium);
    });

    it(`${lang}: over every arrangement there is no one sum, and neither line`, () => {
      const said = show(true);
      expect(said).not.toContain(WORDS[lang]);
      expect(said).not.toContain(beamStrings[lang].ui.results.equilibrium);
    });
  }
});
