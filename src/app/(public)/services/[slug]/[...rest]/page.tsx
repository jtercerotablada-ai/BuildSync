import { notFound } from 'next/navigation';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * FALLBACK ONLY — the English twin of `es/[...rest]`, for /services/<slug>/<x>.
 *
 * The proxy rewrites these to `public-not-found` with a 404 before routing
 * (see `publicNotFoundTarget` in src/proxy.ts). If that rule is ever
 * bypassed, this catch-all still 404s them into the PUBLIC boundary
 * (`(public)/not-found.tsx`), not the app's root not-found, whose only button
 * leads to the staff login. There is no `[slug]/not-found.tsx`, so the
 * (public) one catches it.
 *
 * It sits UNDER [slug] because Next rejects a sibling catch-all beside a
 * dynamic segment ("different slug names for the same dynamic path"). The
 * real /services/<slug> page is static and still wins.
 */
export const metadata = notFoundMetadata('en');

export default function Page() {
  notFound();
}
