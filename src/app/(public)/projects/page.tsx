import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { SEO } from '@/components/ttc/views/seo';
import { WorkView } from '@/components/ttc/views/WorkView';

const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, '/projects', SEO[LANG].work);

export default function Page() {
  return <WorkView lang={LANG} />;
}
