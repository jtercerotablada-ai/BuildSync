import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { beamStrings } from '@/lib/calc/beam/strings';
import { BeamCalculator } from '@/components/ttc/calc/beam/BeamCalculator';
import { CalculatorPage } from './CalculatorPage';

/** The calculator's address, the same in both languages (the Spanish page is /es + this). */
export const BEAM_PATH = '/resources/beam';

/**
 * /resources/beam — "Beam reactions and diagrams", the first calculator of
 * the catalogue to open.
 *
 * The page around the tool — hero, notes, terms, and the calculation sheet
 * it is on paper — is CalculatorPage, which every calculator shares. What is
 * this one's is its address, its text and its tool.
 *
 * WRITTEN FOR ENGINEERS. The site's pages speak to building owners and keep
 * codes and jargon out; this one is a tool for people who use the words
 * "hogging moment". Its text is in lib/calc/beam/strings.ts, not site.ts.
 */
export function BeamCalculatorView({ lang }: { lang: Lang }) {
  const { page, ui } = beamStrings[lang];
  return (
    <CalculatorPage lang={lang} path={BEAM_PATH} page={page} opening={ui.linkOpening}>
      {/* The form's words go in as a prop: this language's, and only the form's. */}
      <BeamCalculator t={ui} />
    </CalculatorPage>
  );
}
