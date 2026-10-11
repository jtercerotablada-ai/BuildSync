import type { Metadata } from 'next';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { SPAN_PATH, SingleSpanView } from '@/components/ttc/views/SingleSpanView';

/**
 * /resources/single-span-beam — Single-span beam, the second calculator of
 * the catalogue (src/lib/ttc/calculators.ts) to open. Its address is listed
 * in calculator-paths.ts, which is what makes it a page for the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, SPAN_PATH, {
  title: spanPage[LANG].title,
  description: spanPage[LANG].description,
});

export default function Page() {
  return <SingleSpanView lang={LANG} />;
}
