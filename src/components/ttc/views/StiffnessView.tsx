import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { stiffnessPage } from '@/lib/calc/stiffness/page-strings';
import { sharedWords, stiffnessUi } from '@/lib/calc/stiffness/strings';
import { StiffnessCalculator } from '@/components/ttc/calc/stiffness/StiffnessCalculator';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const STIFFNESS_PATH = '/resources/stiffness-matrix-step-by-step';

/**
 * /resources/stiffness-matrix-step-by-step: "Stiffness matrix, step by step", the
 * ninth calculator of the catalogue to open: a plane truss or frame of up to 12
 * nodes solved by the direct stiffness method, with every step written out as
 * data the tool prints as a worked solution: the member matrices in local and
 * global axes, the assembly, the loads, the partition, the elimination, the
 * reactions, the member end forces and the checks.
 *
 * A CALCULATOR OF ITS OWN, ON THE SHARED PAGE, as the third to the eighth are:
 * its own engine (lib/calc/stiffness, which records each step) and its own form
 * (StiffnessCalculator). The page around it is the one every calculator shares
 * (CalculatorPage); what is this page's own is its address and its words:
 * page-strings.ts for the page, strings.ts for the form.
 *
 * The form takes TWO sets of words. `w` is what is about a stiffness solution.
 * `t` is what any calculator says as the first one does (how a number is
 * written, "Remove") and NOT the whole of the first calculator's set:
 * `sharedWords` picks out the pieces this tool borrows, since what a server view
 * hands a client component travels with the page and the first calculator's set
 * says "beam" in a dozen sentences that are none of this tool's page.
 *
 * `opening` is this tool's own line, for the same reason: the others hand the
 * page the first calculator's, which says that the link carries a beam.
 */
export function StiffnessView({ lang }: { lang: Lang }) {
  return (
    <CalculatorPage lang={lang} path={STIFFNESS_PATH} page={stiffnessPage[lang]} opening={stiffnessUi[lang].linkOpening}>
      <StiffnessCalculator t={sharedWords(beamStrings[lang].ui)} w={stiffnessUi[lang]} />
    </CalculatorPage>
  );
}
