import type { Metadata } from 'next';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { TRUSS_PATH, TrussView } from '@/components/ttc/views/TrussView';

/** /es/resources/truss-member-forces: the Spanish twin of the truss calculator. */
const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, TRUSS_PATH, {
  title: trussPage[LANG].title,
  description: trussPage[LANG].description,
});

export default function Page() {
  return <TrussView lang={LANG} />;
}
