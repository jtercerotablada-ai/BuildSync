import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { SEO } from '@/components/ttc/views/seo';
import { AboutView } from '@/components/ttc/views/AboutView';

const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, '/about', SEO[LANG].about);

export default function Page() {
  return <AboutView lang={LANG} />;
}
