import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { framePage } from '@/lib/calc/frame/page-strings';
import { frameUi, sharedWords } from '@/lib/calc/frame/strings';
import { FrameCalculator } from '@/components/ttc/calc/frame/FrameCalculator';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const FRAME_PATH = '/resources/plane-frame-analysis';

/**
 * /resources/plane-frame-analysis: "Plane frame analysis", the eighth
 * calculator of the catalogue to open: a 2D frame of straight members, rigid
 * or hinged at their ends, held by fixed, pinned, roller, guided or elastic
 * supports, solved by direct stiffness for its bending moment, shear and axial
 * force diagrams, its reactions and its deflected shape.
 *
 * A CALCULATOR OF ITS OWN, ON THE SHARED PAGE, as the third to the seventh
 * are: its own engine (lib/calc/frame) and its own form (FrameCalculator). The
 * page around it is the one every calculator shares (CalculatorPage); what is
 * this page's own is its address and its words: page-strings.ts for the page,
 * strings.ts for the form.
 *
 * The form takes TWO sets of words. `w` is what is about a frame. `t` is what
 * any calculator says as the first one does (how a number is written,
 * "Remove") and NOT the whole of the first calculator's set: `sharedWords`
 * picks out the pieces this tool borrows, since what a server view hands a
 * client component travels with the page and the first calculator's set says
 * "beam" in a dozen sentences that are none of a frame's page.
 *
 * `opening` is the frame's own line, for the same reason: the others hand the
 * page the first calculator's, which says that the link carries a beam.
 */
export function FrameView({ lang }: { lang: Lang }) {
  return (
    <CalculatorPage lang={lang} path={FRAME_PATH} page={framePage[lang]} opening={frameUi[lang].linkOpening}>
      <FrameCalculator t={sharedWords(beamStrings[lang].ui)} w={frameUi[lang]} />
    </CalculatorPage>
  );
}
