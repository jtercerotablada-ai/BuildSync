import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { LanguageProvider } from '@/components/ttc/language-provider';
import { TTCHeader } from '@/components/ttc/ttc-header';
import { TTCFooter } from '@/components/ttc/ttc-footer';
import { FxElements } from '@/components/ttc/fx-elements';
import 'leaflet/dist/leaflet.css';
import './ttc-globals.css';

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
    'TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. — International structural engineering firm. Registered P.E. Residential, commercial, industrial, and public works.',
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
  logo: 'https://ttcivilstructural.com/ttc/img/logo-horizontal-wide.png',
  email: 'info@tercerotablada.com',
  description:
    'International structural engineering firm. Registered P.E. Specializes in residential, vertical, commercial, industrial, and public works projects with BIM LOD 300 and post-tensioned concrete.',
  knowsAbout: [
    'Structural Engineering',
    'BIM LOD 300',
    'Post-Tensioned Concrete',
    'Reinforced Concrete',
    'Steel Structures',
    'Wood Framing',
    'Masonry',
    'Clash Detection',
    'Value Engineering',
    'Digital Construction',
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
        <FxElements />
        <TTCHeader />
        <main>{children}</main>
        <TTCFooter />
      </LanguageProvider>
    </div>
  );
}
