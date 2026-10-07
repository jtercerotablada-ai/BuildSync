import { notFound } from 'next/navigation';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * FALLBACK ONLY. The proxy rewrites every unknown /es/* path to
 * `es/public-not-found` with a 404 before routing, so this catch-all is
 * reached only if that rule is ever bypassed (a matcher change, a known-route
 * list that drifted). It then 404s into the Spanish boundary
 * (`es/not-found.tsx`) instead of the app's English card — correct status and
 * copy, but through Next's client-built error shell, which is why it is not
 * the primary path.
 *
 * Static and dynamic /es routes always win over a catch-all, so this can never
 * shadow a real page. It is scoped to /es on purpose: a top-level catch-all
 * would also swallow mistyped APP URLs and show signed-in staff the marketing
 * 404.
 *
 * The metadata serves the client after hydration; the server HTML of a
 * notFound() render takes its <head> from the boundary's own export.
 */
export const metadata = notFoundMetadata('es');

export default function Page() {
  notFound();
}
