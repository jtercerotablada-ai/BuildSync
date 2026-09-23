import { NotFoundView, notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * English public 404 BOUNDARY — a fallback, not the main path.
 *
 * Unknown public paths never get here in normal operation: the proxy
 * rewrites them to `public-not-found`, a page that renders NotFoundView with
 * a 404 status (see src/proxy.ts). This boundary catches only a `notFound()`
 * the proxy did not pre-empt — an unknown /services/<slug> if the known-route
 * list ever drifted, or the `services/[slug]/[...rest]` and `resources`
 * catch-alls — and keeps it inside the public chrome rather than the app's
 * root not-found. The app host keeps `src/app/not-found.tsx`.
 *
 * The metadata export is not decoration: on a `notFound()` render Next takes
 * the server HTML's <head> from the layouts plus THIS module, never from the
 * page that threw. Without it that HTML carried the bare firm name as its
 * title and the layout's `index, follow` next to Next's own `noindex`.
 */
export const metadata = notFoundMetadata('en');

export default function NotFound() {
  return <NotFoundView lang="en" />;
}
