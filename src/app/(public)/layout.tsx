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
    'TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. — Structural engineering firm. Reinforced-concrete building design (ACI 318 / Florida Building Code) — foundations, columns, beams, slabs and shear walls. Permit-ready, stamped by a Registered P.E.',
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
    'Structural engineering firm. Registered P.E. Specializes in the structural design of reinforced-concrete buildings (ACI 318 / Florida Building Code) — foundations, columns, beams, slabs and shear walls, delivered permit-ready and P.E.-stamped.',
  knowsAbout: [
    'Reinforced Concrete Design',
    'Structural Engineering',
    'ACI 318',
    'Florida Building Code',
    'Structural Design',
    'Foundations',
    'Columns and Beams',
    'Concrete Slabs',
    'Shear Walls',
  ],
  areaServed: [
    'Miami-Dade County, Florida',
    'Broward County, Florida',
    'Miami', 'Miami Beach', 'Coral Gables', 'Hialeah', 'Miami Springs',
    'North Miami', 'North Miami Beach', 'Opa-locka', 'South Miami',
    'Homestead', 'Miami Shores', 'Bal Harbour', 'Bay Harbor Islands',
    'Surfside', 'West Miami', 'Florida City', 'Biscayne Park', 'El Portal',
    'Golden Beach', 'Pinecrest', 'Indian Creek', 'Medley', 'North Bay Village',
    'Key Biscayne', 'Sweetwater', 'Virginia Gardens', 'Hialeah Gardens',
    'Aventura', 'Sunny Isles Beach', 'Miami Lakes', 'Palmetto Bay',
    'Miami Gardens', 'Doral', 'Cutler Bay',
    'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar', 'Coral Springs',
    'Pompano Beach', 'Davie', 'Sunrise', 'Plantation', 'Deerfield Beach',
    'Lauderhill', 'Weston', 'Tamarac', 'Margate', 'Coconut Creek',
    'Oakland Park', 'North Lauderdale', 'Hallandale Beach', 'Dania Beach', 'Cooper City',
    'Parkland', 'Lauderdale Lakes', 'Wilton Manors', 'West Park', 'Southwest Ranches',
    'Pembroke Park', 'Lauderdale-by-the-Sea', 'Lighthouse Point', 'Hillsboro Beach',
    'Sea Ranch Lakes', 'Lazy Lake',
  ],
  serviceType: [
    'Reinforced Concrete Design',
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
