import type { Metadata } from 'next';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { SHAFT_PATH, ShaftView } from '@/components/ttc/views/ShaftView';

/**
 * /resources/shaft-on-bearings: Shaft on bearings, the fourth calculator of
 * the catalogue (src/lib/ttc/calculators.ts) to open. Its address is listed
 * in calculator-paths.ts, which is what makes it a page for the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, SHAFT_PATH, {
  title: shaftPage[LANG].title,
  description: shaftPage[LANG].description,
});

export default function Page() {
  return <ShaftView lang={LANG} />;
}
