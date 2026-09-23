import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { company } from '@/lib/ttc/site';

/**
 * One robots.txt per HOST. Both hosts ask for /robots.txt and the proxy
 * serves it in place (it is host-neutral), so the answer is decided here.
 *
 * APP HOST — crawlable, on purpose, with no sitemap. Every response there
 * carries `X-Robots-Tag: noindex, nofollow` (next.config.ts headers()), and
 * that header is what actually removes /login and /register from results. A
 * crawler blocked by `Disallow: /` would never fetch a page, never see the
 * header, and could keep an already-known URL indexed as a bare link. Tighten
 * this to `Disallow: /` only once Search Console shows no app URL indexed.
 *
 * PUBLIC HOST — the marketing site, with the sitemap. App paths that reach the
 * apex are 307'd to the app host by the proxy; disallowing them here just
 * keeps crawlers from spending requests on those hops. No `Host:` line — only
 * Yandex ever read it, and it wants a bare hostname, not a URL.
 *
 * Reading the Host header makes this route dynamic, which is fine: it is a
 * tiny response and the header has to be read per request anyway.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const appHost = (process.env.APP_HOST ?? '').trim().toLowerCase();
  const host = ((await headers()).get('host') ?? '').toLowerCase().split(':')[0];

  if (appHost && host === appHost) {
    return {
      rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
          '/onboarding',
          '/invite/',
          '/home',
          '/dashboard',
          '/my-tasks',
          '/inbox',
          '/portfolios',
          '/goals',
          '/reporting',
          '/settings',
          '/teams',
          '/workspace',
          '/knowledge',
          '/client',
          '/portal',
          // Client share links. The token is the credential, so these must
          // never be crawled into an index.
          '/p/',
          '/admin',
          '/logo-styles',
        ],
      },
    ],
    sitemap: `${company.url}/sitemap.xml`,
  };
}
