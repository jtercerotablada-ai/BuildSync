import React from 'react';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { BeamCalculator } from '@/components/ttc/calc/beam/BeamCalculator';
import { BEAM_PATH } from './BeamCalculatorView';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const SPAN_PATH = '/resources/single-span-beam';

/**
 * /resources/single-span-beam — "Single-span beam", the second calculator of
 * the catalogue to open: one span on a pin and a roller.
 *
 * NOT A SECOND CALCULATOR'S CODE. The tool is the first calculator's
 * component in its single-span mode (the `span` prop: the supports are
 * fixed, and two cards are added — load by load, and sizing), and the page
 * around it is the one every calculator shares (CalculatorPage). What is
 * this page's own is its address and its words: span-page-strings.ts for
 * the page, span-strings.ts for what the mode adds to the form.
 *
 * `generalPath` is the first calculator's address in this language. The
 * tool links to it with the beam on screen, for what one span on two simple
 * supports cannot be: more supports, a fixed end, hinges, applied moments.
 */
export function SingleSpanView({ lang }: { lang: Lang }) {
  return (
    <CalculatorPage lang={lang} path={SPAN_PATH} page={spanPage[lang]} opening={beamStrings[lang].ui.linkOpening}>
      {/* The form's words go in as props: this language's, and only the form's. */}
      <BeamCalculator t={beamStrings[lang].ui} span={spanUi[lang]} generalPath={localePath(BEAM_PATH, lang)} />
    </CalculatorPage>
  );
}
