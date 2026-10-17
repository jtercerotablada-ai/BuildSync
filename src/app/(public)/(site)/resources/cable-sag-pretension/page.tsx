import type { Metadata } from 'next';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { CABLE_SAG_PATH, CableSagView } from '@/components/ttc/views/CableSagView';

/**
 * /resources/cable-sag-pretension: Cable sag and pretension, the seventh
 * calculator of the catalogue (src/lib/ttc/calculators.ts) to open. Its
 * address is listed in calculator-paths.ts, which is what makes it a page for
 * the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, CABLE_SAG_PATH, {
  title: cableSagPage[LANG].title,
  description: cableSagPage[LANG].description,
});

export default function Page() {
  return <CableSagView lang={LANG} />;
}
