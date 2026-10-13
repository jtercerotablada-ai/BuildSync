import React from 'react';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { ContinuousCalculator } from '@/components/ttc/calc/continuous/ContinuousCalculator';
import { BEAM_PATH } from './BeamCalculatorView';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const CONTINUOUS_PATH = '/resources/continuous-beam';

/**
 * /resources/continuous-beam — "Continuous beam", the third calculator of
 * the catalogue to open: a beam entered span by span, each span with its own
 * stiffness, on supports that may settle, under dead load and under the live
 * load in every arrangement.
 *
 * A CALCULATOR OF ITS OWN, ON THE SHARED PAGE. Unlike the second, which is
 * the first one's component in another mode, this one has its own engine
 * (lib/calc/continuous: direct stiffness, one element per span) and its own
 * form (ContinuousCalculator). The page around it is the one every
 * calculator shares (CalculatorPage); what is this page's own is its address
 * and its words: page-strings.ts for the page, strings.ts for the form.
 *
 * The form takes TWO sets of words: `t`, the first calculator's — the units,
 * the section and material group, the drawings and the row of actions are
 * the same pieces, and say the same things — and `c`, what a continuous beam
 * adds to them. Both are this language's, and only the form's.
 *
 * `generalPath` is the first calculator's address in this language. The
 * form links to it with the beam on screen, for what this page does not do
 * (internal hinges, applied moments), when that calculator can hold the
 * beam: one stiffness, supports that do not settle.
 */
export function ContinuousBeamView({ lang }: { lang: Lang }) {
  return (
    <CalculatorPage lang={lang} path={CONTINUOUS_PATH} page={continuousPage[lang]} opening={beamStrings[lang].ui.linkOpening}>
      <ContinuousCalculator t={beamStrings[lang].ui} c={continuousUi[lang]} generalPath={localePath(BEAM_PATH, lang)} />
    </CalculatorPage>
  );
}
