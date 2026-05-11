import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Engineering Resources',
  description:
    'Free structural engineering calculators and tools by Tercero Tablada: advanced beam analysis, retaining walls, load generation (ASCE 7-22 Wind), section builders, and a library of quick-design utilities. All in your browser, no signup.',
  openGraph: {
    title: 'Engineering Resources · Tercero Tablada',
    description:
      'Free in-browser structural engineering calculators — beam, retaining wall, load gen, section builder, and more.',
    type: 'website',
  },
};

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
