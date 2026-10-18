import type { Metadata } from 'next';
import { stiffnessPage } from '@/lib/calc/stiffness/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { STIFFNESS_PATH, StiffnessView } from '@/components/ttc/views/StiffnessView';

/** /es/resources/stiffness-matrix-step-by-step: the Spanish twin of the stiffness matrix calculator. */
const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, STIFFNESS_PATH, {
  title: stiffnessPage[LANG].title,
  description: stiffnessPage[LANG].description,
});

export default function Page() {
  return <StiffnessView lang={LANG} />;
}
