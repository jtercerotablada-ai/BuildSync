import { NotFoundView, notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * The Spanish public 404 — the twin of `(public)/public-not-found`, internal
 * and never linked. The proxy rewrites every /es/* path that is not a known
 * Spanish page here with status 404 (see `publicNotFoundTarget` in
 * src/proxy.ts), on every host: /es/contacto, /es/services/nope, and the
 * English-only pages that have no Spanish twin (/es/credits, /es/logo-styles).
 *
 * Rendered by the server, not thrown — see the English page for why. Its
 * <head> is Spanish end to end (title, description, og:locale es_US and the
 * Spanish share card); the (public) layout's fallbacks are English.
 */
export const metadata = notFoundMetadata('es');

/* Per request, for the same reason as the English page: the chrome must be
   built for the address the visitor typed, not for this internal route. */
export const dynamic = 'force-dynamic';

export default function Page() {
  return <NotFoundView lang="es" />;
}
