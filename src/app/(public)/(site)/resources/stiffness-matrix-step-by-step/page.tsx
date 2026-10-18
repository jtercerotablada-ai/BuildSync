import type { Metadata } from 'next';
import { stiffnessPage } from '@/lib/calc/stiffness/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { STIFFNESS_PATH, StiffnessView } from '@/components/ttc/views/StiffnessView';

/**
 * /resources/stiffness-matrix-step-by-step: Stiffness matrix, step by step, the
 * ninth calculator of the catalogue (src/lib/ttc/calculators.ts) to open. Its
 * address is listed in calculator-paths.ts, which is what makes it a page for
 * the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, STIFFNESS_PATH, {
  title: stiffnessPage[LANG].title,
  description: stiffnessPage[LANG].description,
});

export default function Page() {
  return <StiffnessView lang={LANG} />;
}
