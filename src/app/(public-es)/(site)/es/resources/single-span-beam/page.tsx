import type { Metadata } from 'next';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { SPAN_PATH, SingleSpanView } from '@/components/ttc/views/SingleSpanView';

/** /es/resources/single-span-beam — the Spanish twin of the single-span beam calculator. */
const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, SPAN_PATH, {
  title: spanPage[LANG].title,
  description: spanPage[LANG].description,
});

export default function Page() {
  return <SingleSpanView lang={LANG} />;
}
