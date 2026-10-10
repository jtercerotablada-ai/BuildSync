import type { Metadata } from 'next';
import { calculatorsPage } from '@/lib/ttc/calculators';
import { pageMeta } from '@/components/ttc/views/meta';
import { CalculatorsView } from '@/components/ttc/views/CalculatorsView';

/**
 * /es/resources — the Spanish twin of the calculators catalogue. In the menu
 * ("Recursos"); noindex and out of the sitemap for the same reason as the
 * English page: see
 * (public)/(site)/resources/page.tsx, and change the two together.
 */
const LANG = 'es' as const;

export const metadata: Metadata = {
  ...pageMeta(LANG, '/resources', {
    title: calculatorsPage[LANG].title,
    description: calculatorsPage[LANG].description,
  }),
  robots: { index: false, follow: true },
};

export default function Page() {
  return <CalculatorsView lang={LANG} />;
}
