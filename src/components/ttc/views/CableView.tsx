import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cablePage } from '@/lib/calc/cable/page-strings';
import { cableUi, sharedWords } from '@/lib/calc/cable/strings';
import { CableCalculator } from '@/components/ttc/calc/cable/CableCalculator';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const CABLE_PATH = '/resources/cable-tension-elongation';

/**
 * /resources/cable-tension-elongation: "Cable tension and elongation", the
 * sixth calculator of the catalogue to open: a straight, weightless cable under
 * a load, in three problems that share one cable section. A weight hung from
 * one cable or a two-leg sling (tension, stress, elastic and thermal stretch,
 * where the load point ends up); a block pulled against friction on a slope
 * (the pull that starts it, keeps it going, and the best angle to pull at);
 * and a cable round a drum (the capstan equation).
 *
 * A CALCULATOR OF ITS OWN, ON THE SHARED PAGE, as the third to the fifth are:
 * its own engine (lib/calc/cable) and its own form (CableCalculator). The page
 * around it is the one every calculator shares (CalculatorPage); what is this
 * page's own is its address and its words: page-strings.ts for the page,
 * strings.ts for the form.
 *
 * The form takes TWO sets of words. `w` is what is about a cable. `t` is what
 * any calculator says as the first one does (how a number is written,
 * "Remove") and NOT the whole of the first calculator's set: `sharedWords`
 * picks out the pieces this tool borrows, since what a server view hands a
 * client component travels with the page and the first calculator's set says
 * "beam" in a dozen sentences that are none of a cable's page.
 *
 * `opening` is the cable's own line, for the same reason: the others hand the
 * page the first calculator's, which says that the link carries a beam.
 */
export function CableView({ lang }: { lang: Lang }) {
  return (
    <CalculatorPage lang={lang} path={CABLE_PATH} page={cablePage[lang]} opening={cableUi[lang].linkOpening}>
      <CableCalculator t={sharedWords(beamStrings[lang].ui)} w={cableUi[lang]} />
    </CalculatorPage>
  );
}
