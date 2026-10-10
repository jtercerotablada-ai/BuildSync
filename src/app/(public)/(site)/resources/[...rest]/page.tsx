import { notFound } from 'next/navigation';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * FALLBACK ONLY, for /resources/<anything that is not an open calculator>.
 *
 * /resources itself is the calculators catalogue (resources/page.tsx), and
 * each calculator that is open has its own folder beside this one
 * (resources/beam). Everything else under /resources has no page — the
 * addresses the retired calculators had (/resources/steel-member,
 * /resources/load-gen …) were public and may still be bookmarked or indexed.
 *
 * The proxy rewrites every such path to `public-not-found` with a 404
 * before routing (see `publicNotFoundTarget` in src/proxy.ts). If that
 * rule is ever bypassed, this catch-all still 404s them into the public
 * boundary instead of the app's root not-found, whose only button leads to
 * the staff login.
 *
 * It used to be an OPTIONAL catch-all, which also matched the bare
 * /resources; Next refuses a page.tsx beside one of those at the same level.
 *
 * WHEN A CALCULATOR IS BUILT: give it its own folder here (a static segment
 * wins over this catch-all) and add its path to calculator-paths.ts, which
 * the proxy reads — proxy.test.ts diffs its known pages against the (public)
 * page files and fails until you do.
 */
export const metadata = notFoundMetadata('en');

export default function Page() {
  notFound();
}
