import type { Metadata } from 'next';
import { Playfair_Display, Inter, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import { LanguageProvider } from '@/components/ttc/language-provider';
import { V2Chrome } from '@/components/ttc/v2/V2Chrome';
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

// v2 editorial type system — display + technical mono
const v2display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--v2-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const v2mono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--v2-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC.',
    template: '%s · Tercero Tablada',
  },
  description:
    'TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. — Structural engineering firm led by a Registered P.E. Reinforced-concrete building design (ACI 318 / Florida Building Code), full structural analysis, BIM coordination, 40-Year & milestone recertification, building-safety inspection and independent peer review. Permit-ready, P.E.-stamped across Miami-Dade & Broward.',
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
  logo: 'https://ttcivilstructural.com/ttc/img/logo-square.png',
  email: 'info@tercerotablada.com',
  description:
    'Structural engineering firm led by a Registered P.E. Reinforced-concrete building design (ACI 318 / Florida Building Code) — foundations, columns, beams, slabs and shear walls — plus full structural analysis, BIM coordination, 40-Year and milestone recertification, building-safety inspection and independent structural peer review. Delivered permit-ready and P.E.-stamped across Miami-Dade & Broward.',
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
    'Structural Analysis',
    'ASCE 7 Wind and Seismic Loads',
    'BIM Coordination',
    'ISO 19650',
    'Building Recertification',
    '40-Year Recertification',
    'Building-Safety Inspection',
    'Structural Peer Review',
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
    'Structural Design & Analysis',
    'BIM / Digital Construction',
    'Building Recertification',
    'Building-Safety Inspection',
    'Structural Peer Review',
  ],
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`v2 ${playfair.variable} ${inter.variable} ${v2display.variable} ${v2mono.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <LanguageProvider>
        <SmoothScroll />
        <V2Chrome>{children}</V2Chrome>
      </LanguageProvider>
    </div>
  );
}
