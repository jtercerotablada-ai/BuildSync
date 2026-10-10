import type { Metadata } from 'next';
import { beamStrings } from '@/lib/calc/beam/strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { BEAM_PATH, BeamCalculatorView } from '@/components/ttc/views/BeamCalculatorView';

/**
 * /resources/beam — Beam reactions and diagrams, the first calculator of the
 * catalogue (src/lib/ttc/calculators.ts) to open. Its address is listed in
 * calculator-paths.ts, which is what makes it a page for the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, BEAM_PATH, {
  title: beamStrings[LANG].page.title,
  description: beamStrings[LANG].page.description,
});

export default function Page() {
  return <BeamCalculatorView lang={LANG} />;
}
