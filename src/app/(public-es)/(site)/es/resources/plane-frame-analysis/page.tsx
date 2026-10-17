import type { Metadata } from 'next';
import { framePage } from '@/lib/calc/frame/page-strings';
import { pageMeta } from '@/components/ttc/views/meta';
import { FRAME_PATH, FrameView } from '@/components/ttc/views/FrameView';

/** /es/resources/plane-frame-analysis: the Spanish twin of the plane frame calculator. */
const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, FRAME_PATH, {
  title: framePage[LANG].title,
  description: framePage[LANG].description,
});

export default function Page() {
  return <FrameView lang={LANG} />;
}
