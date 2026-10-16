import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { sharedWords, trussUi } from '@/lib/calc/truss/strings';
import { TrussCalculator } from '@/components/ttc/calc/truss/TrussCalculator';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const TRUSS_PATH = '/resources/truss-member-forces';

/**
 * /resources/truss-member-forces: "Truss member forces", the fifth calculator
 * of the catalogue to open: a plane truss of pin-jointed members, loaded at
 * the joints, solved for the axial force in every member and the reactions.
 *
 * A CALCULATOR OF ITS OWN, ON THE SHARED PAGE, as the third and the fourth
 * are: its own engine (lib/calc/truss: joint equilibrium, or the direct
 * stiffness method when the truss is indeterminate) and its own form
 * (TrussCalculator). The page around it is the one every calculator shares
 * (CalculatorPage); what is this page's own is its address and its words:
 * page-strings.ts for the page, strings.ts for the form.
 *
 * The form takes TWO sets of words. `w` is what is about a truss. `t` is what
 * any calculator says as the first one does (how a number is written,
 * "Remove") and NOT the whole of the first calculator's set: `sharedWords`
 * picks out the pieces this tool borrows, since what a server view hands a
 * client component travels with the page and the first calculator's set says
 * "beam" in a dozen sentences that are none of a truss's page.
 *
 * `opening` is the truss's own line, for the same reason: the others hand the
 * page the first calculator's, which says that the link carries a beam.
 */
export function TrussView({ lang }: { lang: Lang }) {
  return (
    <CalculatorPage lang={lang} path={TRUSS_PATH} page={trussPage[lang]} opening={trussUi[lang].linkOpening}>
      <TrussCalculator t={sharedWords(beamStrings[lang].ui)} w={trussUi[lang]} />
    </CalculatorPage>
  );
}
