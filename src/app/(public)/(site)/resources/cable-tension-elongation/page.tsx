import type { Metadata } from 'next';
import { cablePage } from '@/lib/calc/cable/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { CABLE_PATH, CableView } from '@/components/ttc/views/CableView';

/**
 * /resources/cable-tension-elongation: Cable tension and elongation, the sixth
 * calculator of the catalogue (src/lib/ttc/calculators.ts) to open. Its address
 * is listed in calculator-paths.ts, which is what makes it a page for the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, CABLE_PATH, {
  title: cablePage[LANG].title,
  description: cablePage[LANG].description,
});

export default function Page() {
  return <CableView lang={LANG} />;
}
