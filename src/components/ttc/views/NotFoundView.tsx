import React from 'react';
import type { Metadata } from 'next';
import { getContent } from '@/lib/ttc/content';
import { localePath, ogLocale, type Lang } from '@/lib/ttc/i18n';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { ButtonLink, Reveal } from '@/components/ttc/mp/primitives';
import { OG_IMAGE } from '@/components/ttc/views/meta';

/**
 * The public site's 404, in the visitor's language and inside the public
 * chrome.
 *
 * Before it existed, a mistyped or stale public URL fell through to the
 * app's root not-found page — SaaS copy ("…no longer shared with you"), no
 * site header, English on /es, and a single button to /home, which is the
 * staff login. This page instead offers the three places a lost visitor is
 * actually looking for, plus the address to write to. It names no one: the
 * engineer's name belongs to About and Contact only.
 *
 * HOW IT IS SERVED. The normal path is a page that renders this view
 * directly — `(public)/public-not-found` (EN) and `(public)/es/public-not-found`
 * (ES) — reached through a proxy rewrite that carries the 404 status (see
 * `publicNotFoundTarget` in src/proxy.ts). The server completes that render,
 * so the HTML arrives with the header, hero, copy and stylesheet, and paints
 * with JavaScript off.
 *
 * The `not-found.tsx` boundaries (`(public)/` and `(public)/es/`) mount it too,
 * but only as a fallback for a `notFound()` the proxy did not pre-empt. That
 * path is worse: Next 16 answers a `notFound()` thrown during SSR with its
 * error shell — an empty <body> the client fills in after the JS bundle
 * runs — so nothing should rely on it.
 */
export function NotFoundView({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const t = c.ui.notFound;
  const l = (href: string) => localePath(href, lang);

  return (
    <>
      <PageHero eyebrow={t.eyebrow} titleLines={[t.title]} sub={t.sub} />

      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <Reveal className="mp-cta-row">
            <ButtonLink href={l('/')} variant="solid">
              {t.home}
            </ButtonLink>
            <ButtonLink href={l('/services')} variant="line">
              {t.services}
            </ButtonLink>
            <ButtonLink href={l('/contact')} variant="line">
              {t.contact}
            </ButtonLink>
          </Reveal>
          <p className="mp-note">
            {c.ui.form.directEmail} <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a>
          </p>
        </div>
      </section>
    </>
  );
}

/**
 * The 404's <head>, per language. Used by every page that renders
 * NotFoundView AND by both not-found boundaries.
 *
 * Why the boundaries need it too: on a `notFound()` render Next resolves
 * metadata from the layouts plus the boundary module only — never from the
 * page that threw — so without an export there the server HTML carried the
 * bare firm name as its title and the layout's `index, follow` beside the
 * `noindex` Next adds.
 *
 * Why it is complete per language: Next merges metadata SHALLOWLY, and the
 * (public) layout's fallbacks are English — the firm description, `en_US`,
 * the English share card. The Spanish 404 inherited all three. So this sets
 * its own description and a whole `openGraph` (siteName and type included,
 * because the object replaces the layout's). `robots` likewise replaces the
 * layout's object, which also drops its `googleBot: index`.
 *
 * No canonical, no hreflang, no og:url: a 404 is not a page to point at, and
 * without a url a scraper keeps the address it actually fetched.
 */
export function notFoundMetadata(lang: Lang): Metadata {
  const c = getContent(lang);
  return {
    title: c.ui.notFound.metaTitle,
    description: c.company.description,
    robots: { index: false, follow: true },
    openGraph: {
      title: `${c.ui.notFound.metaTitle} · ${c.company.name}`,
      description: c.company.description,
      siteName: c.company.name,
      type: 'website',
      locale: ogLocale[lang],
      images: [OG_IMAGE[lang]],
    },
  };
}
