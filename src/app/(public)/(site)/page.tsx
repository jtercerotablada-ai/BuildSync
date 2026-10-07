import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { SEO } from '@/components/ttc/views/seo';
import { HomeView } from '@/components/ttc/views/HomeView';

const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, '/', SEO[LANG].home);

export default function Page() {
  return <HomeView lang={LANG} />;
}
