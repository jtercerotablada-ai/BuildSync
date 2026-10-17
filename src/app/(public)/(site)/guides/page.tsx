import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { GuidesView } from '@/components/ttc/views/GuideView';
import { GUIDES_PATH } from '@/lib/ttc/guides';
import { guidesIndex } from '@/lib/ttc/guide-content';

const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, GUIDES_PATH, guidesIndex(LANG).seo);

export default function Page() {
  return <GuidesView lang={LANG} />;
}
