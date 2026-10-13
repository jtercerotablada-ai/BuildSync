import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { shaftUi, sharedWords } from '@/lib/calc/shaft/strings';
import { ShaftCalculator } from '@/components/ttc/calc/shaft/ShaftCalculator';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const SHAFT_PATH = '/resources/shaft-on-bearings';

/**
 * /resources/shaft-on-bearings: "Shaft on bearings", the fourth calculator
 * of the catalogue to open: a round shaft whose diameter changes in steps,
 * on two bearings, loaded in two planes at once.
 *
 * A CALCULATOR OF ITS OWN, ON THE SHARED PAGE, as the third is: its own
 * engine (lib/calc/shaft: each plane's statics by the first calculator's
 * engine, the bending of a stepped shaft integrated piece by piece) and its
 * own form (ShaftCalculator). The page around it is the one every
 * calculator shares (CalculatorPage); what is this page's own is its address
 * and its words: page-strings.ts for the page, strings.ts for the form.
 *
 * The form takes TWO sets of words. `w` is what is about a shaft. `t` is
 * what any calculator says as the first one does (how a number is written,
 * "Remove", "Largest values") and NOT the whole of the first calculator's
 * set: `sharedWords` picks out the pieces this tool borrows. What a server
 * view hands a client component travels with the page, and the first
 * calculator's set says "beam" in a dozen sentences that are none of a
 * shaft's page.
 *
 * `opening` is the shaft's own line, for the same reason: the other three
 * hand the page the first calculator's, which says that the link carries a
 * beam.
 */
export function ShaftView({ lang }: { lang: Lang }) {
  return (
    <CalculatorPage lang={lang} path={SHAFT_PATH} page={shaftPage[lang]} opening={shaftUi[lang].linkOpening}>
      <ShaftCalculator t={sharedWords(beamStrings[lang].ui)} w={shaftUi[lang]} />
    </CalculatorPage>
  );
}
