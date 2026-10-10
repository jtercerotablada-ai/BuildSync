import type { Metadata } from 'next';
import { calculatorsPage } from '@/lib/ttc/calculators';
import { pageMeta } from '@/components/ttc/views/meta';
import { CalculatorsView } from '@/components/ttc/views/CalculatorsView';

/**
 * /resources — the calculators catalogue (src/lib/ttc/calculators.ts).
 *
 * The address is the one the calculators had before they were taken off the
 * public site; it comes back as the page that LISTS them, none built yet.
 *
 * IN THE MENU, NOT IN SEARCH YET. The owner asked for it in the header the
 * day it was made ("Resources", site.ts `primaryNav`, and the footer). It
 * stays noindex and out of the sitemap while no calculator is open: a list
 * of calculators that do not exist is not a page to rank for. The day the
 * first one opens: drop `robots` below (and in the Spanish twin) and add
 * '/resources' to sitemap.ts — seo.test.ts then measures its title and
 * description with the rest.
 */
const LANG = 'en' as const;

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
