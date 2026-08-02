import type { Metadata } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { SmoothScroll } from '@/components/ttc/smooth-scroll';
import { company, contact, municipalities, services } from '@/lib/ttc/site';
import './mp.css';

/* ── Type system ──────────────────────────────────────────────────────────
   Two families, per the brand rule: the Geist superfamily carries everything
   structural (sans for reading, mono for technical labels, numerals and
   section indices), and Instrument Serif appears only as an italic accent on
   single words.

   mp.css is the ONLY stylesheet the public site loads. The five legacy
   sheets (ttc-globals, ttc-pop, ttc-refresh-2026, ttc-fx-pro,
   ttc-sections-pro — ~12,000 lines between them) and the Leaflet CSS served
   the retired chrome and are no longer referenced by any public page, so
   they no longer ship. Same for LanguageProvider: nothing under (public)
   consumes useTranslation any more.
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
  style: ['normal', 'italic'],
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
  openGraph: {
    siteName: company.name,
    type: 'website',
    locale: 'en_US',
    url: company.url,
  },
  twitter: {
    card: 'summary_large_image',
    title: company.name,
    description: company.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  formatDetection: { telephone: false },
};

/* ── Structured data ──────────────────────────────────────────────────────
   Organization + ProfessionalService + WebSite. `address` is intentionally
   omitted until a real office address exists — an invented or partial address
   is worse than none. Add it in `site.ts` and it flows through here.
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
      logo: `${company.url}${company.logo.dark}`,
      email: contact.email,
      description: company.description,
      areaServed: [
        'Miami-Dade County, Florida',
        'Broward County, Florida',
        ...municipalities,
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
    },
    {
      '@type': 'ProfessionalService',
      '@id': `${company.url}/#practice`,
      name: company.legalName,
      url: company.url,
      image: `${company.url}${company.logo.dark}`,
      email: contact.email,
      description: company.description,
      parentOrganization: { '@id': `${company.url}/#organization` },
      areaServed: [
        { '@type': 'AdministrativeArea', name: 'Miami-Dade County, Florida' },
        { '@type': 'AdministrativeArea', name: 'Broward County, Florida' },
      ],
      serviceType: services.map((s) => s.title),
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Structural engineering services',
        itemListElement: services.map((s) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
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
      inLanguage: 'en-US',
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
