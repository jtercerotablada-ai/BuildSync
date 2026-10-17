import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { cableSagUi, sharedWords } from '@/lib/calc/cable-sag/strings';
import { CableSagCalculator } from '@/components/ttc/calc/cable-sag/CableSagCalculator';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const CABLE_SAG_PATH = '/resources/cable-sag-pretension';

/**
 * /resources/cable-sag-pretension: "Cable sag and pretension", the seventh
 * calculator of the catalogue to open: a cable hung between two supports,
 * solved for its horizontal tension, its tensions at the supports, its sag and
 * its length; carried from one load and temperature to another; or hung from
 * point loads.
 *
 * A CALCULATOR OF ITS OWN, ON THE SHARED PAGE, as the third, the fourth and the
 * fifth are: its own engine (lib/calc/cable-sag) and its own form
 * (CableSagCalculator). The page around it is the one every calculator shares
 * (CalculatorPage); what is this page's own is its address and its words:
 * page-strings.ts for the page, strings.ts for the form.
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
export function CableSagView({ lang }: { lang: Lang }) {
  return (
    <CalculatorPage lang={lang} path={CABLE_SAG_PATH} page={cableSagPage[lang]} opening={cableSagUi[lang].linkOpening}>
      <CableSagCalculator t={sharedWords(beamStrings[lang].ui)} w={cableSagUi[lang]} />
    </CalculatorPage>
  );
}
