import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { SmoothScroll } from '@/components/ttc/smooth-scroll';
import { OG_IMAGE } from '@/components/ttc/views/meta';
import { company, contact, municipalities, services } from '@/lib/ttc/site';
import './mp.css';

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
   root layout is bare: the app's globals.css (Tailwind + shadcn), Inter and
   the session/query/AI providers and toaster live in SaasShell, used only by
   the SaaS layouts, so none of it ships here. The five legacy sheets
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

export const metadata: Metadata = {
  metadataBase: new URL(company.url),
  title: {
    default: company.name,
    template: `%s · ${company.name}`,
  },
  description: company.description,
  applicationName: company.name,
  authors: [{ name: company.legalName, url: company.url }],
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
   once, in the ROOT layout, so the app host gets the same set. */
export const viewport: Viewport = {
  themeColor: '#0B0C0D',
};

/* ── Structured data ──────────────────────────────────────────────────────
   One Organization + the WebSite. `address` is intentionally omitted until a
   real office address exists — an invented or partial address is worse than
   none. Add it in `site.ts` and it flows through here.

   There is deliberately NO ProfessionalService / LocalBusiness node. Those are
   LocalBusiness subtypes, Google requires `address` on them, and the Rich
   Results Test flagged the old #practice node as an invalid local-business
   item on every page. Re-introduce one (with the address) only when site.ts
   has a real address. What it carried — the offer catalogue, the area
   served — is valid on Organization, so it lives there now, and each service
   page's Service names #organization as its `provider`.

   The engineer is referenced by @id only (the Person node lives on /about),
   so his name never enters the site-wide graph.
   ────────────────────────────────────────────────────────────────────────── */

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${company.url}/#organization`,
      name: company.legalName,
      alternateName: company.shortName,
      url: company.url,
      logo: {
        '@type': 'ImageObject',
        url: `${company.url}${company.logo.dark}`,
        width: company.logo.markSize.w,
        height: company.logo.markSize.h,
      },
      email: contact.email,
      description: company.description,
      founder: { '@id': `${company.url}/about#engineer` },
      employee: { '@id': `${company.url}/about#engineer` },
      // The mailbox is the one real channel (no phone, no address yet), and
      // the practice answers in both languages.
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: contact.email,
        areaServed: 'US-FL',
        availableLanguage: ['English', 'Spanish'],
      },
      // Plain text is valid here. The state is appended because a bare
      // 'Hollywood', 'Plantation' or 'Weston' also names places elsewhere.
      areaServed: [
        'Miami-Dade County, Florida',
        'Broward County, Florida',
        ...municipalities.map((city) => `${city}, FL`),
      ],
      knowsAbout: [
        'Structural Engineering',
        'Reinforced Concrete Design',
        'Structural Analysis',
        'Foundation Design',
        'Building Recertification',
        'Building Safety Inspection',
        'Structural Condition Assessment',
        'Repair Recommendations',
        'BIM Coordination',
        'Structural Peer Review',
        'Engineering Compliance',
      ],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Structural engineering services',
        itemListElement: services.map((s) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            // The same @id the (English) service page gives its own Service
            // node, so the catalogue entry and the page describe ONE thing.
            '@id': `${company.url}/services/${s.slug}#service`,
            name: s.title,
            description: s.summary,
            url: `${company.url}/services/${s.slug}`,
          },
        })),
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${company.url}/#website`,
      url: company.url,
      name: company.name,
      publisher: { '@id': `${company.url}/#organization` },
      inLanguage: ['en-US', 'es-US'],
    },
  ],
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mp ${mpSans.variable} ${mpMono.variable} ${mpSerif.variable}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Motion serialises its `initial` state (opacity: 0) into the server
          HTML. Without JavaScript nothing would ever reveal it, so reset every
          animated element to its final state. */}
      <noscript>
        <style>{`.mp .mp-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <SmoothScroll />
      <SiteChrome>{children}</SiteChrome>
    </div>
  );
}
