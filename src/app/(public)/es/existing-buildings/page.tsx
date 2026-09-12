import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { SEO } from '@/components/ttc/views/seo';
import { ExistingView } from '@/components/ttc/views/ExistingView';

const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, '/existing-buildings', SEO[LANG].existing);

export default function Page() {
  return <ExistingView lang={LANG} />;
}
