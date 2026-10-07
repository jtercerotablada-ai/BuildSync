import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { SiteGraph } from '@/components/ttc/mp/SiteGraph';
import { SmoothScroll } from '@/components/ttc/smooth-scroll';
import { OG_IMAGE, brandedTitle } from '@/components/ttc/views/meta';
import { absoluteUrl, company } from '@/lib/ttc/site';
import '@/app/(public)/mp.css';

/* ── The public site's shell ──────────────────────────────────────────────
   Fonts, the stylesheet, structured data, smooth scroll and the chrome — and
   the metadata and viewport that go with them — for BOTH public sites. The
   English and the Spanish site are separate route groups, each with its own
   root layout, for one reason only: so each can print its own <html lang>
   (see src/app/(public-es)/layout.tsx). Everything else about them is this
   file, mounted by the two (site)/layout.tsx files, so the two cannot drift.
   ────────────────────────────────────────────────────────────────────────── */

/* ── Type system ──────────────────────────────────────────────────────────
   Two families, per the brand rule: the Geist superfamily carries everything
   structural (sans for reading, mono for technical labels, numerals and
   section indices), and Instrument Serif appears only as an italic accent on
   single words.

   Hence the serif loads its ITALIC face only. Every rule in mp.css that uses
   it (.mp-serif, the engineer quote) sets font-style: italic, so the upright
   file was a 15 KB high-priority preload that no glyph ever used. Should an
   upright serif ever be wanted, add 'normal' back here first.

   mp.css is the only stylesheet the public site loads, reset included. The
   public root layouts are bare: the app's globals.css (Tailwind + shadcn),
   Inter and the session/query/AI providers and toaster live in SaasShell,
   used only by the SaaS layouts, so none of it ships here. The five legacy sheets
   (ttc-globals, ttc-pop, ttc-refresh-2026, ttc-fx-pro, ttc-sections-pro —
   ~12,000 lines between them) and the Leaflet CSS served the retired chrome
   and are no longer referenced by any public page, so they no longer ship.
   Same for LanguageProvider: nothing under (public) consumes useTranslation
   any more.
   ────────────────────────────────────────────────────────────────────────── */

const mpSans = Geist({
  subsets: ['latin'],
  variable: '--mp-font-sans',
  display: 'swap',
});

const mpMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--mp-font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

const mpSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--mp-font-serif',
  weight: ['400'],
  style: ['italic'],
  display: 'swap',
});

export const publicMetadata: Metadata = {
  metadataBase: new URL(company.url),
  /* The template appends the SHORT name: the full one is 469 px of the 580 a
     search result shows, so it pushed every page's own words out of sight.
     It serves only the routes that do not go through pageMeta (/credits, the
     404s) — pageMeta sets its titles whole. `default` is a page with no
     title at all, and is the one title that is the full name. */
  title: {
    default: company.name,
    template: brandedTitle('%s'),
  },
  description: company.description,
  applicationName: company.name,
  /* The home page's address as it is served, with its slash: Next prints an
     author's url as written, and the bare origin is a redirect. pageMeta sets
     the same line; this one serves /credits and the 404s. */
  authors: [{ name: company.legalName, url: absoluteUrl('/') }],
  /* The FALLBACK card, for the few routes that do not go through pageMeta
     (/credits, the 404s). Pages that do replace this object wholesale — Next
     merges metadata shallowly — which is why pageMeta carries its own
     siteName and image too.
     No `url` here on purpose: a fallback url is the home page's, and /credits
     used to announce itself as https://ttcivilstructural.com. Without one a
     scraper keeps the URL it actually fetched. */
  openGraph: {
    siteName: company.name,
    type: 'website',
    locale: 'en_US',
    images: [OG_IMAGE.en],
  },
  /* Only the card type. With no title/description/images of its own, Next
     fills twitter:* from each page's localized openGraph, so /es pages get a
     Spanish X card. Hard-coding title and description here froze every page,
     /es included, to the English firm description. */
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  formatDetection: { telephone: false },
};

/* Mobile browser chrome in graphite: the colour of the hero the header sits
   on at the top of every page, and of the open menu. The icons are declared
   by the root layouts (components/layout/site-icons.ts), so the app host
   gets the same set. */
export const publicViewport: Viewport = {
  themeColor: '#0B0C0D',
};

/* ── Structured data ──────────────────────────────────────────────────────
   One Organization + the WebSite, emitted by <SiteGraph /> below and built in
   src/lib/ttc/structured-data.ts — read the comment there for what the graph
   carries and what it deliberately leaves out (no address, no LocalBusiness
   node, no Person node).

   It is a component, not a constant in this file, because this shell serves
   /about and /es/about alike and cannot know which: the graph was English on
   every Spanish page. SiteGraph reads the language from the URL.
   ────────────────────────────────────────────────────────────────────────── */

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`mp ${mpSans.variable} ${mpMono.variable} ${mpSerif.variable}`}
    >
      <SiteGraph />
      {/* Backstop. The scroll reveals no longer write a hidden state into the
          server HTML (primitives.tsx, reveal.ts), so without JavaScript there
          is nothing to undo today. This stays for the day a Motion `initial`
          (which IS serialised, as opacity: 0) lands on an .mp-reveal element
          again: without JavaScript nothing would ever lift it. */}
      <noscript>
        <style>{`.mp .mp-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <SmoothScroll />
      <SiteChrome>{children}</SiteChrome>
    </div>
  );
}
