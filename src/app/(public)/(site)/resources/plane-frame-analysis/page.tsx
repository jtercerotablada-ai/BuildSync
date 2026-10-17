import type { Metadata } from 'next';
import { framePage } from '@/lib/calc/frame/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { FRAME_PATH, FrameView } from '@/components/ttc/views/FrameView';

/**
 * /resources/plane-frame-analysis: Plane frame analysis, the eighth
 * calculator of the catalogue (src/lib/ttc/calculators.ts) to open. Its
 * address is listed in calculator-paths.ts, which is what makes it a page for
 * the proxy.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, FRAME_PATH, {
  title: framePage[LANG].title,
  description: framePage[LANG].description,
});

export default function Page() {
  return <FrameView lang={LANG} />;
}
