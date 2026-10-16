import type { Metadata } from 'next';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { TRUSS_PATH, TrussView } from '@/components/ttc/views/TrussView';

/**
 * /resources/truss-member-forces: Truss member forces, the fifth calculator of
 * the catalogue (src/lib/ttc/calculators.ts) to open. Its address is listed
 * in calculator-paths.ts, which is what makes it a page for the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, TRUSS_PATH, {
  title: trussPage[LANG].title,
  description: trussPage[LANG].description,
});

export default function Page() {
  return <TrussView lang={LANG} />;
}
