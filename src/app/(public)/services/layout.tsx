import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Structural engineering services with BIM LOD 300: pre-design and value engineering, post-tensioned concrete design, peer review, clash detection, and digital construction.',
  openGraph: {
    title: 'Services · Tercero Tablada',
    description:
      'Structural engineering services with BIM LOD 300, post-tension design, peer review, and digital construction.',
    type: 'website',
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
