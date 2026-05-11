import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Tercero Tablada Civil & Structural Engineering Inc. Send project details, drawings, and specifications. Registered P.E. ready to support your residential, commercial, industrial, or public project.',
  openGraph: {
    title: 'Contact · Tercero Tablada',
    description:
      'Contact Tercero Tablada — international structural engineering firm. Send your project for a tailored proposal.',
    type: 'website',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
