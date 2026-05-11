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
  title: 'TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC.',
  description:
    'TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. — International structural engineering firm. Registered P.E. Residential, commercial, industrial, and public works.',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${playfair.variable} ${inter.variable}`}>
      <LanguageProvider>
        <FxElements />
        <TTCHeader />
        <main>{children}</main>
        <TTCFooter />
      </LanguageProvider>
    </div>
  );
}
