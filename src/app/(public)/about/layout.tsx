import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'About Tercero Tablada Civil & Structural Engineering Inc. — an international structural engineering firm. Registered P.E. delivering tailored solutions for residential, commercial, industrial, and public projects.',
  openGraph: {
    title: 'About Us · Tercero Tablada',
    description:
      'International structural engineering firm. Registered P.E. Tailored solutions across residential, commercial, industrial, and public works.',
    type: 'website',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
