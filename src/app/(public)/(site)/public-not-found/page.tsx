import { NotFoundView, notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * The English public 404 — internal, never linked, never in the sitemap.
 *
 * The proxy REWRITES every unknown public path here with status 404 (see
 * `publicNotFoundTarget` and the host split in src/proxy.ts): a typo under a
 * marketing prefix (/services/nope, /services/<slug>/x, /resources/*) on any
 * host, and — with the host split on — any path on the public host that is
 * neither marketing nor an app entry point. The address bar keeps what the
 * visitor typed. A direct request for /public-not-found gets the same 404.
 *
 * It RENDERS the view instead of calling notFound(). A thrown notFound() is
 * answered by Next's error shell (empty <body>, built on the client after the
 * JS bundle runs); this page is a normal render the server completes, so the
 * header, hero and copy are in the HTML. The 404 status comes from the
 * rewrite, which is why this page must never be reachable without it.
 */
export const metadata = notFoundMetadata('en');

/* Rendered per request, not prerendered. The site chrome reads the pathname
   (the language switch, the active nav item), and a request rewritten here
   still carries the visitor's own address as its canonical URL — so a
   per-request render builds the header for /services/nope, exactly as the
   browser will hydrate it. A build-time copy would carry /public-not-found's
   links instead (its language switch pointing at the internal Spanish 404)
   and disagree with the client. A 404 is cheap to render; being right about
   the address is worth that. */
export const dynamic = 'force-dynamic';

export default function Page() {
  return <NotFoundView lang="en" />;
}
