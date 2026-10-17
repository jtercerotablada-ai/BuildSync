import type { Metadata } from 'next';
import { cablePage } from '@/lib/calc/cable/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { CABLE_PATH, CableView } from '@/components/ttc/views/CableView';

/** /es/resources/cable-tension-elongation: the Spanish twin of the cable calculator. */
const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, CABLE_PATH, {
  title: cablePage[LANG].title,
  description: cablePage[LANG].description,
});

export default function Page() {
  return <CableView lang={LANG} />;
}
