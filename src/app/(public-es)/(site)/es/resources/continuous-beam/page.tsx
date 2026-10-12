import type { Metadata } from 'next';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { CONTINUOUS_PATH, ContinuousBeamView } from '@/components/ttc/views/ContinuousBeamView';

/** /es/resources/continuous-beam — the Spanish twin of the continuous beam calculator. */
const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, CONTINUOUS_PATH, {
  title: continuousPage[LANG].title,
  description: continuousPage[LANG].description,
});

export default function Page() {
  return <ContinuousBeamView lang={LANG} />;
}
