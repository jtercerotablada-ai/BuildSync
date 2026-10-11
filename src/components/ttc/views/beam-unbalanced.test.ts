import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { defaultBeam } from '@/lib/calc/beam/model';
import { beamStrings } from '@/lib/calc/beam/strings';
import { BeamCalculator } from '@/components/ttc/calc/beam/BeamCalculator';

/**
 * THE LINE NO BEAM SHOWS: "the reactions add up to X and the load is Y".
 *
 * The calculator asks whether the reactions it is about to print add up to
 * the load (`agree`, lib/calc/format), and says so only where they do. Where
 * they do not it says that instead, and not to use the results. The engine
 * has a check of its own and refuses a beam whose reactions fail it
 * (solver.ts), so no beam anyone has found reaches the other line — and a
 * line that is never shown is one nobody reads. Here `agree` is made to
 * answer no; in a file of its own, because the answer is replaced for
 * every test of the file.
 *
 * What this cannot tell apart is {sum} from {load}: on a solved beam the two
 * are the same figure ("32 kip and … 32 kip"), so a line with the two
 * exchanged passes. Telling them apart needs a solution whose reactions do
 * not add up, which is what the engine does not return.
 */

vi.mock('@/lib/calc/format', async (original) => ({ ...(await original<typeof import('@/lib/calc/format')>()), agree: () => false }));

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

describe('beam calculator: reactions that do not add up to the load', () => {
  const WORDS = {
    en: 'The reactions add up to 32 kip and the load is 32 kip: they should be equal. Do not use these results.',
    es: 'Las reacciones suman 32 kip y la carga es 32 kip: deberían ser iguales. No use estos resultados.',
  };
  for (const lang of ['en', 'es'] as const) {
    it(`${lang}: are not called equal — the page says what each is, and not to use the results`, () => {
      const ui = beamStrings[lang].ui;
      const said = text(renderToStaticMarkup(h(BeamCalculator, { t: ui, initial: defaultBeam() })));
      expect(said).toContain(WORDS[lang]);
      // …in place of the line that says they do, not beside it.
      expect(said).not.toContain(ui.results.equilibrium);
    });
  }
});
