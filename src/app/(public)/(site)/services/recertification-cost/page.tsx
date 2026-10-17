import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { CostView } from '@/components/ttc/views/CostView';
import { COST_PATH, costPage } from '@/lib/ttc/cost-page';

const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, COST_PATH, costPage(LANG).seo);

export default function Page() {
  return <CostView lang={LANG} />;
}
