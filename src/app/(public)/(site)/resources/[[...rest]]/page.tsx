import { notFound } from 'next/navigation';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * FALLBACK ONLY, for the retired calculator URLs (/resources and
 * /resources/*). The calculators were removed from the public site, but their
 * old addresses were public and may still be bookmarked or indexed.
 *
 * The proxy rewrites them to `public-not-found` with a 404 before routing
 * (see `publicNotFoundTarget` in src/proxy.ts). If that rule is ever bypassed,
 * this optional catch-all — which also matches the bare /resources — still
 * 404s them into the public boundary instead of the app's root not-found,
 * whose only button leads to the staff login.
 *
 * IF THE CALCULATORS COME BACK: delete this file (Next refuses a
 * resources/page.tsx beside an optional catch-all at the same level) and add
 * their paths to the proxy's known public routes — proxy.test.ts diffs that
 * list against the (public) page files and fails until you do.
 */
export const metadata = notFoundMetadata('en');

export default function Page() {
  notFound();
}
