import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { SEO } from '@/components/ttc/views/seo';
import { LegalView } from '@/components/ttc/views/LegalView';

const LANG = 'es' as const;

export const metadata: Metadata = {
  ...pageMeta(LANG, '/privacy', SEO[LANG].privacy),
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LegalView lang={LANG} kind="privacy" />;
}
