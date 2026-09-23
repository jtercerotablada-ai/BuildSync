import { NotFoundView, notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * Spanish public 404 BOUNDARY — a fallback, not the main path.
 *
 * The proxy rewrites every unknown /es/* path to `es/public-not-found`, a page
 * that renders NotFoundView with a 404 status (see src/proxy.ts). This
 * boundary catches only a `notFound()` the proxy did not pre-empt — an unknown
 * /es/services/<slug> or the `[...rest]` catch-all, if the known-route list
 * ever drifted — so a Spanish visitor still gets a Spanish page in the site
 * chrome, not the app's English card.
 *
 * Its metadata export is what the server HTML of a `notFound()` render uses
 * (Next never reads the throwing page's), and it is Spanish end to end:
 * without it the page inherited the (public) layout's English description,
 * `en_US` and English share card.
 */
export const metadata = notFoundMetadata('es');

export default function NotFound() {
  return <NotFoundView lang="es" />;
}
