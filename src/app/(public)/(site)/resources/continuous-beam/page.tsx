import type { Metadata } from 'next';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { CONTINUOUS_PATH, ContinuousBeamView } from '@/components/ttc/views/ContinuousBeamView';

/**
 * /resources/continuous-beam — Continuous beam, the third calculator of the
 * catalogue (src/lib/ttc/calculators.ts) to open. Its address is listed in
 * calculator-paths.ts, which is what makes it a page for the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, CONTINUOUS_PATH, {
  title: continuousPage[LANG].title,
  description: continuousPage[LANG].description,
});

export default function Page() {
  return <ContinuousBeamView lang={LANG} />;
}
