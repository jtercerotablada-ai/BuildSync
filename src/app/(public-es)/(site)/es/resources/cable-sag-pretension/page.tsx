import type { Metadata } from 'next';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { CABLE_SAG_PATH, CableSagView } from '@/components/ttc/views/CableSagView';

/** /es/resources/cable-sag-pretension: the Spanish twin of the cable sag calculator. */
const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, CABLE_SAG_PATH, {
  title: cableSagPage[LANG].title,
  description: cableSagPage[LANG].description,
});

export default function Page() {
  return <CableSagView lang={LANG} />;
}
