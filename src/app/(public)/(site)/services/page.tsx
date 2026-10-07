import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { SEO } from '@/components/ttc/views/seo';
import { ServicesView } from '@/components/ttc/views/ServicesView';

const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, '/services', SEO[LANG].services);

export default function Page() {
  return <ServicesView lang={LANG} />;
}
