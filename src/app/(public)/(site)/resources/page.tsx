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
 * In the menu since the day it was made ("Resources", site.ts
 * `primaryNav`, and the footer), at the owner's request. It was noindex
 * and out of the sitemap while it listed only calculators that did not
 * exist; the first one opened on October 10, 2026 (/resources/beam), and
 * with it the page is in the sitemap and seo.test.ts measures its title and
 * description with the rest.
 */
const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, '/resources', {
  title: calculatorsPage[LANG].title,
  description: calculatorsPage[LANG].description,
});

export default function Page() {
  return <CalculatorsView lang={LANG} />;
}
