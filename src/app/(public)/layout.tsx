import type { Metadata } from 'next';
import { Playfair_Display } from 'next/font/google';
import { LanguageProvider } from '@/components/ttc/language-provider';
import { TTCHeader } from '@/components/ttc/ttc-header';
import { TTCFooter } from '@/components/ttc/ttc-footer';
import './ttc-globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tercero Tablada | Civil & Structural Engineering',
  description:
    'Tercero Tablada Civil & Structural Engineering Inc. International structural engineering firm. Registered P.E., S.E. Residential, commercial, industrial, and public works.',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={playfair.variable}
      style={{
        fontFamily: 'var(--font-inter, Inter), sans-serif',
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        minHeight: '100vh',
      }}
    >
      <LanguageProvider>
        <TTCHeader />
        <main>{children}</main>
        <TTCFooter />
      </LanguageProvider>
    </div>
  );
}
