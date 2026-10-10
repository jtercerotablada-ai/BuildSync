import { notFound } from 'next/navigation';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * FALLBACK ONLY, for /resources/<anything>.
 *
 * /resources itself is a page again — the calculators catalogue
 * (resources/page.tsx). No calculator has an address of its own yet, and the
 * addresses the retired ones had (/resources/steel-member, /resources/load-gen
 * …) were public and may still be bookmarked or indexed.
 *
 * The proxy rewrites every path under /resources/ to `public-not-found` with
 * a 404 before routing (see `publicNotFoundTarget` in src/proxy.ts). If that
 * rule is ever bypassed, this catch-all still 404s them into the public
 * boundary instead of the app's root not-found, whose only button leads to
 * the staff login.
 *
 * It used to be an OPTIONAL catch-all, which also matched the bare
 * /resources; Next refuses a page.tsx beside one of those at the same level.
 *
 * WHEN A CALCULATOR IS BUILT: give it its own folder here (a static segment
 * wins over this catch-all) and add its path to the proxy's known public
 * routes — proxy.test.ts diffs that list against the (public) page files and
 * fails until you do.
 */
export const metadata = notFoundMetadata('en');

export default function Page() {
  notFound();
}
