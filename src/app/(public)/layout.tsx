import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { LanguageProvider } from '@/components/ttc/language-provider';
import { TTCHeader } from '@/components/ttc/ttc-header';
import { TTCFooter } from '@/components/ttc/ttc-footer';
import { FxElements } from '@/components/ttc/fx-elements';
import { SmoothScroll } from '@/components/ttc/smooth-scroll';
import 'leaflet/dist/leaflet.css';
import './ttc-globals.css';
import './ttc-fx-pro.css';
import './ttc-sections-pro.css';
import './ttc-pop.css';
import './ttc-refresh-2026.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: {
    default: 'TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC.',
    template: '%s · Tercero Tablada',
  },
  description:
    'TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. — Structural safety engineering firm. 40-year building recertification, milestone / building safety inspection (Florida SB-4-D), and reinforced-concrete restoration. Registered P.E.',
  metadataBase: new URL('https://ttcivilstructural.com'),
  openGraph: {
    siteName: 'Tercero Tablada',
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['es_ES'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Tercero Tablada Civil & Structural Engineering Inc.',
  alternateName: 'Tercero Tablada',
  url: 'https://ttcivilstructural.com',
  logo: 'https://ttcivilstructural.com/ttc/img/logo-white.png',
  email: 'info@tercerotablada.com',
  description:
    'Structural safety engineering firm. Registered P.E. Specializes in 40-year building recertification (Miami-Dade & Broward), milestone / building safety inspections under Florida SB-4-D, and reinforced-concrete restoration.',
  knowsAbout: [
    'Building Recertification',
    '40-Year Recertification',
    'Milestone Inspection',
    'Building Safety Inspection',
    'Florida SB-4-D',
    'Reinforced Concrete Restoration',
    'Concrete Repair',
    'Structural Strengthening',
    'Structural Engineering',
    'Structural Integrity Reserve Study',
  ],
  areaServed: 'Florida, United States',
  serviceType: [
    '40-Year Building Recertification',
    'Milestone Inspection',
    'Reinforced Concrete Restoration',
  ],
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${playfair.variable} ${inter.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <LanguageProvider>
        <SmoothScroll />
        <FxElements />
        <TTCHeader />
        <main>{children}</main>
        <TTCFooter />
      </LanguageProvider>
    </div>
  );
}
