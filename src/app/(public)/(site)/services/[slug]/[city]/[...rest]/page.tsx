import { notFound } from 'next/navigation';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * FALLBACK ONLY — the English twin of `es/[...rest]`, for
 * /services/<slug>/<city>/<x> and anything deeper.
 *
 * The proxy rewrites these to `public-not-found` with a 404 before routing
 * (see `publicNotFoundTarget` in src/proxy.ts). If that rule is ever
 * bypassed, this catch-all still 404s them into the PUBLIC boundary
 * (`(public)/(site)/not-found.tsx`), not the app's root not-found, whose only button
 * leads to the staff login. There is no not-found.tsx under services, so the
 * (public) one catches it.
 *
 * It sits UNDER [city] because Next rejects a sibling catch-all beside a
 * dynamic segment ("different slug names for the same dynamic path"); it
 * used to sit under [slug], where the city pages are now. An unknown
 * /services/<slug>/<x> is answered by [city]/page.tsx, which 404s the same
 * way.
 */
export const metadata = notFoundMetadata('en');

export default function Page() {
  notFound();
}
