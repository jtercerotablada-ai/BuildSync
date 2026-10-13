import type { Metadata } from 'next';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { SHAFT_PATH, ShaftView } from '@/components/ttc/views/ShaftView';

/** /es/resources/shaft-on-bearings: the Spanish twin of the shaft calculator. */
const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, SHAFT_PATH, {
  title: shaftPage[LANG].title,
  description: shaftPage[LANG].description,
});

export default function Page() {
  return <ShaftView lang={LANG} />;
}
