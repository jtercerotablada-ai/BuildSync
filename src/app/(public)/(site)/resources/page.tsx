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
 * NOT TO BE FOUND YET: noindex, absent from the sitemap, and linked from no
 * page. A list of calculators that do not exist is not a page to rank for,
 * and the site's visitors are building owners, not engineers looking for a
 * tool. The day the first calculator opens: drop `robots` below (and in the
 * Spanish twin), add '/resources' to sitemap.ts, and link the page from the
 * footer — seo.test.ts then measures its title and description with the
 * rest.
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
